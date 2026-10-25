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

export const GRADES_HELPDAY = [3, 4, 5];
export const STAMP_HELPDAY = 'Different strengths get every job done together.';

// Board order. `need` is the chip on the card, `needSays` the same need inside a screen-reader sentence,
// `glyph` the 24×24 picture the activity draws, `at` the bench caption word.
export const HELP_JOBS = [
  { id: 'lanterns', name: 'Lanterns', description: 'Hang lanterns', need: 'Up high', needSays: 'needs up high', glyph: 'lantern', at: 'lanterns' },
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
export const JOB_SHORT = { lanterns: 'the lanterns', drum: 'the drum', gate: 'the gate', mail: 'the invitations' };
export const NEED = {
  lanterns: 'Lanterns hang up high.',
  drum: 'The drum is heavy.',
  gate: 'The gate needs a helper all day.',
  mail: 'Invitations go all over town.',
};
export const BETTER_AT = { kiko: 'flying high', taro: 'heavy lifting', nori: 'patient hellos', pip: 'fast trips' };

export const jobById = id => HELP_JOBS.find(j => j.id === id) ?? null;
export const helperById = id => HELP_HELPERS.find(h => h.id === id) ?? null;
const nameOf = id => helperById(id)?.name ?? 'A helper';
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clampInt = (n, a, b) => Math.round(Math.min(b, Math.max(a, Number.isFinite(n) ? n : a)));

// Crew entries keep their order (it is the Undo order); bad jobs or helpers are dropped; a repeated job or
// helper keeps its first entry; anything past four entries is cut. Only { job, helper } is kept.
export function normalizeCrew(input) {
  const crew = [];
  if (!Array.isArray(input)) return crew;
  for (const entry of input) {
    if (crew.length >= MAX_CREW) break;
    if (!isPlainObject(entry)) continue;
    const { job, helper } = entry;
    if (!JOB_IDS.includes(job) || !HELPER_IDS.includes(helper)) continue;
    if (crew.some(p => p.job === job || p.helper === helper)) continue;
    crew.push({ job, helper });
  }
  return crew;
}

// The one validator, for the activity and (through the wiring) encounters.js: { kind, activity, grade,
// chapter, crew }. Nothing else is kept, and normalizing twice changes nothing.
export function normalizeHelpday(input, grade = input?.grade ?? 3, chapter = input?.chapter ?? 1) {
  const s = isPlainObject(input) ? input : {};
  return { kind: KIND, activity: ACTIVITY, grade: clampInt(grade, 0, 5), chapter: chapter === 1 ? 1 : 0, crew: normalizeCrew(s.crew) };
}

// For progress.js cleanCreation: the saved object, or null for anything that is not a Help Day. The chapter
// and grade follow cleanCreation's own rule (chapter 0 or 1; Kindergarten is grade 0, else grades 1–5).
export function cleanHelpdayCreation(input) {
  if (!isPlainObject(input) || input.kind !== KIND || input.activity !== ACTIVITY) return null;
  const chapter = input.chapter === 1 ? 1 : 0;
  const grade = chapter === 1 ? (Number.isFinite(input.grade) ? clampInt(input.grade, 1, 5) : 1) : 0;
  return normalizeHelpday(input, grade, chapter);
}

const crewOf = state => normalizeCrew(state?.crew);
export const helperAt = (state, job) => crewOf(state).find(p => p.job === job)?.helper ?? null;
export const jobOfHelper = (state, helper) => crewOf(state).find(p => p.helper === helper)?.job ?? null;
export const fits = (job, helper) => Object.hasOwn(HELP_FITS, job) && HELP_FITS[job] === helper;

// READY: every job has the helper that fits it (so the crew holds all four fitting pairs).
export function helpdayReady(state) {
  const crew = crewOf(state);
  return Array.isArray(state?.crew) && state.crew.length === 4 && crew.length === 4
    && Object.entries(HELP_FITS).every(([job, helper]) => crew.some(p => p.job === job && p.helper === helper));
}
export const helpDayFitCount = state => crewOf(state).filter(p => fits(p.job, p.helper)).length;
// The first job in board order without its fitting helper, or null when every job fits.
export const helpDayNextJob = state => JOB_IDS.find(job => helperAt(state, job) !== HELP_FITS[job]) ?? null;

// Send a helper to a job. Someone already on that job goes back to the bench; a helper leaving another job
// empties it. The new pair goes last, so Undo pops it first. A mismatch is still placed: the work is kept.
export function assignHelper(state, job, helper) {
  if (!JOB_IDS.includes(job) || !HELPER_IDS.includes(helper)) return { state, status: 'invalid' };
  if (helperAt(state, job) === helper) return { state, status: 'same' };
  const crew = [...crewOf(state).filter(p => p.job !== job && p.helper !== helper), { job, helper }];
  return { state: { ...state, crew }, status: fits(job, helper) ? 'fits' : 'mismatch' };
}
export function undoAssignment(state) {
  const crew = crewOf(state);
  if (!crew.length) return { state, helper: null };
  return { state: { ...state, crew: crew.slice(0, -1) }, helper: crew.at(-1).helper };
}

const FIT = {
  lanterns: 'Kiko flies up and hangs every lantern. Great match!',
  drum: 'Taro carries the big drum to the stage. Great match!',
  gate: 'Nori greets every visitor with a smile. Great match!',
  mail: 'Pip delivers every invitation by noon. Great match!',
};
const NEXT = {
  lanterns: 'The lanterns need a helper who can go up high.',
  drum: 'The drum needs a strong helper to carry it.',
  gate: 'The gate needs a patient helper all day long.',
  mail: 'The invitations need a fast helper for town.',
};
const ASK = {
  kiko: 'Kiko says: I can fly higher than the roof!',
  taro: 'Taro says: I carry heavy things every day!',
  nori: 'Nori says: I can say hello all day long!',
  pip: 'Pip says: Fast feet! I zip all over town!',
};
const PICK = {
  kiko: 'Kiko flies higher than the stage roof.',
  taro: 'Taro lifts heavy crates all day long.',
  nori: 'Nori is patient and loves saying hello.',
  pip: 'Pip zips all over town on fast feet.',
};
export const HELPDAY_LINES = {
  opening: 'Help Day! Four jobs, four helpers. Who fits each job?',
  openingPartial: 'Your team is half set. Who fits the open jobs?',
  openingReady: 'Your team is set. Start day, or move a helper.',
  notReady: 'A job is open again. Fill every job to start.',
  allSet: 'Every job fits. Choose Start day!',
  fit: job => FIT[job],
  // Never "cannot": the job's need, then what this helper is better at.
  mismatch: (job, helper) => `${NEED[job]} ${nameOf(helper)} is better at ${BETTER_AT[helper]}.`,
  same: (job, helper) => `${nameOf(helper)} is already on ${JOB_SHORT[job]}.`,
  undo: helper => `${nameOf(helper)} is back on the bench. One job is open.`,
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
};
const ACCENT = {
  kiko: (cx, cy) => `<path d="M${cx + 6} ${cy - 2}l4 2-4 2z" fill="${INK}"/>`,
  taro: (cx, cy) => `<circle cx="${cx - 5}" cy="${cy - 7}" r="2" fill="${INK}"/><circle cx="${cx + 5}" cy="${cy - 7}" r="2" fill="${INK}"/>`,
  nori: (cx, cy) => `<path d="M${cx - 6} ${cy - 2}h12" stroke="${INK}" stroke-width="2"/>`,
  pip: (cx, cy) => `<path d="M${cx + 5} ${cy}h5" stroke="#ff9a3c" stroke-width="2.5"/>`,
};
export function helpdayCreationMarkup(snapshot) {
  const crew = normalizeCrew(snapshot?.crew);
  const cells = HELP_JOBS.map((job, i) => {
    const x = COLUMNS[i], cx = x + 11, cy = TOKEN_Y;
    const who = helperById(crew.find(p => p.job === job.id)?.helper);
    const token = who
      ? `<circle cx="${cx}" cy="${cy}" r="8" fill="${esc(who.color)}" stroke="${INK}" stroke-width="1.5"/>${ACCENT[who.id](cx, cy)}`
      : `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    const mark = !who ? '' : fits(job.id, who.id)
      ? `<path d="M${cx - 4} 56l3 3 6-6" fill="none" stroke="${FINISH}" stroke-width="2.5"/>`
      : `<text x="${cx}" y="61" font-size="10" font-weight="700" text-anchor="middle" fill="${VERMILION}">?</text>`;
    return GLYPH_SMALL[job.glyph](x) + token + mark;
  }).join('');
  const label = `Your Help Day team board, ${crew.length} of 4 jobs filled`;
  return `<svg class="creation creation--helpday" viewBox="0 0 100 65" role="img" aria-label="${esc(label)}"><rect x="1.5" y="1.5" width="97" height="62" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><circle cx="8" cy="6" r="2" fill="${INK}"/><circle cx="92" cy="6" r="2" fill="${INK}"/>${cells}</svg>`;
}

// The spec's own names for the same functions (normalizeHelpDaySnapshot, helpDayReady, …).
export const normalizeHelpDaySnapshot = normalizeHelpday;
export const helpDayReady = helpdayReady;
export const helpDayOpening = helpdayOpening;
