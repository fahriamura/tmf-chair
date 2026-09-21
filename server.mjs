/* A tiny OpenSea proxy.

   Why this exists rather than calling OpenSea from the browser: an OpenSea API
   key is an account credential. Anything shipped to a browser can be read out
   of the network tab in a few seconds, so putting the key in the app would hand
   it to everyone who loads the page and let them spend the owner's quota. The
   key lives here, in the process environment, and the browser only ever talks
   to this server.

   What it does:

   - Serves the built app from dist/.
   - Proxies a small, fixed set of OpenSea reads. The caller cannot ask for an
     arbitrary path, only the shapes below, so this cannot be turned into an
     open relay for the key.
   - Returns only what the app needs, with the key never echoed back.

   What it is not: an off-chain home for wallet data. Nothing is stored. Every
   response is a straight pass through of a read.

   Run: node server.mjs
   Env: OPENSEA_API_KEY, PORT (default 8788)

   Note on whose numbers these are. OpenSea's holdings endpoint under reports
   on Robinhood Chain: a wallet holding thirty five NFTs across twenty
   collections is returned as twenty two across fourteen, and collections it
   demonstrably knows about, down to the individual owner, are missing from the
   list. So the app counts with the chain and the explorer, and uses this only
   for what OpenSea is good at, which is art and metadata. */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8788);
const KEY = process.env.OPENSEA_API_KEY || '';

const OS = 'https://api.opensea.io/api/v2';
const CHAIN = 'robinhood';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || '');
const isContract = isAddress;
const isId = (s) => /^[0-9]{1,78}$/.test(s || '');

async function opensea(path, timeoutMs = 20000) {
  if (!KEY) throw Object.assign(new Error('no key configured'), { status: 503 });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${OS}${path}`, {
      headers: { 'x-api-key': KEY, accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (r.status === 429) throw Object.assign(new Error('rate limited'), { status: 429 });
    if (!r.ok) throw Object.assign(new Error(`opensea ${r.status}`), { status: r.status });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

/* Art and metadata for one collection.

   This is the piece OpenSea is genuinely useful for on this chain: artwork
   URLs, the slug, and traits. The count is not taken from here. */
async function collectionArt(contract) {
  const d = await opensea(`/chain/${CHAIN}/contract/${contract}`);
  return {
    contract,
    slug: d.collection || null,
    name: d.name || null,
    standard: d.contract_standard || null,
    openseaUrl: d.collection ? `https://opensea.io/collection/${d.collection}` : null,
  };
}

/* One token, with its image and traits. Used to decorate a specific NFT. */
async function tokenArt(contract, id) {
  const d = await opensea(`/chain/${CHAIN}/contract/${contract}/nfts/${id}`);
  const n = d.nft || {};
  return {
    contract,
    id,
    name: n.name || null,
    image: n.display_image_url || n.image_url || null,
    originalImage: n.original_image_url || null,
    openseaUrl: n.opensea_url || null,
    traits: (n.traits || []).map((t) => ({ type: t.trait_type, value: t.value })),
  };
}

/* What OpenSea thinks the wallet holds.

   Exposed for comparison only. The app does not count with this, and the
   interface never shows it as a total, because it under reports. */
async function walletHoldings(address) {
  const out = [];
  let next = null;
  let pages = 0;
  do {
    const q = new URLSearchParams({ limit: '50' });
    if (next) q.set('next', next);
    const d = await opensea(`/chain/${CHAIN}/account/${address}/nfts?${q}`);
    for (const n of d.nfts || []) {
      out.push({
        contract: n.contract,
        id: n.identifier,
        collection: n.collection || null,
        name: n.name || null,
        image: n.display_image_url || n.image_url || null,
      });
    }
    next = d.next || null;
    pages++;
  } while (next && pages < 8);
  return { items: out, pages };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { error: 'method not allowed' });
  }

  try {
    /* ---- the fixed proxy surface ---- */
    if (path === '/api/health') {
      return send(res, 200, { ok: true, keyConfigured: !!KEY });
    }

    if (path.startsWith('/api/collection/')) {
      const contract = path.slice('/api/collection/'.length).toLowerCase();
      if (!isContract(contract)) return send(res, 400, { error: 'bad contract' });
      return send(res, 200, await collectionArt(contract));
    }

    const tokenMatch = path.match(/^\/api\/token\/(0x[0-9a-fA-F]{40})\/([0-9]{1,78})$/);
    if (tokenMatch) {
      return send(res, 200, await tokenArt(tokenMatch[1].toLowerCase(), tokenMatch[2]));
    }

    if (path.startsWith('/api/holdings/')) {
      const address = path.slice('/api/holdings/'.length).toLowerCase();
      if (!isAddress(address)) return send(res, 400, { error: 'bad address' });
      return send(res, 200, await walletHoldings(address));
    }

    /* ---- static app ---- */
    let rel = normalize(path).replace(/^(\.\.[/\\])+/, '');
    if (rel === '/' || rel === '') rel = '/index.html';
    let file = join(DIST, rel);

    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      /* Single page app: an unknown path is a route, not a missing file. */
      file = join(DIST, 'index.html');
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    return res.end(body);
  } catch (e) {
    const status = e.status || 500;
    /* The key must never appear in a response, so only the message is sent. */
    return send(res, status, { error: String(e.message || e).slice(0, 160) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`chair desk on http://127.0.0.1:${PORT}  (opensea key ${KEY ? 'configured' : 'MISSING'})`);
});
