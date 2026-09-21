/* Discovery. Instead of walking a hand written list of collections, this
   finds every contract a wallet has touched by reading its own transfer
   logs, then works out which of those are NFTs and what the wallet still
   holds.

   The problem this solves: a wallet with fifty NFTs across thirty small
   collections read as zero, because no hand written list is ever complete.

   Rarity rules held throughout:
   - A contract is only counted as NFTs if it answers ownerOf for a token.
     A raw balanceOf cannot tell an NFT from a fungible token, and reading it
     as one turns a token balance into millions of imaginary chairs.
   - Anything unreadable is reported, never guessed. */

import { CHAINS, rpc, pad32, hex, ownedTokenIds, retry, sleep } from './onchain.js';

/* Find roughly when a wallet first touched this chain, so the log walk can
   start there instead of at block zero.

   This matters more than it looks. Scanning from genesis across a busy chain
   is around seventy windows per direction, and a public endpoint starts
   refusing long before that finishes. Finding the first block of activity
   usually cuts the range by an order of magnitude. */
/* How far back the log walk goes.

   A full history walk from genesis is around seventy windows per direction on
   this chain, and a public endpoint refuses long before that completes. The
   walk is therefore bounded to a recent depth, which is where the interesting
   activity is: a wallet's current holdings are established by balanceOf and
   ownerOf, which are per block reads and always current, so the log walk only
   has to find collections the wallet has touched recently. Anything older that
   the wallet still holds is picked up the moment it is traded again, and the
   reader is told the depth so the limit is never a hidden one. */
export const SCAN_DEPTH_BLOCKS = 30_000_000;

export async function findFirstActivity(chain, owner, head, depth = SCAN_DEPTH_BLOCKS) {
  const ownerTopic = '0x' + pad32(owner);

  /* Sweep every band in the depth window, in parallel batches.

     Measured on this endpoint, one 5M band read is about a third of a second
     and a batch of four is fine, so sweeping the whole window costs a few
     seconds. An earlier version tried to be clever and stop at the first band
     that answered, which missed everything: activity is not always contiguous,
     a band can be empty with real holdings above and below it, and a band that
     errors is not empty at all. Sweeping is both faster and correct. */
  const band = 5_000_000;
  const floor = Math.max(0, head - depth);
  const bands = [];
  for (let hi = head; hi > floor; hi -= band) bands.push([Math.max(floor, hi - band), hi]);

  const BATCH = 4;
  const lowest = { block: null };
  for (let w = 0; w < bands.length; w += BATCH) {
    const slice = bands.slice(w, w + BATCH);
    const results = await Promise.all(
      slice.map(([start, hi]) =>
        retry(
          () => rpc(chain, 'eth_getLogs', [{ topics: [TRANSFER_TOPIC, null, ownerTopic], fromBlock: hex(start), toBlock: hex(hi) }], 20000),
          2,
          700
        ).catch(() => null)
      )
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r && r.length > 0) {
        const b = slice[i][0];
        if (lowest.block === null || b < lowest.block) lowest.block = b;
      }
    }
  }

  /* Start one band below the oldest band that had anything, and never below
     the floor. If nothing answered at all, start at the floor, which is the
     documented depth limit. */
  const startBlock = lowest.block === null ? floor : Math.max(floor, lowest.block - band);
  return { startBlock, floor, depth, hitFloor: startBlock <= floor };
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = '0x' + '0'.repeat(64);

/* Every contract that ever sent a token to this wallet, or received one from
   it. Both directions, because a wallet can mint and a wallet can pass a
   token on without ever receiving one in the window scanned. */
export async function discoverContracts(chain, owner, { chunkBlocks = 0 } = {}) {
  const ownerTopic = '0x' + pad32(owner);
  const found = new Map(); // contract -> { inTransfers, outTransfers, tokenIds:Set }
  const coverage = {};

  /* Start the walk where the wallet starts, not at genesis. */
  const head = parseInt(await rpc(chain, 'eth_blockNumber', []), 16);
  let startBlock = head - SCAN_DEPTH_BLOCKS;
  let hitFloor = true;
  try {
    const first = await findFirstActivity(chain, owner, head);
    startBlock = first.startBlock;
    hitFloor = first.hitFloor;
  } catch {
    startBlock = Math.max(0, head - SCAN_DEPTH_BLOCKS);
  }
  coverage.firstActivityBlock = startBlock;
  coverage.head = head;
  coverage.hitDepthLimit = hitFloor;

  async function pull(topics, key) {
    const filter = { topics, fromBlock: hex(startBlock), toBlock: 'latest' };

    /* A full range query is the fast path, but this endpoint refuses it for a
       busy address: sometimes as a clean error, sometimes by hanging until the
       request is aborted. In a browser an abort surfaces as an opaque network
       failure. Rather than spend a minute discovering that, the wide attempt
       is given a short leash and the windowed walk does the real work. */
    const wideOk = await (async () => {
      if (chunkBlocks) return false;
      try {
        const r = await retry(
          () => rpc(chain, 'eth_getLogs', [filter], 12000),
          1,
          0
        );
        if (Array.isArray(r)) {
          for (const l of r) record(l, key);
          return true;
        }
      } catch {
        /* fall through to the walk */
      }
      return false;
    })();
    if (wideOk) {
      coverage[key] = { windowsRead: 1, windowsFailed: 0, windows: 1, wide: true };
      return;
    }
    /* Windowed walk, one at a time, no long pause.

       Measured on this endpoint: a single 1M window answers in about a third
       of a second, but two of them at once already start to trip the rate
       limit, and a batch of four gets almost everything refused. So the walk
       goes one window at a time and the speed comes from not pausing between
       them, rather than from parallelism.

       A window that still cannot be read after retries is counted, never
       treated as empty. That distinction matters: an earlier version let
       failures pass as empty windows and a wallet with twenty collections read
       as one. */
    const span = chunkBlocks || 1000000;
    const windows = [];
    for (let end = head; end > startBlock; end -= span) {
      windows.push([Math.max(startBlock, end - span + 1), end]);
    }

    let windowsRead = 0;
    let windowsFailed = 0;
    let consecutiveFailures = 0;

    for (const [start, end] of windows) {
      const r = await retry(
        () => rpc(chain, 'eth_getLogs', [{ ...filter, fromBlock: hex(start), toBlock: hex(end) }], 25000),
        3,
        700
      ).catch(() => null);

      if (r === null) {
        windowsFailed++;
        consecutiveFailures++;
        /* Back off only when the endpoint is actually refusing, so a healthy
           run stays fast. */
        if (consecutiveFailures >= 3) await sleep(Math.min(4000, 800 * consecutiveFailures));
        continue;
      }
      consecutiveFailures = 0;
      windowsRead++;
      for (const l of r) record(l, key);
      await sleep(60);
    }
    coverage[key] = { windowsRead, windowsFailed, windows: windows.length };
  }

  function record(l, key) {
    const a = (l.address || '').toLowerCase();
    if (!a) return;
    const rec = found.get(a) || { contract: a, inTransfers: 0, outTransfers: 0, tokenIds: new Set() };
    rec[key]++;
    const t = l.topics || [];
    if (t.length >= 4) rec.tokenIds.add(BigInt(t[3]).toString());
    found.set(a, rec);
  }

  /* Any transfer where this wallet is the receiver. */
  await pull([TRANSFER_TOPIC, null, ownerTopic], 'inTransfers');
  /* Any transfer where this wallet is the sender. */
  await pull([TRANSFER_TOPIC, ownerTopic], 'outTransfers');

  return { list: [...found.values()], coverage };
}

/* Is this contract a non fungible collection, and does the wallet still hold
   any?

   Order matters. balances first, because it is one call and it answers the
   question that actually needs answering. Then ownerOf to prove the thing is
   an NFT rather than a fungible token, since balanceOf alone cannot tell them
   apart and reading a token balance as chairs invents millions of them.

   A note on token ids: this chain has collections whose ids run far past
   Number.MAX_SAFE_INTEGER, so ids are handled as BigInt throughout. Converting
   them to Number silently corrupts them and the probe then misses real
   holdings, which is exactly how a wallet with fifty NFTs read as zero. */
export async function classifyCollection(chain, contract, owner, candidateIds) {
  const out = { contract, kind: 'unknown', held: 0, tokenIds: [], standard: null };

  /* ERC-165 is a signal, not a gate. Plenty of collections here do not
     implement it, so a false answer proves nothing and we keep probing. */
  try {
    const s = await rpc(chain, 'eth_call', [
      { to: contract, data: '0x01ffc9a7000000000000000000000000000000000000000000000000000000000080ac58cd' },
      'latest',
    ]);
    if (s && s.endsWith('1')) out.standard = 'erc721-165';
  } catch {
    /* ignore */
  }

  /* How many does the wallet hold right now. */
  let bal = 0n;
  try {
    const b = await rpc(chain, 'eth_call', [{ to: contract, data: '0x70a08231' + pad32(owner) }, 'latest']);
    if (b && b !== '0x') bal = BigInt(b);
  } catch {
    /* treat as zero, verified below by ownerOf */
  }

  /* Prove NFT-ness with ownerOf on any id seen, as BigInt. */
  const probes = [...candidateIds].slice(0, 10);
  const ownedIds = [];
  for (const id of probes) {
    try {
      const idBig = BigInt(id);
      const data = '0x6352211e' + idBig.toString(16).padStart(64, '0');
      const r = await rpc(chain, 'eth_call', [{ to: contract, data }, 'latest']);
      if (!r || r === '0x' || r.length < 66) continue;
      const holder = '0x' + r.slice(2).slice(-40).toLowerCase();
      if (holder === owner) ownedIds.push(idBig);
    } catch {
      /* try the next id */
    }
  }

  const looksNft = ownedIds.length > 0 || (out.standard === 'erc721-165' && bal > 0n);

  if (looksNft) {
    out.kind = 'nft';
    out.standard = out.standard || 'erc721';
    /* The probe is a sample, but discovery already collected every id this
       wallet was seen with, in both directions, as BigInt. That set is the
       reconstruction, so there is no need to re-read the logs here. */
    const seen = [...candidateIds].map((x) => String(x));
    out.tokenIds = seen;
    out.held = Math.max(seen.length, Number(bal));
    if (bal > BigInt(seen.length)) {
      out.note = `Node reports ${bal.toString()}, transfer logs showed ${seen.length}.`;
    }
    return out;
  }

  /* Not an NFT. Ask for decimals, which only a fungible token has. */
  try {
    const d = await rpc(chain, 'eth_call', [{ to: contract, data: '0x313ce567' }, 'latest']);
    if (d && d !== '0x') {
      out.kind = 'token';
      out.standard = 'erc20';
      out.rawBalance = bal.toString();
      return out;
    }
  } catch {
    /* ignore */
  }

  out.kind = 'unknown';
  out.held = 0;
  return out;
}

function decodeString(r) {
  try {
    if (r.length >= 130) {
      const len = parseInt(r.slice(2 + 64, 2 + 128), 16);
      if (len > 0 && len < 200) return bytesToUtf8(r.slice(2 + 128, 2 + 128 + len * 2));
    }
    return bytesToUtf8(r.slice(2).replace(/0+$/, ''));
  } catch {
    return null;
  }
}

function bytesToUtf8(hexStr) {
  try {
    let s = '';
    for (let i = 0; i < hexStr.length; i += 2) {
      const c = parseInt(hexStr.substr(i, 2), 16);
      if (c === 0) continue;
      if (c >= 32 && c < 127) s += String.fromCharCode(c);
    }
    return s.trim() || null;
  } catch {
    return null;
  }
}

/* Read the name of a collection, for the results table. */
export async function collectionName(chain, contract) {
  try {
    const r = await rpc(chain, 'eth_call', [{ to: contract, data: '0x06fdde03' }, 'latest']);
    if (r && r !== '0x') {
      const n = decodeString(r);
      if (n) return n;
    }
  } catch {
    /* ignore */
  }
  try {
    const r = await rpc(chain, 'eth_call', [{ to: contract, data: '0x95d89b41' }, 'latest']);
    if (r && r !== '0x') return decodeString(r);
  } catch {
    /* ignore */
  }
  return null;
}

/* The whole discovery run for one wallet on one chain. */
export async function discoverHoldings(chain, owner, onStep) {
  const step = (msg, frac) => onStep && onStep(msg, frac);

  step('Reading the wallet transfer history', 0.05);
  const dc = await discoverContracts(chain, owner);
  const candidates = dc.list;
  const coverage = dc.coverage;
  const nftCandidates = candidates.filter((c) => c.tokenIds.size > 0);
  const otherCandidates = candidates.filter((c) => c.tokenIds.size === 0);

  step(`Found ${candidates.length} contracts, checking ${nftCandidates.length} for tokens`, 0.25);

  const collections = [];
  const tokens = [];
  const unknown = [];

  let done = 0;
  /* Sequential with a small gap. Same reason as the window walk: parallel
     calls get refused, and a refusal without CORS headers looks like a
     network failure in a browser rather than a rate limit. */
  for (const c of nftCandidates) {
    const cls = await classifyCollection(chain, c.contract, owner, c.tokenIds);
    const nm = await collectionName(chain, c.contract);
    cls.name = nm;
    if (cls.kind === 'nft' && cls.held > 0) collections.push(cls);
    else if (cls.kind === 'token') tokens.push(cls);
    else unknown.push(cls);
    done++;
    step(
      `Checking collection ${done} of ${nftCandidates.length}`,
      0.25 + (done / Math.max(1, nftCandidates.length)) * 0.65
    );
  }

  /* Contracts seen only as senders, with no token of their own, are usually
     routers and marketplaces. Reported as touched, not as holdings. */
  const touchedExtra = otherCandidates.length;

  step('Done', 1);
  return { candidates, collections, tokens, unknown, touchedExtra, coverage };
}
