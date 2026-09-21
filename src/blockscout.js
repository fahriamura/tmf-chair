/* Blockscout, as the fast path.

   The reason this exists: reading a wallet directly from the chain needs the
   wallet's own transfer logs to learn which collections it has touched, and
   that walk is the slow part. Measured on Robinhood Chain, a discovery run is
   around a minute because it makes on the order of a hundred and eighty calls.
   Blockscout has already indexed all of it, so the same answer arrives in two
   or three requests and around three seconds.

   It sits behind Cloudflare, which answers a scripted client with a challenge.
   A real browser is served normally, which is what the app is, so no special
   headers are set here. Setting a user agent is not possible from a browser
   anyway, and it is not needed.

   The chain is still the source of truth elsewhere. Anything from here is
   labelled as the explorer's record in the interface, so a reader always knows
   where a number came from. */

export const BLOCKSCOUT = {
  robinhood: 'https://robinhoodchain.blockscout.com',
};

async function get(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`blockscout http ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/* Address summary: native balance, a transaction count, and whether the
   address has ever held tokens. One request. */
export async function addressSummary(chain, address) {
  const base = BLOCKSCOUT[chain];
  if (!base) throw new Error(`no explorer for ${chain}`);
  const d = await get(`${base}/api/v2/addresses/${address}`);
  return {
    address: d.hash,
    nativeBalance: d.coin_balance ?? '0',
    isContract: !!d.is_contract,
    hasTokens: !!d.has_tokens,
    name: d.name || null,
    /* The explorer tracks this directly, so it is not derived from a walk. */
    transactionCount: d.transaction_count ?? null,
  };
}

/* The counters endpoint, which is where the transaction count actually lives.
   One request, and it is the cheapest way to answer "how active is this
   wallet". */
export async function addressCounters(chain, address) {
  const base = BLOCKSCOUT[chain];
  if (!base) throw new Error(`no explorer for ${chain}`);
  const d = await get(`${base}/api/v2/addresses/${address}/counters`);
  return {
    transactions: d.transactions_count ? Number(d.transactions_count) : 0,
    tokenTransfers: d.token_transfers_count ? Number(d.token_transfers_count) : 0,
    gasUsage: d.gas_usage_count ? Number(d.gas_usage_count) : 0,
  };
}

/* Every NFT the address holds, with the collection it belongs to.

   The explorer pages these. The loop follows next_page_params until it stops,
   with a ceiling so a very large wallet cannot spin forever, and it reports
   whether it stopped early rather than pretending it saw everything. */
export async function addressNfts(chain, address, { maxPages = 10 } = {}) {
  const base = BLOCKSCOUT[chain];
  if (!base) throw new Error(`no explorer for ${chain}`);

  const items = [];
  let url = `${base}/api/v2/addresses/${address}/nft?type=ERC-721`;
  let pages = 0;
  let truncated = false;

  while (url && pages < maxPages) {
    const d = await get(url, 30000);
    for (const it of d.items || []) items.push(it);
    pages++;
    const next = d.next_page_params;
    if (next) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) {
        if (v !== null && v !== undefined) q.set(k, String(v));
      }
      url = `${base}/api/v2/addresses/${address}/nft?type=ERC-721&${q.toString()}`;
    } else {
      url = null;
    }
  }
  if (url) truncated = true;

  return { items, pages, truncated };
}

/* Fold the raw items into one entry per collection.

   Nothing is inferred here. The collection address, the name and the count all
   come from the explorer's own records. */
export function groupNfts(items) {
  const byContract = new Map();

  for (const it of items) {
    const token = it.token || {};
    const contract = (token.address_hash || '').toLowerCase();
    if (!contract) continue;

    const rec =
      byContract.get(contract) || {
        contract,
        name: token.name || null,
        symbol: token.symbol || null,
        type: it.token_type || token.type || 'ERC-721',
        tokenIds: [],
      };

    /* The id may arrive as the item id or inside the metadata. Prefer the
       item id, which is the token id for a single token. */
    const id = it.id !== undefined && it.id !== null ? String(it.id) : null;
    if (id && !rec.tokenIds.includes(id)) rec.tokenIds.push(id);

    byContract.set(contract, rec);
  }

  return [...byContract.values()]
    .map((c) => ({ ...c, count: c.tokenIds.length }))
    .sort((a, b) => b.count - a.count);
}

/* The whole fast read: summary, counters and NFTs, in parallel.

   Three requests on the wire, two of them independent of each other and all
   three independent of the chain walk. This is the path that answers in a
   couple of seconds. */
export async function readWalletFast(chain, address, onStep) {
  const step = (m, f) => onStep && onStep(m, f);

  step('Asking the chain explorer', 0.2);

  const [summary, counters, nfts] = await Promise.all([
    addressSummary(chain, address).catch(() => null),
    addressCounters(chain, address).catch(() => null),
    addressNfts(chain, address).catch(() => null),
  ]);

  step('Grouping what it holds', 0.8);

  const collections = nfts ? groupNfts(nfts.items) : [];
  const totalItems = collections.reduce((s, c) => s + c.count, 0);

  step('Done', 1);

  return {
    source: 'blockscout',
    summary,
    counters,
    collections,
    totalItems,
    nftTruncated: nfts ? nfts.truncated : false,
    itemCount: nfts ? nfts.items.length : 0,
  };
}
