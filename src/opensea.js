/* OpenSea, through the desk's own proxy.

   Why through a proxy: an OpenSea API key is an account credential. Anything
   shipped to a browser can be read out of the network tab in seconds, which
   would hand the key to everyone who loads the page and let them spend the
   owner's quota. So the browser only ever calls this server, and the key stays
   in the server's environment.

   This is the fast path. One request, about a second and a half.

   Honest note on completeness, because it matters for how the numbers are
   shown: OpenSea's holdings endpoint under reports on Robinhood Chain. Measured
   against the chain itself, a wallet holding thirty five NFTs across twenty
   collections comes back as twenty two across fourteen, and that includes
   collections OpenSea demonstrably knows, down to the individual owner of a
   token, which are simply missing from the list. So the count here is OpenSea's
   record and is labelled as such. When the app can reach the chain explorer as
   well, it reconciles the two and says which is larger.

   The whole module degrades quietly. If the proxy is not deployed, every call
   fails and the app falls back to reading the chain, which is slower but needs
   nobody's index. */

async function get(path, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`proxy ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/* Is the proxy there at all? Checked once so the app can skip the calls
   entirely rather than firing requests that all fail. */
export async function proxyAvailable() {
  try {
    const h = await get('/api/health', 6000);
    return !!(h && h.ok);
  } catch {
    return false;
  }
}

export async function collectionArt(contract) {
  return get(`/api/collection/${contract}`);
}

export async function tokenArt(contract, id) {
  return get(`/api/token/${contract}/${id}`);
}

/* Everything OpenSea knows the wallet holds, grouped by collection.

   One request, and the only count in the app that comes from OpenSea. */
export async function openSeaHoldings(address) {
  const d = await get(`/api/holdings/${address}`);
  const items = d.items || [];

  const byContract = new Map();
  for (const it of items) {
    const contract = (it.contract || '').toLowerCase();
    if (!contract) continue;
    const rec =
      byContract.get(contract) ||
      { contract, name: it.collection || null, slug: it.collection || null, tokenIds: [], art: {} };
    if (it.id !== undefined && it.id !== null) rec.tokenIds.push(String(it.id));
    /* Keep the first artwork seen for the collection, as a fallback thumbnail. */
    if (!rec.art.image && it.image) rec.art.image = it.image;
    byContract.set(contract, rec);
  }

  const collections = [...byContract.values()]
    .map((c) => ({ ...c, count: c.tokenIds.length }))
    .sort((a, b) => b.count - a.count);

  return {
    source: 'opensea',
    address,
    collections,
    totalItems: collections.reduce((s, c) => s + c.count, 0),
    pages: d.pages || 1,
  };
}
