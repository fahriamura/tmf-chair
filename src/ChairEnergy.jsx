import { useMemo, useRef, useEffect, useState } from 'react';
import { analyseEnergy, drawChairPixels, SAMPLES } from './engine.js';
import { usePersistedState, copyText } from './lib.js';

function ChairCanvas({ score }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = 64;
    cv.height = 64;
    const c = cv.getContext('2d');
    const img = c.createImageData(64, 64);
    img.data.set(drawChairPixels(score));
    c.putImageData(img, 0, 0);
  }, [score]);
  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      className="chair-canvas"
      aria-label={`Chair mark at ${score} out of 100`}
    />
  );
}

export default function ChairEnergy() {
  const [post, setPost] = usePersistedState(
    'tmf.energy.post',
    'Minting a Seat and enrolling it the same afternoon. The draw decides the fund, the chair comes with it, and the Briefcase holds whatever the fund pays out. @TheMutualFun'
  );
  const [hasImage, setHasImage] = usePersistedState('tmf.energy.image', true);
  const [flashMsg, setFlashMsg] = useState('');
  const canvasWrap = useRef(null);

  const reading = useMemo(() => analyseEnergy(post, { hasImage }), [post, hasImage]);

  const nextSample = () => {
    const i = SAMPLES.indexOf(post);
    setPost(SAMPLES[(i + 1 + SAMPLES.length) % SAMPLES.length]);
  };

  const withFlash = (btn, msg) => {
    const was = btn.textContent;
    btn.textContent = msg;
    btn.disabled = true;
    setFlashMsg(msg);
    setTimeout(() => {
      if (btn.isConnected) {
        btn.textContent = was;
        btn.disabled = false;
      }
      setFlashMsg('');
    }, 1200);
  };

  const copyReading = async (e) => {
    const lines = [
      `Chair Energy: ${reading.score} out of 100`,
      reading.title,
      reading.note,
      '',
      'Where the reading came from',
      ...reading.parts.map((p) => `${p.label} (weight ${p.weight}): ${p.score} of 100, ${p.why}`),
    ].join('\n');
    await copyText(lines);
    withFlash(e.currentTarget, 'Copied');
  };

  const downloadChair = (e) => {
    const src = canvasWrap.current?.querySelector('canvas');
    if (!src) return;
    const out = document.createElement('canvas');
    out.width = 512;
    out.height = 512;
    const c = out.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, 0, 0, 512, 512);
    const a = document.createElement('a');
    a.download = `chair-energy-${reading.score}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
    withFlash(e.currentTarget, 'Saved');
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>The post</h2>
          <p className="hint">
            Paste the post you mean to publish. The generator does not fix it for you, it tells you what the house would say.
          </p>
          <textarea
            id="energy-post"
            rows={7}
            value={post}
            onChange={(e) => setPost(e.target.value)}
            placeholder="Sitting in the MIDAS fund since the draw. The book is up to us once a week, and the Closing Bell rings Friday at 20:00 UTC."
          />
          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
              />
              The post carries a portrait or a cutout
            </label>
          </div>
          <div className="btnrow">
            <button className="btn" onClick={nextSample}>
              Another
            </button>
            <button className="btn btn-ghost" onClick={copyReading} data-flash={flashMsg === 'Copied'}>
              Copy the reading
            </button>
          </div>
        </div>

        <div className="card card-result" ref={canvasWrap}>
          <h2>The reading</h2>
          <div className="scoreline">
            <ChairCanvas score={reading.score} />
            <div className="scoreline-txt">
              <div className="big" id="energy-score">
                {String(reading.score).padStart(2, '0')}
              </div>
              <div className="verdict" id="energy-title">
                {reading.title}
              </div>
            </div>
          </div>
          <p className="note" id="energy-note">
            {reading.note}
          </p>
          <div className="eq">
            <div className="eq-row">
              <span>Chair Energy</span>
              <i className="on" style={{ '--w': `${reading.score}%` }} />
            </div>
          </div>
          <p className="hint small">
            The chair is drawn from the reading itself at 64 by 64, whole numbers only, the way the collection is
            drawn. Eight rungs match the published chair ladder.
          </p>
          <div className="btnrow">
            <button className="btn btn-ghost" onClick={downloadChair} data-flash={flashMsg === 'Saved'}>
              Download the chair
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Where the reading came from</h2>
        <p className="hint">Each line is one rule, its weight, and how this post did against it.</p>
        <table className="tbl" id="energy-breakdown">
          <thead>
            <tr>
              <th>Rule</th>
              <th className="num">Weight</th>
              <th className="num">Score</th>
              <th>What the rule is</th>
            </tr>
          </thead>
          <tbody>
            {reading.parts.map((p) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td className="num">{p.weight}</td>
                <td className="num">
                  <span
                    className={`bar${p.score >= 80 ? ' hot' : ''}`}
                    style={{ width: `${Math.max(2, p.score * 0.34)}px` }}
                  />{' '}
                  {p.score}
                </td>
                <td>{p.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
