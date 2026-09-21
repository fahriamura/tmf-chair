/* On-chain reading, straight from public JSON-RPC.
   No API key, no indexer, no backend. The whole scan runs in the browser.
   Every number this module returns is read from a node and can be checked
   against a block explorer. */

export const CHAINS = {
  robinhood: {
    id: 4663,
    name: 'Robinhood Chain',
    short: 'Robinhood',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    rpcs: ['https://rpc.mainnet.chain.robinhood.com'],
    explorer: 'https://robin.etherscan.io',
    native: 'ETH',
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    short: 'Ethereum',
    /* Public endpoints, no key. The scan fails over between them so one
       rate limited node cannot take the whole run down. */
    rpc: 'https://ethereum-rpc.publicnode.com',
    rpcs: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
    ],
    explorer: 'https://etherscan.io',
    native: 'ETH',
  },
};

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let rpcId = 1;

/* Round robin position per chain, so a healthy node keeps serving and a
   throttled one is passed over instead of retried into the ground. */
const cursor = {};

async function callOne(url, method, params, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    if (json.result === undefined) throw new Error('empty rpc result');
    return json.result;
  } finally {
    clearTimeout(t);
  }
}

const RETRYABLE = /429|too many|http 5|timeout|abort|network|fetch|empty rpc|cors|load failed/i;

export async function rpc(chain, method, params, timeoutMs = 20000) {
  const urls = CHAINS[chain].rpcs || [CHAINS[chain].rpc];
  const start = cursor[chain] || 0;
  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    const idx = (start + i) % urls.length;
    try {
      const out = await callOne(urls[idx], method, params, timeoutMs);
      cursor[chain] = idx; // remember the healthy one
      return out;
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      /* Only move on for a transient problem. A revert is a real answer. */
      if (!RETRYABLE.test(msg)) break;
      cursor[chain] = (idx + 1) % urls.length;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr || new Error('all rpc endpoints failed');
}

export const pad32 = (addr) => addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const hex = (n) => '0x' + n.toString(16);

export function normaliseAddress(a) {
  const s = (a || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  return s.toLowerCase();
}

/* ---------- ERC-20 balance, used for the native and token legs ---------- */
export async function nativeBalance(chain, address) {
  const r = await rpc(chain, 'eth_getBalance', [address, 'latest']);
  return Number(BigInt(r)) / 1e18;
}

/* Transactions sent by the wallet. eth_getTransactionCount returns the
   account nonce, which is exactly the number of transactions this address
   has sent, so it is a real figure rather than an estimate. */
export async function transactionCount(chain, address) {
  try {
    const r = await rpc(chain, 'eth_getTransactionCount', [address, 'latest']);
    if (!r || r === '0x') return null;
    return Number(BigInt(r));
  } catch {
    return null;
  }
}

/* ---------- ERC-721 ---------- */
export async function erc721Balance(chain, contract, owner) {
  const data = '0x70a08231' + pad32(owner);
  const r = await rpc(chain, 'eth_call', [{ to: contract, data }, 'latest']);
  if (!r || r === '0x') return 0;
  return Number(BigInt(r));
}

export async function erc721TotalSupply(chain, contract) {
  const r = await rpc(chain, 'eth_call', [{ to: contract, data: '0x18160ddd' }, 'latest']);
  if (!r || r === '0x') return null;
  return Number(BigInt(r));
}

/* Decode an ABI encoded string without Buffer, which does not exist in a
   browser. Handles both the standard offset and length form and the short
   bytes32 form that some older contracts use. */
function decodeString(r) {
  if (!r || r === '0x') return null;
  try {
    const body = r.slice(2);
    if (body.length >= 128) {
      const len = parseInt(body.slice(64, 128), 16);
      if (Number.isFinite(len) && len > 0 && len < 512) {
        const s = hexToUtf8(body.slice(128, 128 + len * 2));
        if (s) return s;
      }
    }
    /* bytes32 style, or a bare string sitting at the front. */
    return hexToUtf8(body);
  } catch {
    return null;
  }
}

function hexToUtf8(hexStr) {
  let out = '';
  for (let i = 0; i + 1 < hexStr.length; i += 2) {
    const c = parseInt(hexStr.substr(i, 2), 16);
    if (!Number.isFinite(c) || c === 0) continue;
    if (c >= 32 && c < 127) out += String.fromCharCode(c);
    else if (c >= 128) out += decodeUtf8Byte(hexStr, i);
  }
  return out.trim() || null;
}

function decodeUtf8Byte(hexStr, i) {
  try {
    const bytes = [];
    for (let j = i; j < hexStr.length && bytes.length < 4; j += 2) {
      const c = parseInt(hexStr.substr(j, 2), 16);
      if (!Number.isFinite(c) || c === 0) break;
      bytes.push(c);
      if ((c & 0xc0) !== 0x80) break;
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

export async function contractName(chain, contract) {
  try {
    const r = await rpc(chain, 'eth_call', [{ to: contract, data: '0x06fdde03' }, 'latest']);
    return decodeString(r);
  } catch {
    return null;
  }
}

/* Find every tokenId a wallet owns in one collection, using Transfer logs.
   The head-to-tail pass is exact but costs one wide eth_getLogs, so it is used
   for collections the scan already knows the wallet holds something in. */
export async function ownedTokenIds(chain, contract, owner, opts = {}) {
  const { fromBlock = '0x0', toBlock = 'latest', chunkBlocks = 0 } = opts;
  const ownerTopic = '0x' + pad32(owner);
  const zeroTopic = '0x' + '0'.repeat(64);

  const filter = {
    address: contract,
    topics: [TRANSFER_TOPIC, null, ownerTopic],
  };

  let logs = [];
  if (!chunkBlocks) {
    logs = (await rpc(chain, 'eth_getLogs', [{ ...filter, fromBlock, toBlock }], 45000)) || [];
  } else {
    const headHex = await rpc(chain, 'eth_blockNumber', []);
    const head = parseInt(headHex, 16);
    for (let start = head - chunkBlocks; start <= head; start += chunkBlocks) {
      const end = Math.min(start + chunkBlocks - 1, head);
      try {
        const part = await rpc(
          chain,
          'eth_getLogs',
          [{ ...filter, fromBlock: hex(start), toBlock: hex(end) }],
          30000
        );
        logs = logs.concat(part || []);
      } catch {
        /* a failed window is skipped rather than failing the whole scan */
      }
    }
  }

  const ids = new Set();
  for (const l of logs) {
    const t = l.topics || [];
    if (t.length < 4) continue;
    const to = '0x' + t[2].slice(26).toLowerCase();
    if (to !== owner) continue;
    /* Ids can run past Number.MAX_SAFE_INTEGER on this chain, so they are
       kept as strings all the way through. parseInt would silently round
       them and the reconstruction would then miss real tokens. */
    ids.add(BigInt(t[3]).toString());
  }

  /* A transfer out is also a log with this owner as `from`, so remove those. */
  const outFilter = { address: contract, topics: [TRANSFER_TOPIC, ownerTopic] };
  let outLogs = [];
  try {
    outLogs = (await rpc(chain, 'eth_getLogs', [{ ...outFilter, fromBlock, toBlock }], 45000)) || [];
  } catch {
    outLogs = [];
  }
  for (const l of outLogs) {
    const t = l.topics || [];
    if (t.length < 4) continue;
    const from = '0x' + t[1].slice(26).toLowerCase();
    if (from !== owner) continue;
    const id = BigInt(t[3]).toString();
    const to = '0x' + t[2].slice(26).toLowerCase();
    if (to !== owner && t[2] !== zeroTopic) ids.delete(id);
  }

  /* Sort numerically without converting to Number. */
  return [...ids].sort((a, b) => {
    const x = BigInt(a);
    const y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/* A collection entry in the registry the scan walks. */
export async function scanCollection(chain, entry, owner) {
  const out = { ...entry, chain, balance: 0, tokenIds: [], error: null };
  try {
    out.balance = await erc721Balance(chain, entry.contract, owner);
    if (out.balance > 0 && entry.enumerate !== false) {
      out.tokenIds = await ownedTokenIds(chain, entry.contract, owner, {
        chunkBlocks: entry.chunkBlocks || 0,
      });
      /* Trust the node over the log reconstruction. If they disagree, say so. */
      if (out.tokenIds.length !== out.balance) {
        out.note = `Node reports ${out.balance}, logs reconstructed ${out.tokenIds.length}.`;
      }
    }
  } catch (e) {
    out.error = String(e.message || e).slice(0, 120);
  }
  return out;
}

/* Run a list of collections with a small concurrency cap so a public
   endpoint does not rate limit the scan into failure. */
export async function scanAll(entries, owner, onProgress, concurrency = 2) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < entries.length) {
      const idx = i++;
      const entry = entries[idx];
      const r = await scanCollection(entry.chain, entry, owner);
      results[idx] = r;
      if (onProgress) onProgress(idx + 1, entries.length, r);
      /* A small gap between collections keeps a public endpoint from
         treating the scan as a burst. */
      if (i < entries.length) await sleep(150);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return results;
}

/* Everything the power formula needs, in one pass. */
export async function scanWallet(entries, owner, onProgress, concurrency = 2) {
  const collections = await scanAll(entries, owner, onProgress, concurrency);

  /* The heavy log reads are finished by now. Pause briefly so the endpoint
     has a chance to shed the burst before the wallet calls go out, which is
     what stops the figures below reading as zero. */
  await sleep(400);

  const chains = [...new Set(entries.map((e) => e.chain))];
  let txCount = null;
  let native = 0;
  const perChain = {};
  const unread = [];

  for (const c of chains) {
    /* Both figures are retried. A public endpoint will occasionally drop a
       call after a burst, and a retry is the honest fix rather than writing
       a zero into a term the reader is going to trust. */
    const tx = await retry(() => transactionCount(c, owner), 4, 700);
    if (tx === null) unread.push(`${c} transaction count`);
    else {
      perChain[c] = tx;
      txCount = (txCount ?? 0) + tx;
    }

    const nb = await retry(() => nativeBalance(c, owner), 4, 700);
    if (nb === null) unread.push(`${c} native balance`);
    else native += nb;
  }

  /* Distinct contracts the wallet touched. Every collection that answered
     with a balance counts, and every tokenId read proves contact even when a
     balance call was rate limited. */
  const touched = new Set(
    collections
      .filter((c) => !c.error && (c.balance > 0 || (c.tokenIds && c.tokenIds.length > 0)))
      .map((c) => `${c.chain}:${c.contract}`)
  );

  return { collections, txCount, txPerChain: perChain, native, contractsTouched: touched.size, unread };
}

/* Retry with backoff. A public endpoint drops calls under load, and a
   discovery pass makes far more calls than a fixed read does. Anything that
   eventually fails is reported by the caller rather than counted as zero. */
export async function retry(fn, attempts = 5, delay = 600) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await fn();
      if (out !== null && out !== undefined) return out;
    } catch (e) {
      last = e;
    }
    if (i < attempts - 1) await sleep(delay * (i + 1));
  }
  if (last) throw last;
  return null;
}
