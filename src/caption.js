/* The caption that goes out with a card.
   Dry, plain and quiet, the way the house writes. No dashes anywhere, no
   exclamation marks, no hype. It states what was read and where. */

import { analysePass } from './engine.js';

export function buildCaption(standing) {
  if (!standing) return '';

  const lines = [];

  if (!standing.points || standing.points === 0) {
    lines.push('The Chair Desk read my wallet and found no chair. Level 1, outside the building.');
    lines.push('The door is open.');
  } else {
    lines.push(
      `The Chair Desk put me on Level ${standing.level.level} of ${standing.power.maxLevel}: ${standing.level.title}.`
    );
    lines.push(
      `${standing.totalItems} NFTs across ${standing.collectionsWithHits} collections. Wallet power ${standing.points}. ${standing.chair.chair}.`
    );
    lines.push(`Sitting above ${standing.share.pctBelow.toFixed(2)} percent of the building.`);
  }

  lines.push('');
  lines.push('Read it yourself. Read only, no wallet connection, nothing stored.');
  lines.push('');
  lines.push('@TheMutualFun');
  lines.push('');
  lines.push('https://x.com/absolya227/status/2101843635121856653?s=20')

  return lines.join('\n');
}

/* The caption is held to the house rules, same as anything else the desk
   produces. This runs the real scorer over it so a stray dash or a stray
   exclamation mark cannot ship. */
export function checkCaption(caption) {
  return analysePass(caption);
}

export function tweetIntent(caption, url) {
  const params = new URLSearchParams();
  if (caption) params.set('text', caption);
  if (url) params.set('url', url);
  return `https://x.com/intent/tweet?${params.toString()}`;
}
