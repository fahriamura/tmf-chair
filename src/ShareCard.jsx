import { useRef, useEffect, useState } from 'react';
import { drawChairPixels } from './engine.js';
import { buildCaption, tweetIntent, checkCaption } from './caption.js';

const W = 1080;
const H = 1080;

/* The credit line, on the card and in the app. */
export const AUTHOR = {
  handle: '@absolya227',
  url: 'https://x.com/absolya227/status/2101843635121856653',
};

function drawCard(canvas, standing) {
  const c = canvas.getContext('2d');
  const ink = '#211B14';
  const paper = '#F6EFE3';
  const rule = '#D8CCB4';
  const oxblood = '#7A2E2E';
  const gold = '#B08A3C';

  const font = (size, weight = '400') => `${weight} ${size}px Georgia, serif`;
  const mono = (size, weight = '400') => `${weight} ${size}px Menlo, monospace`;

  c.fillStyle = paper;
  c.fillRect(0, 0, W, H);

  c.strokeStyle = rule;
  c.lineWidth = 2;
  c.strokeRect(28, 28, W - 56, H - 56);
  c.strokeStyle = gold;
  c.lineWidth = 1;
  c.strokeRect(40, 40, W - 80, H - 80);

  c.fillStyle = ink;
  c.font = font(46, '700');
  c.textAlign = 'center';
  c.fillText('The Chair Desk', W / 2, 126);
  c.font = mono(18);
  c.fillStyle = '#6B5F4E';
  c.fillText('A WALLET, READ ON CHAIN', W / 2, 160);

  c.strokeStyle = rule;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(96, 190);
  c.lineTo(W - 96, 190);
  c.stroke();

  /* chair mark, 8x from the 64 pixel source */
  const px = 64;
  const buf = drawChairPixels(standing ? (standing.rung / 8) * 100 : 0);
  const scale = 6;
  const size = px * scale;
  const cx = (W - size) / 2;
  const cy = 226;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const i = (y * px + x) * 4;
      c.fillStyle = `rgb(${buf[i]},${buf[i + 1]},${buf[i + 2]})`;
      c.fillRect(cx + x * scale, cy + y * scale, scale, scale);
    }
  }
  c.strokeStyle = rule;
  c.lineWidth = 2;
  c.strokeRect(cx, cy, size, size);

  const after = cy + size + 52;

  if (!standing || standing.points === 0) {
    c.textAlign = 'center';
    c.fillStyle = '#6B5F4E';
    c.font = font(38, '700');
    c.fillText('No chair found', W / 2, after);
    c.font = font(24);
    c.fillText('Level 1. Outside the building.', W / 2, after + 42);
    c.font = mono(19);
    c.fillText('The door is open.', W / 2, after + 80);
  } else {
    c.textAlign = 'center';
    c.fillStyle = oxblood;
    c.font = mono(21);
    c.fillText(`LEVEL ${standing.level.level} OF ${standing.power.maxLevel}`, W / 2, after - 8);
    c.fillStyle = ink;
    c.font = font(48, '700');
    c.fillText(standing.level.title, W / 2, after + 46);
    c.fillStyle = '#6B5F4E';
    c.font = font(22);
    c.fillText(standing.chair.chair, W / 2, after + 88);

    const y = after + 158;
    const cols = [
      ['NFTS', String(standing.totalItems)],
      ['POWER', String(standing.points)],
      ['ABOVE', `${standing.share.pctBelow.toFixed(2)}%`],
    ];
    const colW = (W - 192) / cols.length;
    cols.forEach(([label, value], i) => {
      const x = 96 + colW * i + colW / 2;
      c.fillStyle = ink;
      c.font = mono(42, '600');
      c.fillText(value, x, y);
      c.fillStyle = '#6B5F4E';
      c.font = mono(16);
      c.fillText(label, x, y + 30);
      if (i < cols.length - 1) {
        c.strokeStyle = rule;
        c.beginPath();
        c.moveTo(96 + colW * (i + 1), y - 40);
        c.lineTo(96 + colW * (i + 1), y + 38);
        c.stroke();
      }
    });
  }

  /* address */
  const addr = standing?.address || '';
  c.fillStyle = '#6B5F4E';
  c.font = mono(19);
  c.textAlign = 'center';
  c.fillText(addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : '', W / 2, H - 196);

  /* the fun reminder and the credit, both stated plainly */
  c.strokeStyle = rule;
  c.beginPath();
  c.moveTo(180, H - 172);
  c.lineTo(W - 180, H - 172);
  c.stroke();

  c.font = font(21, '700');
  c.fillStyle = ink;
  c.fillText('Built for fun by a holder. Not official, not endorsed.', W / 2, H - 132);

  c.font = mono(23, '600');
  c.fillStyle = oxblood;
  c.fillText(AUTHOR.handle, W / 2, H - 96);

  c.font = mono(14);
  c.fillStyle = '#8d8069';
  c.fillText('Read from public nodes. Rarity table belongs to The Mutual Fun.', W / 2, H - 66);

  /* stamp */
  c.save();
  c.translate(W - 178, 142);
  c.rotate(-0.12);
  c.strokeStyle = oxblood;
  c.lineWidth = 2;
  c.strokeRect(-88, -24, 176, 48);
  c.fillStyle = oxblood;
  c.font = mono(15);
  c.fillText('FOR FUN', 0, 6);
  c.restore();
}

export default function ShareCard({ standing, onClose }) {
  const ref = useRef(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const caption = standing ? buildCaption(standing) : '';
  const ruleCheck = caption ? checkCaption(caption) : null;

  useEffect(() => {
    if (ref.current && standing) drawCard(ref.current, standing);
  }, [standing]);

  if (!standing) return null;

  const download = () => {
    const a = document.createElement('a');
    a.download = `chair-desk-${standing.address.slice(2, 8)}.png`;
    a.href = ref.current.toDataURL('image/png');
    a.click();
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the textarea below can still be selected */
    }
  };

  /* Download the card, then open the composer with the caption ready. The
     image has to be attached by hand because an intent URL cannot carry one. */
  const shareToX = () => {
    download();
    window.open(tweetIntent(caption, AUTHOR.url), '_blank', 'noopener');
  };

  return (
    <div className="modal" role="dialog" aria-label="Shareable card">
      <div className="modal-in">
        <canvas ref={ref} width={W} height={H} className="share-canvas" />

        <div className="caption-box">
          <div className="caption-head">
            <strong>The caption</strong>
            {ruleCheck && ruleCheck.findings.length === 0 && <span className="ok-tag">passes the house rules</span>}
          </div>
          <textarea className="caption-text" readOnly value={caption} rows={7} />
          <div className="btnrow">
            <button className="btn" onClick={shareToX}>
              Share to X
            </button>
            <button className="btn btn-ghost" onClick={download}>
              {saved ? 'Saved' : 'Download the card'}
            </button>
            <button className="btn btn-ghost" onClick={copyCaption}>
              {copied ? 'Copied' : 'Copy the caption'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
          <p className="hint small">
            Share to X saves the card and opens the composer with the caption filled in. Attach the saved image before
            posting, since a link cannot carry it. The caption is checked against the same rules the desk enforces.
          </p>
        </div>
      </div>
    </div>
  );
}
