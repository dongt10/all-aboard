// Momo's bean test: change one thing, compare two weeks, then fill a garden bed.
import { INK, PAPER, PAPER_SHADE, WOOD, LANTERN, GRASS, GRASS_DARK, SEA, SKY, VERMILION } from './ui/palette.js';

export const GRADES_BEANS = [2];
export const STAMP_BEANS = 'Plants need sun and water. Change one thing to test.';
export const BED_TILES = ['seed', 'sun', 'water', 'bee'];
export const REQUIRED_TILES = ['seed', 'sun', 'water'];
export const TRAY_TILES = [...BED_TILES, 'dark', 'dry'];
export const CHANGES = ['water', 'dark'];
export const TILE_NAMES = { seed: 'Seed', sun: 'Sun', water: 'Water', bee: 'Bee', dark: 'Dark', dry: 'Dry' };

const num = value => (typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN);
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(num(value)) ? num(value) : 0));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBeans = value => isObject(value) && value.kind === 'science' && value.activity === 'beans';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanBed = bed => BED_TILES.filter(tile => Array.isArray(bed) && bed.includes(tile));

export function normalizeBeans(input, grade = 2, chapter = 1) {
  const s = isObject(input) ? input : {};
  const change = CHANGES.includes(s.change) ? s.change : 'none';
  return {
    kind: 'science', activity: 'beans', grade: Math.round(clamp(grade, 0, 5)), chapter: chapter === 1 ? 1 : 0,
    change, weeks: change === 'none' ? 0 : Math.round(clamp(s.weeks, 0, 2)), bed: cleanBed(s.bed),
  };
}

export function cleanBeansCreation(input) {
  return isBeans(input) ? normalizeBeans(input, input.grade ?? 0, input.chapter === 1 ? 1 : 0) : null;
}

export const testDone = s => isBeans(s) && CHANGES.includes(s.change) && s.weeks === 2;
export function beansReady(s) {
  return testDone(s) && s.chapter === 1 && GRADES_BEANS.includes(s.grade)
    && Array.isArray(s.bed) && s.bed.length === cleanBed(s.bed).length
    && cleanBed(s.bed).every((tile, i) => tile === s.bed[i])
    && REQUIRED_TILES.every(tile => s.bed.includes(tile));
}

// 'none' is the Same as A choice; refusing it keeps an existing test intact.
export function chooseChange(s, change) {
  if (change === 'none') return { state: s, status: 'same' };
  if (!CHANGES.includes(change)) return { state: s, status: 'invalid' };
  if (s.change === change) return { state: s, status: 'unchanged' };
  return { state: { ...s, change, weeks: 0 }, status: s.weeks > 0 ? 'restart' : 'changed' };
}

export function waitWeek(s) {
  if (!CHANGES.includes(s.change) || s.weeks >= 2) return s;
  return { ...s, weeks: s.weeks + 1 };
}

export function toggleTile(s, tile) {
  if (!BED_TILES.includes(tile)) return s;
  const wanted = s.bed.includes(tile) ? s.bed.filter(id => id !== tile) : [...s.bed, tile];
  return { ...s, bed: cleanBed(wanted) };
}

export function cupState(s, cup) {
  const weeks = CHANGES.includes(s?.change) ? Math.round(clamp(s.weeks, 0, 2)) : 0;
  if (!weeks || !['a', 'b', 'A', 'B'].includes(cup)) return 'seed';
  if (cup === 'a' || cup === 'A') return weeks === 1 ? 'sprout' : 'tall';
  if (s.change === 'dark') return 'pale';
  return 'seed';
}

export const LINES = {
  opening: 'Two bean cups. Cup A gets sun and water. What will cup B get?',
  running: w => `Week ${w} of 2. Choose Wait a week.`,
  done: 'The test is done. Fill the bed card.',
  ready: 'Your bed card is ready. Plant bed, or start over.',
  notReady: 'The bed card changed. Add seed, sun, and water.',
  changeWater: 'Cup B gets sun but no water. Now wait a week.',
  changeDark: 'Cup B gets water but sits in a dark box. Wait a week.',
  same: 'Same conditions cannot test water or light. Pick a change.',
  newTest: 'New test!',
  chooseFirst: 'Pick one change for cup B first. Change one thing only. Then you know why.',
  nextChange: 'Tap one change for cup B: No water or Dark box.',
  week1Water: 'Week 1. Cup A sprouts. Dry cup B stays a seed.',
  week2Water: 'Week 2. Cup A grows tall. Cup B is still a seed. Plants need water! Fill the bed card.',
  week1Dark: 'Week 1. Both cups sprout. Cup B is pale.',
  week2Dark: 'Week 2. Cup A grows tall. Cup B grows weak and pale. Plants need sunlight! Fill the bed card.',
  seed: 'A seed starts the plant.',
  sun: 'Sun! Plants need sunlight to grow well.',
  water: 'Water! Plants need water to grow well.',
  bee: 'Bees move pollen between flowers. Beans can self-pollinate.',
  dark: 'Plants need sunlight. No dark box in the bed.',
  dry: 'Plants need water. Keep the water in the bed.',
  removed: name => `The ${name} is back in the tray.`,
  allFour: 'Choose Plant bed.',
  early: 'Now finish the test.',
  reset: 'Fresh cups. Cup A gets sun and water again.',
};

export function beansOpening(s) {
  if (beansReady(s)) return LINES.ready;
  if (testDone(s)) return LINES.done;
  return CHANGES.includes(s?.change) ? LINES.running(s.weeks) : LINES.opening;
}

export function nextStepLine(s) {
  return CHANGES.includes(s?.change) ? beansOpening(s) : LINES.nextChange;
}

// Transparent 16-pixel pictures shared by the tiles and saved bed card.
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const DROP = `<path d="M7 1h2v2h2v3h2v2h1v5h-2v2H4v-2H2V8h1V6h2V3h2z" fill="${INK}"/>`
  + `<path d="M7 3h2v3h2v3h2v3h-2v2H5v-2H3V9h2V6h2z" fill="${SEA}"/>`
  + rect(5, 8, 2, 4, SKY);
const GLYPHS = {
  seed: `<path d="M7 2h5v2h2v7h-2v2H9v2H4v-2H2V6h2V4h3z" fill="${INK}"/>`
    + `<path d="M7 3h4v2h2v5h-2v2H8v2H5v-2H3V7h2V5h2z" fill="${WOOD}"/>`
    + rect(5, 6, 2, 5, PAPER_SHADE) + rect(7, 4, 3, 2, PAPER_SHADE),
  sprout: `<path d="M7 6h2v9H7zM1 2h4v1h2v2h2V3h2V1h4v5h-2v2H9v2H5V8H3V6H1z" fill="${INK}"/>`
    + `<path d="M2 3h3v1h1v2h1v2H5V6H3V5H2zM10 4h2V2h2v3h-2v2h-2zM8 8h1v6H8z" fill="${GRASS}"/>`,
  sun: rect(7, 0, 2, 16, INK) + rect(0, 7, 16, 2, INK)
    + `<path d="M5 3h6v2h2v6h-2v2H5v-2H3V5h2z" fill="${INK}"/>`
    + `<path d="M5 4h6v2h1v4h-2v2H6v-1H4V6h1z" fill="${LANTERN}"/>`
    + rect(5, 5, 3, 2, PAPER) + rect(1, 1, 2, 2, LANTERN) + rect(13, 1, 2, 2, LANTERN)
    + rect(1, 13, 2, 2, LANTERN) + rect(13, 13, 2, 2, LANTERN),
  water: DROP,
  bee: `<path d="M3 1h4v2h2V1h4v4h-2v1h3v2h2v3h-2v2H3v-2H1V7h2V5H2V2h1z" fill="${INK}"/>`
    + rect(3, 2, 3, 3, SKY) + rect(9, 2, 3, 3, SKY) + rect(3, 7, 10, 5, LANTERN)
    + rect(5, 7, 2, 5, INK) + rect(9, 7, 2, 5, INK) + rect(13, 8, 2, 2, PAPER)
    + rect(14, 8, 1, 1, INK) + rect(3, 12, 1, 3, INK) + rect(10, 12, 1, 3, INK),
  dark: rect(1, 2, 14, 13, INK) + rect(2, 3, 12, 2, WOOD) + rect(2, 5, 2, 9, WOOD)
    + rect(12, 5, 2, 9, WOOD) + rect(4, 13, 8, 1, WOOD) + rect(6, 3, 4, 2, PAPER_SHADE),
  dry: DROP + `<path d="M1 1h3v2h2v2h2v2h2v2h2v2h2v2h1v3h-3v-2h-2v-2H8v-2H6V8H4V6H2V4H1z" fill="${INK}"/>`
    + `<path d="M2 2h1v2h2v2h2v2h2v2h2v2h2v2h1v1h-2v-2h-2v-2H8V9H6V7H4V5H2z" fill="${VERMILION}"/>`,
  same: rect(2, 5, 12, 2, INK) + rect(2, 10, 12, 2, INK),
};
export const beanGlyphMarkup = tile => Object.hasOwn(GLYPHS, tile) ? GLYPHS[tile] : '';

export function beansCreationMarkup(snapshot) {
  const s = normalizeBeans(snapshot);
  const label = 'Your garden bed card: seed, sun, water and optional bee';
  const spots = BED_TILES.map((tile, i) => {
    const x = 7 + i * 22;
    const drawing = s.bed.includes(tile)
      ? rect(x, 21, 20, 24, PAPER_SHADE) + `<g transform="translate(${x + 2} 25)">${beanGlyphMarkup(tile === 'seed' ? 'sprout' : tile)}</g>`
      : `<rect x="${x}" y="21" width="20" height="24" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="3 2"/>`;
    return `<g class="beans-creation-slot" data-tile="${esc(tile)}">${drawing}</g>`;
  }).join('');
  return `<svg class="creation creation--science creation--beans" viewBox="0 0 100 65" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges">`
    + rect(1, 1, 98, 63, INK) + rect(2, 2, 96, 61, PAPER) + rect(96, 3, 2, 60, PAPER_SHADE)
    + rect(2, 61, 94, 2, PAPER_SHADE) + rect(5, 49, 90, 11, WOOD)
    + rect(5, 49, 90, 2, INK) + rect(12, 54, 5, 1, PAPER_SHADE) + rect(43, 57, 6, 1, INK)
    + rect(76, 53, 4, 2, GRASS_DARK)
    + `<text x="50" y="14" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="10" fill="${INK}">${esc('Garden bed')}</text>${spots}</svg>`;
}
