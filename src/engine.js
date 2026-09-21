/* The Mutual Fun tools, shared engine.
   Deterministic. Every score names the rule that produced it.
   Nothing here guesses at holders. The only inputs are words a person
   actually wrote and a wallet someone actually holds. */

export const RULES = {
  /* ---------------------------------------------------------------
     PASS SCREENING
     Mirrors the published Waiting Room requirement:
     "You apply with a wallet, an X account, and one public post."
     plus the house rules that art:supplies actually enforces in prose.
     --------------------------------------------------------------- */
  pass: [
    {
      id: 'no_dashes',
      weight: 9,
      label: 'No em dashes and no en dashes',
      why: 'The house rule states it outright: no em dashes and no en dashes, ever. Commas, colons, full stops and parentheses do the job.',
      test: (a) => {
        const hits = a.post.match(/[\u2014\u2013]|--/g) || [];
        if (!hits.length) return null;
        return {
          evidence: `Found ${hits.length}: ${[...new Set(hits)].join(' ')}`,
          fix: 'Replace every dash with a comma, a colon, a full stop or a pair of parentheses.',
        };
      },
    },
    {
      id: 'admits_not_invites',
      weight: 8,
      label: 'The house admits; it never invites',
      why: 'The words invitation and invite do not appear in the house voice.',
      test: (a) => {
        const hits = a.post.match(/\b(invites?|invited|inviting|invitation|invitational)\b/gi) || [];
        if (!hits.length) return null;
        return {
          evidence: `Found ${hits.length}: ${[...new Set(hits.map((h) => h.toLowerCase()))].join(', ')}`,
          fix: 'Use admitted, eligible, or simply state what the thing is.',
        };
      },
    },
    {
      id: 'no_exclamation',
      weight: 6,
      label: 'No exclamation marks',
      why: 'The house never shouts and never hypes.',
      test: (a) => {
        const hits = a.post.match(/!/g) || [];
        if (!hits.length) return null;
        return { evidence: `Found ${hits.length}`, fix: 'Full stop instead. Say what the thing is and stop.' };
      },
    },
    {
      id: 'verdict_wording',
      weight: 7,
      label: 'Verdict wording',
      why: 'A verdict reads Admitted, Pending, Flagged or Declined. Anything else is not the house.',
      test: (a) => {
        const bad = a.post.match(/\b(whitelist(?:ed)?|approved|accepted|rejected|denied|allowlisted)\b/gi);
        if (!bad) return null;
        return {
          evidence: `Found: ${[...new Set(bad.map((b) => b.toLowerCase()))].join(', ')}`,
          fix: 'Use Admitted, Pending, Flagged or Declined.',
        };
      },
    },
    {
      id: 'pass_naming',
      weight: 6,
      label: 'The mint instrument is a TMF Pass',
      why: 'It is always the TMF Pass, always with the TMF.',
      test: (a) => {
        const bare = a.post.match(/\b[pP]ass(?:es)?\b/g) || [];
        const correct = a.post.match(/TMF Pass(?:es)?/g) || [];
        const stripped = a.post.replace(/TMF Pass(?:es)?/g, '');
        const loose = stripped.match(/\b[pP]ass(?:es)?\b/g) || [];
        if (!bare.length || correct.length || !loose.length) return null;
        return { evidence: `Found ${loose.length} bare use, 0 with the TMF`, fix: 'Write TMF Pass, not Pass.' };
      },
    },
    {
      id: 'chair_vs_seat',
      weight: 5,
      label: 'A chair is the object, a Seat is the title',
      why: 'A chair is the object you buy; a Seat is the title it confers. They are not interchangeable.',
      test: (a) => {
        /* Only fires when the post talks about holding, buying or owning a chair
           as though it were the title, and never uses the word Seat at all. */
        if (/\bseats?\b/i.test(a.post)) return null;
        const misuse = a.post.match(
          /\b(?:my|our|his|her|their|own|owns?|holding|hold|holds|bought|buy|buying|sold|sell|selling|mint(?:ed|ing)?)\s+chairs?\b/gi
        );
        if (!misuse) return null;
        return {
          evidence: `Found: ${misuse.join(', ')} with no use of Seat anywhere`,
          fix: 'Buy a chair, hold a Seat. Use the capital S for the title.',
        };
      },
    },
    {
      id: 'hyped_language',
      weight: 5,
      label: 'Plain and dry',
      why: 'Dry, plain and quiet. It never shouts, never hypes.',
      test: (a) => {
        const bad = a.post.match(
          /\b(amazing|insane|incredible|moon|to the moon|huge|massive|epic|legendary|can'?t miss|guaranteed|100x|alpha leak|alpha call)\b/gi
        );
        if (!bad) return null;
        return {
          evidence: `Found: ${[...new Set(bad.map((b) => b.toLowerCase()))].join(', ')}`,
          fix: 'State the thing. Let the reader draw the conclusion.',
        };
      },
    },
    {
      id: 'mentions_house',
      weight: 12,
      label: 'Tag @TheMutualFun',
      why: 'The Waiting Room requires one public post tagging @TheMutualFun.',
      test: (a) => {
        if (/@TheMutualFun\b/i.test(a.post)) return null;
        return { evidence: 'No @TheMutualFun found', fix: 'Tag @TheMutualFun in the post.' };
      },
    },
    {
      id: 'post_substance',
      weight: 8,
      label: 'The post says something',
      why: 'One public post. A post that says nothing does not get read.',
      test: (a) => {
        const body = a.post
          .replace(/@TheMutualFun/gi, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const words = body.split(' ').filter(Boolean).length;
        /* The house writes short and dry. Anything that names a real action or state
           is substance. The rule only fires on a post that says nothing at all. */
        const STATED =
          /\b(mint(?:ed|ing)?|enrol(?:led|ing)?|applied|applying|vote[ds]?|voting|holding|hold|bought|sold|drawn|seated|admitted|pending|flagged|declined|rings|opens|closed|waiting)\b/i;
        const sentences = body
          .split(/[.!?]+/)
          .map((s) => s.trim())
          .filter((s) => s.split(' ').filter(Boolean).length >= 3);
        if (STATED.test(body)) return null;
        if (words >= 8 && sentences.length >= 1) return null;
        if (words >= 18) return null;
        return {
          evidence: `About ${words} words of substance once the tag and links are removed`,
          fix: 'State one thing about the project that stands on its own. Short is fine, empty is not.',
        };
      },
    },
    {
      id: 'asset_terms',
      weight: 6,
      label: 'UGC terms respected',
      why: 'The supply room is licensed for making things, not for claiming to be the house.',
      test: (a) => {
        const bad = a.post.match(
          /\b(official(?:ly)? (?:part of|affiliated|partner)|endorsed by|we are tmf|i am tmf|tmf team member)\b/gi
        );
        if (!bad) return null;
        return {
          evidence: `Found: ${[...new Set(bad.map((b) => b.toLowerCase()))].join(', ')}`,
          fix: 'Do not suggest TMF has endorsed you or pass yourself off as the house.',
        };
      },
    },
  ],

  /* ---------------------------------------------------------------
     CHAIR ENERGY
     Scores a post against the published house style. Same rules,
     weighted for how the house actually reads a timeline.
     --------------------------------------------------------------- */
  energy: [
    {
      id: 'brevity',
      weight: 12,
      label: 'Brevity',
      why: 'It says what a thing is and stops.',
      score: (a) => {
        const n = a.post.trim().split(/\s+/).filter(Boolean).length;
        if (n === 0) return 0;
        if (n <= 12) return 1;
        if (n <= 25) return 0.85;
        if (n <= 45) return 0.6;
        if (n <= 80) return 0.35;
        return 0.15;
      },
    },
    {
      id: 'no_shout',
      weight: 10,
      label: 'Restraint',
      why: 'Never shouts. Never uses an exclamation mark.',
      score: (a) => {
        let s = 1;
        s -= Math.min(0.5, (a.post.match(/!/g) || []).length * 0.25);
        const capsWords = (a.post.match(/\b[A-Z]{3,}\b/g) || []).filter(
          (w) => !/^(TMF|ARGON|BOGLE|SMAUG|MIDAS|VLADD|NFT|ETH|UGC|AMM)$/.test(w)
        );
        s -= Math.min(0.4, capsWords.length * 0.1);
        return Math.max(0, s);
      },
    },
    {
      id: 'dashes',
      weight: 10,
      label: 'House punctuation',
      why: 'No em dashes and no en dashes. Ever.',
      score: (a) => ((a.post.match(/[\u2014\u2013]|--/g) || []).length === 0 ? 1 : 0),
    },
    {
      id: 'vernacular',
      weight: 14,
      label: 'Speaks the language',
      why: 'Seat, chair, TMF Pass, the Closing Bell, the Briefcase, enrolled, Admitted.',
      score: (a) => {
        const terms = ['seat', 'chair', 'tmf pass', 'closing bell', 'briefcase', 'enrol', 'admit',
          'fund', 'proxy ballot', 'fiscal friday', 'waiting room', 'guest book',
          'argon', 'bogle', 'smaug', 'midas', 'vladd', 'mailroom', 'subscription desk',
          'deng', 'gilded throne', 'corner office', 'share class', 'postage', 'the vault'];
        const low = a.post.toLowerCase();
        const found = terms.filter((t) => low.includes(t));
        if (!found.length) return 0;
        return Math.min(1, found.length / 3);
      },
    },
    {
      id: 'understatement',
      weight: 12,
      label: 'Understatement',
      why: 'The joke is always dry and always understated. The house never explains it.',
      score: (a) => {
        const low = a.post.toLowerCase();
        if (/\b(i\.?e\.?|in other words|which means|let me explain|basically)\b/.test(low)) return 0.25;
        const flat = ['quiet', 'plain', 'dry', 'still', 'empty', 'slow', 'holds', 'sits', 'reads',
          'marked', 'noted', 'filed', 'on the record', 'for the record', 'not yet found'];
        return flat.some((w) => low.includes(w)) ? 1 : 0.55;
      },
    },
    {
      id: 'no_hype',
      weight: 12,
      label: 'No hype',
      why: 'Never hypes.',
      score: (a) => {
        const bad = a.post.match(/\b(amazing|insane|incredible|moon|wagmi|gm|ser|fren|alpha|degen|100x|ath|lfgo+)\b/gi);
        if (!bad) return 1;
        return Math.max(0, 1 - bad.length * 0.3);
      },
    },
    {
      id: 'specific',
      weight: 10,
      label: 'Specific',
      why: 'The house deals in exact figures. Always that number, never another.',
      score: (a) => (/[\d,.]+%?|#\d{1,4}\b/.test(a.post) ? 1 : 0.3),
    },
    {
      id: 'punctuation',
      weight: 8,
      label: 'Clean sentences',
      why: 'Commas, colons, full stops and parentheses do the job.',
      score: (a) => {
        const sents = a.post.split(/[.!?]+\s/).filter((s) => s.trim().length > 2);
        if (!sents.length) return 0.4;
        const clean = sents.filter((s) => !/\s{2,}/.test(s) && !/^\s*[a-z]/.test(s)).length;
        return clean / sents.length;
      },
    },
    {
      id: 'has_visual',
      weight: 6,
      label: 'Carries the art',
      why: 'Posts get further when they carry a portrait or a cutout.',
      score: (a) => (a.hasImage ? 1 : 0.35),
    },
  ],
};

export const TITLES = [
  { min: 88, title: "The Chairman's Chair", note: 'Never for sale. This one goes in the lobby.' },
  { min: 78, title: 'Gilded Throne Energy', note: 'Thirty seven Seats hold the Throne. Your post sits like one of them.' },
  { min: 68, title: 'Oxblood Wingback Energy', note: 'Six point seven seven percent of the collection. A serious chair.' },
  { min: 56, title: 'Green Bankers Chair Energy', note: 'Fourteen percent. The house recognises the tone.' },
  { min: 44, title: 'Creaking Wooden Swivel Energy', note: 'It works, it turns, it does the job.' },
  { min: 32, title: 'Beige Task Chair Energy', note: 'Nineteen point four two percent of the building sits here.' },
  { min: 0, title: 'The Interns Folding Chair Energy', note: 'Thirty point eight seven percent start here. The ladder is above you.' },
];

export const KNOWN = {
  ARGON: { name: 'The Argon Fund', color: '#49698C', motto: 'Noble, inert, and unmoved by the news.' },
  BOGLE: { name: 'The Bogle Fund', color: '#4E8A5A', motto: 'Buys the whole haystack.' },
  SMAUG: { name: 'The Smaug Fund', color: '#9C5248', motto: 'Sleeps on the pile and knows every coin in it.' },
  MIDAS: { name: 'The Midas Fund', color: '#B9902F', motto: 'Everything it touches, marked to gold.' },
  VLADD: { name: 'The Vladd Fund', color: '#6E5D8C', motto: 'Buys when there is blood in the streets.' },
};

export const LADDER = [
  { rung: 1, chair: 'The Interns Folding Chair', seats: 1235, pct: 30.87 },
  { rung: 2, chair: 'Beige Task Chair', seats: 777, pct: 19.42 },
  { rung: 3, chair: 'Creaking Wooden Swivel', seats: 850, pct: 21.24 },
  { rung: 4, chair: 'Green Bankers Chair', seats: 560, pct: 14.0 },
  { rung: 5, chair: 'Oxblood Wingback', seats: 271, pct: 6.77 },
  { rung: 6, chair: 'Deep Button Chesterfield', seats: 179, pct: 4.47 },
  { rung: 7, chair: 'Tasteful Walnut Lounge', seats: 88, pct: 2.2 },
  { rung: 8, chair: 'The Gilded Throne', seats: 37, pct: 0.92 },
];

export const THRESHOLDS = { 8: 88, 7: 78, 6: 68, 5: 56, 4: 44, 3: 32, 2: 18, 1: 0 };

export function analysePass(post, opts = {}) {
  const a = { post: post || '', hasImage: !!opts.hasImage };
  const findings = [];
  let deducted = 0;
  let total = 0;
  for (const r of RULES.pass) {
    total += r.weight;
    const hit = r.test(a);
    if (hit) {
      deducted += r.weight;
      findings.push({ ...r, ...hit });
    }
  }
  const score = Math.max(0, Math.round(((total - deducted) / total) * 100));
  const evidence = [];
  if (!a.post.trim()) evidence.push('No post supplied.');
  if (a.post && !/x\.com|twitter\.com/i.test(a.post)) evidence.push('No X post link found.');
  const policy = findings.filter((f) => f.id === 'asset_terms');
  const verdict = !a.post.trim()
    ? 'Pending'
    : policy.length
      ? 'Declined'
      : findings.length === 0
        ? 'Admitted'
        : score >= 75
          ? 'Pending'
          : 'Flagged';
  return { score, verdict, findings, evidence, suggestions: findings.map((f) => f.fix) };
}

export function analyseEnergy(post, opts = {}) {
  const a = { post: post || '', hasImage: !!opts.hasImage };
  if (!a.post.trim()) {
    return {
      score: 0,
      title: TITLES[TITLES.length - 1].title,
      note: 'Nothing to read.',
      parts: RULES.energy.map((r) => ({ id: r.id, label: r.label, weight: r.weight, score: 0, why: r.why })),
    };
  }
  let earned = 0;
  let total = 0;
  const parts = RULES.energy.map((r) => {
    const s = Math.max(0, Math.min(1, r.score(a)));
    total += r.weight;
    earned += r.weight * s;
    return { id: r.id, label: r.label, weight: r.weight, score: Math.round(s * 100), why: r.why };
  });
  const score = Math.round((earned / total) * 100);
  const t = TITLES.find((x) => score >= x.min) || TITLES[TITLES.length - 1];
  return { score, title: t.title, note: t.note, parts };
}

/* Chair Energy as a mark: 64 by 64, no gradients, whole numbers only. */
export function drawChairPixels(score) {
  const px = 64;
  const rungs = 8;
  const rung = Math.min(rungs - 1, Math.floor((score / 100) * rungs));
  const palettes = [
    ['#EDE3CF', '#6B5F4E'], ['#F6EFE3', '#8A7A5E'], ['#F6EFE3', '#B08A3C'],
    ['#4E8A5A', '#2F6B3D'], ['#7A2E2E', '#5E2222'], ['#9C5248', '#5E2222'],
    ['#B9902F', '#7D601C'], ['#D4AF37', '#B08A3C'], ['#D4AF37', '#211B14'],
  ];
  const [bg, fg] = palettes[rung + 1] || palettes[palettes.length - 1];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const bgR = hex(bg);
  const fgR = hex(fg);
  const seatTop = 26 - rung;
  const seatH = 8 + Math.floor(rung / 2);

  const img = new Uint8ClampedArray(px * px * 4);
  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= px || y >= px) return;
    const i = (y * px + x) * 4;
    img[i] = rgb[0];
    img[i + 1] = rgb[1];
    img[i + 2] = rgb[2];
    img[i + 3] = 255;
  };

  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) put(x, y, bgR);
  for (let x = 24; x < 40; x++) for (let y = seatTop; y < seatTop + seatH; y++) put(x, y, fgR);
  for (let x = 24; x < 40; x++) for (let y = seatTop - 14 - rung; y < seatTop - 1; y++) put(x, y, fgR);
  if (rung >= 3) for (let x = 20; x < 24; x++) for (let y = seatTop - 6; y < seatTop + 4; y++) put(x, y, fgR);
  if (rung >= 6) for (let x = 40; x < 44; x++) for (let y = seatTop - 6; y < seatTop + 4; y++) put(x, y, fgR);
  for (let x = 26; x < 30; x++) for (let y = seatTop + seatH; y < seatTop + seatH + 12; y++) put(x, y, fgR);
  for (let x = 34; x < 38; x++) for (let y = seatTop + seatH; y < seatTop + seatH + 12; y++) put(x, y, fgR);
  if (rung >= 5) for (let x = 20; x < 44; x++) for (let y = 58; y < 61; y++) put(x, y, fgR);
  if (rung >= 7) {
    for (let x = 4; x < 60; x++) {
      put(x, 2, fgR); put(x, 3, fgR); put(x, 60, fgR); put(x, 61, fgR);
    }
    for (let y = 2; y < 62; y++) {
      put(4, y, fgR); put(5, y, fgR); put(58, y, fgR); put(59, y, fgR);
    }
  }
  return img;
}

export const SAMPLES = [
  'Minting a Seat and enrolling it the same afternoon. The draw decides the fund, the chair comes with it, and the Briefcase holds whatever the fund pays out. @TheMutualFun',
  'Four thousand and one portraits, drawn on chain. The chair is the rarity trait and only thirty seven hold the Gilded Throne. @TheMutualFun',
  'The Closing Bell rings Friday at 20:00 UTC. After it, the checks go out in kind. Nothing is sold to pay a dividend. @TheMutualFun',
  'Enrolled in the Midas fund. Everything it touches, marked to gold. Voting before the bell. @TheMutualFun',
  "The Mailroom is open to anyone. Press a button, run one of the fund's weekly tasks, take the Postage. @TheMutualFun",
  'Applied for a TMF Pass. One wallet, one X account, one public post, and then the Waiting Room decides. @TheMutualFun',
];
