/* Blockscout path tests.
   Run: node tests/blockscout.test.mjs

   Two halves. The pure folding logic runs always. The live part hits the
   Robinhood Chain explorer and cross checks it against the chain itself, which
   is the thing that matters: the explorer is a different party, and if its
   count ever drifts from balanceOf, that must fail loudly rather than quietly
   become the number the tool reports.

   Note on running this from a script: the explorer sits behind Cloudflare and
   refuses a plain curl or fetch from Node, answering with a challenge page.
   The app runs in a real browser, which is served normally. So the live checks
   here are allowed to skip on a 403 rather than fail, and the browser is where
   end to end verification happens. */

import { groupNfts, BLOCKSCOUT } from '../src/blockscout.js';
import { buildFromExplorer } from '../src/standing.js';

let failures = 0;
const ok = (c, m) => {
  if (!c) {
    failures++;
    console.log('FAIL:', m);
  }
};

const WALLET = '0xe00380938f4127a0dba57ea68e0abe7d690f9d4b';

/* ---------------- folding, no network ---------------- */
const item = (contract, id, name, symbol) => ({
  id,
  token_type: 'ERC-721',
  token: { address_hash: contract, name, symbol, type: 'ERC-721' },
});

const folded = groupNfts([
  item('0xAA', 1, 'Alpha', 'ALP'),
  item('0xAA', 2, 'Alpha', 'ALP'),
  item('0xaa', 3, 'Alpha', 'ALP'),
  item('0xBB', 9, 'Beta', 'BET'),
  { id: 5, token_type: 'ERC-721', token: { address_hash: '', name: 'No contract' } },
]);
ok(folded.length === 2, `expected 2 collections, got ${folded.length}`);
ok(folded[0].count === 3, `expected 3 in the first collection, got ${folded[0].count}`);
ok(folded[0].tokenIds.length === 3, 'token ids should be kept per collection');
ok(folded.every((c) => c.contract !== ''), 'an item with no contract must be dropped');

/* Duplicate ids in the same collection count once. */
const dupes = groupNfts([item('0xCC', 7, 'C', 'C'), item('0xCC', 7, 'C', 'C')]);
ok(dupes[0].count === 1, `a repeated id must count once, got ${dupes[0].count}`);

/* ---------------- buildFromExplorer ---------------- */
const standing = buildFromExplorer(WALLET, {
  collections: [
    { contract: '0xaa', name: 'Alpha', symbol: 'ALP', count: 5, tokenIds: ['1', '2', '3', '4', '5'] },
    { contract: '0xbb', name: 'Beta', symbol: 'BET', count: 3, tokenIds: ['8', '9', '10'] },
  ],
  counters: { transactions: 273, tokenTransfers: 126 },
  summary: { nativeBalance: '626085933968122', isContract: true },
  nftTruncated: false,
});
ok(standing.totalItems === 8, `expected 8 items, got ${standing.totalItems}`);
ok(standing.txCount === 273, 'the explorer transaction count should be used');
ok(standing.txCountSource === 'explorer', 'the transaction count source should be stated');
ok(standing.source === 'explorer', 'the source should be recorded');
ok(standing.hitDepthLimit === false, 'the explorer path has no depth limit');
/* 8 items x2 = 16, 2 collections x3 = 6, 3 touched x3 = 9 (two collections
   plus the wallet being a contract), 273 tx = 273. Total 304. */
ok(standing.points === 304, `expected 304 points, got ${standing.points}`);
ok(standing.power.terms[3].unread === false, 'a read tx count must not be flagged unread');

/* A missing counter must be reported as unread, never as zero. */
const noCounters = buildFromExplorer(WALLET, { collections: [], counters: null, summary: null });
ok(noCounters.txCount === null, 'a missing transaction count must stay null');
ok(noCounters.power.terms[3].unread === true, 'a missing count must be flagged unread');
ok(noCounters.points === 0, 'no holdings is zero points');

/* ---------------- live, cross checked against the chain ---------------- */
let skipped = false;
try {
  const res = await fetch(`${BLOCKSCOUT.robinhood}/api/v2/addresses/${WALLET}/nft?type=ERC-721`, {
    headers: { accept: 'application/json' },
  });
  if (res.status === 403 || res.status === 503) {
    skipped = true;
    console.log('SKIPPED: live explorer checks, Cloudflare refuses a scripted client');
  } else {
    ok(res.ok, `explorer should answer, got ${res.status}`);
    const d = await res.json();
    const collections = groupNfts(d.items || []);
    const total = collections.reduce((s, c) => s + c.count, 0);

    ok(collections.length >= 15, `expected at least 15 collections, got ${collections.length}`);
    ok(total >= 30, `expected at least 30 NFTs, got ${total}`);

    /* Cross check the biggest collection against the chain, which is the
       source of truth. */
    const top = collections[0];
    const pad = '0'.repeat(24) + WALLET.slice(2);
    const r = await fetch('https://rpc.mainnet.chain.robinhood.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: top.contract, data: '0x70a08231' + pad }, 'latest'],
      }),
    });
    const onchain = await r.json();
    if (onchain.result && onchain.result !== '0x') {
      const bal = Number(BigInt(onchain.result));
      ok(
        bal === top.count,
        `the explorer and the chain must agree: explorer says ${top.count}, balanceOf says ${bal} for ${top.contract}`
      );
    }
  }
} catch (e) {
  const msg = String(e.message || e);
  if (/403|503|fetch failed|network/i.test(msg)) {
    skipped = true;
    console.log('SKIPPED: live explorer checks,', msg.slice(0, 60));
  } else {
    failures++;
    console.log('FAIL: live explorer check threw:', msg.slice(0, 160));
  }
}

console.log(failures === 0 ? `all explorer tests passed${skipped ? ' (live checks skipped)' : ''}` : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
