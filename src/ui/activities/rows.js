import {
  GRID, LINES, ORDER_GLYPH, normalizeRows, rowsReady, rowsOpening, rowsReport,
  toggleCrate, nextTarget, pairs, placeLine, pairLine,
} from '../../rows.js';
import { gridMove, keyIntent } from '../input.js';
import { INK } from '../palette.js';

export { LINES, ORDER_GLYPH };
export const HELP = [
  'Tap a slot to put a crate on the cart.',
  'Make equal rows with no gaps.',
  'Choose Pair up to count by twos.',
  'When the rows add up to the order, choose Send cart.',
];

const CRATE_ART = `<svg class="rows-crate" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M2 0h28v2h2v28h-2v2H2v-2H0V2h2z" fill="${INK}"/><path d="M2 2h28v28H2z" fill="#dda475"/><path d="M26 2h4v28H2v-4h24zM6 6h20v2H6zM6 15h20v2H6zM6 24h20v2H6z" fill="#855034"/><path d="M4 2h2v28H4zM24 2h2v28h-2z" fill="${INK}"/><path d="M2 2h2v2H2zM28 2h2v2h-2zM2 28h2v2H2zM28 28h2v2h-2z" fill="${INK}"/></svg>`;
const PAIR_CRATE_ART = `<svg viewBox="0 0 10 10" width="10" height="10" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M0 0h10v10H0z" fill="${INK}"/><path d="M1 1h8v8H1z" fill="#dda475"/><path d="M7 1h2v8H1V7h6zM1 4h6v1H1z" fill="#855034"/></svg>`;
const unpair = ui => ui?.paired ? { ...ui, paired: false } : ui;

function act(state, ui, action) {
  if (action?.type === 'field') {
    const next = toggleCrate(state, action.slot);
    return next === state ? { state, ui } : { state: next, ui: unpair(ui), line: placeLine(next) };
  }
  if (action?.type !== 'command') return { state, ui };
  if (action.id === 'new') {
    const next = nextTarget(state);
    return { state: next, ui: unpair(ui), line: LINES.newOrder(next.target) };
  }
  if (action.id === 'pair') {
    return { state, ui: !state.crates.length || ui?.paired ? ui : { ...ui, paired: true }, line: pairLine(state) };
  }
  if (action.id === 'clear' && state.crates.length) {
    return { state: { ...state, crates: [] }, ui: unpair(ui), line: LINES.clear };
  }
  return { state, ui };
}

// Only saved state determines the sum and readiness. Pair up reveals a separate
// strip of the same crates in twos, even when a pair crosses a row on the cart.
export function fieldView(state, ui) {
  const report = rowsReport(state), paired = ui?.paired === true && report.count > 0;
  const groups = pairs(report.count);
  return {
    order: `Order: ${state.target} crates`,
    sum: report.sum || 'Make equal rows',
    count: `${report.count} of ${state.target} crates`,
    paired, ready: rowsReady(state),
    pairs: paired ? `${groups.pairs} pairs · ${groups.left ? '1 left · Odd' : 'Even'}` : 'Pair up',
    groups: paired ? [...Array(groups.pairs).fill(2), ...(groups.left ? [1] : [])] : [],
    slots: Array.from({ length: GRID * GRID }, (_, slot) => {
      const filled = state.crates.includes(slot);
      return { filled, rowOK: filled && report.block,
        label: `Row ${Math.floor(slot / GRID) + 1}, column ${slot % GRID + 1}. ${filled ? 'Take a crate off.' : 'Put a crate here.'}` };
    }),
  };
}

function mountField(host, { dispatch = () => {} } = {}) {
  const doc = host.ownerDocument ?? document;
  const root = doc.createElement('div');
  root.className = 'rows-field';
  root.innerHTML = '<div class="rows-bed" role="group" aria-label="Crate cart, 5 rows of 5 slots"></div>'
    + '<span class="rows-plank" aria-hidden="true"></span><span class="rows-wheel rows-wheel--left" aria-hidden="true"></span><span class="rows-wheel rows-wheel--right" aria-hidden="true"></span>'
    + '<p class="rows-order"></p><p class="rows-sum"></p>'
    + '<div class="rows-pairs" role="group"><p class="rows-pairs-label"></p><div class="rows-pairs-strip" aria-hidden="true"></div></div>'
    + '<p class="rows-count"></p>';
  const bed = root.querySelector('.rows-bed');
  const order = root.querySelector('.rows-order'), sum = root.querySelector('.rows-sum'), count = root.querySelector('.rows-count');
  const pairsPanel = root.querySelector('.rows-pairs'), pairsLabel = root.querySelector('.rows-pairs-label'), strip = root.querySelector('.rows-pairs-strip');
  const slots = Array.from({ length: GRID * GRID }, (_, slot) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'rows-slot'; button.dataset.slot = String(slot);
    button.tabIndex = slot === 0 ? 0 : -1;
    button.innerHTML = `${CRATE_ART}<span class="rows-empty" aria-hidden="true"></span>`;
    bed.append(button);
    return { button, crate: button.querySelector('.rows-crate'), empty: button.querySelector('.rows-empty') };
  });
  const pairGroups = Array.from({ length: Math.ceil(GRID * GRID / 2) }, () => {
    const group = doc.createElement('span'); group.className = 'rows-pair'; group.hidden = true;
    group.innerHTML = `${PAIR_CRATE_ART}${PAIR_CRATE_ART}<span class="rows-pair-bracket"></span>`;
    strip.append(group);
    return { group, partner: group.children[1], bracket: group.querySelector('.rows-pair-bracket') };
  });
  let cursor = 0;
  const indexOf = event => slots.findIndex(slot => slot.button === event.target.closest?.('.rows-slot'));
  const setCursor = (at, focus = false) => {
    cursor = at;
    slots.forEach(({ button }, i) => { button.tabIndex = i === cursor ? 0 : -1; });
    if (focus) slots[cursor].button.focus();
  };
  const onClick = event => {
    const at = indexOf(event);
    if (at < 0) return;
    setCursor(at, true);
    dispatch({ type: 'field', slot: at });
  };
  const onFocus = event => {
    const at = indexOf(event);
    if (at >= 0) setCursor(at);
  };
  const onKey = event => {
    const intent = keyIntent(event), at = indexOf(event);
    if (at < 0 || !['up', 'down', 'left', 'right'].includes(intent)) return;
    const next = gridMove(at, intent, GRID, slots.length);
    if (next === at && intent === 'down') return;
    event.preventDefault();
    setCursor(next, true);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('keydown', onKey);
  host.append(root);
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  return {
    update(state, ui) {
      const view = fieldView(state, ui);
      setText(order, view.order); setText(sum, view.sum); setText(count, view.count);
      sum.toggleAttribute('data-ready', view.ready);
      setText(pairsLabel, view.pairs); pairsPanel.setAttribute('aria-label', view.pairs);
      slots.forEach(({ button, crate, empty }, i) => {
        const slot = view.slots[i];
        button.setAttribute('aria-label', slot.label);
        button.setAttribute('aria-pressed', String(slot.filled));
        button.toggleAttribute('data-row-ok', slot.rowOK);
        crate.toggleAttribute('hidden', !slot.filled); empty.hidden = slot.filled;
      });
      pairGroups.forEach(({ group, partner, bracket }, i) => {
        const n = view.groups[i] ?? 0;
        group.hidden = n === 0; partner.toggleAttribute('hidden', n < 2); bracket.hidden = n < 2;
        group.toggleAttribute('data-left', n === 1);
      });
    },
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

export default {
  kind: 'math', title: 'Taro’s crate rows', rewardLabel: 'Crate rows', help: HELP,
  notReadyLine: LINES.notReady,
  start(snapshot, { grade = 2, chapter = 1 } = {}) {
    const saved = snapshot?.kind === 'math' && snapshot.activity === 'rows' ? snapshot : null;
    return { state: normalizeRows(saved, grade, chapter), ui: { paired: false } };
  },
  opening: rowsOpening,
  another(state) {
    const request = ((state.request ?? 1) % 3) + 1;
    const fresh = this.start({ kind: 'math', activity: 'rows', request }, { grade: state.grade, chapter: state.chapter });
    return { ...fresh, line: rowsOpening(fresh.state) };
  },
  commands(state, ui) {
    return [
      { id: 'new', label: 'New order', art: ORDER_GLYPH },
      { id: 'pair', label: 'Pair up', icon: 'people', pressed: ui?.paired === true && state.crates.length > 0 },
      { id: 'clear', label: 'Clear cart', icon: 'trash', disabled: state.crates.length === 0 },
      { id: 'finish', label: 'Send cart', icon: 'check', finish: true, disabled: !rowsReady(state) },
    ];
  },
  act, mountField,
};
