// Hana's Help Day (community, grades 3–5): four festival jobs, four neighbors with different strengths.
// The child sends each helper to a job; a fitting pair gets a check, a mismatch gets a "?" and a line that
// names the job's need and what that helper is better at. Pure rules, like reading.js: nothing here touches
// the DOM, it imports nothing, and every sentence is 56 characters or fewer so a Bigger words
// dialogue page never breaks mid-sentence.
// The snapshot keeps kind 'community' and adds the discriminator activity: 'helpday'. A K–2 square save has
// no activity field, so the wiring in progress.js and encounters.js only hands this module helpday saves.
// Fixed festival colors keep the saved-board renderer independent of the UI modules.
const INK = '#1f2147', PAPER = '#fff8e6', PAPER_SHADE = '#f3e3bf';
const FINISH = '#1f7a55', SKY = '#9fdcff', WOOD = '#b8754a';
const VERMILION = '#d9412e', LANTERN = '#ffc94a', GRASS_DARK = '#4f9a50';

const KIND = 'community';
const ACTIVITY = 'helpday';
const MAX_CREW = 4;
const MAX_HISTORY = 40;

export const GRADES_HELPDAY = [3, 4, 5];
export const STAMP_HELPDAY = 'Different strengths get every job done together.';

// Board order. `need` is the chip on the card, `needSays` the same need inside a screen-reader sentence,
// `glyph` the 24×24 picture the activity draws, `at` the bench caption word.
export const HELP_JOBS = [
  { id: 'lanterns', name: 'Lanterns', description: 'Hang lanterns', need: 'Up high', needSays: 'a helper must reach up high', glyph: 'lantern', at: 'lanterns' },
  { id: 'drum', name: 'Carry drum', description: 'Carry the drum', need: 'Heavy', needSays: 'it is heavy', glyph: 'drum', at: 'drum' },
  { id: 'gate', name: 'Greet guests', description: 'Greet at the gate', need: 'All day', needSays: 'needs a helper all day', glyph: 'gate', at: 'gate' },
  { id: 'mail', name: 'Deliver mail', description: 'Deliver invitations', need: 'Around town', needSays: 'goes all over town', glyph: 'envelope', at: 'mail' },
];
// Bench order. `figure` is the sprite id in figures/index.js (Kiko is the music neighbor, Taro the math one:
// a cameo at Hana's stall, not a change to data.js). `color` is the token on the small team board; every token
// also has a shape accent, so color is never the only cue (Kiko a beak, Taro two ears, Nori a flat dome,
// Pip an orange bill).
export const HELP_HELPERS = [
  { id: 'kiko', name: 'Kiko', figure: 'music', strength: 'Flies high', color: '#c6a044' },
  { id: 'taro', name: 'Taro', figure: 'math', strength: 'Strong', color: '#c5773b' },
  { id: 'nori', name: 'Nori', figure: 'nori', strength: 'Patient', color: GRASS_DARK },
  { id: 'pip', name: 'Pip', figure: 'pip', strength: 'Fast', color: PAPER_SHADE },
];
export const JOB_IDS = HELP_JOBS.map(j => j.id);
export const HELPER_IDS = HELP_HELPERS.map(h => h.id);
export const HELP_FITS = { lanterns: 'kiko', drum: 'taro', gate: 'nori', mail: 'pip' };
const JOBS_B = [
  { id: 'stew', name: 'Cook stew', description: 'Cook the stew', need: 'Big pot', needSays: 'a big pot needs a cook', glyph: 'pot', at: 'stew' },
  { id: 'tale', name: 'Tell a tale', description: 'Tell a tale', need: 'Loud voice', needSays: 'a tale needs a loud voice', glyph: 'book', at: 'tale' },
  { id: 'banner', name: 'Paint banner', description: 'Paint the banner', need: 'Steady hand', needSays: 'painting needs a steady hand', glyph: 'brush', at: 'banner' },
  { id: 'signs', name: 'Write signs', description: 'Write the signs', need: 'Neat words', needSays: 'signs need neat words', glyph: 'pen', at: 'signs' },
];
const HELPERS_B = [
  { id: 'momo', name: 'Momo', figure: 'science', strength: 'Cook', color: '#78ad9b' },
  { id: 'sora', name: 'Sora', figure: 'reading', strength: 'Storyteller', color: '#639dc4' },
  { id: 'yuki', name: 'Yuki', figure: 'art', strength: 'Steady hand', color: '#a28ac5' },
  { id: 'fumi', name: 'Fumi', figure: 'writing', strength: 'Neat writer', color: '#51a2a2' },
];
export const HELP_SETS = {
  A: { jobs: HELP_JOBS, helpers: HELP_HELPERS, jobIds: JOB_IDS, helperIds: HELPER_IDS, fits: HELP_FITS },
  B: { jobs: JOBS_B, helpers: HELPERS_B, jobIds: JOBS_B.map(j => j.id), helperIds: HELPERS_B.map(h => h.id),
    fits: { stew: 'momo', tale: 'sora', banner: 'yuki', signs: 'fumi' } },
};
export const helpSetFor = grade => Number(grade) === 4 ? HELP_SETS.B : HELP_SETS.A;
// Saved pictures follow the crew, so the old grade-4 board still has its four jobs.
export const helpSetOfCrew = crew => (Array.isArray(crew) ? crew : [])
  .map(pair => Object.values(HELP_SETS).find(set => set.jobIds.includes(pair?.job) && set.helperIds.includes(pair?.helper)))
  .find(Boolean) ?? HELP_SETS.A;
export const JOB_SHORT = {
  lanterns: 'the lanterns', drum: 'the drum', gate: 'the gate', mail: 'the invitations',
  stew: 'the stew', tale: 'the tale', banner: 'the banner', signs: 'the signs',
};
export const NEED = {
  lanterns: 'Lanterns hang up high.',
  drum: 'The drum is heavy.',
  gate: 'The gate needs a helper all day.',
  mail: 'Invitations go all over town.',
  stew: 'The big pot needs a cook.',
  tale: 'A tale needs a loud, clear voice.',
  banner: 'Painting needs a steady hand.',
  signs: 'Signs need neat words everyone can read.',
};
export const BETTER_AT = {
  kiko: 'flying high', taro: 'heavy lifting', nori: 'patient hellos', pip: 'fast trips',
  momo: 'cooking stew', sora: 'telling tales', yuki: 'painting banners', fumi: 'neat writing',
};

export const jobById = id => [...HELP_JOBS, ...JOBS_B].find(j => j.id === id) ?? null;
export const helperById = id => [...HELP_HELPERS, ...HELPERS_B].find(h => h.id === id) ?? null;
const nameOf = id => helperById(id)?.name ?? 'A helper';
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clampInt = (n, a, b) => Math.round(Math.min(b, Math.max(a, Number.isFinite(n) ? n : a)));

// Crew entries keep their order (the legacy Undo order); bad jobs or helpers are dropped; a repeated job or
// helper keeps its first entry; anything past four entries is cut. Only { job, helper } is kept.
export function normalizeCrew(input, set = HELP_SETS.A) {
  const crew = [];
  if (!Array.isArray(input)) return crew;
  for (const entry of input) {
    if (crew.length >= MAX_CREW) break;
    if (!isPlainObject(entry)) continue;
    const { job, helper } = entry;
    if (!set.jobIds.includes(job) || !set.helperIds.includes(helper)) continue;
    if (crew.some(p => p.job === job || p.helper === helper)) continue;
    crew.push({ job, helper });
  }
  return crew;
}

const historyOf = (state, set = helpSetFor(state?.grade)) => Array.isArray(state?.history)
  ? state.history.slice(-MAX_HISTORY).filter(Array.isArray).map(crew => normalizeCrew(crew, set)) : [];

// The one validator, for the activity and (through the wiring) encounters.js. Optional history keeps
// the crew before each move so Undo also restores displaced helpers after reopening a draft.
function normalizedHelpday(input, grade, chapter, set) {
  const s = isPlainObject(input) ? input : {};
  const history = historyOf(s, set);
  return { kind: KIND, activity: ACTIVITY, grade: clampInt(grade, 0, 5), chapter: chapter === 1 ? 1 : 0,
    crew: normalizeCrew(s.crew, set), ...(history.length ? { history } : {}) };
}
export function normalizeHelpday(input, grade = input?.grade ?? 3, chapter = input?.chapter ?? 1) {
  const g = clampInt(grade, 0, 5);
  const set = helpSetFor(g);
  const s = isPlainObject(input) ? input : {};
  // Old grade-4 crews start a new board, including their old Undo trail.
  const otherSet = Array.isArray(s.crew) && s.crew.length && helpSetOfCrew(s.crew) !== set;
  return normalizedHelpday(otherSet ? {} : s, g, chapter, set);
}

// For progress.js cleanCreation: the saved object, or null for anything that is not a Help Day. The chapter
// and grade follow cleanCreation's own rule (chapter 0 or 1; Kindergarten is grade 0, else grades 1–5).
export function cleanHelpdayCreation(input) {
  if (!isPlainObject(input) || input.kind !== KIND || input.activity !== ACTIVITY) return null;
  const chapter = input.chapter === 1 ? 1 : 0;
  const grade = chapter === 1 ? (Number.isFinite(input.grade) ? clampInt(input.grade, 1, 5) : 1) : 0;
  const set = input.crew?.length ? helpSetOfCrew(input.crew) : helpSetFor(grade);
  return normalizedHelpday(input, grade, chapter, set);
}

const crewOf = state => normalizeCrew(state?.crew, helpSetFor(state?.grade));
export const helperAt = (state, job) => crewOf(state).find(p => p.job === job)?.helper ?? null;
export const jobOfHelper = (state, helper) => crewOf(state).find(p => p.helper === helper)?.job ?? null;
export const fits = (job, helper, grade = 3) => Object.hasOwn(helpSetFor(grade).fits, job) && helpSetFor(grade).fits[job] === helper;

// READY: every job has the helper that fits it (so the crew holds all four fitting pairs).
export function helpdayReady(state) {
  const crew = crewOf(state);
  return Array.isArray(state?.crew) && state.crew.length === 4 && crew.length === 4
    && Object.entries(helpSetFor(state?.grade).fits).every(([job, helper]) => crew.some(p => p.job === job && p.helper === helper));
}
export const helpDayFitCount = state => crewOf(state).filter(p => fits(p.job, p.helper, state?.grade)).length;
// The first job in board order without its fitting helper, or null when every job fits.
export const helpDayNextJob = state => helpSetFor(state?.grade).jobIds.find(job => helperAt(state, job) !== helpSetFor(state?.grade).fits[job]) ?? null;

// Send a helper to a job. Someone already on that job goes back to the bench; a helper leaving another job
// empties it. Remember the crew before moving either helper. A mismatch is still placed: the work is kept.
export function assignHelper(state, job, helper) {
  const set = helpSetFor(state?.grade);
  if (!set.jobIds.includes(job) || !set.helperIds.includes(helper)) return { state, status: 'invalid' };
  if (helperAt(state, job) === helper) return { state, status: 'same' };
  const before = crewOf(state);
  const crew = [...before.filter(p => p.job !== job && p.helper !== helper), { job, helper }];
  const history = [...historyOf(state), before].slice(-MAX_HISTORY);
  return { state: { ...state, crew, history }, status: fits(job, helper, state.grade) ? 'fits' : 'mismatch' };
}
export function undoAssignment(state) {
  const crew = crewOf(state);
  if (!crew.length) return { state, helper: null };
  const history = historyOf(state);
  const next = { ...state, crew: history.length ? history.at(-1) : crew.slice(0, -1) };
  if (history.length > 1) next.history = history.slice(0, -1);
  else delete next.history;
  return { state: next, helper: crew.at(-1).helper };
}

const FIT = {
  lanterns: 'Kiko flies up and hangs every lantern. Great match!',
  drum: 'Taro carries the big drum to the stage. Great match!',
  gate: 'Nori greets every visitor with a smile. Great match!',
  mail: 'Pip delivers every invitation by noon. Great match!',
  stew: 'Momo stirs a stew that smells amazing. Great match!',
  tale: 'Sora tells a tale for everyone to hear. Great match!',
  banner: 'Yuki paints bright stars on the banner. Great match!',
  signs: 'Fumi writes neat words on every sign. Great match!',
};
const NEXT = {
  lanterns: 'The lanterns need a helper who can go up high.',
  drum: 'The drum needs a strong helper to carry it.',
  gate: 'The gate needs a patient helper all day long.',
  mail: 'The invitations need a fast helper for town.',
  stew: 'The stew needs a cook for the big pot.',
  tale: 'The tale needs a helper with a loud voice.',
  banner: 'The banner needs a helper with a steady hand.',
  signs: 'The signs need a helper who writes neat words.',
};
const ASK = {
  kiko: 'Kiko says: I can fly higher than the roof!',
  taro: 'Taro says: I carry heavy things every day!',
  nori: 'Nori says: I can say hello all day long!',
  pip: 'Pip says: Fast feet! I zip all over town!',
  momo: 'Momo says: I cook stew in my big pot every day!',
  sora: 'Sora says: I know a hundred tales by heart!',
  yuki: 'Yuki says: My steady hand paints bright banners!',
  fumi: 'Fumi says: I write neat words for everyone to read!',
};
const PICK = {
  kiko: 'Kiko flies higher than the stage roof.',
  taro: 'Taro lifts heavy crates all day long.',
  nori: 'Nori is patient and loves saying hello.',
  pip: 'Pip zips all over town on fast feet.',
  momo: 'Momo cooks warm stew for hungry neighbors.',
  sora: 'Sora tells tales in a loud, clear voice.',
  yuki: 'Yuki paints banners with a steady hand.',
  fumi: 'Fumi writes neat words on the festival signs.',
};
export const HELPDAY_LINES = {
  opening: 'Help Day! Four jobs, four helpers. Who fits each job?',
  openingPartial: 'Let’s check your team. Who fits each job?',
  openingReady: 'Your team is set. Start day, or move a helper.',
  notReady: 'A job is open again. Fill every job to start.',
  allSet: 'Every job fits. Choose Start day!',
  fit: job => FIT[job],
  // Never "cannot": the job's need, then what this helper is better at.
  mismatch: (job, helper) => `${NEED[job]} ${nameOf(helper)} is better at ${BETTER_AT[helper]}.`,
  same: (job, helper) => `${nameOf(helper)} is already on ${JOB_SHORT[job]}.`,
  undo: (helper, state) => `${nameOf(helper)} is back on ${JOB_SHORT[jobOfHelper(state, helper)] ?? 'the bench'}.`,
  next: job => NEXT[job] ?? 'Every job fits. Choose Start day!',
  ask: helper => ASK[helper],
  pick: helper => PICK[helper],
};

// Fresh, resumed part way (or with a wrong pair), or resumed ready.
export function helpdayOpening(state) {
  if (helpdayReady(state)) return HELPDAY_LINES.openingReady;
  return crewOf(state).length ? HELPDAY_LINES.openingPartial : HELPDAY_LINES.opening;
}

// The team board drawn small (about 64×48) for the stall easel, the parade float and the item-get card:
// a pinned notice, four columns (job glyph on top, helper token under it, a check or "?" below). Sprites are
// background images and cannot go inside an SVG, so each helper is a colored token with a shape accent.
// Only constants and the validated crew reach the markup, and the one number is an integer count.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLUMNS = [6, 29, 52, 75];
const TOKEN_Y = 44;
const GLYPH_SMALL = {
  lantern: x => `<rect x="${x + 6}" y="11" width="10" height="14" rx="3" fill="${LANTERN}" stroke="${INK}" stroke-width="1.5"/><rect x="${x + 9}" y="8" width="4" height="3" fill="${INK}"/>`,
  drum: x => `<rect x="${x + 4}" y="12" width="14" height="12" fill="${WOOD}" stroke="${INK}" stroke-width="1.5"/><rect x="${x + 4}" y="15" width="14" height="2" fill="${INK}"/><rect x="${x + 4}" y="20" width="14" height="2" fill="${INK}"/>`,
  gate: x => `<rect x="${x + 5}" y="11" width="3" height="16" fill="${VERMILION}"/><rect x="${x + 14}" y="11" width="3" height="16" fill="${VERMILION}"/><rect x="${x + 2}" y="9" width="18" height="3" fill="${VERMILION}"/><rect x="${x + 4}" y="15" width="14" height="2" fill="${VERMILION}"/>`,
  envelope: x => `<rect x="${x + 4}" y="13" width="14" height="10" fill="${SKY}" stroke="${INK}" stroke-width="1.5"/><path d="M${x + 4} 13l7 6 7-6" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
  pot: x => `<path d="M${x + 3} 14h16v11H${x + 3}zM${x} 15h3v4h-3zm19 0h3v4h-3z" fill="${INK}"/><rect x="${x + 5}" y="16" width="12" height="7" fill="${VERMILION}"/><path d="M${x + 3} 11h16v2H${x + 3}zm6-3h4v3h-4z" fill="${INK}"/>`,
  book: x => `<path d="M${x + 2} 10h8v2h3v-2h8v15h-8v2h-3v-2H${x + 2}z" fill="${INK}"/><path d="M${x + 4} 12h5v11H${x + 4}zm10 0h5v11h-5z" fill="${PAPER_SHADE}"/><path d="M${x + 5} 15h3v1h-3zm0 4h3v1h-3zm10-4h3v1h-3zm0 4h3v1h-3z" fill="${WOOD}"/>`,
  brush: x => `<path d="M${x + 13} 8h5v4h-2v3h-2v3h-4v-3h1v-3h2z" fill="${WOOD}"/><path d="M${x + 6} 17h7v5h-2v3H${x + 3}v-3h3z" fill="${INK}"/><path d="M${x + 7} 19h4v3H${x + 5}v1h-1v-1h3z" fill="${VERMILION}"/>`,
  pen: x => `<path d="M${x + 16} 8h4v5h-2v3h-2v3h-2v3h-3v3H${x + 6}v-5h2v-3h2v-3h2v-3h4z" fill="${INK}"/><path d="M${x + 16} 10h2v3h-2v3h-2v3h-2v2h-2v-3h2v-3h2v-3h2z" fill="${SKY}"/>`,
};
const ACCENT = {
  kiko: (cx, cy) => `<path d="M${cx + 6} ${cy - 2}l4 2-4 2z" fill="${INK}"/>`,
  taro: (cx, cy) => `<circle cx="${cx - 5}" cy="${cy - 7}" r="2" fill="${INK}"/><circle cx="${cx + 5}" cy="${cy - 7}" r="2" fill="${INK}"/>`,
  nori: (cx, cy) => `<path d="M${cx - 6} ${cy - 2}h12" stroke="${INK}" stroke-width="2"/>`,
  pip: (cx, cy) => `<path d="M${cx + 5} ${cy}h5" stroke="#ff9a3c" stroke-width="2.5"/>`,
  momo: (cx, cy) => `<path d="M${cx - 5} ${cy - 12}h3v7h-3zm7 0h3v7h-3z" fill="${INK}"/>`,
  sora: (cx, cy) => `<path d="M${cx - 6} ${cy + 1}h12v3H${cx - 6}z" fill="${PAPER_SHADE}"/>`,
  yuki: (cx, cy) => `<path d="M${cx - 7} ${cy - 9}h3v2h2v3h-5zm9 5v-3h2v-2h3v5z" fill="${INK}"/>`,
  fumi: (cx, cy) => `<path d="M${cx - 6} ${cy}h3v2h6v-2h3v3h-3v2h-6v-2h-3z" fill="${PAPER}"/>`,
};
export function helpdayCreationMarkup(snapshot) {
  const set = snapshot?.crew?.length ? helpSetOfCrew(snapshot.crew) : helpSetFor(snapshot?.grade);
  const crew = normalizeCrew(snapshot?.crew, set);
  const cells = set.jobs.map((job, i) => {
    const x = COLUMNS[i], cx = x + 11, cy = TOKEN_Y;
    const who = helperById(crew.find(p => p.job === job.id)?.helper);
    const token = who
      ? `<circle cx="${cx}" cy="${cy}" r="8" fill="${esc(who.color)}" stroke="${INK}" stroke-width="1.5"/>${ACCENT[who.id](cx, cy)}`
      : `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    const mark = !who ? '' : set.fits[job.id] === who.id
      ? `<path d="M${cx - 4} 56l3 3 6-6" fill="none" stroke="${FINISH}" stroke-width="2.5"/>`
      : `<text x="${cx}" y="61" font-size="10" font-weight="700" text-anchor="middle" fill="${VERMILION}">?</text>`;
    return `<g data-job="${job.id}">` + GLYPH_SMALL[job.glyph](x) + token + mark + '</g>';
  }).join('');
  const label = `Your Help Day team board, ${crew.length} of 4 jobs filled`;
  return `<svg class="creation creation--helpday" viewBox="0 0 100 65" role="img" aria-label="${esc(label)}"><rect x="1.5" y="1.5" width="97" height="62" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><circle cx="8" cy="6" r="2" fill="${INK}"/><circle cx="92" cy="6" r="2" fill="${INK}"/>${cells}</svg>`;
}

// The spec's own names for the same functions (normalizeHelpDaySnapshot, helpDayReady, …).
export const normalizeHelpDaySnapshot = normalizeHelpday;
export const helpDayReady = helpdayReady;
export const helpDayOpening = helpdayOpening;
