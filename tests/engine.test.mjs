/* Regression suite. Run with: node tests/engine.test.mjs
   Guards the two things that are easy to break by accident:
   1. legit posts in the house voice must not be flagged
   2. real violations must still fire, and terms breaches must return Declined */
import { analysePass, analyseEnergy, RULES, drawChairPixels } from '../src/engine.js';
import { computePower, WEIGHTS, levelFor } from '../src/power.js';
import { buildStanding, rungFor, chairFor, shareBelow, LADDER_RUNGS } from '../src/standing.js';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log('FAIL:', msg);
  }
};

const CLEAN = [
  'Minting a Seat and enrolling it the same afternoon. The draw decides the fund, the chair comes with it, and the Briefcase holds whatever the fund pays out. @TheMutualFun',
  'Four thousand and one portraits, drawn on chain. The chair is the rarity trait and only thirty seven hold the Gilded Throne. @TheMutualFun',
  'The Closing Bell rings Friday at 20:00 UTC. After it, the checks go out in kind. Nothing is sold to pay a dividend. @TheMutualFun',
  'Applied for a TMF Pass. One wallet, one X account, one public post, and then the Waiting Room decides. @TheMutualFun',
  "The Mailroom is open to anyone. Press a button, run one of the fund's weekly tasks, take the Postage. @TheMutualFun",
  'Seat 0, the Chairman, stays in the lobby and is never for sale. The other ten executive portraits are still not yet found. @TheMutualFun',
  'Minted. Enrolled in the Smaug fund. @TheMutualFun',
  'Voting before the bell, then the checks wait in the Briefcase. @TheMutualFun',
];

for (const p of CLEAN) {
  const r = analysePass(p);
  ok(r.findings.length === 0, `false positive on: ${p.slice(0, 50)} -> ${r.findings.map((f) => f.id).join(',')}`);
  ok(r.verdict === 'Admitted', `clean post should be Admitted, got ${r.verdict}`);
}

const MUST_CATCH = [
  ['no_dashes', 'This is great \u2014 amazing, honestly'],
  ['no_dashes', 'Wait -- it works'],
  ['admits_not_invites', 'I invite everyone to look at this'],
  ['no_exclamation', 'A new fund!'],
  ['verdict_wording', 'Please whitelist me'],
  ['pass_naming', 'My pass is ready'],
  ['hyped_language', 'This is guaranteed 100x'],
  ['mentions_house', 'Four thousand and one chairs in the draw.'],
  ['post_substance', 'gm'],
];
for (const [rule, post] of MUST_CATCH) {
  const r = analysePass(post);
  ok(r.findings.some((f) => f.id === rule), `rule ${rule} did not fire on: ${post}`);
}

const terms = analysePass('We are TMF official partner and this is endorsed by the house. @TheMutualFun');
ok(terms.verdict === 'Declined', `terms breach should be Declined, got ${terms.verdict}`);
ok(analysePass('').verdict === 'Pending', 'empty post should be Pending, not Admitted');
ok(analyseEnergy('').score === 0, 'empty post energy should be 0');

ok(RULES.pass.length === 10, `expected 10 pass rules, got ${RULES.pass.length}`);
ok(RULES.energy.length === 9, `expected 9 energy rules, got ${RULES.energy.length}`);

const good = analyseEnergy(CLEAN[0], { hasImage: true });
ok(good.score >= 88, `clean post should score high, got ${good.score}`);

const buf = drawChairPixels(95);
ok(buf.length === 64 * 64 * 4, `buffer should be 16384 bytes, got ${buf.length}`);
const colours = new Set();
for (let i = 0; i < buf.length; i += 4) colours.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
ok(colours.size === 2, `chair should use 2 colors, got ${colours.size}`);

/* ---------------- the power formula ----------------
   Holdings x2, NFT portfolio x3, wallet portfolio x3, transactions x1. */
ok(WEIGHTS.holding === 2, 'holdings weight must be 2');
ok(WEIGHTS.nftPortfolio === 3, 'nft portfolio weight must be 3');
ok(WEIGHTS.walletPortfolio === 3, 'wallet portfolio weight must be 3');
ok(WEIGHTS.transactions === 1, 'transactions weight must be 1');

/* 10 NFTs in 4 collections, 6 contracts touched, 20 transactions:
     10 x2 = 20,  4 x3 = 12,  6 x3 = 18,  20 x1 = 20  ->  70 */
const pw = computePower({
  totalItems: 10,
  holdings: [],
  collectionsWithHits: 4,
  contractsTouched: 6,
  nativeBalance: 0,
  txCount: 20,
});
ok(pw.total === 70, `expected 70, got ${pw.total} (${pw.terms.map((t) => t.key + '=' + t.points).join(', ')})`);
ok(pw.terms.length === 4, `expected 4 terms, got ${pw.terms.length}`);
ok(pw.terms[0].points === 20, `holdings term should be 20, got ${pw.terms[0].points}`);
ok(pw.terms[1].points === 12, `nft portfolio term should be 12, got ${pw.terms[1].points}`);
ok(pw.terms[2].points === 18, `wallet portfolio term should be 18, got ${pw.terms[2].points}`);
ok(pw.terms[3].points === 20, `transactions term should be 20, got ${pw.terms[3].points}`);

/* A Seat counts twice inside term 1. */
const seatPower = computePower({
  totalItems: 5,
  holdings: [{ tier: 'seat', count: 2 }, { tier: 'other', count: 3 }],
  collectionsWithHits: 2,
  contractsTouched: 2,
  nativeBalance: 0,
  txCount: 0,
});
ok(seatPower.terms[0].points === 14, `2 Seats + 3 others = 7 items, x2 = 14, got ${seatPower.terms[0].points}`);

/* An unread transaction count contributes zero rather than a guess. */
const noTx = computePower({
  totalItems: 1, holdings: [], collectionsWithHits: 1,
  contractsTouched: 1, nativeBalance: 0, txCount: null,
});
ok(noTx.terms[3].points === 0, 'an unread tx count must contribute 0');
ok(noTx.terms[3].unread === true, 'an unread tx count must be flagged as unread');
ok(noTx.total === 1 * 2 + 1 * 3 + 1 * 3, `expected 8, got ${noTx.total}`);

/* A funded native balance adds one to the wallet portfolio breadth. */
const funded = computePower({
  totalItems: 0, holdings: [], collectionsWithHits: 0,
  contractsTouched: 2, nativeBalance: 0.5, txCount: 0,
});
ok(funded.terms[2].points === 9, `2 contracts + 1 funded = 3, x3 = 9, got ${funded.terms[2].points}`);

/* Levels climb with the total. */
ok(levelFor(0).level === 1, 'zero is level 1');
ok(levelFor(850).level === 10, 'a large book is level 10');

/* A real wallet through the whole pipeline. */
const standing = buildStanding({
  address: '0xabc',
  collections: [
    { name: 'PumpCa$h Terminals', collection: 'pumpca', chain: 'robinhood', chainName: 'Robinhood Chain', contract: '0xaa', tier: 'other', balance: 5, tokenIds: [1, 2, 3, 4, 5] },
    { name: 'PRIMAL PUNKS', collection: 'primal', chain: 'robinhood', chainName: 'Robinhood Chain', contract: '0xbb', tier: 'other', balance: 3, tokenIds: [7, 8, 9] },
    { name: 'Broken', collection: 'broken', chain: 'robinhood', chainName: 'Robinhood Chain', contract: '0xcc', tier: 'other', balance: 99, tokenIds: [], error: 'rpc timeout' },
  ],
  txCount: 12,
  native: 0.1,
  contractsTouched: 2,
});
ok(standing.totalItems === 8, `expected 8 items, got ${standing.totalItems}`);
ok(standing.power.terms[0].points === 16, `8 x2 = 16, got ${standing.power.terms[0].points}`);
ok(standing.power.terms[1].points === 6, `2 collections x3 = 6, got ${standing.power.terms[1].points}`);
ok(standing.power.terms[2].points === 9, `2 touched + 1 funded = 3, x3 = 9, got ${standing.power.terms[2].points}`);
ok(standing.power.terms[3].points === 12, `12 tx x1 = 12, got ${standing.power.terms[3].points}`);
ok(standing.points === 43, `expected 43 total, got ${standing.points}`);
ok(standing.holdings.length === 2, 'an errored collection must not appear as a holding');
ok(standing.errors === 1, 'an errored collection should be counted as an error');

/* The ladder and the share. */
ok(rungFor(0) === 1, 'no power is rung 1');
ok(chairFor(8).chair === 'The Gilded Throne', 'rung 8 is the Gilded Throne');
const s8 = shareBelow(8);
ok(s8.total === 4001, `stated supply should be 4001, got ${s8.total}`);
ok(s8.covered === 3997, `the chair table should cover 3997, got ${s8.covered}`);
ok(s8.gap === 4, `the chair table should be 4 short, got ${s8.gap}`);
ok(s8.seatsBelow === 3960, `rung 8 sits above 3960, got ${s8.seatsBelow}`);
ok(LADDER_RUNGS.length === 8, 'the ladder has eight rungs');

console.log(failures === 0 ? 'all engine tests passed' : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
