import { useState, useRef, useCallback } from 'react';
import { normaliseAddress } from './onchain.js';
import { discoverHoldings } from './discover.js';
import { readWalletFast } from './blockscout.js';
import { proxyAvailable, openSeaHoldings } from './opensea.js';
import { buildFromDiscovery, buildFromExplorer, LADDER_RUNGS } from './standing.js';
import { usePersistedState } from './lib.js';
import ChairCard, { PowerBreakdown } from './ChairCard.jsx';

export default function WalletStanding({ onShare }) {
  const [address, setAddress] = usePersistedState('tmf.wallet.address', '');
  const [standing, setStanding] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [elapsed, setElapsed] = useState(null);
  const abortRef = useRef(false);

  const scan = useCallback(async (addrIn) => {
    const addr = normaliseAddress(addrIn);
    if (!addr) {
      setErr('That is not an address. A wallet is 0x followed by forty characters.');
      setStanding(null);
      return;
    }
    setErr('');
    setNote('');
    setElapsed(null);
    setBusy(true);
    setStanding(null);
    setProgress({ msg: 'Reading the wallet', frac: 0.05 });
    abortRef.current = false;
    const t0 = performance.now();

    /* Three sources, tried in order of speed.

       OpenSea first, one request, about a second and a half. Then the chain
       explorer, which is complete but a little slower. Then the chain itself,
       which is slowest but depends on nobody's index.

       The sources are not treated as equals. OpenSea under reports on this
       chain, so when the explorer also answers, the two are reconciled and the
       larger figure is used, with the difference stated rather than hidden. */
    let settled = false;

    const viaOpenSea = async () => {
      if (!addr) return null;
      const hasProxy = await proxyAvailable();
      if (!hasProxy) return null;
      return openSeaHoldings(addr);
    };

    const viaExplorer = async () => {
      return readWalletFast('robinhood', addr, (msg, frac) => {
        if (!abortRef.current) setProgress({ msg, frac: 0.15 + frac * 0.7 });
      });
    };

    try {
      const os = await viaOpenSea();
      if (abortRef.current) return;
      if (os && os.collections.length > 0) {
        setProgress({ msg: 'Checking the explorer for anything it missed', frac: 0.6 });
        let ex = null;
        try {
          ex = await viaExplorer();
        } catch {
          /* the explorer is an addition here, not a requirement */
        }
        if (abortRef.current) return;

        const exTotal = ex ? ex.collections.reduce((s, c) => s + c.count, 0) : 0;
        const standingBuilt =
          ex && exTotal > os.totalItems
            ? buildFromExplorer(addr, ex) // the chain's view is the fuller one
            : buildFromOpenSea(addr, os);

        setStanding({
          ...standingBuilt,
          openseaTotal: os.totalItems,
          explorerTotal: exTotal || null,
          sourcesCompared: !!ex,
        });
        if (ex && exTotal > os.totalItems) {
          setNote(
            `OpenSea lists ${os.totalItems} items, the chain explorer finds ${exTotal}. The desk is showing the larger, more complete figure from the explorer.`
          );
        } else if (ex && exTotal > 0 && exTotal < os.totalItems) {
          setNote(`OpenSea lists ${os.totalItems} items, the chain explorer finds ${exTotal}.`);
        }
        settled = true;
        setElapsed(((performance.now() - t0) / 1000).toFixed(1));
        setBusy(false);
        setProgress(null);
        return;
      }
    } catch {
      /* fall through */
    }

    if (settled || abortRef.current) return;

    /* No proxy, or OpenSea had nothing. The explorer is complete, so it is the
       better source anyway when it is reachable. */
    try {
      setProgress({ msg: 'Asking the chain explorer', frac: 0.3 });
      const ex = await viaExplorer();
      if (abortRef.current) return;
      if (ex && ex.collections) {
        setStanding(buildFromExplorer(addr, ex));
        setElapsed(((performance.now() - t0) / 1000).toFixed(1));
        setBusy(false);
        setProgress(null);
        return;
      }
    } catch {
      /* fall through to the chain read */
    }

    if (abortRef.current) return;
    setNote('The explorer could not be reached, so the desk is reading the chain directly. This takes longer.');
    setProgress({ msg: 'Reading the chain directly', frac: 0.05 });

    try {
      const res = await discoverHoldings('robinhood', addr, (msg, frac) => {
        if (!abortRef.current) setProgress({ msg, frac });
      });
      if (abortRef.current) return;
      setStanding(buildFromDiscovery(addr, res));
      setElapsed(((performance.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setErr(String(e.message || e).slice(0, 220));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    scan(address);
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Read a wallet</h2>
          <p className="hint">
            Paste any address. The desk reads what the wallet holds and puts the holder on the chair ladder. No sign
            in, no wallet connection, nothing stored. Read only.
          </p>
          <form onSubmit={onSubmit}>
            <label className="fld">
              <span>Wallet address</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="go"
              />
            </label>
            <div className="btnrow">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Reading the chain' : 'Read it'}
              </button>
              {standing && (
                <button className="btn btn-ghost" type="button" onClick={() => onShare(standing)}>
                  Make a card
                </button>
              )}
            </div>
          </form>

          {progress && (
            <div className="progress">
              <div className="progress-bar">
                <i style={{ width: `${Math.min(100, progress.frac * 100)}%` }} />
              </div>
              <span className="progress-txt">{progress.msg}</span>
            </div>
          )}

          {note && <p className="hint small">{note}</p>}
          {err && <p className="err">{err}</p>}
          {elapsed && !busy && <p className="hint small read-time">Read in {elapsed}s.</p>}

          {!busy && !standing && !err && (
            <p className="hint small">
              Nothing is read from a server of ours holding your data. The read runs here in the browser and against
              public endpoints, and every figure can be checked against a block explorer.
            </p>
          )}
        </div>

        <ChairCard standing={standing} />
      </div>

      {standing && (
        <>
          <PowerBreakdown power={standing.power} />

          <div className="card">
            <h2>What was found</h2>
            <p className="hint">
              {standing.discovered
                ? `The desk read ${standing.candidates} contracts from this wallet's transfer history and found NFTs in ${standing.holdings.length}. Every count below comes from the chain.`
                : 'Every line is a collection the desk read on chain.'}
            </p>
            {standing.holdings.length === 0 ? (
              <div className="clear">
                <strong>No chair found.</strong> This wallet holds no NFTs in the collections the desk could read. That
                is level 1, outside the building. The door is open.
              </div>
            ) : (
                          <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th className="num">Held</th>
                    <th>Token IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {standing.holdings.map((h) => (
                    <tr key={h.contract}>
                      <td>
                        <a href={`https://robin.etherscan.io/token/${h.contract}`} target="_blank" rel="noreferrer">
                          {h.name || h.contract}
                        </a>
                        {h.note && <div className="hint small">{h.note}</div>}
                      </td>
                      <td className="num">{h.count}</td>
                      <td className="mono small">
                        {h.tokenIds && h.tokenIds.length
                          ? h.tokenIds.slice(0, 6).map((t) => (t.length > 10 ? t.slice(0, 6) + '…' : t)).join(', ') +
                            (h.tokenIds.length > 6 ? ` +${h.tokenIds.length - 6} more` : '')
                          : h.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
                      <strong>Total NFTs</strong>
                    </td>
                    <td className="num">
                      <strong>{standing.totalItems}</strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            )}
            {standing.excludedTokens > 0 && (
              <p className="hint small">
                {standing.excludedTokens} fungible {standing.excludedTokens === 1 ? 'token was' : 'tokens were'} left out
                of the count. A token balance is not a chair, and counting one as chairs would invent millions of them.
              </p>
            )}
            {standing.hitDepthLimit && (
              <p className="hint small depth-note">
                The transfer history walk went back {Math.round(standing.scanDepthBlocks / 1e6)} million blocks, which
                is as far as public nodes answer reliably. A collection this wallet holds but has not touched inside
                that range may not be listed. Holdings in everything found are confirmed against the chain itself, so
                the counts shown are current.
              </p>
            )}
            {standing.source === 'explorer' && (
              <p className="hint small depth-note">
                Collections and counts come from the chain explorer, which indexes every transfer so this read does not
                have to walk the wallet's history. The explorer is a different party from the chain, so treat its
                figures as its record rather than the chain's own word. Everything here can be checked against a block
                explorer directly.
              </p>
            )}
            {standing.nftTruncated && (
              <p className="hint small depth-note">
                This wallet holds more NFTs than one page of results. The list shown stops at the page limit, so the
                total is a floor rather than a full count.
              </p>
            )}
          </div>

          <div className="card">
            <h2>The ladder, and where this wallet sits</h2>
            <p className="hint">The published chair table, with the rung this wallet reaches on this desk's scale.</p>
                        <div className="tbl-scroll">
              <table className="tbl">
              <thead>
                <tr>
                  <th className="num">Rung</th>
                  <th>Chair</th>
                  <th className="num">Seats</th>
                  <th className="num">Rarity</th>
                </tr>
              </thead>
              <tbody>
                {LADDER_RUNGS.map((l) => (
                  <tr key={l.rung} className={l.rung === standing.rung ? 'mine' : ''}>
                    <td className="num">{l.rung}</td>
                    <td>{l.chair}</td>
                    <td className="num">{l.seats.toLocaleString('en-US')}</td>
                    <td className="num">{l.pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="hint small">
              The published chair counts sum to {standing.share.covered.toLocaleString('en-US')}, while the house states
              a supply of {standing.share.total.toLocaleString('en-US')}. {standing.share.gap} Seats are unaccounted for
              in the chair table. The share below is worked out against the stated supply, so it is never overstated.
            </p>
          </div>
        </>
      )}
    </>
  );
}
