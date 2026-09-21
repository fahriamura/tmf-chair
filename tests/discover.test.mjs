/* Discovery and caption tests.
   Run: node tests/discover.test.mjs

   The chain tests here run against a real wallet on Robinhood Chain. That
   wallet is the one that exposed the original bug: fifty NFTs across thirty
   small collections, which a fixed registry read as zero. If discovery ever
   regresses to a fixed list, the count assertion below fails. */

import { discoverHoldings } from '../src/discover.js';
import { buildFromDiscovery, rungFor, chairFor } from '../src/standing.js';
import { buildCaption, checkCaption, tweetIntent } from '../src/caption.js';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log('FAIL:', msg);
  }
};

/* The wallet that broke the old build. */
const WALLET = '0xe00380938f4127a0dba57ea68e0abE7D690f9D4b'.toLowerCase();

/* ---------------- caption, held to the house rules ---------------- */
const fakeStanding = {
  address: WALLET,
  points: 512,
  totalItems: 39,
  collectionsWithHits: 20,
  level: { level: 5, title: 'Desk Manager' },
  power: { maxLevel: 10, terms: [] },
  chair: { chair: 'Green Bankers Chair' },
  share: { pctBelow: 71.2 },
};

const caption = buildCaption(fakeStanding);
ok(caption.length > 0, 'a caption should be produced');
ok(!caption.includes('\u2014'), 'the caption must not contain an em dash');
ok(!caption.includes('\u2013'), 'the caption must not contain an en dash');
ok(!caption.includes('!'), 'the caption must not contain an exclamation mark');
ok(!/\binvite/i.test(caption), 'the house admits, it never invites');
ok(caption.includes('@') === false || !/invite/i.test(caption), 'no invitation language');

/* Run the real scorer over it, same as the app does. */
const check = checkCaption(caption);
ok(check.findings.length === 0, `the caption must pass the house rules, got: ${check.findings.map((f) => f.id).join(',')}`);

const emptyCaption = buildCaption({ ...fakeStanding, points: 0 });
ok(emptyCaption.length > 0, 'a caption is produced even with no chair');
ok(checkCaption(emptyCaption).findings.length === 0, 'the empty caption must also pass the rules');

/* The intent URL carries the text. */
const url = tweetIntent(caption, 'https://x.com/absolya227');
ok(url.startsWith('https://x.com/intent/tweet?'), 'the intent URL should point at the X composer');
ok(url.includes('text='), 'the intent URL should carry the caption');

/* ---------------- pure helpers on a synthetic run ---------------- */
const built = buildFromDiscovery(WALLET, {
  candidates: [{}, {}, {}],
  collections: [
    { contract: '0xaa', name: 'Alpha', held: 5, tokenIds: ['1', '2', '3', '4', '5'] },
    { contract: '0xbb', name: 'Beta', held: 3, tokenIds: ['9', '8', '7'] },
  ],
  tokens: [{ contract: '0xcc', name: 'A Token' }],
  unknown: [],
});
ok(built.totalItems === 8, `expected 8 items, got ${built.totalItems}`);
ok(built.collectionsWithHits === 2, 'breadth should be the collections found');
ok(built.excludedTokens === 1, 'a fungible token must be excluded and reported');
/* 8 items x2 = 16, 2 collections x3 = 6, 2 touched x3 = 6, no tx read. */
ok(built.points === 28, `expected 28 points, got ${built.points}`);
ok(built.power.terms[3].unread === true, 'an unread tx count must be flagged');

const none = buildFromDiscovery(WALLET, { candidates: [], collections: [], tokens: [], unknown: [] });
ok(none.points === 0, 'no holdings is zero points');
ok(none.level.level === 1, 'no holdings is level 1');
ok(rungFor(0) === 1, 'zero power is rung 1');
ok(chairFor(1).chair === 'The Folding Chair'.replace('The ', 'The Interns '), 'rung 1 is the interns chair');

/* ---------------- live chain ----------------
   This part needs a working public endpoint. A rate limit is not a product
   failure, so a 429 is reported as skipped rather than failing the suite.
   Everything above this point is deterministic and always runs. */
let liveSkipped = false;
try {
  /* One discovery run. Running it twice back to back trips the endpoint's
     rate limit, and the second run is what the old test did. */
  const res = await discoverHoldings('robinhood', WALLET, null);
  const candidates = res.candidates;
  ok(candidates.length > 20, `discovery should find many contracts, got ${candidates.length}`);

  /* The bug this guards: a fixed list found 0, discovery must find the real
     spread across many small collections. */
  const total = res.collections.reduce((s, c) => s + c.held, 0);

  ok(res.collections.length >= 15, `expected at least 15 collections, got ${res.collections.length}`);
  ok(total >= 30, `expected at least 30 NFTs, got ${total}`);
  ok(res.tokens.length === 0 || res.tokens.every((t) => t.kind === 'token'), 'fungible tokens must be typed as tokens');

  /* Nothing may be counted that the wallet does not hold. */
  const zeroHeld = res.collections.filter((c) => c.held <= 0);
  ok(zeroHeld.length === 0, `no collection with zero held should be listed, got ${zeroHeld.length}`);

  /* Names should resolve for most of them, which proves the reads worked. */
  const named = res.collections.filter((c) => c.name).length;
  ok(named >= res.collections.length * 0.8, `expected most collections to have a name, got ${named} of ${res.collections.length}`);

  /* Token ids must survive as strings, because ids here exceed Number range. */
  const ids = res.collections.flatMap((c) => c.tokenIds);
  ok(ids.length > 0, 'token ids should be captured');
  ok(ids.every((i) => typeof i === 'string'), 'token ids must stay as strings to avoid precision loss');
  const big = ids.filter((i) => BigInt(i) > BigInt(Number.MAX_SAFE_INTEGER));
  ok(big.length > 0, `expected at least one id past Number range, got ${big.length}`);

  /* The whole pipeline, end to end. */
  const standing = buildFromDiscovery(WALLET, res);
  ok(standing.totalItems === total, 'the standing total should equal the sum of collections');
  ok(standing.points > 0, 'a wallet with NFTs should have power');
  ok(standing.level.level >= 1, 'a level is assigned');
  ok(standing.holdings.length === res.collections.length, 'every collection should appear in the table');
} catch (e) {
  const msg = String(e.message || e);
  if (/429|too many|timed out|timeout|http 5/i.test(msg)) {
    liveSkipped = true;
    console.log('SKIPPED: live chain checks, the public endpoint is rate limiting:', msg.slice(0, 60));
  } else {
    failures++;
    console.log('FAIL: live discovery threw:', msg.slice(0, 200));
  }
}

console.log(
  failures === 0
    ? `all discovery tests passed${liveSkipped ? ' (live chain checks skipped)' : ''}`
    : `${failures} failures`
);
process.exit(failures === 0 ? 0 : 1);
