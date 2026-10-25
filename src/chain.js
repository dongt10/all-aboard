// Momo's sunbeam chart (science, grades 3–5): the pure rules.
// A bay food chain on three plates: sea plant, little fish, then an otter or a gull. Every step up the chain
// keeps about one tenth of the energy (the 10% rule), so a finished chart reads as stairs going down.
// Nothing wrong ever lands: a wrong card or number stays in its rail and Momo says why.
// This module owns its own snapshot, so it runs and is tested without any change to encounters.js or progress.js.
// Every sentence here is 56 characters or fewer, so a dialogue page never breaks mid-sentence with Bigger words on.
import { INK, PAPER, PAPER_SHADE, SEA, LANTERN, VERMILION } from './ui/palette.js';

export const GRADES_CHAIN = [3, 4, 5];
export const STAMP_CHAIN = 'Only about one tenth of energy moves up a food chain.';

export const CHAIN_CARDS = ['plant', 'fish', 'otter', 'gull'];
export const EATS = { plant: 'sun', fish: 'plant', otter: 'fish', gull: 'fish' };
// Every number a tile can carry at any grade: the whitelist for saving.
export const ENERGY_TILES = [1, 5, 10, 50, 100, 250, 500, 1000, 2500, 5000];
const PLATES = 3;
// What sits before each plate: the sun before plate 1, then the creature on the plate before.
const BEFORE = ['sun', 'plant', 'fish'];
const FOOD_WORD = ['sunlight', 'sea plants', 'little fish'];
const FOOD_QUESTION = ['Who makes food from sunlight?', 'Who nibbles sea plants?', 'Who eats little fish?'];

// The word a kid reads for each creature, and its plural for the wrong-try lines.
export const CARD_WORDS = {
  plant: { word: 'Sea plant', plural: 'Sea plants' },
  fish: { word: 'Little fish', plural: 'Fish' },
  otter: { word: 'Otter', plural: 'Otters' },
  gull: { word: 'Gull', plural: 'Gulls' },
};
// Small pixel glyphs in currentColor on a 24×24 grid, like icons.js: a sea plant tuft, a little fish, an otter, a gull.
export const CARD_GLYPHS = {
  plant: 'M11 3h2v17h-2zM7 7h2v13H7zm8 0h2v13h-2zM4 11h2v9H4zm14 0h2v9h-2zM3 20h18v2H3z',
  fish: 'M8 8h8v8H8zm8 2h3v4h-3zM6 10h2v4H6zM4 8h2v3H4zm0 5h2v3H4zM2 6h2v3H2zm0 9h2v3H2zm8-9h4v2h-4zm3 4h2v2h-2z',
  otter: 'M9 3h6v2H9zM7 5h10v6H7zm2 6h6v8H9zM7 19h4v2H7zm6 0h4v2h-4zM4 9h3v2H4zm13 0h3v2h-3zm-2 4h4v2h-4zm4 2h2v4h-2z',
  gull: 'M1 10h4v2H1zm4-2h4v2H5zm4-2h6v2H9zm6 2h4v2h-4zm4 2h4v2h-4zm-9 2h4v6h-4zm-2 6h8v2H8zm4-6h2v2h-2z',
};

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const bounded = (n, a, b, fallback) => Number.isFinite(n) ? Math.round(Math.min(b, Math.max(a, n))) : fallback;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isGrade5 = grade => Number(grade) >= 5;

// Grade 5 works with 5000 and says "10%"; grades 3 and 4 work with 1000 and say "one tenth".
export const sunEnergy = grade => (isGrade5(grade) ? 5000 : 1000);
export const energyTiles = grade => (isGrade5(grade) ? [5000, 2500, 500, 250, 50, 5] : [1000, 500, 100, 50, 10, 1]);
export const expectedEnergy = grade => { const s = sunEnergy(grade); return [s / 10, s / 100, s / 1000]; };
export const tenthWord = grade => (isGrade5(grade) ? '10%' : 'one tenth');
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);

export const openCardSlot = chain => { const i = chain.findIndex(c => c === null); return i < 0 ? PLATES : i; };
export const openEnergySlot = s => s.chain.findIndex((c, i) => c !== null && s.energy[i] === null);

// The chain cut to its longest valid prefix: plant, then fish, then an otter or a gull. A bad entry nulls
// itself and everything after it, so a tampered ['fish', 'plant', null] comes back as [null, null, null].
function validChainPrefix(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [null, null, null];
  for (let i = 0; i < PLATES; i++) {
    const card = list[i];
    if (!CHAIN_CARDS.includes(card) || EATS[card] !== BEFORE[i]) break;
    out[i] = card;
  }
  return out;
}

// Saved numbers must be integer tiles, with no energy on an empty plate.
function validEnergy(input, chain) {
  const list = Array.isArray(input) ? input : [];
  return chain.map((card, i) => (card !== null && Number.isInteger(list[i]) && ENERGY_TILES.includes(list[i]) ? list[i] : null));
}

// The saved shape: { kind: 'science', activity: 'chain', grade, chapter, chain[3], energy[3], shone }.
// A legacy K–2 ice snapshot (no activity field) is ignored, so the chart starts fresh.
export function normalizeChain(input = {}, grade = 3, chapter = 1) {
  const s = isPlainObject(input) && input.kind === 'science' && input.activity === 'chain' ? input : {};
  const g = bounded(grade, 3, 5, 3);
  const chain = validChainPrefix(s.chain);
  const energy = validEnergy(s.energy, chain, g);
  const snapshot = { kind: 'science', activity: 'chain', grade: g, chapter: bounded(chapter, 1, 1, 1), chain, energy, shone: false };
  snapshot.shone = s.shone === true && chainComplete(snapshot, g);
  return snapshot;
}

// This activity only belongs to elementary grades 3–5. Other activities are rejected.
export function cleanChainCreation(input) {
  if (!isPlainObject(input) || input.kind !== 'science' || input.activity !== 'chain') return null;
  return normalizeChain(input, input.grade, input.chapter);
}

export function chainComplete(s, grade = s?.grade) {
  const chain = Array.isArray(s?.chain) ? s.chain : [];
  const energy = Array.isArray(s?.energy) ? s.energy : [];
  if (chain.length !== 3 || energy.length !== 3) return false;
  if (chain[0] !== 'plant' || chain[1] !== 'fish' || !['otter', 'gull'].includes(chain[2])) return false;
  return expectedEnergy(grade).every((want, i) => energy[i] === want);
}
// A grade 3–5 science creation is ready when the chain and the three numbers are right and Shine! has been pressed.
export const chainReady = s => Boolean(s) && s.kind === 'science' && s.activity === 'chain' && GRADES_CHAIN.includes(s.grade) && chainComplete(s, s.grade) && s.shone === true;

// A creature goes onto the lowest empty plate when it eats what sits on the plate before it.
// status: 'placed' | 'used' | 'full' | 'wrong' | 'unknown'; food names what sits before the open plate.
export function placeCard(s, card) {
  if (!CHAIN_CARDS.includes(card)) return { state: s, status: 'unknown' };
  if (s.chain.includes(card)) return { state: s, status: 'used' };
  const slot = openCardSlot(s.chain);
  if (slot >= PLATES) return { state: s, status: 'full' };
  const food = FOOD_WORD[slot];
  if (EATS[card] !== BEFORE[slot]) return { state: s, status: 'wrong', slot, food };
  const chain = s.chain.map((c, i) => (i === slot ? card : c));
  return { state: { ...s, chain, shone: false }, status: 'placed', slot, food };
}

// A number goes onto the lowest plate that has a creature but no number.
// status: 'placed' | 'nowhere' | 'same' | 'high' | 'low' | 'unknown'; prev is the number on the step before.
export function placeEnergy(s, n, grade = s.grade) {
  if (!energyTiles(grade).includes(n)) return { state: s, status: 'unknown' };
  const plate = openEnergySlot(s);
  if (plate < 0) return { state: s, status: 'nowhere', plate };
  const want = expectedEnergy(grade);
  const expected = want[plate], prev = plate === 0 ? sunEnergy(grade) : want[plate - 1];
  if (n === expected) {
    const energy = s.energy.map((e, i) => (i === plate ? n : e));
    return { state: { ...s, energy, shone: false }, status: 'placed', plate, prev, expected };
  }
  return { state: s, status: n === prev ? 'same' : n > expected ? 'high' : 'low', plate, prev, expected };
}

export const LINES = {
  opening: 'Every bite started as sunlight. Who uses it first?',
  openingPart: 'Let’s finish the chart.',
  openingReady: 'Your sunbeam chart is ready. Pin it, or start over.',
  needCard1: 'Who uses sunlight first? Tap a card.',
  needCard2: 'Who eats sea plants? Tap a card.',
  needCard3: 'Who eats little fish? Tap a card.',
  needNumber: plate => `How much energy reaches plate ${plate}? Tap a number.`,
  allSet: 'All set! Choose Shine!',
  ready: 'Ready! Choose Pin chart.',
  placed: { plant: 'Sea plants use sunlight to grow.', fish: 'Little fish nibble sea plants.', otter: 'Otters love fish!', gull: 'Gulls dive for fish!' },
  used: 'That card is already on the chart.',
  full: 'Every plate is full.',
  wrongSun: plural => `${plural} cannot use sunlight.`,
  wrongFood: (plural, food) => `${plural} do not eat ${food}.`,
  question: slot => FOOD_QUESTION[slot],
  nowhereEmpty: 'Fill a plate first. Who uses sunlight first?',
  nowhereFull: 'Every number is in.',
  same: 'All of it? No. Most energy is used to live and move.',
  high: tenth => `Too much. Only about ${tenth} moves up each step.`,
  low: tenth => `Too little. About ${tenth} moves up, not less.`,
  number: (plate, value, prev, tenth) => `Plate ${plate} gets ${value}. ${capital(tenth)} of ${prev} is ${value}.`,
  shine: tenth => `Sunlight pours in! Only ${tenth} moves up each step. Choose Pin chart.`,
  shineHint: 'Choose Shine!',
  reset: 'The chart is empty again. Start with the sun.',
  notReady: 'Something changed. Choose Shine!',
  repair: 'These numbers need a fresh start. Choose Start over.',
};

// What to do next, in this order: the first empty plate's creature or its number, then Shine!, then Pin chart.
export function nextNeedLine(s, grade = s.grade) {
  if (s.chain[0] === null) return LINES.needCard1;
  const slot = openEnergySlot(s);
  if (slot >= 0) return LINES.needNumber(slot + 1);
  const next = openCardSlot(s.chain);
  if (next === 1) return LINES.needCard2;
  if (next === 2) return LINES.needCard3;
  if (!chainComplete(s, grade)) return LINES.repair;
  return s.shone ? LINES.ready : LINES.allSet;
}

export function chainOpening(s) {
  if (chainReady(s)) return LINES.openingReady;
  if (s.chain[0] === null) return LINES.opening;
  return `${LINES.openingPart} ${nextNeedLine(s)}`;
}

// What Momo says after a card tap: a right card lands with its line and the next need; a wrong one explains why.
export function cardLine(card, state, grade = state.grade) {
  const result = placeCard(state, card);
  state = result.state;
  const words = CARD_WORDS[card];
  if (result.status === 'placed') return `${LINES.placed[card]} ${nextNeedLine(state, grade)}`;
  if (result.status === 'used') return `${LINES.used} ${nextNeedLine(state, grade)}`;
  if (result.status === 'full') return `${LINES.full} ${nextNeedLine(state, grade)}`;
  if (result.status === 'wrong') {
    const why = result.slot === 0 ? LINES.wrongSun(words.plural) : LINES.wrongFood(words.plural, result.food);
    return `${why} ${LINES.question(result.slot)}`;
  }
  return nextNeedLine(state, grade);
}

// What Momo says after a number tap. `state` is the state after the tap (the same object when nothing landed).
export function energyLine(result, grade = result.state.grade) {
  const state = result.state;
  const tenth = tenthWord(grade);
  switch (result.status) {
    case 'placed': {
      const line = LINES.number(result.plate + 1, result.expected, result.prev, tenth);
      return chainComplete(state, grade) ? `${line} ${LINES.shineHint}` : line;
    }
    case 'nowhere':
      if (state.chain[0] === null) return LINES.nowhereEmpty;
      if (!chainComplete(state, grade)) return nextNeedLine(state, grade);
      return `${LINES.nowhereFull} ${state.shone ? 'Choose Pin chart.' : LINES.shineHint}`;
    case 'same': return LINES.same;
    case 'high': return LINES.high(tenth);
    case 'low': return LINES.low(tenth);
    default: return nextNeedLine(state, grade);
  }
}

// ---- The pinned chart, drawn small (96×64 viewBox, reads at 64×48) for the stall, the parade and the item-get card.
// Every value is validated (names map to a glyph table, numbers become block counts), so nothing from the save is
// written as text. The staircase (one tall stack, then three shorter) is the shape a judge recognizes from afar.
const digits = n => (Number.isInteger(n) && ENERGY_TILES.includes(n) ? String(n).length : 0);
const CELL = 22, LEFT = 4, FLOOR = 52;
function blockStack(x, count, lit) {
  const fill = lit ? LANTERN : 'none';
  const stroke = lit ? INK : PAPER_SHADE;
  const dash = lit ? '' : ' stroke-dasharray="1.5 1"';
  return Array.from({ length: count }, (_, i) => `<rect x="${x}" y="${FLOOR - 12 - 7 * (i + 1)}" width="6" height="6" fill="${fill}" stroke="${stroke}" stroke-width="1"${dash}/>`).join('');
}
export function chainCreationMarkup(s = {}) {
  s = isPlainObject(s) ? s : {};
  const chain = validChainPrefix(s.chain);
  const lit = s.shone === true && chainComplete({ ...s, chain }, s.grade);
  const energy = Array.isArray(s.energy) ? s.energy : [];
  const names = chain.filter(Boolean).map(card => CARD_WORDS[card].word.toLowerCase());
  const label = names.length ? `Your sunbeam chart: sun to ${names.join(' to ')}` : 'Your sunbeam chart';
  const cells = [];
  // Cell 1: the sun, with four rays and a full stack of four blocks.
  const sx = LEFT + 6;
  cells.push(`<rect x="${sx}" y="${FLOOR - 10}" width="10" height="10" fill="${LANTERN}" stroke="${INK}" stroke-width="1"/>`
    + `<path d="M${sx + 5} ${FLOOR - 13}v2M${sx + 5} ${FLOOR + 1}v2M${sx - 3} ${FLOOR - 5}h2M${sx + 11} ${FLOOR - 5}h2" stroke="${INK}" stroke-width="1"/>`
    + blockStack(sx + 2, 4, lit));
  for (let i = 0; i < PLATES; i++) {
    const x = LEFT + CELL * (i + 1);
    const card = chain[i];
    const gx = x + 6;
    if (card) {
      cells.push(`<g transform="translate(${gx} ${FLOOR - 10}) scale(${10 / 24})" fill="${SEA}"><path d="${CARD_GLYPHS[card]}"/></g>`);
    } else {
      cells.push(`<rect x="${gx}" y="${FLOOR - 10}" width="10" height="10" fill="none" stroke="${PAPER_SHADE}" stroke-width="1" stroke-dasharray="1.5 1"/>`
        + `<path d="M${gx + 4} ${FLOOR - 7}h2v1h1v2h-1v1h-2v-1h1v-1h-1zm0 5h2v2h-2z" fill="${PAPER_SHADE}"/>`);
    }
    cells.push(blockStack(gx + 2, card ? digits(energy[i]) : 0, lit));
    // A tiny arrow from the cell before, meaning "gives energy to".
    cells.push(`<path d="M${x - 4} ${FLOOR - 5}h4M${x - 2} ${FLOOR - 7}l2 2-2 2" fill="none" stroke="${INK}" stroke-width="1"/>`);
  }
  return `<svg class="creation creation--science creation--chain" viewBox="0 0 96 64" role="img" aria-label="${esc(label)}">`
    + `<rect x="1" y="1" width="94" height="62" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="6" cy="6" r="2" fill="${VERMILION}"/><circle cx="90" cy="6" r="2" fill="${VERMILION}"/>`
    + cells.join('') + '</svg>';
}
