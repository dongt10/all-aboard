// Taro's pizza party (math, grades 3–5): Momo baked a pizza, Taro's cart carries it, and four friends
// share it. Plates hold half-slice units so one integer array covers whole slices (grades 3–4) and the
// grade-5 halves. Pure rules only, no DOM, imported by the activity and (through the wiring lane) by
// encounters.js and progress.js, so it imports nothing from either.
// Every sentence a child reads here is 56 characters or fewer (one Bigger-words dialogue page).
import { INK, PAPER, WOOD, LANTERN, VERMILION } from './ui/palette.js';

export const PIZZA_PLATES = 4;
export const FRIENDS = [
  { id: 'reading', name: 'Sora' },
  { id: 'nori', name: 'Nori' },
  { id: 'music', name: 'Kiko' },
  { id: 'pip', name: 'Pip' },
];
export const GRADES_PIZZA = [3, 4, 5];
// Guide stamps for grades 3, 4 and 5.
export const STAMP_PIZZA = 'Sharing equally is dividing: 8 ÷ 4 = 2 each.';
export const STAMP_PIZZA_TWELVE = 'Sharing equally is dividing: 12 ÷ 4 = 3 each.';
export const STAMP_PIZZA_HALVES = 'A leftover can be split: 6 ÷ 4 = 1 and a half.';
export const ALL_CUTS = [4, 6, 8, 10, 12];
const MAX_UNITS = 24;   // 12 slices, every one on a single plate

const num = v => (typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN);
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(num(n)) ? num(n) : 0));
const sum = list => list.reduce((a, b) => a + b, 0);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Which pizzas New pizza cycles through. Grades 3 and 4 share evenly by whole slices; grade 5 starts with
// a pizza that only shares out once the leftovers are cut in half.
export function PIZZA_CUTS(grade) {
  const g = num(grade);
  if (g >= 5) return [6, 10];
  if (g === 4) return [12, 8, 4];
  return [8, 12, 4];
}
export const startingSlices = grade => PIZZA_CUTS(grade)[0];
const cutsHalves = grade => num(grade) >= 5;

// The one validator: bounded, idempotent, and it repairs a plate set that could not have come from the rules
// (more units than the pizza holds, or an odd plate while the slices are whole).
export function normalizePizza(input, grade = 3, chapter = 1) {
  const s = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const base = { kind: 'math', activity: 'pizza', grade: Math.round(clamp(grade, 0, 5)), chapter: chapter === 1 ? 1 : 0 };
  // Older saves keep their pizza even when New pizza now offers a different cycle.
  const slices = ALL_CUTS.includes(s.slices) ? s.slices : startingSlices(base.grade);
  const halves = s.halves === true;
  const validPlates = Array.isArray(s.plates) && s.plates.length === PIZZA_PLATES && Array.from(s.plates).every(n => Number.isInteger(n));
  let plates = validPlates
    ? Array.from(s.plates, n => clamp(n, 0, MAX_UNITS))
    : Array(PIZZA_PLATES).fill(0);
  let tried = validPlates && s.tried === true;
  if (sum(plates) > 2 * slices || (!halves && plates.some(n => n % 2 === 1))) { plates = Array(PIZZA_PLATES).fill(0); tried = false; }
  return { ...base, slices, halves, plates, tried };
}

export const pieceUnits = s => (s.halves ? 1 : 2);
export const remainingUnits = s => 2 * s.slices - sum(s.plates);

// "2", "1½", "½", "0": for chips and labels. The dialogue uses shareWords instead so no glyph can go missing.
export function shareText(units) {
  const u = Math.max(0, Math.round(clamp(units, 0, MAX_UNITS)));
  const wholes = Math.floor(u / 2);
  if (u % 2 === 0) return String(wholes);
  return wholes === 0 ? '½' : `${wholes}½`;
}
export function shareWords(units) {
  const u = Math.max(0, Math.round(clamp(units, 0, MAX_UNITS)));
  const wholes = Math.floor(u / 2);
  if (u % 2 === 0) return String(wholes);
  return wholes === 0 ? 'a half' : `${wholes} and a half`;
}

export function pizzaReport(s) {
  const plates = s.plates;
  const remaining = remainingUnits(s);
  let fewestAt = 0, mostAt = 0;
  plates.forEach((n, i) => { if (n < plates[fewestAt]) fewestAt = i; if (n >= plates[mostAt]) mostAt = i; });
  return {
    remaining,
    remainingWhole: Math.floor(remaining / 2),
    equal: plates.every(n => n === plates[0]),
    share: plates[0],
    fewest: { name: FRIENDS[fewestAt].name, units: plates[fewestAt] },
    most: { name: FRIENDS[mostAt].name, units: plates[mostAt] },
    allEmpty: plates.every(n => n === 0),
  };
}

// Checked, empty, equal non-zero shares; grade 5 also needs a cut.
export function pizzaReady(s) {
  if (!s || s.kind !== 'math' || s.activity !== 'pizza' || !ALL_CUTS.includes(s.slices)
    || !Array.isArray(s.plates) || s.plates.length !== PIZZA_PLATES
    || !Array.from(s.plates).every(n => Number.isInteger(n) && n >= 0 && n <= MAX_UNITS)
    || (!s.halves && s.plates.some(n => n % 2))) return false;
  return s.tried === true && remainingUnits(s) === 0 && s.plates.every(n => n === s.plates[0]) && s.plates[0] > 0
    && (s.grade < 5 || s.halves === true);
}

export const PIZZA_LINES = {
  changed: 'The plates changed. Choose Dig in! to check.',
  pizzaEmpty: 'The pizza is empty. Take one back, or Dig in!',
  platesEmpty: 'No slices are on the plates yet.',
  tryEmpty: 'The plates are empty. Give out the slices first!',
  tapHint: 'Tap a friend to give them a slice.',
  cutEmpty: 'The pizza is empty. Nothing to cut.',
  cutAlready: 'The slices are already halves.',
  readyOpening: 'Fair shares! Choose Serve pizza, or make a new pizza.',
  fairNeedsCut: 'Fair! New pizza brings one with leftovers to cut.',
  takeSlice: 'One slice back on the pizza.',
  takeHalf: 'One half back on the pizza.',
  opening: s => `Share Momo’s ${s.slices} slices equally among 4 friends.`,
  openingHalves: s => `Momo baked ${s.slices} slices. Can 4 friends share fairly?`,
  gave: (name, n) => `${name} gets a slice. ${n} left on the pizza.`,
  gaveHalf: (name, n) => `${name} gets a half. ${n} ${n === 1 ? 'half' : 'halves'} left on the pizza.`,
  gaveLast: (name, half) => `${name} gets a ${half ? 'half' : 'slice'}. The pizza is all shared out!`,
  nudge: n => `${n} left for 4 friends. Tap the pizza to cut halves.`,
  unfair: (few, most) => `${few.name}: ${shareWords(few.units)}. ${most.name}: ${shareWords(most.units)}. Make them equal.`,
  leftover: (share, n) => `Each has ${shareWords(share)}. ${n} ${n === 1 ? 'slice' : 'slices'} left. Keep going!`,
  leftoverHalves: (share, n) => `Each has ${shareWords(share)}. ${n} ${n === 1 ? 'half' : 'halves'} left. Keep going!`,
  fair: (slices, share) => `${slices} ÷ 4 = ${share / 2} ${share === 2 ? 'slice' : 'slices'} each! Choose Serve pizza.`,
  fairMixed: (slices, share) => `${slices} ÷ 4 = ${shareWords(share)} each! Choose Serve pizza.`,
  fresh: n => `A new pizza with ${n} slices. Share it out!`,
  cut: n => `Every slice is cut in half. Now there are ${n} halves.`,
};

export function pizzaOpening(s) {
  if (pizzaReady(s)) return PIZZA_LINES.readyOpening;
  return cutsHalves(s.grade) ? PIZZA_LINES.openingHalves(s) : PIZZA_LINES.opening(s);
}

// Grade 5 only: a few whole slices left, shared evenly so far, and nothing cut yet. Points at the pizza.
export function nudgeLine(s) {
  if (!cutsHalves(s.grade) || s.halves) return null;
  const r = pizzaReport(s);
  return r.equal && r.remainingWhole > 0 && r.remainingWhole < PIZZA_PLATES ? PIZZA_LINES.nudge(r.remainingWhole) : null;
}

// After a give: s is the new state, i the plate that got the piece, wasTried whether Dig in! had been pressed.
export function giveLine(s, i, wasTried) {
  const nudge = nudgeLine(s);
  if (nudge) return nudge;
  if (wasTried) return PIZZA_LINES.changed;
  const name = FRIENDS[i].name, r = pizzaReport(s);
  if (r.remaining === 0) return PIZZA_LINES.gaveLast(name, s.halves);
  return s.halves ? PIZZA_LINES.gaveHalf(name, r.remaining) : PIZZA_LINES.gave(name, r.remainingWhole);
}
export function takeLine(s, wasTried, units = pieceUnits(s)) {
  const nudge = nudgeLine(s);
  if (nudge) return nudge;
  if (wasTried) return PIZZA_LINES.changed;
  return units === 1 ? PIZZA_LINES.takeHalf : PIZZA_LINES.takeSlice;
}
// What Dig in! says about this state (s.tried is true by the time this runs).
export function tryLine(s) {
  const r = pizzaReport(s);
  if (r.allEmpty) return PIZZA_LINES.tryEmpty;
  if (!r.equal) return PIZZA_LINES.unfair(r.fewest, r.most);
  if (r.remaining > 0) {
    const nudge = nudgeLine(s);
    if (nudge) return nudge;
    return s.halves ? PIZZA_LINES.leftoverHalves(r.share, r.remaining) : PIZZA_LINES.leftover(r.share, r.remainingWhole);
  }
  if (s.grade >= 5 && s.halves !== true) return PIZZA_LINES.fairNeedsCut;
  return r.share % 2 === 0 ? PIZZA_LINES.fair(s.slices, r.share) : PIZZA_LINES.fairMixed(s.slices, r.share);
}
export const newLine = s => PIZZA_LINES.fresh(s.slices);
export const cutLine = s => PIZZA_LINES.cut(remainingUnits(s));

// The saved creation, for progress.js: null for anything that is not a pizza snapshot of Taro's.
export function cleanPizzaCreation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.kind !== 'math' || input.activity !== 'pizza') return null;
  const chapter = input.chapter === 1 ? 1 : 0;
  const grade = chapter === 1 ? Math.round(clamp(input.grade, 1, 5) || 1) : 0;
  return normalizePizza(input, grade, chapter);
}

// A sector of radius r from 12 o'clock, clockwise through `degrees`. A full circle at 360, nothing at 0.
export function sectorPath(cx, cy, r, degrees) {
  cx = clamp(cx, -256, 256); cy = clamp(cy, -256, 256); r = clamp(r, 0, 256);
  const a = clamp(degrees, 0, 360);
  if (a <= 0) return '';
  if (a >= 360) return `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}z`;
  const rad = (a * Math.PI) / 180;
  const x = +(cx + r * Math.sin(rad)).toFixed(1), y = +(cy - r * Math.cos(rad)).toFixed(1);
  return `M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${x} ${y}z`;
}

// Drawn small (90×45, like the cart) for the stall easel, the parade float and the item-get card: Taro's tray
// with four plates, each holding its share as a wedge, so a fair share reads as four identical quarters.
export function pizzaCreationMarkup(s = {}) {
  s = s && typeof s === 'object' ? s : {};
  const { slices, plates } = normalizePizza(s, s.grade ?? ([6, 10].includes(s.slices) ? 5 : 3), s.chapter);
  const equal = plates.every(n => n === plates[0]) && plates[0] > 0;
  const label = equal ? `Your pizza party, ${shareText(plates[0])} ${plates[0] === 2 ? 'slice' : 'slices'} each` : 'Your pizza party';
  const tray = `<rect x="4" y="26" width="82" height="8" fill="${WOOD}" stroke="${INK}" stroke-width="1.5"/><circle cx="20" cy="39" r="4" fill="${INK}"/><circle cx="70" cy="39" r="4" fill="${INK}"/>`;
  let food;
  if (plates.every(n => n === 0)) {
    food = `<circle cx="45" cy="18" r="13" fill="${LANTERN}" stroke="${INK}" stroke-width="1"/><circle cx="45" cy="18" r="10" fill="#f4bf4f"/><path d="M45 5v26M32 18h26" stroke="${INK}" stroke-width="1"/><circle cx="40" cy="13" r="1.6" fill="${VERMILION}"/><circle cx="50" cy="13" r="1.6" fill="${VERMILION}"/><circle cx="40" cy="23" r="1.6" fill="${VERMILION}"/><circle cx="50" cy="23" r="1.6" fill="${VERMILION}"/>`;
  } else {
    food = plates.map((n, i) => {
      const cx = 15 + i * 20, cy = 20;
      const wedge = sectorPath(cx, cy, 6, (360 * n) / (2 * slices));
      return `<circle cx="${cx}" cy="${cy}" r="8" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>${wedge ? `<path d="${wedge}" fill="${LANTERN}" stroke="${INK}" stroke-width=".8"/><circle cx="${cx + (n >= slices ? 0 : 2)}" cy="${cy - 3}" r="1.1" fill="${VERMILION}"/>` : ''}`;
    }).join('');
  }
  return `<svg class="creation creation--math pizza-creation" viewBox="0 0 90 45" role="img" aria-label="${esc(label)}">${tray}${food}</svg>`;
}
