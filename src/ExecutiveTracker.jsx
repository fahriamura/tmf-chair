import { usePersistedState } from './lib.js';

/* The eleven executive portraits. The house publishes the titles and says
   which Seats hold them stays secret until somebody mints one. Every one of
   them reads "not yet found" on their own page today. This desk keeps a
   local record of guesses and shows the pool, nothing more. */

const EXECUTIVES = [
  { id: 'chairman', title: 'The Chairman', note: 'Seat 0. On display in the lobby, never for sale. The one that is not a guess.' },
  { id: 'ghost', title: 'The Fired Analysts Ghost', note: 'Let go in a quarter nobody writes down.' },
  { id: 'night', title: 'The Night Trader', note: 'Works the hours the building is empty.' },
  { id: 'floor', title: 'The Floor Model', note: 'A display unit that was never sent back.' },
  { id: 'offworld', title: 'The Offworld Consultant', note: 'Files from a jurisdiction that is not on the map.' },
  { id: 'founder', title: 'The Founder Who Never Left', note: 'Still has a key and still uses it.' },
  { id: 'two', title: 'The Two Percent', note: 'Enough of the book to change a vote.' },
  { id: 'newyear', title: 'The Fiscal New Year', note: 'Arrives once a year and stays for the paperwork.' },
  { id: 'auditor', title: 'The Auditor', note: 'Reads everything and says nothing.' },
  { id: 'overnight', title: 'The Overnight Analyst', note: 'Holds the desk between the close and the open.' },
  { id: 'retriever', title: 'The Golden Retriever Who Made Partner', note: 'Made partner on merit. The house swears.' },
];

export default function ExecutiveTracker() {
  const [guesses, setGuesses] = usePersistedState('tmf.tracker.guesses', {});
  const [claimed, setClaimed] = usePersistedState('tmf.tracker.claimed', {});

  const setGuess = (id, value) => setGuesses({ ...guesses, [id]: value.replace(/[^\d]/g, '').slice(0, 4) });
  const toggleClaim = (id) => setClaimed({ ...claimed, [id]: !claimed[id] });

  const found = Object.values(claimed).filter(Boolean).length;
  const total = EXECUTIVES.length - 1; // the Chairman is not findable

  const guessedNumbers = Object.values(guesses).filter(Boolean).map(Number);
  const collisions = guessedNumbers.filter((n, i) => guessedNumbers.indexOf(n) !== i);

  return (
    <>
      <div className="card">
        <h2>The eleven, and where they are</h2>
        <p className="hint">
          The house publishes the titles and keeps the Seats secret. Every one of them reads "not yet found" on their
          own page. This desk keeps a private record on your machine of what you think the numbers are, so you can see
          your own read of the collection. Nothing here is sent anywhere, and nothing here is an official list.
        </p>

        <div className="tracker-head">
          <div className="figure">
            <span className="v">
              {found}
              <small>/{total}</small>
            </span>
            <span className="k">marked found by you</span>
          </div>
          <div className="figure">
            <span className="v">{Object.values(guesses).filter(Boolean).length}</span>
            <span className="k">guesses on file</span>
          </div>
          {collisions.length > 0 && (
            <div className="figure">
              <span className="v warn">{new Set(collisions).size}</span>
              <span className="k">numbers used twice</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="exec-grid">
          {EXECUTIVES.map((e) => {
            const isChairman = e.id === 'chairman';
            const g = guesses[e.id] || '';
            const isClaimed = !!claimed[e.id];
            return (
              <div key={e.id} className={`exec${isChairman ? ' chairman' : ''}${isClaimed ? ' claimed' : ''}`}>
                <div className="exec-top">
                  <span className="exec-badge">{isChairman ? 'Seat 0' : 'not yet found'}</span>
                  {!isChairman && (
                    <label className="check small-check">
                      <input type="checkbox" checked={isClaimed} onChange={() => toggleClaim(e.id)} />
                      marked
                    </label>
                  )}
                </div>
                <h3>{e.title}</h3>
                <p>{e.note}</p>
                {isChairman ? (
                  <div className="exec-fixed">Lobby. Never for sale.</div>
                ) : (
                  <label className="exec-guess">
                    <span>Seat #</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={g}
                      onChange={(ev) => setGuess(e.id, ev.target.value)}
                      placeholder="0000"
                      maxLength={4}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <p className="hint small">
          The pool is seats 1 to 4000, since Seat 0 belongs to the building. Your guesses stay in this browser. Clear
          them by clearing site data.
        </p>
      </div>
    </>
  );
}
