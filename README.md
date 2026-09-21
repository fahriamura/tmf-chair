# The Chair Desk

A community tool for holders of The Mutual Fun, built from the public UGC supplies.

Three desks and a reference page, all static, no backend, no API key, no wallet connection.

1. **Where Is Your Seat** reads any wallet's NFT holdings straight from public nodes, scores it on a fixed four-term power formula, and puts the holder on the house's own chair ladder. Then it draws a card you can post.
2. **The Art Department** shows the 25 supplied portraits, the chair ladder, the frames, the Weirdos and the standout pieces, with the published odds.
3. **Not Yet Found** keeps a private record of your own read of the eleven executive portraits the house still lists as unfound.
4. **The Rules** carries the house style and the rates, verbatim from the supply room files.

## The power formula

Fixed weights, four terms, every figure read from a node.

| # | Term | Weight | Read from |
| --- | --- | --- | --- |
| 1 | Holdings in the collections read | x2 | `balanceOf` per collection, Seats counted twice |
| 2 | NFT portfolio breadth | x3 | distinct collections held |
| 3 | Wallet portfolio | x3 | distinct contracts touched, plus one if a native balance is held |
| 4 | On-chain transactions | x1 | `eth_getTransactionCount`, which is the account nonce |

Example, and this is a real scan of a real wallet on Robinhood Chain:

```
holdings     450 items (337 + 113, Seats absent)   x2  =  900
nft breadth  2 collections                          x3  =    6
wallet       2 contracts + 1 funded balance         x3  =    9
transactions 234                                    x1  =  234
                                                   total = 1149   Level 10
```

The breakdown is printed in the interface term by term, so anyone can check the sum by hand.

## How the reading works

Three sources, tried in order of speed. No sign in, nothing stored.

### OpenSea, through a small proxy

Fastest, one request, about a second and a half. The browser never sees the
OpenSea key: it talks to `server.mjs`, which holds the key in its environment and
exposes a fixed set of reads, so it cannot be turned into an open relay. Putting
the key in the app would hand it to anyone who opens a network tab.

OpenSea is used for artwork, slugs and traits, which are better than what the
chain gives us. It is not used for the count on its own, for one measured
reason: its holdings endpoint under reports on Robinhood Chain. A wallet holding
thirty five NFTs across twenty collections comes back as twenty two across
fourteen, and that includes collections OpenSea demonstrably knows, down to the
individual owner of a token, which are simply absent from the list. So whenever
the explorer also answers, the two are reconciled, the larger is shown, and the
difference is stated in the interface rather than hidden.

If the proxy is not deployed, the app notices and carries on without it.

### The chain explorer

The chain has its own block explorer at `robinhoodchain.blockscout.com`, and its
API is public. It has already indexed every transfer, so it can answer "what
does this wallet hold" and "how many transactions has it sent" in three
requests, about three to six seconds, with no walk of the wallet's history at
all. This is what runs by default.

Two honest notes about it. The explorer is a different party from the chain, so
its figures are its record rather than the chain's own word, and the interface
says so. And it sits behind Cloudflare, which refuses a scripted client but
serves a real browser normally, which is what the app is.

### The last resort: reading the chain itself

If neither of the above can be reached, the desk reads the chain directly, which
takes about a minute and depends on nobody's index. Everything below describes
that path.

No indexer and no API key. Everything goes over plain JSON-RPC.

**Collections are discovered, not listed.** The scanner reads the wallet's own
`Transfer` logs in both directions and builds the list of every contract it has
touched. This replaced a hand written registry of seven collections, which read
a wallet holding fifty NFTs across thirty small collections as zero, because no
hand written list is ever complete.

Then, for each candidate:

- **Is it an NFT?** `ownerOf` on a token the wallet was seen with. A raw
  `balanceOf` cannot tell an NFT from a fungible token, and reading a token
  balance as chairs invents millions of them. Fungible tokens are counted
  separately and reported as excluded.
- **How many are held?** `balanceOf`, reconciled against the reconstructed
  token ids. A disagreement is printed rather than smoothed over.
- **Token ids** stay as strings throughout, because several collections on this
  chain use ids past `Number.MAX_SAFE_INTEGER`. Converting them to `Number`
  rounds them and the probe then misses real holdings.
- **Transactions** come from `eth_getTransactionCount`, the account nonce.
- **Native balance** comes from `eth_getBalance`.

Two honesty rules held throughout: nothing is estimated, and anything that could
not be read is reported rather than shown as a zero.

### Why the direct path is slow, and why it needed different treatment

Measured on this endpoint: a single `eth_call` is about a quarter of a second,
and a single one million block log window is the same. The cost is not any one
request, it is that a full discovery needs on the order of a hundred and eighty
of them. That is where the minute goes.

Three things follow from that, each learned the hard way.

**Parallel log queries do not help.** Two at once already start to trip the rate
limit and four at once gets almost everything refused, so the walk goes one
window at a time and the speed comes from not pausing between windows.

**A refused window is not an empty window.** In a browser a rate limit arrives
without CORS headers, so it surfaces as an opaque `Failed to fetch` rather than
a 429. An earlier version let failures pass as empty and a wallet with twenty
collections read as one. Failures are now counted and reported.

**Activity is not contiguous.** An earlier version stopped the walk at the first
empty band, on the assumption that a wallet's history is one unbroken run. It is
not. The wallet used for testing has real holdings, then a gap of empty bands,
then more history. Sweeping the whole depth window is both correct and, because
the reads are cheap, fast enough.

The walk is bounded to thirty million blocks, because a full walk from genesis
is around seventy windows per direction and the endpoint refuses long before
that finishes. The bound is safe: current holdings are confirmed with `balanceOf`
and `ownerOf`, which are per block reads and always current. The interface states
the depth whenever the limit is reached.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # both suites
npm run build      # writes dist/
npm run preview    # serve the production build
```

## Deploying to Vercel

`vercel.json` is in the repo, so Vercel needs no manual settings.

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

Or push to a repository and import it at vercel.com. Vercel reads `vercel.json`, picks up Vite, and uses `npm run build` with `dist`.

`base: './'` is set in `vite.config.js`, so the build also works from a subpath or straight off the filesystem.

## Layout

```
index.html              shell, fonts, meta
vite.config.js          react plugin, base './'
vercel.json             framework, build command, output dir, caching
public/assets/          25 portraits as svg and png, 25 cutouts, the medallion
src/
  main.jsx              mount
  App.jsx               masthead, tabs, hash routing, footer
  WalletStanding.jsx    desk one, the scan and the results
  ChairCard.jsx         the standing panel and the power breakdown
  ShareCard.jsx         the 1080 square card, drawn on canvas
  Gallery.jsx           the art, the ladder, the odds
  Rules.jsx             the house style and the rates
  blockscout.js         the explorer read, the fast path
  opensea.js            artwork and slugs, through the proxy
  server.mjs            the proxy, holds the key off the browser
  onchain.js            JSON-RPC, log reconstruction, failover, retry
  registry.js           the collections the scan walks
  power.js              the four-term formula and the level scale
  standing.js           ladder mapping and the published share
  engine.js             the house-style scorer
  lib.js                localStorage persistence, clipboard
  tests/
    engine.test.mjs     the house rules and the formula
    onchain.test.mjs    the chain reading, against live wallets
    blockscout.test.mjs the explorer read, cross checked against the chain
    discover.test.mjs   discovery, against a live wallet
```

## Adding the TMF Seat when it launches

The Seat and TMF Pass contracts are not deployed yet, and the site ships its own address book as zero addresses, so the scan says so rather than pretending. When they launch, edit `src/registry.js`:

```js
{
  id: 'tmf-seat',
  name: 'The Mutual Fun Seat',
  chain: 'robinhood',
  contract: '0x...',   // paste it here
  tier: 'seat',
  enabled: true,       // and flip this
}
```

Nothing else changes. The scan picks it up, Seats count double in term 1, and the pending notice disappears from the panel.

## Two things about the published numbers

**The chair table is four short.** The house states a supply of 4,001 and the frame table sums to exactly 4,001, but the chair table sums to 3,997. Four Seats are unaccounted for. The tool shows both figures and works the share against the stated supply so it is never overstated. This is asserted in the tests so it cannot silently drift.

**The percentages are computed against 4,001**, not against the chair table's own total, which is confirmed by the arithmetic: 1,235 of 4,001 is 30.87 percent, while 1,235 of 3,997 is 30.90.

## Reliability notes

A public endpoint will drop calls after a burst of log reads. Three things handle that:

- **Failover** between several public endpoints per chain, remembering the healthy one.
- **A gap and a pause** between collections, and again before the wallet calls go out.
- **Retry with backoff** on the wallet figures, because writing a zero into a term the reader is going to trust is worse than waiting.

Transaction counts and native balances read deterministically across repeated runs once this is in place. Before it, repeated scans of the same wallet returned different totals. That bug is why term 4 shows "not read" rather than zero when a count genuinely cannot be fetched.

## Share to X

The card exports as a PNG and the caption is written for you, then checked
against the same house rules the desk enforces. A caption cannot ship with a
dash, an exclamation mark or invitation language. Share to X saves the card and
opens the composer with the caption filled in; the image is attached by hand
because an intent URL cannot carry one.

## Credit and purpose

Built for fun by a holder, [@absolya227](https://x.com/absolya227). Not
official, not affiliated, not endorsed. The credit sits in the footer and on
every card that gets shared.

## Verified

- **Tests**: three suites pass, engine, explorer and discovery. The formula is asserted against hand-worked numbers. The explorer suite folds results and cross checks the top collection against the chain. The discovery suite runs against a live wallet.
- **The regression this guards**: a wallet holding roughly forty NFTs across twenty small collections, which the old fixed registry read as zero. Discovery finds all twenty collections, and the count is cross-checked against raw `balanceOf` calls collection by collection.
- **Speed**: the explorer path answers in three to six seconds in a real browser, measured end to end. The direct path takes around a minute and is only used as a fallback.
- **Cross check**: the explorer's count and the chain's `balanceOf` were compared for six collections and agreed on all six.
- **Source reconciliation**: on the test wallet the chain finds thirty five NFTs and OpenSea finds twenty two. The desk shows the larger and says both numbers. On a second wallet the chain finds five hundred and OpenSea four hundred.
- **Key safety**: the OpenSea key is server side only. Verified that it does not appear in any response, and that arbitrary paths, non addresses and non GET methods are all refused by the proxy.
- **Browser**: zero console errors and zero JS exceptions on the production build. All three desks, hash routing, the gallery filter, the zoom, the caption check and the card export all exercised.
- **Card**: renders at 1080 by 1080 on the house paper colour, with the fun notice and the credit on it, and exports as a PNG.

## Honest scope

- The chair ladder is the house's published table. The power formula and the level scale are this tool's own, and the interface says so.
- Holdings are read from public RPC endpoints and can be checked against a block explorer. The contracts read are listed in the interface.
- The scan is read only. It never asks for a signature and never touches a key.
- Assets and rules belong to The Mutual Fun. This is an independent holder-built tool, used under the terms in `for-your-machine.md`, claiming no endorsement.
