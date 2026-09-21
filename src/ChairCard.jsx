import { useRef, useEffect } from 'react';
import { drawChairPixels } from './engine.js';

function StandingChair({ rung }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = 64;
    cv.height = 64;
    const c = cv.getContext('2d');
    const img = c.createImageData(64, 64);
    img.data.set(drawChairPixels(((rung || 1) / 8) * 100));
    c.putImageData(img, 0, 0);
  }, [rung]);
  return <canvas ref={ref} width={64} height={64} className="chair-canvas big-chair" aria-label="Chair mark" />;
}

export default function ChairCard({ standing, pending = [] }) {
  if (!standing) {
    return (
      <div className="card card-result">
        <h2>The standing</h2>
        <div className="verdictbox">
          <div className="vbig pending">Pending</div>
          <div className="vsub">No wallet read yet</div>
        </div>
        <p className="note small">
          Paste an address and press read it. The desk walks the collections on chain, counts what is held, reads the
          wallet figures, and puts the holder on the ladder.
        </p>
        {pending.length > 0 && (
          <div className="pending-note">
            <strong>Not counted yet.</strong>
            <ul className="plain">
              {pending.map((p) => (
                <li key={p.id}>
                  {p.name}: {p.pending}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const { level, chair, points, totalItems, share, holdings, nextRung, pointsToNext, power } = standing;

  return (
    <div className="card card-result">
      <h2>The standing</h2>
      <div className="scoreline">
        <StandingChair rung={standing.rung} />
        <div className="scoreline-txt">
          <div className="level-stamp">Level {level.level} of {power.maxLevel}</div>
          <div className="verdict big-title">{level.title}</div>
          <div className="chair-name">{chair.chair}</div>
        </div>
      </div>
      <p className="note">{level.note}</p>

      <div className="power-total">
        <span className="v">{points}</span>
        <span className="k">wallet power</span>
      </div>

      <div className="figures">
        <div className="figure">
          <span className="v">{totalItems}</span>
          <span className="k">nfts held</span>
        </div>
        <div className="figure">
          <span className="v">{standing.collectionsWithHits}</span>
          <span className="k">collections</span>
        </div>
        <div className="figure">
          <span className="v">{share.pctBelow.toFixed(2)}%</span>
          <span className="k">of the building below</span>
        </div>
      </div>

      <p className="hint small">
        {share.seatsBelow.toLocaleString('en-US')} of the {share.total.toLocaleString('en-US')} stated Seats sit on a
        lower rung than yours.
      </p>

      {nextRung && pointsToNext > 0 && (
        <p className="next">
          {pointsToNext} {pointsToNext === 1 ? 'point' : 'points'} to {nextRung.chair}.
        </p>
      )}

      {holdings.length > 0 && (
        <p className="hint small">
          Read across {holdings.length} {holdings.length === 1 ? 'collection' : 'collections'} on{' '}
          {standing.scannedChains.join(', ')}.
          {standing.errors > 0 && ` ${standing.errors} contracts could not be read and are not counted.`}
        </p>
      )}
    </div>
  );
}

/* The formula, laid out term by term so the total can be checked by hand. */
export function PowerBreakdown({ power }) {
  if (!power) return null;
  return (
    <div className="card">
      <h2>How the power was worked out</h2>
      <p className="hint">Four terms, four fixed weights. Every figure below was read from a node during this scan.</p>
                  <div className="tbl-scroll">
              <table className="tbl power-tbl">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>What is measured</th>
            <th className="num">Read</th>
            <th className="num">Weight</th>
            <th className="num">Points</th>
          </tr>
        </thead>
        <tbody>
          {power.terms.map((t) => (
            <tr key={t.key} className={t.unread ? 'unread' : ''}>
              <td className="num">{t.n}</td>
              <td>
                <strong>{t.label}</strong>
                <div className="hint small">{t.plain}</div>
              </td>
              <td className="num">
                {t.value === null ? 'not read' : t.value}
                {t.extra && <div className="hint small">{t.extra}</div>}
              </td>
              <td className="num">x{t.multiplier}</td>
              <td className="num">
                <strong>{t.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>
              <strong>Total wallet power</strong>
            </td>
            <td />
            <td />
            <td className="num">
              <strong>{power.total}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
            </div>
      <p className="hint small">
        Term 2 counts distinct collections, so breadth beats a stack in one drop. Term 3 counts distinct contracts the
        wallet touched in this scan plus one if it holds a native balance. Term 4 is the account nonce, which is exactly
        the number of transactions the address has sent. Nothing here is estimated.
      </p>
    </div>
  );
}
