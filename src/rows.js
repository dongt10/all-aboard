// Taro's crate rows: equal rows and counting by twos on a five-by-five cart.
import { INK, PAPER, WOOD, FINISH } from './ui/palette.js';

export const GRID = 5;
export const TARGETS = Object.freeze([12, 10, 8, 6]);
export const GRADES_ROWS = Object.freeze([2]);
export const STAMP_ROWS = 'Equal rows add up: 4 + 4 + 4 = 12.';
export const ORDER_GLYPH = '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M8 2h8v2h4v18H4V4h4zM6 6v14h12V6h-2v2H8V6zM10 4v2h4V4zM8 10h8v2H8zM8 14h8v2H8z"/></svg>';

const num = value => typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(num(value)) ? num(value) : 0));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRows = value => isObject(value) && value.kind === 'math' && value.activity === 'rows';
const validSlot = slot => Number.isInteger(slot) && slot >= 0 && slot < GRID * GRID;
const cleanCrates = crates => Array.isArray(crates) ? [...new Set(crates.filter(validSlot))].sort((a, b) => a - b) : [];

export function normalizeRows(input, grade = 2, chapter = 1) {
  const s = isObject(input) ? input : {};
  return {
    kind: 'math', activity: 'rows', grade: Math.round(clamp(grade, 0, 5)), chapter: chapter === 1 ? 1 : 0,
    target: TARGETS.includes(s.target) ? s.target : TARGETS[0], crates: cleanCrates(s.crates),
  };
}

export function cleanRowsCreation(input) {
  if (!isRows(input)) return null;
  return normalizeRows(input, Math.round(clamp(input.grade, 0, 5)), input.chapter === 1 ? 1 : 0);
}

// used lists occupied row indices. Contiguous includes both gaps inside a row and
// empty rows between occupied rows. Equal counts alone do not imply alignment.
export function rowsReport(s) {
  const crates = cleanCrates(s?.crates);
  const columns = Array.from({ length: GRID }, (_, row) => crates.filter(slot => Math.floor(slot / GRID) === row).map(slot => slot % GRID));
  const used = columns.map((row, i) => row.length ? i : -1).filter(i => i >= 0);
  const rows = used.length, first = columns[used[0]] ?? [];
  const contiguous = rows > 0 && used.every((row, i) => (i === 0 || row === used[i - 1] + 1)
    && columns[row].every((column, j) => j === 0 || column === columns[row][j - 1] + 1));
  const equal = rows > 0 && used.every(row => columns[row].length === first.length);
  const aligned = rows > 0 && used.every(row => columns[row].length === first.length && columns[row].every((column, i) => column === first[i]));
  const block = contiguous && equal && aligned;
  const count = crates.length, perRow = equal ? first.length : 0;
  return { count, used, contiguous, equal, aligned, block, rows, perRow,
    sum: block ? `${Array(rows).fill(perRow).join(' + ')} = ${count}` : '' };
}

export function rowsReady(s) {
  if (!isRows(s) || !GRADES_ROWS.includes(s.grade) || s.chapter !== 1 || !TARGETS.includes(s.target)
    || !Array.isArray(s.crates) || !Array.from(s.crates).every((slot, i) => validSlot(slot) && (i === 0 || slot > s.crates[i - 1]))) return false;
  const report = rowsReport(s);
  return report.block && report.count === s.target;
}

export function toggleCrate(s, slot) {
  if (!validSlot(slot) || !Array.isArray(s?.crates)) return s;
  const crates = s.crates.includes(slot) ? s.crates.filter(at => at !== slot) : [...s.crates, slot].sort((a, b) => a - b);
  return { ...s, crates };
}

export function nextTarget(s) {
  return { ...s, target: TARGETS[(TARGETS.indexOf(s.target) + 1) % TARGETS.length], crates: [] };
}

export function pairs(count) {
  const n = Math.floor(clamp(count, 0, GRID * GRID));
  return { pairs: Math.floor(n / 2), left: n % 2 };
}

export const LINES = {
  opening: target => `I need ${target} crates in equal rows. Build them any way.`,
  openingPartial: target => `Let's finish the order. ${target} crates in equal rows.`,
  openingReady: 'Your rows are ready. Send cart, or make a new order.',
  notReady: 'The rows changed. Make equal rows again.',
  ready: (rows, perRow, sum) => `${rows} rows of ${perRow}. ${sum}. Choose Send cart.`,
  gaps: 'Rows with gaps are not equal rows.',
  unequal: 'Count each row. Are the rows the same?',
  misaligned: 'Line up the rows so the crates make a block.',
  fewer: (count, left) => `${count} crates on the cart. ${left} more to go.`,
  more: (count, extra) => `${count} crates. That is ${extra} too many.`,
  even: (count, total) => `${count} makes ${total} pairs. Even!`,
  odd: (count, total) => `${count} makes ${total} pairs and 1 left. Odd!`,
  empty: 'The cart is empty. Tap a slot to add a crate.',
  newOrder: target => `New order! ${target} crates in equal rows.`,
  clear: 'The cart is empty. Build the rows again.',
};

export function rowsOpening(s) {
  if (rowsReady(s)) return LINES.openingReady;
  return rowsReport(s).count ? LINES.openingPartial(s.target) : LINES.opening(s.target);
}

export function placeLine(s) {
  const r = rowsReport(s);
  if (rowsReady(s)) return LINES.ready(r.rows, r.perRow, r.sum);
  if (r.count === 0) return LINES.empty;
  if (!r.contiguous) return LINES.gaps;
  if (!r.equal) return LINES.unequal;
  if (!r.aligned) return LINES.misaligned;
  if (r.count > s.target) return LINES.more(r.count, r.count - s.target);
  return LINES.fewer(r.count, s.target - r.count);
}

export function pairLine(s) {
  const { count } = rowsReport(s), result = pairs(count);
  return count === 0 ? LINES.empty : result.left ? LINES.odd(count, result.pairs) : LINES.even(count, result.pairs);
}

// Six-pixel crates keep their actual slots in the saved cart picture. The sum is
// split across the small plaque, with a bounded text length for five-row arrays.
export function rowsCreationMarkup(input) {
  const s = normalizeRows(input, input?.grade ?? 2, input?.chapter ?? 1), r = rowsReport(s);
  const label = r.block ? `Your crate rows: ${r.rows} ${r.rows === 1 ? 'row' : 'rows'} of ${r.perRow} make ${r.count}` : `Your crate rows: ${r.count} crates`;
  const crates = s.crates.map(slot => {
    const x = 4 + slot % GRID * 7, y = 3 + Math.floor(slot / GRID) * 7;
    return `<g class="rows-creation-crate"><rect x="${x}" y="${y}" width="6" height="6" fill="${INK}"/><rect x="${x + 1}" y="${y + 1}" width="4" height="4" fill="#dda475"/><path d="M${x + 1} ${y + 3}h4v1h-4zM${x + 4} ${y + 1}h1v4h-1z" fill="#855034"/></g>`;
  }).join('');
  const addends = Array(r.rows).fill(r.perRow);
  const top = addends.slice(0, 3).join(' + ');
  const bottom = `${r.rows > 3 ? `+ ${addends.slice(3).join(' + ')} ` : ''}= ${r.count}`;
  const text = r.block ? [top, bottom].map((line, i) => `<text x="66" y="${19 + i * 10}" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="6.5"${line.length > 10 ? ' textLength="36" lengthAdjust="spacingAndGlyphs"' : ''} fill="${PAPER}">${esc(line)}</text>`).join('') : '';
  return `<svg class="creation creation--math creation--rows" viewBox="0 0 90 45" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect x="2" y="1" width="39" height="38" fill="${INK}"/><rect x="3" y="2" width="37" height="36" fill="${WOOD}"/>${crates}<rect x="1" y="38" width="42" height="4" fill="${INK}"/><rect x="2" y="39" width="40" height="2" fill="#dda475"/><path d="M7 41h6v3H7zM31 41h6v3h-6z" fill="${INK}"/><rect x="45" y="7" width="43" height="28" fill="${INK}"/><rect x="46" y="8" width="41" height="26" fill="${WOOD}"/><rect x="48" y="10" width="37" height="22" fill="${FINISH}"/>${text}</svg>`;
}
