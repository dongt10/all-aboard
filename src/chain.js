// Momo's sunbeam chart (science, grades 3–5): the pure rules.
// Three plates hold a bay or pond food chain. Plants catch sunlight; each feeding step
// keeps about one tenth of the energy, so a finished chart reads as stairs going down.
// Nothing wrong ever lands: a wrong card or number stays in its rail and Momo says why.
// This module owns its own snapshot, so it runs and is tested without any change to encounters.js or progress.js.
// Every sentence here is 56 characters or fewer, so a dialogue page never breaks mid-sentence with Bigger words on.
import { INK, PAPER, PAPER_SHADE, SEA, LANTERN, VERMILION } from './ui/palette.js';

export const GRADES_CHAIN = [3, 4, 5];
export const STAMP_CHAIN = 'This chart uses one tenth. Real transfer varies.';

export const CHAIN_CARDS = ['plant', 'fish', 'otter', 'gull'];
export const EATS = { plant: 'sun', fish: 'plant', otter: 'fish', gull: 'fish', pondweed: 'sun', snail: 'pondweed', koi: 'snail', frog: 'snail' };
export const CHAINS = {
  bay: {
    cards: CHAIN_CARDS, before: ['sun', 'plant', 'fish'], food: ['sunlight', 'sea plants', 'little fish'],
    questions: ['Who makes food from sunlight?', 'Who nibbles sea plants?', 'Who eats little fish?'],
    needs: ['Who uses sunlight first? Tap a card.', 'Who eats sea plants? Tap a card.', 'Who eats little fish? Tap a card.'],
    firstHint: 'Sea plants catch the most. Tap the biggest number.',
    firstNumber: 'Sea plants catch sunlight first.',
  },
  pond: {
    cards: ['pondweed', 'snail', 'koi', 'frog'], before: ['sun', 'pondweed', 'snail'], food: ['sunlight', 'pondweed', 'snails'],
    questions: ['Who makes food from sunlight?', 'Who nibbles pondweed?', 'Who eats snails?'],
    needs: ['Who uses sunlight first? Tap a card.', 'Who nibbles pondweed? Tap a card.', 'Who eats snails? Tap a card.'],
    firstHint: 'Pondweed catches the most. Tap the biggest number.',
    firstNumber: 'Pondweed catches sunlight first.',
  },
};
export const chainFor = grade => Number(grade) === 4 ? CHAINS.pond : CHAINS.bay;
// Pictures follow the saved cards, even when an older grade-4 chart used the bay.
export const chainOfCards = cards => (Array.isArray(cards) ? cards : [])
  .map(card => Object.values(CHAINS).find(chain => chain.cards.includes(card))).find(Boolean) ?? CHAINS.bay;
// Every number a tile can carry at any grade: the whitelist for saving.
export const ENERGY_TILES = [1, 2, 5, 10, 20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
const PLATES = 3;

// The word a kid reads for each creature, and its plural for the wrong-try lines.
export const CARD_WORDS = {
  plant: { word: 'Sea plant', plural: 'Sea plants' },
  fish: { word: 'Little fish', plural: 'Fish' },
  otter: { word: 'Otter', plural: 'Otters' },
  gull: { word: 'Gull', plural: 'Gulls' },
  pondweed: { word: 'Pondweed', plural: 'Pondweed' },
  snail: { word: 'Snail', plural: 'Snails' },
  koi: { word: 'Koi', plural: 'Koi' },
  frog: { word: 'Frog', plural: 'Frogs' },
};
// Small pixel glyphs in currentColor on a 24×24 grid, like icons.js: a sea plant tuft, a little fish, an otter, a gull.
export const CARD_GLYPHS = {
  plant: 'M11 3h2v17h-2zM7 7h2v13H7zm8 0h2v13h-2zM4 11h2v9H4zm14 0h2v9h-2zM3 20h18v2H3z',
  fish: 'M8 8h8v8H8zm8 2h3v4h-3zM6 10h2v4H6zM4 8h2v3H4zm0 5h2v3H4zM2 6h2v3H2zm0 9h2v3H2zm8-9h4v2h-4zm3 4h2v2h-2z',
  otter: 'M9 3h6v2H9zM7 5h10v6H7zm2 6h6v8H9zM7 19h4v2H7zm6 0h4v2h-4zM4 9h3v2H4zm13 0h3v2h-3zm-2 4h4v2h-4zm4 2h2v4h-2z',
  gull: 'M1 10h4v2H1zm4-2h4v2H5zm4-2h6v2H9zm6 2h4v2h-4zm4 2h4v2h-4zm-9 2h4v6h-4zm-2 6h8v2H8zm4-6h2v2h-2z',
  pondweed: 'M11 2h2v20h-2zM4 4h5v2h2v3H6V7H4zm11 5h5v3h-2v2h-5v-3h2zM3 13h6v2h2v3H5v-2H3zm12 4h6v3h-3v2h-5v-3h2z',
  snail: 'M7 5h8v2h2v8H5V7h2zm2 3v2h4v3h2V8zm-7 9h16v-4h2v6h-2v2H2zm17-9h2v4h-2zm3-2h2v6h-2z',
  koi: 'M8 6h8v2h3v2h2v4h-2v2h-3v2H8v-2H6v-2H4v4H2V6h2v4h2V8h2zm2 3v3h3V9zm3 5v2h3v-2z',
  frog: 'M5 3h4v4h6V3h4v6h2v6h-3v3h4v3h-7v-4H9v4H2v-3h4v-3H3V9h2zm3 7v2h8v-2z',
};

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const bounded = (n, a, b, fallback) => Number.isFinite(n) ? Math.round(Math.min(b, Math.max(a, n))) : fallback;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isGrade5 = grade => Number(grade) >= 5;

// The largest number belongs to the plant. The Sun is a source, not a numbered plate.
export const topEnergy = grade => isGrade5(grade) ? 5000 : Number(grade) === 4 ? 2000 : 1000;
export const energyTiles = grade => isGrade5(grade) ? [5000, 2500, 500, 250, 50, 5]
  : Number(grade) === 4 ? [2000, 1000, 200, 100, 20, 2] : [1000, 500, 100, 50, 10, 1];
export const expectedEnergy = grade => { const t = topEnergy(grade); return [t, t / 10, t / 100]; };
export const tenthWord = grade => (isGrade5(grade) ? '10%' : 'one tenth');
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);

export const openCardSlot = chain => { const i = chain.findIndex(c => c === null); return i < 0 ? PLATES : i; };
export const openEnergySlot = s => s.chain.findIndex((c, i) => c !== null && s.energy[i] === null);

// The chain cut to its longest valid prefix: plant, then fish, then an otter or a gull. A bad entry nulls
// itself and everything after it, so a tampered ['fish', 'plant', null] comes back as [null, null, null].
function validChainPrefix(input, content) {
  const list = Array.isArray(input) ? input : [];
  const out = [null, null, null];
  for (let i = 0; i < PLATES; i++) {
    const card = list[i];
    if (!content.cards.includes(card) || EATS[card] !== content.before[i]) break;
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
function normalizedChain(input, grade, chapter, content) {
  const s = isPlainObject(input) && input.kind === 'science' && input.activity === 'chain' ? input : {};
  const g = bounded(grade, 3, 5, 3);
  const chain = validChainPrefix(s.chain, content);
  const energy = validEnergy(s.energy, chain);
  const snapshot = { kind: 'science', activity: 'chain', grade: g, chapter: bounded(chapter, 1, 1, 1), chain, energy, shone: false };
  snapshot.shone = s.shone === true && chainComplete(snapshot, g);
  return snapshot;
}
export function normalizeChain(input = {}, grade = 3, chapter = 1) {
  return normalizedChain(input, grade, chapter, chainFor(bounded(grade, 3, 5, 3)));
}

// This activity only belongs to elementary grades 3–5. Other activities are rejected.
export function cleanChainCreation(input) {
  if (!isPlainObject(input) || input.kind !== 'science' || input.activity !== 'chain') return null;
  return normalizedChain(input, input.grade, input.chapter, chainOfCards(input.chain));
}

export function chainComplete(s, grade = s?.grade) {
  const chain = Array.isArray(s?.chain) ? s.chain : [];
  const energy = Array.isArray(s?.energy) ? s.energy : [];
  if (chain.length !== 3 || energy.length !== 3) return false;
  const content = chainFor(grade);
  if (!content.before.every((food, i) => content.cards.includes(chain[i]) && EATS[chain[i]] === food)) return false;
  return expectedEnergy(grade).every((want, i) => energy[i] === want);
}
// A grade 3–5 science creation is ready when the chain and the three numbers are right and Shine! has been pressed.
export const chainReady = s => Boolean(s) && s.kind === 'science' && s.activity === 'chain' && GRADES_CHAIN.includes(s.grade) && chainComplete(s, s.grade) && s.shone === true;

// A creature goes onto the lowest empty plate when it eats what sits on the plate before it.
// status: 'placed' | 'used' | 'full' | 'wrong' | 'unknown'; food names what sits before the open plate.
export function placeCard(s, card) {
  const content = chainFor(s.grade);
  if (!content.cards.includes(card)) return { state: s, status: 'unknown' };
  if (s.chain.includes(card)) return { state: s, status: 'used' };
  const slot = openCardSlot(s.chain);
  if (slot >= PLATES) return { state: s, status: 'full' };
  const food = content.food[slot];
  if (EATS[card] !== content.before[slot]) return { state: s, status: 'wrong', slot, food };
  const chain = s.chain.map((c, i) => (i === slot ? card : c));
  return { state: { ...s, chain, shone: false }, status: 'placed', slot, food };
}

// A number goes onto the lowest plate that has a creature but no number.
// status: 'placed' | 'nowhere' | 'first' | 'same' | 'high' | 'low' | 'unknown'.
// Plate 1 has no previous number: its plant catches sunlight first.
export function placeEnergy(s, n, grade = s.grade) {
  if (!energyTiles(grade).includes(n)) return { state: s, status: 'unknown' };
  const plate = openEnergySlot(s);
  if (plate < 0) return { state: s, status: 'nowhere', plate };
  const want = expectedEnergy(grade);
  const expected = want[plate], prev = plate === 0 ? null : want[plate - 1];
  if (n === expected) {
    const energy = s.energy.map((e, i) => (i === plate ? n : e));
    return { state: { ...s, energy, shone: false }, status: 'placed', plate, prev, expected };
  }
  return { state: s, status: plate === 0 ? 'first' : n === prev ? 'same' : n > expected ? 'high' : 'low', plate, prev, expected };
}

export const LINES = {
  opening: 'This chart shows pretend energy units. Groups grow over the same time. We compare their new growth. For this example, use one tenth. Real transfer varies. Who uses sunlight first?',
  openingPart: 'These are pretend energy units for new growth. Groups grow over the same time. This example uses one tenth. Real transfer varies. Let’s finish the chart.',
  openingReady: 'These are pretend energy units for new growth. Groups grow over the same time. This example uses one tenth. Real transfer varies. Your chart is ready. Pin it, or start over.',
  needCard1: 'Who uses sunlight first? Tap a card.',
  needCard2: 'Who eats sea plants? Tap a card.',
  needCard3: 'Who eats little fish? Tap a card.',
  needNumber: plate => `How many pretend units for plate ${plate}? Tap a number.`,
  allSet: 'All set! Choose Shine!',
  ready: 'Ready! Choose Pin chart.',
  placed: {
    plant: 'Sea plants use sunlight to grow.', fish: 'Little fish nibble sea plants.', otter: 'Otters love fish!', gull: 'Gulls dive for fish!',
    pondweed: 'Pondweed uses sunlight to grow.', snail: 'Snails nibble pondweed.', koi: 'Koi slurp up snails!', frog: 'Frogs snap up snails!',
  },
  used: 'That card is already on the chart.',
  full: 'Every plate is full.',
  wrongSun: plural => `${plural} cannot use sunlight.`,
  wrongFood: () => 'For this chart, choose what comes next.',
  question: (slot, grade = 3) => chainFor(grade).questions[slot],
  nowhereEmpty: 'Fill a plate first. Who uses sunlight first?',
  nowhereFull: 'Every number is in.',
  same: 'For this example, use one tenth at each step.',
  high: tenth => `For this example, use ${tenth} at each step.`,
  low: tenth => `For this example, use ${tenth} at each step.`,
  first: (grade = 3) => chainFor(grade).firstHint,
  firstNumber: (value, grade = 3) => `Plate 1 gets ${value}. ${chainFor(grade).firstNumber}`,
  number: (plate, value, prev, tenth) => `Plate ${plate} gets ${value}. ${capital(tenth)} of ${prev} is ${value}.`,
  shine: tenth => `This example uses ${tenth} at each step. Real transfer varies. Choose Pin chart.`,
  shineHint: 'Choose Shine!',
  reset: 'The chart is empty again. Start with the sun.',
  notReady: 'Something changed. Choose Shine!',
  repair: 'These numbers need a fresh start. Choose Start over.',
};

// What to do next, in this order: the first empty plate's creature or its number, then Shine!, then Pin chart.
export function nextNeedLine(s, grade = s.grade) {
  if (s.chain[0] === null) return LINES.needCard1;
  const slot = openEnergySlot(s);
  if (slot === 0) return LINES.first(grade);
  if (slot > 0) return LINES.needNumber(slot + 1);
  const next = openCardSlot(s.chain);
  if (next < PLATES) return chainFor(grade).needs[next];
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
    return `${why} ${LINES.question(result.slot, grade)}`;
  }
  return nextNeedLine(state, grade);
}

// What Momo says after a number tap. `state` is the state after the tap (the same object when nothing landed).
export function energyLine(result, grade = result.state.grade) {
  const state = result.state;
  const tenth = tenthWord(grade);
  switch (result.status) {
    case 'placed': {
      const line = result.plate === 0 ? LINES.firstNumber(result.expected, grade)
        : LINES.number(result.plate + 1, result.expected, result.prev, tenth);
      return chainComplete(state, grade) ? `${line} ${LINES.shineHint}` : line;
    }
    case 'nowhere':
      if (state.chain[0] === null) return LINES.nowhereEmpty;
      if (!chainComplete(state, grade)) return nextNeedLine(state, grade);
      return `${LINES.nowhereFull} ${state.shone ? 'Choose Pin chart.' : LINES.shineHint}`;
    case 'first': return LINES.first(grade);
    case 'same': return LINES.same;
    case 'high': return LINES.high(tenth);
    case 'low': return LINES.low(tenth);
    default: return nextNeedLine(state, grade);
  }
}

// ---- The pinned chart, drawn small (96×64 viewBox, reads at 64×48) for the stall, the parade and the item-get card.
// Every value is validated (names map to a glyph table, numbers become block counts), so nothing from the save is
// written as text. The three stacks count digits, with a division label at each feeding step.
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
  const chain = validChainPrefix(s.chain, chainOfCards(s.chain));
  const lit = s.shone === true && chainComplete({ ...s, chain }, s.grade);
  const energy = Array.isArray(s.energy) ? s.energy : [];
  const names = chain.filter(Boolean).map(card => CARD_WORDS[card].word.toLowerCase());
  const label = names.length ? `Your sunbeam chart. Sun to ${names.join(' to ')}.` : 'Your sunbeam chart';
  const cells = [];
  // The Sun supplies sunlight. It carries neither a number nor a block stack.
  const sx = LEFT + 6;
  cells.push(`<rect x="${sx}" y="${FLOOR - 10}" width="10" height="10" fill="${LANTERN}" stroke="${INK}" stroke-width="1"/>`
    + `<path d="M${sx + 5} ${FLOOR - 13}v2M${sx + 5} ${FLOOR + 1}v2M${sx - 3} ${FLOOR - 5}h2M${sx + 11} ${FLOOR - 5}h2" stroke="${INK}" stroke-width="1"/>`);
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
    if (i > 0) cells.push(`<path d="M${x - 4} ${FLOOR - 5}h4M${x - 2} ${FLOOR - 7}l2 2-2 2" fill="none" stroke="${INK}" stroke-width="1"/>`
      + `<text x="${x - 2}" y="${FLOOR - 14}" font-size="6" text-anchor="middle" fill="${INK}">÷10</text>`);
  }
  return `<svg class="creation creation--science creation--chain" viewBox="0 0 96 64" role="img" aria-label="${esc(label)}">`
    + `<rect x="1" y="1" width="94" height="62" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="6" cy="6" r="2" fill="${VERMILION}"/><circle cx="90" cy="6" r="2" fill="${VERMILION}"/>`
    + cells.join('') + '</svg>';
}
