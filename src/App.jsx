import { useState, useEffect } from 'react';
import WalletStanding from './WalletStanding.jsx';
import Gallery from './Gallery.jsx';
import Rules from './Rules.jsx';
import ShareCard from './ShareCard.jsx';

const TABS = [
  { id: 'wallet', label: 'Where Is Your Seat', Desk: WalletStanding },
  { id: 'gallery', label: 'The Art Department', Desk: Gallery },
  { id: 'rules', label: 'The Rules', Desk: Rules },
];

export default function App() {
  const [tab, setTab] = useState(() => {
    const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    return TABS.some((t) => t.id === h) ? h : 'wallet';
  });
  const [share, setShare] = useState(null);

  useEffect(() => {
    window.location.hash = tab;
  }, [tab]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* Esc closes the share card. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setShare(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Active = TABS.find((t) => t.id === tab).Desk;

  return (
    <>
      <header className="masthead">
        <div className="wrap masthead-in">
          <div className="mark">
            <img src="./assets/medallion-384.png" alt="The house mark" width="38" height="38" className="mark-img" />
            <div className="mark-txt">
              <strong>The Chair Desk</strong>
              <span>built for the holders</span>
            </div>
          </div>
          <nav className="tabs" role="tablist" aria-label="Desks">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? ' is-on' : ''}`}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`pane-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        <section className="lede">
          <p className="stamp">the chair desk</p>
          {tab === 'wallet' && (
            <>
              <h1>Where is your seat.</h1>
              <p className="sub">
                Paste a wallet and the desk reads what it holds, straight from public nodes. Every chair is counted, a
                Seat counts double, and the whole thing lands on the house's own chair ladder. Then it makes you a card
                you can post. Read only, no sign in, no key, nothing stored on a server.
              </p>
            </>
          )}
          {tab === 'gallery' && (
            <>
              <h1>The art, and the odds.</h1>
              <p className="sub">
                The 25 portraits the supply room hands out, the chair ladder, the frames, the Weirdos and the standout
                pieces. All of it is the house's published material, laid out so you can see where you sit in it.
              </p>
            </>
          )}
          {tab === 'rules' && (
            <>
              <h1>How the house talks.</h1>
              <p className="sub">
                The rules these desks are built against, taken verbatim from the supply room files and the site. Hold
                the tool to them.
              </p>
            </>
          )}
        </section>

        <section id={`pane-${tab}`} className="pane is-on" role="tabpanel">
          <Active onShare={setShare} />
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <img src="./assets/medallion-384.png" alt="" width="26" height="26" className="foot-mark" />
          <p className="fun-line">
            <strong>This is a fan project, built for fun.</strong> Not affiliated with The Mutual Fun and not endorsed
            by it. The assets, the ladder and the rules belong to the house. Nothing on this page is financial advice.
          </p>
          <p className="credit">
            Made by <a href="https://x.com/absolya227" target="_blank" rel="noreferrer">@absolya227</a>
          </p>
          <p className="fine">
            Supply room: <a href="https://themutual.fun/art-department">themutual.fun/art-department</a> &nbsp;·&nbsp;
            The house: <a href="https://x.com/TheMutualFun">@TheMutualFun</a> &nbsp;·&nbsp; Holdings are read from
            public RPC endpoints and can be checked against a block explorer.
          </p>
        </div>
      </footer>

      {share && <ShareCard standing={share} onClose={() => setShare(null)} />}
    </>
  );
}
