/* The collections the scan walks.
   Each entry needs an address that actually exists on the chain named.
   Nothing here is guessed: every contract in this list was read from a
   node while building the tool, and the scan reports an error rather
   than a zero if one stops responding. */

export const REGISTRY = [
  /* ------------------------------------------------------------------
     TMF. The Seat contract is the whole point of this tool, and it is
     NOT deployed yet (the Waiting Room and the mint are still closed,
     and the site ships its address book as zero addresses).
     When it launches, fill these two in and the scan picks them up with
     no other change. Until then the scan reports honestly that it found
     no Seat, rather than pretending a wallet holds one.
     ------------------------------------------------------------------ */
  {
    id: 'tmf-seat',
    name: 'The Mutual Fun Seat',
    collection: 'The Mutual Fun',
    chain: 'robinhood',
    contract: '', // <- paste the TMF Seat address on launch
    tier: 'seat',
    rare: true,
    enabled: false,
    pending: 'The Seat contract is not deployed yet. The mint has not opened.',
  },
  {
    id: 'tmf-pass',
    name: 'A TMF Pass',
    collection: 'The Mutual Fun',
    chain: 'robinhood',
    contract: '', // <- paste the TMF Pass address on launch
    tier: 'pass',
    enabled: false,
    pending: 'The TMF Pass contract is not deployed yet.',
  },

  /* ------------------------------------------------------------------
     Collections live on Robinhood Chain today, verified on this build.
     These are what make the level move while TMF is still closed.
     ------------------------------------------------------------------ */
  {
    id: 'primal-punks',
    name: 'PRIMAL PUNKS',
    collection: 'primal-punks-rh',
    chain: 'robinhood',
    contract: '0x982c2c43bb505e79dca607105473271f970d1dc3',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'pumpcash',
    name: 'PumpCa$h Terminals',
    collection: 'pumpca-h-terminals',
    chain: 'robinhood',
    contract: '0x4b2bead45b60dcde3a0e71273e435371186b0880',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'paperhand',
    name: 'Paperhand Vault',
    collection: 'paperhand-vault',
    chain: 'robinhood',
    contract: '0xb809c142b5c4d372d54ac928ceb353d346c5f72f',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'mirrorpass',
    name: 'Buttonwood MirrorPass',
    collection: 'buttonwood-mirrorpass',
    chain: 'robinhood',
    contract: '0xc6e5dc557cd3a235d061f462b9e83e0fb5d46361',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'wizard-staff',
    name: 'Wizard Staff',
    collection: 'wizard-staff-623267920',
    chain: 'robinhood',
    contract: '0x3c51b909b5b4e48120604d8bf3792f726e5ae54c',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'yakuzi',
    name: 'Yakuzi Immortals',
    collection: 'yakuzi-immortals',
    chain: 'robinhood',
    contract: '0xde3a3384e5ff7ce4e7ef1f77336418985b7525ec',
    tier: 'other',
    enabled: true,
  },
  {
    id: 'arbistocks',
    name: 'Arbistocks',
    collection: 'arbistocks-779751871',
    chain: 'robinhood',
    contract: '0xf4e454f61f7925d2490842b1b931970558118cff',
    tier: 'other',
    enabled: true,
  },
];

export const ACTIVE_REGISTRY = REGISTRY.filter((r) => r.enabled && r.contract);

export const PENDING = REGISTRY.filter((r) => !r.enabled && r.pending);

export function attachChainMeta(entries, chains) {
  return entries.map((e) => ({
    ...e,
    chainName: chains[e.chain]?.name || e.chain,
    explorer: chains[e.chain]?.explorer || null,
  }));
}
