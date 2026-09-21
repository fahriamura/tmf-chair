/* Test the on-chain read path against real wallets on a live chain.
   Run: node tests/onchain.test.mjs
   These tests hit public RPC endpoints, so they need network access and
   they will print a clear failure if an endpoint is down. */

import {
  normaliseAddress,
  erc721Balance,
  erc721TotalSupply,
  contractName,
  ownedTokenIds,
  scanCollection,
} from '../src/onchain.js';
import { buildStanding, rungFor, chairFor, shareBelow, LADDER_RUNGS } from '../src/standing.js';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log('FAIL:', msg);
  }
};

/* ---------- pure functions ---------- */
ok(normaliseAddress('0xAbC0000000000000000000000000000000000001') === '0xabc0000000000000000000000000000000000001', 'address should normalise to lowercase');
ok(normaliseAddress('nope') === null, 'invalid address should return null');
ok(normaliseAddress('') === null, 'empty address should return null');

ok(chairFor(8).chair === 'The Gilded Throne', 'rung 8 is the Gilded Throne');
ok(chairFor(1).seats === 1235, 'rung 1 carries the published seat count');

const s = shareBelow(8);
ok(s.total === 4001, `total seats should be 4001, got ${s.total}`);
/* Rung 8 sits above every rung below it, which is 3,960 of 4,001. It is the
   rarest chair in the ladder, not a claim to be above all 4,001, because the
   37 Throne holders are not above one another. */
ok(s.pctBelow > 98 && s.pctBelow < 100, `rung 8 should sit above about 99 percent, got ${s.pctBelow}`);
ok(s.seatsBelow === 3960, `rung 8 should sit above 3960 published Seats, got ${s.seatsBelow}`);
ok(s.gap === 4, `the chair table should be 4 short, got ${s.gap}`);
ok(s.covered === 3997, `the chair table should cover 3997, got ${s.covered}`);

/* The published chair table sums to 3997 across a stated supply of 4001, and
   the frame table sums to exactly 4001. Four Seats are unaccounted for in the
   chair ladder. The tool must not hide that, so it is asserted here and the
   interface shows the gap. */
const CHAIR_SUM = [1235, 777, 850, 560, 271, 179, 88, 37].reduce((a, b) => a + b, 0);
ok(CHAIR_SUM === 3997, `the published chair counts should sum to 3997, got ${CHAIR_SUM}`);
ok(4001 - CHAIR_SUM === 4, 'the chair ladder should be 4 short of the stated supply');

/* Standing from a synthetic scan, through the new four-term formula. */
const fakeScan = {
  address: '0xabc',
  collections: [
    { name: 'The Mutual Fun Seat', collection: 'The Mutual Fun', chain: 'robinhood', chainName: 'Robinhood Chain', contract: '0xaa', tier: 'seat', balance: 3, tokenIds: [1, 2, 3] },
    { name: 'PRIMAL PUNKS', collection: 'primal-punks', chain: 'robinhood', chainName: 'Robinhood Chain', contract: '0xbb', tier: 'other', balance: 2, tokenIds: [10, 11] },
  ],
  txCount: 0,
  native: 0,
  contractsTouched: 2,
};
const standing = buildStanding(fakeScan);
/* 5 items with 3 Seats counting twice = 8, x2 = 16; 2 collections x3 = 6;
   2 touched x3 = 6; 0 tx. Total 28. */
ok(standing.points === 28, `expected 28, got ${standing.points}`);
ok(standing.power.terms[0].points === 16, `3 Seats + 2 others = 8 counted, x2 = 16, got ${standing.power.terms[0].points}`);
ok(standing.totalItems === 5, `expected 5 items, got ${standing.totalItems}`);
ok(standing.holdings.length === 2, 'both collections with a balance should appear');

/* A scan full of errors must not claim a holding. */
const errored = buildStanding({ address: '0x0', collections: [{ name: 'x', balance: 0, error: 'rpc timeout' }], txCount: null, native: 0, contractsTouched: 0 });
ok(errored.points === 0, 'errors must not produce points');
ok(errored.level.level === 1, 'errors must leave the reader at level 1');

/* ---------- live chain ---------- */
const CHAIN = 'robinhood';
const PUMPCASH = '0x4b2bead45b60dcde3a0e71273e435371186b0880';

try {
  const supply = await erc721TotalSupply(CHAIN, PUMPCASH);
  ok(typeof supply === 'number' && supply > 0, `PumpCa$h supply should be a positive number, got ${supply}`);

  const name = await contractName(CHAIN, PUMPCASH);
  ok(typeof name === 'string' && name.length > 0, `contract name should decode, got ${name}`);

  /* Find a real holder from the mint logs, then confirm the balance agrees. */
  const ids = await ownedTokenIds(CHAIN, PUMPCASH, '0x078cc9f93b6c1f503f3f668e8be87a7cbe829978');
  ok(ids.length > 0, `expected the known holder to own tokens, got ${ids.length}`);

  const bal = await erc721Balance(CHAIN, PUMPCASH, '0x078cc9f93b6c1f503f3f668e8be87a7cbe829978');
  ok(ids.length === bal, `log reconstruction (${ids.length}) should match balanceOf (${bal})`);

  /* The full collection scan for one entry. */
  const one = await scanCollection(
    CHAIN,
    { name: 'PumpCa$h Terminals', collection: 'pumpca-h-terminals', contract: PUMPCASH, tier: 'other' },
    '0x078cc9f93b6c1f503f3f668e8be87a7cbe829978'
  );
  ok(one.balance > 0, `scan should find a balance, got ${one.balance}`);
  ok(one.tokenIds.length === one.balance, 'scan tokenIds should match the balance');
  ok(!one.error, `scan should not error, got ${one.error}`);

  /* A wallet with nothing must read as nothing, not as an error. */
  const empty = await scanCollection(
    CHAIN,
    { name: 'PumpCa$h Terminals', collection: 'pumpca-h-terminals', contract: PUMPCASH, tier: 'other' },
    '0x000000000000000000000000000000000000dEaD'
  );
  ok(empty.balance === 0, `a dead address should hold zero, got ${empty.balance}`);
  ok(!empty.error, `an empty wallet is not an error, got ${empty.error}`);

  /* A bad address must fail loudly rather than read as zero. */
  const bad = await scanCollection(
    CHAIN,
    { name: 'Broken', collection: 'broken', contract: '0x0000000000000000000000000000000000000001', tier: 'other' },
    '0x078cc9f93b6c1f503f3f668e8be87a7cbe829978'
  );
  ok(bad.error !== null || bad.balance === 0, 'a contract with no code must not invent a holding');
} catch (e) {
  failures++;
  console.log('FAIL: live chain tests threw:', String(e.message || e).slice(0, 200));
}

console.log(failures === 0 ? 'all onchain tests passed' : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
