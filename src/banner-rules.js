export const STAMP_FORMS = {
  star: [
    '................', '.......xx.......', '.......xx.......', '......xxxx......',
    '......xxxx......', '.....xxxxxx.....', '.xxxxxxxxxxxxxx.', '..xxxxxxxxxxxx..',
    '...xxxxxxxxxx...', '....xxxxxxxx....', '....xxxxxxxx....', '...xxxxxxxxxx...',
    '...xxxx..xxxx...', '...xx......xx...', '................', '................',
  ],
  flower: [
    '................', '......xxxx......', '.....xxxxxx.....', '.....xxxxxx.....',
    '..xxxxxxxxxxxx..', '.xxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxx.', '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxxx..', '.xxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxx.', '..xxxxxxxxxxxx..',
    '.....xxxxxx.....', '.....xxxxxx.....', '......xxxx......', '................',
  ],
  leaf: [
    '................', '................', '........xxxxxx..', '......xxxxxxxx..',
    '.....xxxxxxxxx..', '....xxxxxxxxxx..', '...xxxxxxxxxxx..', '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxx...', '..xxxxxxxxxx....', '..xxxxxxxxx.....', '..xxxxxxxx......',
    '..xxxxxx........', '..xxxx..........', '................', '................',
  ],
  circle: [
    '................', '................', '.....xxxxxx.....', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '.....xxxxxx.....', '................', '................',
  ],
};

// Sample rotation first, then reflect horizontally in the displayed coordinate system.
export function stampSource(x, y, rotation = 0, flipped = false) {
  if (flipped === true) x = 31 - x;
  const angle = (Number(rotation) || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return [Math.floor((cos * (x - 15.5) + sin * (y - 15.5) + 16) / 2), Math.floor((-sin * (x - 15.5) + cos * (y - 15.5) + 16) / 2)];
}
export function stampFilled(shape, x, y, rotation = 0, flipped = false) {
  const [sx, sy] = stampSource(x, y, rotation, flipped);
  return (STAMP_FORMS[shape] || STAMP_FORMS.circle)[sy]?.[sx] === 'x';
}
// Grade goals use the visible stamps; the saved cloth stays unchanged.
export const COLUMNS = 6;
export const ROWS = 5;
export const PATTERN_CELLS = Object.freeze([3, 4, 5]);
export const YUKI_CELLS = Object.freeze([0, 1, 2]);
export const PATTERNS = Object.freeze({
  shapes: Object.freeze([Object.freeze({ shape: 'star', color: '#e96163' }), Object.freeze({ shape: 'circle', color: '#e96163' })]),
  colors: Object.freeze([Object.freeze({ shape: 'flower', color: '#e96163' }), Object.freeze({ shape: 'flower', color: '#559fc7' })]),
});

export function patternFor(grade, request = 1) {
  if (Number(grade) === 1) return request === 2 ? [{ shape: 'leaf', color: '#e96163' }, { shape: 'flower', color: '#e96163' }] : PATTERNS.shapes;
  if (Number(grade) === 2) return request === 2 ? [{ shape: 'star', color: '#f4bf4f' }, { shape: 'star', color: '#6dbea0' }] : PATTERNS.colors;
  return null;
}
export function stampPosition(cell) {
  return { x: 8.33 + (cell % COLUMNS) * 16.66, y: 10 + Math.floor(cell / COLUMNS) * 20 };
}
const validCell = cell => Number.isInteger(cell) && cell >= 0 && cell < COLUMNS * ROWS;
const sameSpot = (stamp, at) => stamp && Math.abs(stamp.x - at.x) < 1e-6 && Math.abs(stamp.y - at.y) < 1e-6;
const sameDesign = (a, b) => Boolean(a && b && a.color === b.color && Array.from({ length: 32 * 32 }, (_, i) => stampFilled(a.shape, i % 32, Math.floor(i / 32), a.rotation, a.flipped) === stampFilled(b.shape, 31 - i % 32, Math.floor(i / 32), b.rotation, b.flipped)).every(Boolean));
export function stampAt(state, cell) {
  return validCell(cell) && Array.isArray(state?.stamps) ? state.stamps.findLastIndex(s => sameSpot(s, stampPosition(cell))) : -1;
}
export function yukiStamps(grade, request = 1) {
  const pattern = patternFor(grade, request);
  return pattern ? YUKI_CELLS.map(cell => ({ ...pattern[cell % 2], rotation: 0, ...stampPosition(cell) })) : [];
}
export function expectedAt(grade, cell, request = 1) {
  const pattern = patternFor(grade, request);
  return pattern && PATTERN_CELLS.includes(cell) ? pattern[cell % 2] : null;
}
// Grade 1 teaches shape; grade 2 teaches the flower's repeating paint colors.
// Keep validation and the activity's retry hints on the same rule.
export function patternMismatch(grade, cell, stamp, request = 1) {
  const expected = expectedAt(grade, cell, request);
  if (!expected) return null;
  if (stamp?.shape !== expected.shape) return 'shape';
  return Number(grade) === 2 && stamp?.color !== expected.color ? 'color' : null;
}
export function patternReport(state) {
  const missing = PATTERN_CELLS.filter(cell => !expectedAt(state?.grade, cell, state?.request)
    || patternMismatch(state?.grade, cell, state?.stamps?.[stampAt(state, cell)], state?.request));
  return { matched: PATTERN_CELLS.length - missing.length, missing, complete: missing.length === 0 };
}
export function mirrorCell(cell) {
  return validCell(cell) ? Math.floor(cell / COLUMNS) * COLUMNS + COLUMNS - 1 - cell % COLUMNS : -1;
}
export function symmetryReport(state) {
  const stamps = Array.isArray(state?.stamps) ? state.stamps : [];
  const visible = new Map();
  const offGrid = [];
  for (const stamp of stamps) {
    const cell = Array.from({ length: COLUMNS * ROWS }, (_, i) => i).find(i => sameSpot(stamp, stampPosition(i)));
    if (cell === undefined) offGrid.push(stamp);
    else visible.set(cell, stamp);
  }
  // Hidden stamps do not add to the design's count. -1 marks an old off-grid stamp,
  // which must be undone before the cloth can be a matching grid design.
  const unmatched = [...visible].filter(([cell, stamp]) => !sameDesign(stamp, visible.get(mirrorCell(cell)))).map(([cell]) => cell);
  unmatched.push(...offGrid.map(() => -1));
  const colors = new Set([...visible.values(), ...offGrid].map(stamp => stamp?.color));
  return { count: visible.size + offGrid.length, colors, unmatched, symmetric: unmatched.length === 0 };
}
export function bannerReady(state) {
  if (state?.kind !== 'art' || !Array.isArray(state.stamps)) return false;
  if (patternFor(state.grade)) return patternReport(state).complete;
  if (!(state.grade >= 3)) return state.request === 2 ? state.stamps.some(stamp => stamp.shape === 'flower') : state.stamps.length > 0;
  const report = symmetryReport(state);
  return report.symmetric && report.count >= (state.grade >= 4 ? 6 : 4) + (state.request === 2 ? 2 : 0) && (state.grade < 4 || report.colors.size >= 2);
}

export const BANNER_RULE_LINES = Object.freeze({
  openingK: 'Tap the cloth to add a stamp.',
  openingPattern: 'I started a pattern. Continue it across the top row!',
  openingMirror: 'Make a mirror banner. The left side matches the right.',
  readyOpening: 'Your banner is ready. Hang banner, or Try another.',
  yuki: 'Yuki stamped those. Continue the pattern to the right.',
  wrongShape: 'Try a different shape. Tap again for a clue.',
  wrongColor: 'Try a different paint. Tap again for a clue.',
  fits: 'That fits the pattern! Keep going.',
  patternDone: 'Pattern done! Choose Hang banner, or keep stamping.',
  free: 'Stamped! The top row still needs the pattern.',
  mirror: 'Now stamp its mirror on the other side.',
  pair: 'A matching pair! Four stamps make a banner.',
  pairColors: 'A matching pair! Use two colors and six stamps.',
  secondColor: 'All matched! Now use a second color.',
  mirrorDone: 'Mirror match! Choose Hang banner, or keep stamping.',
  patternAgain: 'The top row needs the pattern again.',
  mirrorAgain: 'Make the left side mirror the right.',
});
export function bannerOpening(state) {
  if (bannerReady(state)) return BANNER_RULE_LINES.readyOpening;
  if (state?.request === 2 && !(state.grade > 0)) return 'Add a flower stamp to the cloth.';
  if (state?.grade >= 3) {
    const count = state.request === 2 ? (state.grade >= 4 ? 'eight' : 'six') : (state.grade >= 4 ? 'six' : 'four');
    return `Make a mirror banner. Use ${count} stamps${state.grade >= 4 ? ' in two colors' : ''}.`;
  }
  return patternFor(state?.grade) ? BANNER_RULE_LINES.openingPattern
    : state?.grade >= 3 ? BANNER_RULE_LINES.openingMirror : BANNER_RULE_LINES.openingK;
}
export function bannerHelp(grade) {
  if (patternFor(grade)) return ['Look at Yuki’s three stamps on top.', 'Pick the next stamp. Tap a spot again for a clue.', 'Turn, Fill cloth or Undo any time.', 'Choose Hang banner.'];
  if (grade >= 3) return ['Stamp one side, then its mirror on the other.', 'Use Plain or Flipped to mirror a stamp.', grade >= 4 ? 'Follow Yuki’s stamp count. Use two colors.' : 'Follow Yuki’s stamp count.', 'Choose Hang banner.'];
  return ['Pick a paint and a stamp.', 'Tap the cloth to stamp it.', 'Turn, Fill cloth or Undo any time.', 'Choose Hang banner.'];
}
