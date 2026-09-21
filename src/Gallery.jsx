import { useState, useMemo } from 'react';
import { LADDER_RUNGS } from './standing.js';

const FUNDS = [
  { key: 'argon', name: 'The Argon Fund', color: '#49698C', motto: 'Noble, inert, and unmoved by the news.' },
  { key: 'bogle', name: 'The Bogle Fund', color: '#4E8A5A', motto: 'Buys the whole haystack.' },
  { key: 'smaug', name: 'The Smaug Fund', color: '#9C5248', motto: 'Sleeps on the pile and knows every coin in it.' },
  { key: 'midas', name: 'The Midas Fund', color: '#B9902F', motto: 'Everything it touches, marked to gold.' },
  { key: 'vladd', name: 'The Vladd Fund', color: '#6E5D8C', motto: 'Buys when there is blood in the streets.' },
];

const FRAMES = [
  { frame: 'Standard Ink Certificate', seats: 2054, pct: 51.34 },
  { frame: 'Double Rule Certificate', seats: 1180, pct: 29.49 },
  { frame: 'Ornate Scrollwork Certificate', seats: 507, pct: 12.67 },
  { frame: 'Oxblood Lacquer Certificate', seats: 172, pct: 4.3, rare: true },
  { frame: 'Gold Foil Certificate', seats: 88, pct: 2.2, rare: true },
];

const WEIRDOS = [
  { sitter: 'The Offworld Consultant', seats: 99, pct: 2.47 },
  { sitter: 'The Golden Retriever Who Made Partner', seats: 93, pct: 2.32 },
  { sitter: 'The Fired Analysts Ghost', seats: 89, pct: 2.22 },
  { sitter: 'The Quant', seats: 86, pct: 2.15 },
  { sitter: 'The Long Holder', seats: 80, pct: 2.0 },
  { sitter: 'The Floor Model', seats: 78, pct: 1.95 },
  { sitter: 'The Night Trader', seats: 76, pct: 1.9 },
];

const ACCESSORIES = [
  { piece: 'Fiscal New Year Hat', seats: 13, pct: 0.32 },
  { piece: 'Worked All Night Bathrobe', seats: 28, pct: 0.7 },
  { piece: 'Annual Gala Tuxedo', seats: 33, pct: 0.82 },
  { piece: 'Ledger Green Eyeshade', seats: 72, pct: 1.8 },
  { piece: 'Old Money Monocle', seats: 76, pct: 1.9 },
  { piece: 'Corner Office Cigar', seats: 94, pct: 2.35 },
  { piece: 'The Glowing Portfolio', seats: 135, pct: 3.37 },
  { piece: 'Handcuffed Projections', seats: 146, pct: 3.65 },
];

const ALL = [...FUNDS.flatMap((f) => f.key ? ['argon', 'bogle', 'smaug', 'midas', 'vladd'] : [])];
const KEYS = ['argon', 'bogle', 'smaug', 'midas', 'vladd'];

export default function Gallery() {
  const [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState(null);

  /* 25 portraits: five funds, each with five chairs from the kit. The kit names
     them portrait N, and the site names the chairs, so the pairing below is
     the order the supply room lists them in. */
  const items = useMemo(() => {
    const out = [];
    KEYS.forEach((k) => {
      for (let n = 1; n <= 5; n++) {
        out.push({ fund: k, n, src: `./assets/${k}-0${n}.png`, svg: `./assets/${k}-0${n}.svg` });
      }
    });
    return filter === 'all' ? out : out.filter((i) => i.fund === filter);
  }, [filter]);

  return (
    <>
      <div className="card">
        <h2>The 25 clean portraits</h2>
        <p className="hint">
          This is the set the supply room hands out, at the size it hands them out. Each one is 1024 pixels wide, drawn
          from a 64 by 64 source with no smoothing. Click one to see it large.
        </p>
        <div className="chips">
          <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
            All five funds
          </button>
          {FUNDS.map((f) => (
            <button
              key={f.key}
              className={`chip${filter === f.key ? ' on' : ''}`}
              onClick={() => setFilter(f.key)}
              style={filter === f.key ? { borderColor: f.color, color: f.color } : undefined}
            >
              <i style={{ background: f.color }} />
              {f.label || f.name.replace('The ', '')}
            </button>
          ))}
        </div>
        <div className="gallery">
          {items.map((i) => (
            <button key={i.src} className="tile" onClick={() => setZoom(i)}>
              <img src={i.src} alt="" loading="lazy" />
              <span className="tile-cap">{i.fund}-0{i.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>The chair ladder</h2>
        <p className="hint">The main rarity trait, as published. The bar shows rarity, not count.</p>
        <div className="ladder-viz">
          {LADDER_RUNGS.map((l) => (
            <div className="ladder-row" key={l.rung}>
              <span className="ladder-rung">{l.rung}</span>
              <span className="ladder-name">{l.chair}</span>
              <span className="ladder-bar">
                <i style={{ width: `${(l.pct / 30.87) * 100}%` }} />
              </span>
              <span className="ladder-num">{l.seats.toLocaleString('en-US')}</span>
              <span className="ladder-pct">{l.pct.toFixed(2)}%</span>
            </div>
          ))}
        </div>
        <p className="hint small">
          These counts add up to 3,997 across a stated supply of 4,001. The frame table below adds up to exactly 4,001,
          so four Seats are unaccounted for in the chair ladder. The desk does not smooth that over.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Frames</h2>
          <p className="hint">Five designs, two of them rare.</p>
          <table className="tbl">
            <thead>
              <tr>
                <th>Frame</th>
                <th className="num">Seats</th>
                <th className="num">Rarity</th>
              </tr>
            </thead>
            <tbody>
              {FRAMES.map((f) => (
                <tr key={f.frame}>
                  <td>
                    {f.frame}
                    {f.rare && <span className="rare-tag">rare</span>}
                  </td>
                  <td className="num">{f.seats.toLocaleString('en-US')}</td>
                  <td className="num">{f.pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>4,001</strong>
                </td>
                <td className="num">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card">
          <h2>The Weirdos</h2>
          <p className="hint">
            About fifteen percent of sitters are not human: a ghost, a robot, a skull, a mannequin, a vampire, an alien,
            and a golden retriever. 601 of the 4,001.
          </p>
          <table className="tbl">
            <thead>
              <tr>
                <th>Sitter</th>
                <th className="num">Seats</th>
                <th className="num">Rarity</th>
              </tr>
            </thead>
            <tbody>
              {WEIRDOS.map((w) => (
                <tr key={w.sitter}>
                  <td>{w.sitter}</td>
                  <td className="num">{w.seats}</td>
                  <td className="num">{w.pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>The standout pieces</h2>
        <p className="hint">
          157 traits across 8 layers: wall, frame, chair, body, head, hair, face and accessories. Every outfit works
          with every skin tone, and the same recolouring system gives the Weirdos fur, bone, steel or ectoplasm.
        </p>
        <div className="accessories">
          {ACCESSORIES.map((a) => (
            <div className="acc" key={a.piece}>
              <span className="acc-name">{a.piece}</span>
              <span className="acc-bar">
                <i style={{ width: `${(a.pct / 3.65) * 100}%` }} />
              </span>
              <span className="acc-num">
                {a.seats} · {a.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {zoom && (
        <div className="modal" role="dialog" aria-label="Portrait" onClick={() => setZoom(null)}>
          <div className="modal-in" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.src} alt="" className="zoom-img" />
            <p className="hint small center">
              {zoom.fund}-0{zoom.n} · 1024 square, from a 64 by 64 source. The .svg beside it is the exact markup the
              chain emits.
            </p>
            <div className="btnrow center-row">
              <a className="btn btn-ghost" href={zoom.svg} download>
                Download the svg
              </a>
              <button className="btn btn-ghost" onClick={() => setZoom(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
