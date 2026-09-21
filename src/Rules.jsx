import { LADDER, THRESHOLDS } from './engine.js';

const RULE_TEXT = [
  ['No em dashes, no en dashes', 'No em dashes and no en dashes. Ever. Commas, colons, full stops and parentheses do the job.'],
  ['The house admits, it never invites', 'The house admits; it never invites. The words <code>invitation</code> and <code>invite</code> do not appear.'],
  ['A verdict reads one of four words', '<code>Admitted</code>, <code>Pending</code>, <code>Flagged</code> or <code>Declined</code>.'],
  ['The mint instrument is a TMF Pass', 'The mint instrument is a TMF Pass, always with the TMF.'],
  ['A chair is the object, a Seat is the title', 'A chair is the object you buy; a Seat is the title it confers.'],
  ['No shouting', 'Dry, plain and quiet. It says what a thing is and stops. It never shouts, never hypes, and never uses an exclamation mark.'],
  ['The joke stays dry', 'Take one cutout file, keep the pixels hard, and put the caption in a plain serif. The joke is always dry and always understated. The house never explains it.'],
  ['Whole numbers, no smoothing', '64 by 64 pixels, 64 colors, no anti-aliasing, no smoothing, no gradients. Scale by whole numbers only.'],
  ['Do not repaint the art', 'Do not smooth or upscale the pixel art with a model that repaints it; it stops being the art. Do not recolor the funds. Do not put the house mark on anything that claims to be official.'],
  ['What the supplies are licensed for', 'Take these and make things. Posts, memes, videos, whatever your machine makes of them, paid work included. Do not mint them or sell them as a collection of your own, and do not use them to suggest TMF has endorsed you or to pass yourself off as us.'],
  ['Waiting Room requirement', 'You apply with a wallet, an X account, and one public post. The application is reviewed and marked ADMITTED or DECLINED. Each admitted person receives one TMF Pass.'],
  ['Minting', 'A TMF Pass is soulbound. It cannot be sold or transferred; it can only be burned for exactly two chairs at 0.01 ETH each.'],
  ['The randomness', 'The Morning Edition commits to a future blockhash when you sign, mixes that hash with who asked and what they asked for, and produces the result a couple of blocks later. Nobody can cherry-pick the rare portraits.'],
  ['The art is sealed', '114,367 bytes of art in the Trait Vault, written once at deployment. No server, no IPFS, no admin key, no owner.'],
];

const RATES = [
  ['the house rate', '401,000', '$TMF per Seat'],
  ['buy at random', '+8%', 'on the rate'],
  ['pick a specific Seat', '+16%', 'on the rate'],
  ['sell to the market', '368,920', '$TMF paid back'],
  ['pass burns for', '2', 'chairs at 0.01 ETH each'],
  ['closing bell', 'Fri 20:00', 'UTC, votes end'],
];

export default function Rules() {
  return (
    <>
      <div className="card">
        <h2>The house rules these desks enforce</h2>
        <p className="hint">Taken from the supply room files and the site itself. Verbatim, so you can hold the tool to them.</p>
        <div className="rules">
          {RULE_TEXT.map(([h, p]) => (
            <div className="rule" key={h}>
              <h3>{h}</h3>
              <p dangerouslySetInnerHTML={{ __html: p }} />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>The chair ladder, as published</h2>
        <p className="hint">The chair is the collection’s main rarity trait.</p>
        <table className="tbl" id="ladder">
          <thead>
            <tr>
              <th className="num">Rung</th>
              <th>Chair</th>
              <th className="num">Seats</th>
              <th className="num">Rarity</th>
              <th>Reached at</th>
            </tr>
          </thead>
          <tbody>
            {LADDER.map((l) => (
              <tr key={l.rung}>
                <td className="num">{l.rung}</td>
                <td>{l.chair}</td>
                <td className="num">{l.seats.toLocaleString('en-US')}</td>
                <td className="num">{l.pct.toFixed(2)}%</td>
                <td className="num">{THRESHOLDS[l.rung]}+</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="hint small" style={{ border: 0, paddingTop: '.7rem' }}>
                The last column is this desk’s own eight rungs, mapped to the published chair ladder so a reading lands
                on a named chair. It is a reading, not an allocation.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>The house rate</h2>
        <div className="rates">
          {RATES.map(([k, v, u]) => (
            <div className="rate" key={k}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
              <span className="u">{u}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
