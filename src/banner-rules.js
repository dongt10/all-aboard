// Grade goals use the visible stamps; the saved cloth stays unchanged.
export const COLUMNS = 6;
export const ROWS = 5;
export const PATTERN_CELLS = Object.freeze([3, 4, 5]);
export const YUKI_CELLS = Object.freeze([0, 1, 2]);
export const PATTERNS = Object.freeze({
  shapes: Object.freeze([Object.freeze({ shape: 'star', color: '#e96163' }), Object.freeze({ shape: 'circle', color: '#e96163' })]),
  colors: Object.freeze([Object.freeze({ shape: 'flower', color: '#e96163' }), Object.freeze({ shape: 'flower', color: '#559fc7' })]),
});

export function patternFor(grade) {
  return Number(grade) === 1 ? PATTERNS.shapes : Number(grade) === 2 ? PATTERNS.colors : null;
}
export function stampPosition(cell) {
  return { x: 8.33 + (cell % COLUMNS) * 16.66, y: 10 + Math.floor(cell / COLUMNS) * 20 };
}
const validCell = cell => Number.isInteger(cell) && cell >= 0 && cell < COLUMNS * ROWS;
const sameSpot = (stamp, at) => stamp && Math.abs(stamp.x - at.x) < 1e-6 && Math.abs(stamp.y - at.y) < 1e-6;
const sameDesign = (a, b) => Boolean(a && b && a.shape === b.shape && a.color === b.color);
export function stampAt(state, cell) {
  return validCell(cell) && Array.isArray(state?.stamps) ? state.stamps.findLastIndex(s => sameSpot(s, stampPosition(cell))) : -1;
}
export function yukiStamps(grade) {
  const pattern = patternFor(grade);
  return pattern ? YUKI_CELLS.map(cell => ({ ...pattern[cell % 2], rotation: 0, ...stampPosition(cell) })) : [];
}
export function expectedAt(grade, cell) {
  const pattern = patternFor(grade);
  return pattern && PATTERN_CELLS.includes(cell) ? pattern[cell % 2] : null;
}
// Grade 1 teaches shape; grade 2 teaches the flower's repeating paint colors.
// Keep validation and the activity's retry hints on the same rule.
export function patternMismatch(grade, cell, stamp) {
  const expected = expectedAt(grade, cell);
  if (!expected) return null;
  if (stamp?.shape !== expected.shape) return 'shape';
  return Number(grade) === 2 && stamp?.color !== expected.color ? 'color' : null;
}
export function patternReport(state) {
  const missing = PATTERN_CELLS.filter(cell => !expectedAt(state?.grade, cell)
    || patternMismatch(state?.grade, cell, state?.stamps?.[stampAt(state, cell)]));
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
  if (!(state.grade >= 3)) return state.stamps.length > 0;
  const report = symmetryReport(state);
  return report.symmetric && report.count >= (state.grade >= 4 ? 6 : 4) && (state.grade < 4 || report.colors.size >= 2);
}

export const BANNER_RULE_LINES = Object.freeze({
  openingK: 'Tap the cloth to add a stamp.',
  openingPattern: 'I started a pattern. Continue it across the top row!',
  openingMirror: 'Make a mirror banner. The left side matches the right.',
  readyOpening: 'Your banner is ready. Hang it, or keep stamping.',
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
  return patternFor(state?.grade) ? BANNER_RULE_LINES.openingPattern
    : state?.grade >= 3 ? BANNER_RULE_LINES.openingMirror : BANNER_RULE_LINES.openingK;
}
export function bannerHelp(grade) {
  if (patternFor(grade)) return ['Look at Yuki’s three stamps on top.', 'Pick the next stamp. Tap a spot again for a clue.', 'Turn, Fill cloth or Undo any time.', 'Choose Hang banner.'];
  if (grade >= 3) return ['Stamp one side, then its mirror on the other.', 'The fold is between columns 3 and 4.', grade >= 4 ? 'Use two colors and at least six stamps.' : 'Use at least four stamps.', 'Choose Hang banner.'];
  return ['Pick a paint and a stamp.', 'Tap the cloth to stamp it.', 'Turn, Fill cloth or Undo any time.', 'Choose Hang banner.'];
}
