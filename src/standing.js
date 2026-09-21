/* Holdings to chair. Deterministic, and every step is shown to the reader.
   The chair ladder is the house's own published rarity table. The level and
   the power score are this tool's own scale, and the interface says so. */

import { computePower, LEVELS } from './power.js';
import { SCAN_DEPTH_BLOCKS } from './discover.js';

export const LADDER_RUNGS = [
  { rung: 1, chair: 'The Interns Folding Chair', seats: 1235, pct: 30.87 },
  { rung: 2, chair: 'Beige Task Chair', seats: 777, pct: 19.42 },
  { rung: 3, chair: 'Creaking Wooden Swivel', seats: 850, pct: 21.24 },
  { rung: 4, chair: 'Green Bankers Chair', seats: 560, pct: 14.0 },
  { rung: 5, chair: 'Oxblood Wingback', seats: 271, pct: 6.77 },
  { rung: 6, chair: 'Deep Button Chesterfield', seats: 179, pct: 4.47 },
  { rung: 7, chair: 'Tasteful Walnut Lounge', seats: 88, pct: 2.2 },
  { rung: 8, chair: 'The Gilded Throne', seats: 37, pct: 0.92 },
];

export { LEVELS };

/* Higher rungs need more power. The bands are spaced so a wallet with no
   history sits low and a large book tops out at the Throne. */
export function rungFor(points, holdings = []) {
  if (points <= 0) return 1;
  if (points < 40) return 2;
  if (points < 110) return 3;
  if (points < 220) return 4;
  if (points < 400) return 5;
  if (points < 700) return 6;
  if (points < 1100) return 7;
  return 8;
}

export function chairFor(rung) {
  return LADDER_RUNGS.find((r) => r.rung === rung) || LADDER_RUNGS[0];
}

/* How much of the building sits below you, using the published seat counts.

   One honest note on the numbers. The house states a supply of 4,001 and the
   frame table sums to exactly that, but the chair table sums to 3,997. Four
   Seats are unaccounted for in the published ladder. This function therefore
   reports both figures rather than quietly picking one, and the interface
   surfaces the gap. */
export const STATED_SUPPLY = 4001;
export const CHAIR_TABLE_SUM = 3997;
export const CHAIR_TABLE_GAP = STATED_SUPPLY - CHAIR_TABLE_SUM; // 4

export function shareBelow(rung) {
  const total = STATED_SUPPLY;
  const covered = LADDER_RUNGS.reduce((s, r) => s + r.seats, 0);
  const below = LADDER_RUNGS.filter((r) => r.rung < rung).reduce((s, r) => s + r.seats, 0);
  const atOrBelow = below + (chairFor(rung)?.seats || 0);
  return {
    total,
    covered,
    gap: CHAIR_TABLE_GAP,
    below,
    atOrBelow,
    pctBelow: total ? (below / total) * 100 : 0,
    rarerThan: total ? ((total - atOrBelow) / total) * 100 : 0,
    /* How many Seats you sit above, stated as a count, using the counts
       the house actually published rather than a share of a rounded total. */
    seatsBelow: below,
  };
}

/* Build the readable result from an OpenSea read.

   This is the fastest path: one request through the desk's proxy, about a
   second and a half. It under reports on this chain, so whenever the explorer
   also answers the caller reconciles the two and prefers the larger. That
   difference is carried on the result as openseaTotal and explorerTotal rather
   than being averaged away or hidden. */
export function buildFromOpenSea(address, r) {
  const collections = r.collections || [];
  const holdings = collections.map((c) => ({
    name: c.name || c.slug || c.contract,
    contract: c.contract,
    slug: c.slug || null,
    tier: 'other',
    count: c.count,
    tokenIds: c.tokenIds || [],
    image: (c.art && c.art.image) || null,
    chain: 'robinhood',
  }));

  const totalItems = holdings.reduce((s, h) => s + h.count, 0);

  const base = {
    address,
    discovered: true,
    source: 'opensea',
    candidates: holdings.length,
    totalItems,
    holdings,
    collectionsWithHits: holdings.length,
    contractsTouched: holdings.length,
    excludedTokens: 0,
    errors: 0,
    scannedChains: ['Robinhood Chain'],
    txCount: null,
    txCountSource: null,
    nativeBalance: null,
    hitDepthLimit: false,
  };

  const power = computePower(base);
  const rung = rungFor(power.total, holdings);
  const chair = chairFor(rung);
  const share = shareBelow(rung);
  const nextRung = LADDER_RUNGS.find((r2) => r2.rung === rung + 1) || null;

  return {
    ...base,
    points: power.total,
    power,
    level: power.level,
    rung,
    chair,
    share,
    nextRung,
    pointsToNext: power.toNext,
    seatCount: 0,
  };
}

/* Build the readable result from a Blockscout read.

   This is the fast path. The explorer has already indexed the wallet, so no
   log walk happens here and the whole read is three requests. What comes back
   is the explorer's record, and the interface says so, so a reader always
   knows whether a number was read from the chain or from the explorer. */
export function buildFromExplorer(address, r) {
  const collections = r.collections || [];
  const holdings = collections.map((c) => ({
    name: c.name || c.symbol || c.contract,
    contract: c.contract,
    tier: 'other',
    count: c.count,
    tokenIds: c.tokenIds || [],
    chain: 'robinhood',
  }));

  const totalItems = holdings.reduce((s, h) => s + h.count, 0);

  const base = {
    address,
    discovered: true,
    source: 'explorer',
    candidates: holdings.length,
    totalItems,
    holdings,
    collectionsWithHits: holdings.length,
    contractsTouched: holdings.length,
    excludedTokens: 0,
    errors: 0,
    scannedChains: ['Robinhood Chain'],
    txCount: r.counters ? r.counters.transactions : null,
    txCountSource: r.counters ? 'explorer' : null,
    nativeBalance: r.summary ? r.summary.nativeBalance : null,
    isContract: r.summary ? r.summary.isContract : null,
    nftTruncated: !!r.nftTruncated,
    hitDepthLimit: false,
  };

  const power = computePower(base);
  const rung = rungFor(power.total, holdings);
  const chair = chairFor(rung);
  const share = shareBelow(rung);
  const nextRung = LADDER_RUNGS.find((r2) => r2.rung === rung + 1) || null;

  return {
    ...base,
    points: power.total,
    power,
    level: power.level,
    rung,
    chair,
    share,
    nextRung,
    pointsToNext: power.toNext,
    seatCount: 0,
  };
}

/* Build the readable result from a discovery run. Discovery works on the
   whole chain rather than a fixed list, so every collection found counts as
   one toward the breadth term. */
export function buildFromDiscovery(address, res) {
  const collections = res.collections || [];
  const holdings = collections
    .map((c) => ({
      name: c.name || c.contract,
      contract: c.contract,
      tier: c.tier || 'other',
      count: c.held,
      tokenIds: c.tokenIds || [],
      note: c.note,
      chain: 'robinhood',
    }))
    .sort((a, b) => b.count - a.count);

  const totalItems = holdings.reduce((s, h) => s + h.count, 0);
  const seatCount = holdings.filter((h) => h.tier === 'seat').reduce((s, h) => s + h.count, 0);

  const base = {
    address,
    discovered: true,
    candidates: (res.candidates || []).length,
    totalItems,
    holdings,
    /* Each collection found is its own thing, so breadth is the count of
       collections rather than a number read from a registry. */
    collectionsWithHits: holdings.length,
    contractsTouched: holdings.length,
    excludedTokens: (res.tokens || []).length,
    errors: 0,
    scannedChains: ['Robinhood Chain'],
    txCount: null,
    nativeBalance: 0,
    /* How deep the log walk went, so the limit is stated rather than hidden. */
    hitDepthLimit: !!(res.coverage && res.coverage.hitDepthLimit),
    scanDepthBlocks: SCAN_DEPTH_BLOCKS,
  };

  const power = computePower(base);
  const rung = rungFor(power.total, holdings);
  const chair = chairFor(rung);
  const share = shareBelow(rung);
  const nextRung = LADDER_RUNGS.find((r) => r.rung === rung + 1) || null;

  return {
    ...base,
    points: power.total,
    power,
    level: power.level,
    rung,
    chair,
    share,
    nextRung,
    pointsToNext: power.toNext,
    seatCount,
  };
}

/* Build the readable result from a finished scan. */
export function buildStanding(scanInput) {
  /* Accept either the raw collection array or the wrapper scanWallet returns. */
  const scan = Array.isArray(scanInput) ? scanInput : scanInput.collections || [];
  const wallet = Array.isArray(scanInput)
    ? { txCount: null, native: 0, contractsTouched: 0 }
    : scanInput;

  const holdings = [];
  let totalItems = 0;

  for (const c of scan) {
    if (!c || c.error || !c.balance) continue;
    const counted = c.tokenIds.length || c.balance;
    totalItems += counted;
    holdings.push({
      name: c.name,
      collection: c.collection,
      chain: c.chain,
      chainName: c.chainName,
      contract: c.contract,
      tier: c.tier,
      count: counted,
      tokenIds: c.tokenIds,
      note: c.note,
      url: c.explorer ? `${c.explorer}/token/${c.contract}` : null,
      rare: !!c.rare,
    });
  }

  holdings.sort((a, b) => b.count - a.count);

  const base = {
    address: scanInput.address,
    totalItems,
    holdings,
    collectionsWithHits: holdings.length,
    errors: scan.filter((s) => s && s.error).length,
    scannedChains: [...new Set(scan.filter((s) => s && s.balance).map((s) => s.chainName))],
    txCount: wallet.txCount ?? null,
    nativeBalance: wallet.native || 0,
    contractsTouched: wallet.contractsTouched || 0,
  };

  const power = computePower(base);
  const rung = rungFor(power.total, holdings);
  const chair = chairFor(rung);
  const share = shareBelow(rung);

  const nextRung = LADDER_RUNGS.find((r) => r.rung === rung + 1) || null;
  const needForNext = nextRung
    ? [
        { min: 2, at: 3 }, { min: 4, at: 4 }, { min: 7, at: 5 },
        { min: 12, at: 6 }, { min: 20, at: 7 }, { min: 35, at: 8 },
      ].find((x) => x.at === nextRung.rung)
    : null;

  return {
    ...base,
    points: power.total,
    power,
    level: power.level,
    rung,
    chair,
    share,
    nextRung,
    pointsToNext: power.toNext,
  };
}
