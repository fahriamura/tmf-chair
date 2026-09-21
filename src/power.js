/* Wallet power. The formula is fixed and every term is shown to the reader:

     1. NFT held in the collection        x2
     2. Portfolio of NFTs, distinct cols  x3
     3. Portfolio of the wallet, breadth  x3
     4. Transactions on chain             x1

   Nothing here guesses. Each term is computed from a figure the scan read
   from a node, and the breakdown is printed so anyone can check the sum. */

export const WEIGHTS = {
  holding: 2,
  nftPortfolio: 3,
  walletPortfolio: 3,
  transactions: 1,
};

export const LEVELS = [
  { min: 0, level: 1, title: 'Outside the Building', note: 'No chair yet. The lobby is warm and the door is open.' },
  { min: 7, level: 2, title: 'Signed the Guest Book', note: 'On the record. No chair, but the name is in the book.' },
  { min: 18, level: 3, title: 'First Chair', note: 'One chair, one Seat. The ladder starts here.' },
  { min: 40, level: 4, title: 'Junior Partner', note: 'A small book of chairs and a desk of your own.' },
  { min: 75, level: 5, title: 'Desk Manager', note: 'Enough chairs to run a floor of the building.' },
  { min: 130, level: 6, title: 'Floor Director', note: 'The chairs have chairs of their own.' },
  { min: 220, level: 7, title: 'The Two Percent', note: 'Deep in the building. People ask you how the fund is.' },
  { min: 360, level: 8, title: 'Anchor Holder', note: 'A book that moves the room when it votes.' },
  { min: 560, level: 9, title: 'The Chairman Circle', note: 'Large enough that the lobby knows the name.' },
  { min: 850, level: 10, title: 'Institutional', note: 'This is a desk the building plans around.' },
];

/* Term 1. Raw NFT count across the collections read, Seats counting double
   because they are the ones that vote and carry a Briefcase. */
export function holdingScore(standing) {
  const raw = standing.totalItems || 0;
  const seatBoost = standing.holdings.filter((h) => h.tier === 'seat').reduce((s, h) => s + h.count, 0);
  const effective = raw + seatBoost; // Seats counted once more, so x2 overall
  return { raw, seatBoost, effective, weighted: effective * WEIGHTS.holding };
}

/* Term 2. The NFT portfolio, measured as how many distinct collections the
   wallet holds something in. Breadth, not size, so a wallet spread across
   many collections reads stronger than one holding a stack in a single drop. */
export function nftPortfolioScore(standing) {
  const distinct = standing.collectionsWithHits || 0;
  return { distinct, weighted: distinct * WEIGHTS.nftPortfolio };
}

/* Term 3. The wallet portfolio, measured on the wallet's own breadth: how
   many distinct contracts answered with either a token balance or activity.
   A plain wallet with no activity reads zero here and the card says so. */
export function walletPortfolioScore(standing) {
  const contracts = standing.contractsTouched || 0;
  const native = standing.nativeBalance || 0;
  const funded = native > 0 ? 1 : 0;
  const distinct = contracts + funded;
  return { contracts, native, funded, distinct, weighted: distinct * WEIGHTS.walletPortfolio };
}

/* Term 4. Transactions. Counted from the node when a count is available,
   otherwise reported as unread rather than invented. */
export function transactionScore(standing) {
  const tx = standing.txCount;
  if (tx === null || tx === undefined) {
    return { read: false, count: null, weighted: 0 };
  }
  return { read: true, count: tx, weighted: tx * WEIGHTS.transactions };
}

/* The four terms, in order, with the working shown. */
export function computePower(standing) {
  const holding = holdingScore(standing);
  const nftPortfolio = nftPortfolioScore(standing);
  const walletPortfolio = walletPortfolioScore(standing);
  const transactions = transactionScore(standing);

  const total =
    holding.weighted + nftPortfolio.weighted + walletPortfolio.weighted + transactions.weighted;

  const level = levelFor(total);
  const next = LEVELS.find((l) => l.min > total) || null;

  return {
    total,
    terms: [
      {
        key: 'holding',
        n: 1,
        label: 'Holdings in the collections read',
        plain: 'NFTs held, with a Seat counted twice',
        value: holding.raw,
        extra: holding.seatBoost ? `+${holding.seatBoost} Seat boost` : null,
        multiplier: WEIGHTS.holding,
        points: holding.weighted,
        detail: `${holding.effective} counted items x ${WEIGHTS.holding}`,
      },
      {
        key: 'nftPortfolio',
        n: 2,
        label: 'NFT portfolio breadth',
        plain: 'Distinct collections held',
        value: nftPortfolio.distinct,
        multiplier: WEIGHTS.nftPortfolio,
        points: nftPortfolio.weighted,
        detail: `${nftPortfolio.distinct} collections x ${WEIGHTS.nftPortfolio}`,
      },
      {
        key: 'walletPortfolio',
        n: 3,
        label: 'Wallet portfolio',
        plain: 'Distinct contracts touched, plus a funded native balance',
        value: walletPortfolio.distinct,
        extra: walletPortfolio.funded ? 'incl. funded native balance' : null,
        multiplier: WEIGHTS.walletPortfolio,
        points: walletPortfolio.weighted,
        detail: `${walletPortfolio.distinct} touched x ${WEIGHTS.walletPortfolio}`,
      },
      {
        key: 'transactions',
        n: 4,
        label: 'On-chain transactions',
        plain: transactions.read
          ? 'Transactions sent by this wallet'
          : 'Not read. This endpoint does not expose a transaction count.',
        value: transactions.read ? transactions.count : null,
        multiplier: WEIGHTS.transactions,
        points: transactions.weighted,
        detail: transactions.read
          ? `${transactions.count} transactions x ${WEIGHTS.transactions}`
          : 'contributes 0 until a count is available',
        unread: !transactions.read,
      },
    ],
    level,
    next,
    toNext: next ? Math.max(0, next.min - total) : 0,
    maxLevel: LEVELS[LEVELS.length - 1].level,
  };
}

export function levelFor(points) {
  let found = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) found = l;
  return found;
}
