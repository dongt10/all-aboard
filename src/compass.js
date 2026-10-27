// Hana's compass errands: three trips from the kiosk, with north at the top of the map.
import { INK, PAPER, PAPER_SHADE, GRASS, GRASS_DARK, WOOD, LANTERN, VERMILION, SKY, SEA, FINISH } from './ui/palette.js';

export const GRID = 5;
export const GRADES_COMPASS = [2];
export const STAMP_COMPASS = 'A compass shows north, south, east and west.';
export const PLACES = {
  kiosk: [2, 2], bakery: [1, 2], stage: [2, 0], shed: [2, 4], workshop: [3, 4], pond: [4, 2],
};
export const ERRANDS = [
  { id: 'north', target: [1, 2], path: [[2, 2], [1, 2]], near: { cell: [0, 2] } },
  { id: 'west', target: [2, 0], path: [[2, 2], [2, 1], [2, 0]] },
  { id: 'lantern', target: [3, 4], path: [[2, 2], [2, 3], [2, 4], [3, 4]], near: { cell: [2, 4] } },
];
export const ERRAND_IDS = ERRANDS.map(errand => errand.id);
export const DIRECTION_HINT = {
  north: 'North is up on the map.',
  west: 'West is left on the map.',
  lantern: 'East is right, south is down.',
};
export const ROUTE_STYLES = {
  north: { color: VERMILION, marker: 'circle' },
  west: { color: '#2857a8', marker: 'square' },
  lantern: { color: FINISH, marker: 'triangle' },
};
export const LINES = {
  prompts: {
    north: 'From the kiosk, go north one square. Tap each square.',
    west: 'From the kiosk, go west two squares. Tap each square.',
    lantern: 'From the kiosk, go east two squares, then south one. Tap each square.',
  },
  openingFresh: 'Three errands today.',
  openingMid: n => `Errand ${n} of 3.`,
  openingReady: 'All three errands are done. Hang map, or start over.',
  notReady: 'An errand is open again. Finish all three.',
  delivered: {
    north: 'The baker needs flour. Pip the courier helps.',
    west: 'Kiko needs a drum on the stage. Taro carries it.',
    lantern: 'Taro needs light to work. Your lantern helps!',
  },
  next: 'Choose Next errand.',
  allDone: 'All three errands are done! Choose Hang map.',
  wrong: id => `That is a different way. ${DIRECTION_HINT[id] ?? DIRECTION_HINT.north}`,
  near: {
    north: 'Yes, that is north! Pip stops one square up.',
  },
  kiosk: 'That is the kiosk, where you start.',
  compass: 'North is up, south is down. West is left, east is right.',
  startOver: 'The map is clear. Start with errand 1.',
  places: {
    kiosk: 'That is the kiosk, where you start.',
    bakery: 'The bakery is north of the kiosk.',
    stage: 'The stage is west of the kiosk.',
    shed: 'The lantern shed is east of the kiosk.',
    workshop: 'Taro’s workshop is south of the lantern shed.',
    pond: 'The pond is south of the kiosk.',
  },
  grass: 'Just grass here.',
};

const num = value => (typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN);
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(num(value)) ? num(value) : 0));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCompass = value => isObject(value) && value.kind === 'community' && value.activity === 'compass';
const isCell = cell => Number.isInteger(cell) && cell >= 0 && cell < GRID * GRID;
const indexOf = ([row, col]) => row * GRID + col;
const doneOf = state => ERRAND_IDS.filter(id => Array.isArray(state?.done) && state.done.includes(id));

export function normalizeCompass(input, grade = 2, chapter = 1) {
  const state = isObject(input) ? input : {};
  return { kind: 'community', activity: 'compass', grade: Math.round(clamp(grade, 0, 5)),
    chapter: chapter === 1 ? 1 : 0, done: doneOf(state) };
}

export function cleanCompassCreation(input) {
  return isCompass(input) ? normalizeCompass(input, input.grade, input.chapter === 1 ? 1 : 0) : null;
}

export function compassReady(state) {
  return isCompass(state) && state.chapter === 1 && GRADES_COMPASS.includes(state.grade)
    && Array.isArray(state.done) && state.done.length === ERRAND_IDS.length
    && ERRAND_IDS.every(id => state.done.includes(id));
}

export const currentErrand = state => ERRANDS.find(errand => !doneOf(state).includes(errand.id)) ?? null;
export const placeAt = cell => isCell(cell) ? Object.keys(PLACES).find(place => indexOf(PLACES[place]) === cell) ?? null : null;

// A route is a new value: callers cannot change a later map by editing its points.
export function routes(state) {
  return ERRANDS.filter(errand => doneOf(state).includes(errand.id)).map(errand => ({
    id: errand.id, path: errand.path.map(point => [...point]), ...ROUTE_STYLES[errand.id],
  }));
}

export function compassOpening(state) {
  const errand = currentErrand(state);
  if (!errand) return LINES.openingReady;
  const prefix = doneOf(state).length ? LINES.openingMid(ERRAND_IDS.indexOf(errand.id) + 1) : LINES.openingFresh;
  return `${prefix} ${LINES.prompts[errand.id]}`;
}

// Only the current destination saves a change. Near misses and repeated taps preserve the snapshot.
export function deliver(state, cell, progress = 0) {
  if (!isCell(cell)) return { state, status: 'wrong' };
  if (!isCompass(state) || state.chapter !== 1 || !GRADES_COMPASS.includes(state.grade)) return { state, status: 'wrong' };
  const errand = currentErrand(state);
  if (!errand) return { state, status: 'ready' };
  if (cell === indexOf(PLACES.kiosk)) return { state, status: 'kiosk' };
  const step = Number.isInteger(progress) && progress >= 0 && progress < errand.path.length - 1 ? progress : 0;
  if (cell === indexOf(errand.path[step + 1]) && step + 1 < errand.path.length - 1) {
    return { state, status: 'progress', progress: step + 1 };
  }
  if (cell === indexOf(errand.target) && step === errand.path.length - 2) {
    const done = ERRAND_IDS.filter(id => id === errand.id || doneOf(state).includes(id));
    return { state: { ...state, done }, status: 'done' };
  }
  return { state, status: errand.id === 'north' && cell === indexOf(errand.near.cell) ? 'near' : 'wrong' };
}

export function progressLine(id, step) {
  if (id === 'west') return 'One square west. Go west one more square.';
  if (id === 'lantern' && step === 1) return 'One square east. Go east one more square, then south one.';
  return 'Two squares east. Go south one square.';
}

// Takes the snapshot before the tap so the job line names the errand just completed.
export function tapLine(state, cell, result = deliver(state, cell)) {
  if (!isCell(cell)) return null;
  const errand = currentErrand(state);
  if (result.status === 'ready') return LINES.places[placeAt(cell)] ?? LINES.grass;
  if (result.status === 'kiosk') return LINES.kiosk;
  if (result.status === 'progress') return progressLine(errand.id, result.progress);
  if (result.status === 'near') return LINES.near[errand?.id] ?? LINES.wrong(errand?.id);
  if (result.status === 'done') return `${LINES.delivered[errand.id]} ${compassReady(result.state) ? LINES.allDone : LINES.next}`;
  return LINES.wrong(errand?.id);
}

// Small, transparent pixel silhouettes serve both the live map and its saved drawing.
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${esc(fill)}"/>`;
const ART = {
  bakery: `<path d="M3 8h2V5h3V3h8v2h3v3h2v12H3z" fill="${INK}"/>`
    + rect(4, 9, 16, 10, WOOD) + rect(6, 6, 12, 11, LANTERN) + rect(9, 4, 6, 2, LANTERN)
    + rect(8, 7, 2, 5, PAPER) + rect(13, 7, 2, 5, PAPER) + rect(5, 17, 14, 2, WOOD),
  stage: `<path d="M2 8h3V5h3V2h8v3h3v3h3v3h-2v9h3v3H1v-3h3v-9H2z" fill="${INK}"/>`
    + rect(5, 9, 14, 2, VERMILION) + rect(8, 6, 8, 3, VERMILION) + rect(10, 3, 4, 3, LANTERN)
    + rect(5, 11, 2, 9, WOOD) + rect(17, 11, 2, 9, WOOD) + rect(2, 21, 20, 1, WOOD),
  shed: `<path d="M9 1h6v3h3v2h3v12h-3v3h-5v3h-2v-3H6v-3H3V6h3V4h3z" fill="${INK}"/>`
    + rect(7, 5, 10, 15, VERMILION) + rect(4, 7, 16, 10, VERMILION)
    + rect(7, 6, 3, 10, LANTERN) + rect(11, 6, 2, 13, PAPER_SHADE) + rect(10, 2, 4, 2, WOOD),
  workshop: `<path d="M2 3h13v3h5v3h-5v3h-4v10H7V12H2z" fill="${INK}"/>`
    + rect(3, 4, 11, 7, SKY) + rect(14, 7, 5, 1, SKY) + rect(8, 12, 2, 9, WOOD) + rect(3, 4, 9, 2, PAPER),
  pond: `<path d="M6 5h12v2h4v3h2v7h-4v3H4v-3H0v-7h2V7h4z" fill="${INK}"/>`
    + rect(3, 8, 18, 8, SEA) + rect(6, 6, 12, 12, SEA) + rect(7, 8, 8, 2, SKY)
    + rect(4, 13, 6, 1, PAPER) + rect(14, 12, 6, 1, PAPER) + rect(13, 15, 4, 2, GRASS_DARK),
  kiosk: `<path d="M3 2h18v8h-2v10h3v3H2v-3h3V10H3z" fill="${INK}"/>`
    + rect(4, 3, 16, 6, LANTERN) + rect(6, 10, 2, 10, WOOD) + rect(16, 10, 2, 10, WOOD)
    + rect(3, 17, 18, 5, WOOD) + rect(5, 18, 14, 1, PAPER_SHADE),
  flour: `<path d="M6 2h12v4h-2v3h3v3h2v10H3V12h2V9h3V6H6z" fill="${INK}"/>`
    + rect(7, 3, 10, 2, PAPER) + rect(9, 6, 6, 3, WOOD) + rect(6, 10, 12, 11, PAPER_SHADE)
    + rect(4, 13, 16, 8, PAPER_SHADE) + rect(11, 12, 2, 7, WOOD) + rect(8, 13, 8, 2, WOOD),
  drum: rect(3, 5, 18, 15, INK) + rect(5, 3, 14, 19, INK)
    + rect(4, 7, 16, 12, WOOD) + rect(6, 4, 12, 3, PAPER) + rect(6, 19, 12, 2, PAPER_SHADE)
    + rect(7, 8, 2, 10, PAPER_SHADE) + rect(15, 8, 2, 10, PAPER_SHADE),
};

export function compassGlyph(name) {
  const art = Object.hasOwn(ART, name) ? ART[name] : '';
  return `<svg class="compass-glyph" viewBox="0 0 24 24" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${art}</svg>`;
}

// End marks remain distinguishable without color: a circle, a square and a triangle.
export function routeMarkup(route, step = 50, inset = 0) {
  const points = route.path.map(([row, col]) => [inset + (col + 0.5) * step, inset + (row + 0.5) * step]);
  const [x, y] = points.at(-1), radius = step * 0.4;
  const shape = route.marker === 'circle' ? `<circle cx="${x}" cy="${y}" r="${radius}"/>`
    : route.marker === 'square' ? `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}"/>`
      : `<polygon points="${x},${y - radius} ${x + radius},${y + radius} ${x - radius},${y + radius}"/>`;
  const polyline = `<polyline points="${esc(points.map(point => point.join(',')).join(' '))}" stroke-dasharray="${step * 0.16} ${step * 0.1}"/>`;
  return `<g class="compass-route" data-errand="${esc(route.id)}" data-marker="${esc(route.marker)}" fill="none" stroke-linejoin="miter">`
    + `<g stroke="${PAPER}" stroke-width="${step * 0.12}">${polyline}${shape}</g>`
    + `<g stroke="${esc(route.color)}" stroke-width="${step * 0.08}">${polyline}${shape}</g></g>`;
}

export function compassCreationMarkup(input) {
  const state = normalizeCompass(input);
  const grid = Array.from({ length: GRID + 1 }, (_, i) => {
    const at = 5 + i * 18;
    return `M${at} 5v90M5 ${at}h90`;
  }).join('');
  const places = Object.entries(PLACES).map(([place, [row, col]]) =>
    `<g transform="translate(${8 + col * 18} ${8 + row * 18}) scale(0.5)">${ART[place]}</g>`).join('');
  const paths = routes(state).map(route => routeMarkup(route, 18, 5)).join('');
  const label = `Your delivery map, ${state.done.length} of 3 errands drawn`;
  return `<svg class="creation creation--community creation--compass" viewBox="0 0 100 100" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges">`
    + `<rect x="4" y="4" width="92" height="92" fill="${GRASS}" stroke="${INK}" stroke-width="2"/>`
    + `<path d="${grid}" fill="none" stroke="${GRASS_DARK}" stroke-width="1"/>${places}${paths}`
    + `<path d="M83 20v-6h-3v-2h2v-2h2V8h2v2h2v2h2v2h-3v6z" fill="${INK}"/>`
    + `<text x="85" y="33" text-anchor="middle" font-family="'Pixelify Sans', sans-serif" font-size="12" fill="${INK}">N</text></svg>`;
}
