import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import rows, { HELP, fieldView } from '../src/ui/activities/rows.js';
import {
  GRID, TARGETS, GRADES_ROWS, STAMP_ROWS, ORDER_GLYPH, LINES,
  normalizeRows, cleanRowsCreation, rowsReady, rowsOpening, rowsReport,
  toggleCrate, nextTarget, pairs, placeLine, pairLine, rowsCreationMarkup,
} from '../src/rows.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { routeIntent } from '../src/ui/input.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { declarations, controlStyle } from './helpers/css.js';

const cmd = id => ({ type: 'command', id });
const field = slot => ({ type: 'field', slot });
const fixture = { kind: 'math', activity: 'rows', grade: 2, chapter: 1, request: 1, target: 12, crates: [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13] };
const snapshot = parts => normalizeRows(parts);
const rectangle = (height, width, top = 0, left = 0) => Array.from({ length: height }, (_, row) =>
  Array.from({ length: width }, (_, col) => (top + row) * GRID + left + col)).flat();
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function fits(line) {
  assert.equal(typeof line, 'string');
  for (const sentence of line.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  for (const limit of Object.values(PAGE_CHARS)) {
    const pages = paginate(line, limit);
    assert.ok(pages.every(page => page.length <= limit));
    assert.equal(pages.join(' '), line);
  }
}
function contract(state, ui) {
  const commands = rows.commands(state, ui);
  assert.equal(commands.length, 4);
  assert.equal(new Set(commands.map(command => command.id)).size, 4);
  assert.deepEqual(commands.map(command => command.id), ['new', 'pair', 'clear', 'finish']);
  assert.deepEqual(commands.map(command => command.label), ['New order', 'Pair up', 'Clear cart', 'Send cart']);
  assert.equal(commands.filter(command => command.finish).length, 1);
  assert.deepEqual(commands.at(-1), { id: 'finish', label: 'Send cart', icon: 'check', finish: true, disabled: !rowsReady(state) });
  assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  assert.equal(commands[0].art, ORDER_GLYPH);
  assert.equal(commands[2].disabled, state.crates.length === 0);
  for (const command of commands) {
    assert.ok(command.label.length <= 12);
    assert.ok(ICON_NAMES.includes(command.icon) || command.art);
    if (command.art) assert.match(command.art, /viewBox="0 0 24 24".*currentColor/);
  }
  fits(rows.opening(state, ui));
  return commands;
}
function mounted() {
  const doc = new Doc(), host = doc.createElement('section'), actions = [];
  doc.body.append(host);
  let current = rows.start();
  const mount = rows.mountField(host, { grade: 2, dispatch(action) {
    actions.push(action);
    current = rows.act(current.state, current.ui, action);
    mount.update(current.state, current.ui);
  } });
  mount.update(current.state, current.ui);
  return { doc, host, actions, mount, current: () => current };
}

test('rows starts independently with the approved snapshot, four commands and matching saved rows', () => {
  const fresh = rows.start();
  assert.deepEqual(fresh, { state: { kind: 'math', activity: 'rows', grade: 2, chapter: 1, request: 1, target: 12, crates: [] }, ui: { paired: false } });
  assert.equal(rows.kind, 'math');
  assert.equal(rows.title, 'Taro’s crate rows');
  assert.equal(rows.rewardLabel, 'Crate rows');
  assert.deepEqual(TARGETS, [12, 10, 8, 6]);
  assert.deepEqual(GRADES_ROWS, [2]);
  assert.equal(GRID, 5);
  for (const name of ['start', 'opening', 'commands', 'act', 'mountField']) assert.equal(typeof rows[name], 'function');
  assert.equal(rows.opening(fresh.state), 'I need 12 crates in equal rows. Build them any way.');
  assert.equal(rows.opening(snapshot({ crates: [0] })), "Let's finish the order. 12 crates in equal rows.");
  assert.equal(rows.opening(fixture), 'Your crate rows are ready. Send cart, or Try another.');
  assert.equal(rows.opening, rowsOpening);
  contract(fresh.state, fresh.ui); contract(fixture, fresh.ui);
  assert.deepEqual(rows.start(fixture).state, fixture);
  assert.deepEqual(rows.start({ ...fixture, paired: true, ui: { paired: true } }).ui, { paired: false });
});

test('legacy math saves and foreign activities start fresh at every old K-to-2 grade', () => {
  for (const grade of [0, 1, 2]) {
    const old = { kind: 'math', grade, chapter: grade === 0 ? 0 : 1, left: [5, 5, 2], right: [5, 5, 2], rolled: true, target: 6, crates: [0, 1, 2, 5, 6, 7] };
    for (const saved of [old, { ...old, activity: 'pizza' }, { ...old, kind: 'science', activity: 'rows' }]) {
      assert.deepEqual(rows.start(saved), rows.start());
    }
  }
});

test('normalization bounds slots, sorts once, drops duplicates and junk without mutating input', () => {
  for (const junk of [null, undefined, 7, 'rows', [], {}, NaN, Infinity, Symbol('rows')]) {
    assert.deepEqual(normalizeRows(junk), rows.start().state);
    assert.equal(cleanRowsCreation(junk), null);
  }
  for (const junk of [{ kind: 'math' }, { kind: 'reading', activity: 'rows' }, { kind: 'math', activity: 'cart' }]) assert.equal(cleanRowsCreation(junk), null);
  const input = freeze({ ...fixture, crates: [24, 0, 13, 0, -1, 25, 2.5, '4', null, NaN, Infinity, {}, Symbol('slot')], name: '<script>', paired: true });
  const result = normalizeRows(input);
  assert.deepEqual(result.crates, [0, 13, 24]);
  assert.deepEqual(Object.keys(result).sort(), ['activity', 'chapter', 'crates', 'grade', 'kind', 'request', 'target']);
  assert.notEqual(result.crates, input.crates);
  assert.deepEqual(normalizeRows(result), result);
  assert.deepEqual(cleanRowsCreation(result), result);
  for (const target of [-1, 0, 7, 25, Infinity, NaN, '12', {}, Symbol('target')]) assert.equal(snapshot({ target }).target, 12);
  for (const crates of [null, '0,1', {}, 7, Array(25)]) assert.deepEqual(snapshot({ crates }).crates, []);
  assert.deepEqual(snapshot({ crates: Array.from({ length: 200 }, (_, i) => i) }).crates, Array.from({ length: 25 }, (_, i) => i));
});

test('grade and chapter follow the shared clamp without coercing other grades into grade 2', () => {
  for (const [grade, expected] of [[-99, 0], [99, 5], [2.4, 2], [2.5, 3], ['2', 2], [NaN, 0], [Infinity, 0], [null, 0], [{}, 0], [Symbol('grade'), 0]]) {
    assert.equal(normalizeRows(fixture, grade).grade, expected);
    assert.equal(cleanRowsCreation({ ...fixture, grade }).grade, expected);
  }
  for (let grade = 0; grade <= 5; grade++) for (const chapter of [0, 1, 2, -1, '1', Infinity, null]) {
    const result = normalizeRows(fixture, grade, chapter);
    assert.equal(result.grade, grade);
    assert.equal(result.chapter, chapter === 1 ? 1 : 0);
    assert.deepEqual(cleanRowsCreation(result), result);
    assert.deepEqual(normalizeRows(result, result.grade, result.chapter), result);
    assert.equal(rowsReady(result), grade === 2 && chapter === 1);
  }
});

test('report separates gaps, unequal counts and misalignment, and writes only rectangular sums', () => {
  assert.deepEqual(rowsReport(fixture), { count: 12, used: [0, 1, 2], contiguous: true, equal: true, aligned: true, block: true, rows: 3, perRow: 4, sum: '4 + 4 + 4 = 12' });
  assert.deepEqual(rowsReport(null), { count: 0, used: [], contiguous: false, equal: false, aligned: false, block: false, rows: 0, perRow: 0, sum: '' });
  const cases = [
    [[0, 2, 5, 7], 'contiguous', LINES.gaps],
    [[0, 1, 10, 11], 'contiguous', LINES.gaps],
    [[0, 1, 5], 'equal', LINES.unequal],
    [[0, 2, 10], 'equal', LINES.unequal],
    [[0, 1, 6, 7], 'aligned', LINES.misaligned],
  ];
  for (const [crates, reason, line] of cases) {
    const state = snapshot({ crates });
    assert.equal(rowsReport(state)[reason], false);
    assert.equal(rowsReport(state).block, false);
    assert.equal(rowsReport(state).sum, '');
    assert.equal(placeLine(state), line); fits(line);
  }
  assert.equal(placeLine(snapshot({ crates: [0, 1, 2, 3] })), '4 crates on the cart. 8 more to go.');
  assert.equal(placeLine(snapshot({ crates: rectangle(3, 5) })), '15 crates. That is 3 too many.');
  assert.equal(placeLine(snapshot()), LINES.empty);
});

test('equal rows with gaps keep their counts and explain the packing constraint', () => {
  for (const crates of [[0, 2, 5, 7], [0, 1, 10, 11]]) {
    const state = snapshot({ crates });
    assert.equal(rowsReport(state).equal, true);
    assert.equal(placeLine(state), 'Equal counts! Close the gaps to make a solid block.');
    assert.equal(rowsReady(state), false);
    assert.deepEqual(state.crates, crates);
  }
});

test('every solid rectangle and offset is ready exactly when its count matches a listed order', () => {
  for (let height = 1; height <= GRID; height++) for (let width = 1; width <= GRID; width++) {
    for (let top = 0; top <= GRID - height; top++) for (let left = 0; left <= GRID - width; left++) {
      const crates = rectangle(height, width, top, left);
      const report = rowsReport({ crates });
      assert.equal(report.block, true);
      assert.equal(report.rows, height); assert.equal(report.perRow, width);
      assert.equal(report.sum, `${Array(height).fill(width).join(' + ')} = ${height * width}`);
      for (const target of TARGETS) assert.equal(rowsReady(snapshot({ crates, target })), height * width === target);
    }
  }
});

test('a rectangle needs every slot, adjacent rows and matching columns, even at the right total', () => {
  for (const target of TARGETS) {
    const height = target === 10 ? 5 : 2, width = target / height;
    const crates = target === 12 ? rectangle(3, 4) : rectangle(height, width);
    for (const missing of crates) assert.equal(rowsReady(snapshot({ target, crates: crates.filter(slot => slot !== missing) })), false);
  }
  for (const crates of [
    [0, 1, 2, 3, 5, 6, 7, 8, 15, 16, 17, 18],
    [0, 1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14],
    [0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  ]) assert.equal(rowsReady({ ...fixture, crates }), false);
  for (const patch of [
    { kind: 'science' }, { activity: 'cart' }, { activity: undefined }, { chapter: 0 }, { chapter: '1' },
    ...[0, 1, 3, 4, 5, '2', 2.5, undefined].map(grade => ({ grade })),
    ...[0, 11, '12', NaN, undefined].map(target => ({ target })),
    ...[null, {}, 'crates', Array(12), [...fixture.crates, 0], [...fixture.crates].reverse(), [...fixture.crates, 25], [...fixture.crates, 0.5]].map(crates => ({ crates })),
  ]) assert.equal(rowsReady({ ...fixture, ...patch }), false);
  for (const junk of [null, [], 12, 'rows', {}]) assert.equal(rowsReady(junk), false);
});

test('all 3-by-3 subsets match an independent bounding-box rectangle check', () => {
  const cells = rectangle(3, 3, 1, 1);
  for (let mask = 0; mask < 2 ** cells.length; mask++) {
    const crates = cells.filter((_, i) => mask & 2 ** i);
    const row = crates.map(slot => Math.floor(slot / GRID)), col = crates.map(slot => slot % GRID);
    const area = crates.length ? (Math.max(...row) - Math.min(...row) + 1) * (Math.max(...col) - Math.min(...col) + 1) : 0;
    assert.equal(rowsReport({ crates }).block, crates.length > 0 && crates.length === area);
  }
});

for (const [target, height, width] of [[12, 3, 4], [10, 5, 2], [8, 2, 4], [6, 2, 3]]) {
  test(`order ${target}: tap equal rows, pair, save, reopen, edit and clear; all lines fit`, () => {
    let { state, ui } = rows.start({ ...fixture, target, crates: [] });
    const crates = rectangle(height, width);
    for (const slot of crates) {
      freeze(state); freeze(ui);
      const before = [...state.crates], next = rows.act(state, ui, field(slot));
      assert.notEqual(next.state, state); assert.deepEqual(state.crates, before);
      assert.equal(next.ui.paired, false); fits(next.line);
      ({ state, ui } = next);
      contract(state, ui); assert.deepEqual(cleanRowsCreation(state), state);
    }
    assert.equal(rowsReady(state), true);
    const sum = `${Array(height).fill(width).join(' + ')} = ${target}`;
    assert.equal(placeLine(state), `${height} rows of ${width}. ${sum}. Choose Send cart.`);
    const paired = rows.act(freeze(state), freeze(ui), cmd('pair'));
    assert.equal(paired.state, state); assert.equal(paired.ui.paired, true);
    assert.equal(paired.line, `${target} makes ${target / 2} pairs. Even!`); fits(paired.line);
    assert.equal(fieldView(state, paired.ui).sum, sum);
    assert.equal(fieldView(state, paired.ui).groups.length, target / 2);
    assert.equal(rows.act(state, paired.ui, cmd('pair')).ui, paired.ui);
    const reopened = rows.start(JSON.parse(JSON.stringify(cleanRowsCreation(state))));
    assert.deepEqual(reopened.state, state); assert.equal(reopened.ui.paired, false);
    assert.equal(rowsReady(reopened.state), true);
    assert.deepEqual(rows.act(state, paired.ui, cmd('finish')), { state, ui: paired.ui });
    const removed = rows.act(freeze(state), freeze(paired.ui), field(crates.at(-1)));
    assert.equal(rowsReady(removed.state), false); assert.equal(removed.ui.paired, false); fits(removed.line);
    contract(removed.state, removed.ui);
    const restored = rows.act(removed.state, removed.ui, field(crates.at(-1)));
    assert.deepEqual(restored.state, state); assert.equal(rowsReady(restored.state), true);
    const clear = rows.act(state, paired.ui, cmd('clear'));
    assert.deepEqual(clear.state.crates, []); assert.equal(clear.state.target, target); assert.equal(clear.ui.paired, false);
    assert.equal(clear.line, 'The cart is empty. Build the rows again.'); fits(clear.line);
    contract(clear.state, clear.ui);
  });
}

test('New order cycles and wraps, empties the cart and resets pairing without changing grade or chapter', () => {
  let { state, ui } = rows.start(fixture);
  for (const target of [10, 8, 6, 12, 10]) {
    const paired = rows.act(state, ui, cmd('pair'));
    const next = rows.act(freeze(state), freeze(paired.ui), cmd('new'));
    assert.equal(next.state.target, target); assert.equal(next.state.grade, 2); assert.equal(next.state.chapter, 1);
    assert.deepEqual(next.state.crates, []); assert.equal(next.ui.paired, false);
    assert.equal(next.line, `New order! ${target} crates in equal rows.`); fits(next.line);
    assert.deepEqual(next.state, nextTarget(state));
    ({ state, ui } = rows.act(next.state, next.ui, field(0)));
  }
  assert.equal(nextTarget({ ...fixture, target: 11 }).target, 12);
});

test('Pair up counts every total, includes leftovers, and never changes saved state', () => {
  for (let count = 0; count <= 25; count++) {
    const state = freeze(snapshot({ crates: Array.from({ length: count }, (_, i) => i) })), ui = freeze({ paired: false });
    assert.deepEqual(pairs(count), { pairs: Math.floor(count / 2), left: count % 2 });
    const paired = rows.act(state, ui, cmd('pair'));
    assert.equal(paired.state, state); assert.equal(paired.ui.paired, count > 0);
    if (!count) { assert.equal(paired.ui, ui); assert.equal(paired.line, LINES.empty); }
    else assert.equal(paired.line, count % 2 ? `${count} makes ${Math.floor(count / 2)} pairs and 1 left. Odd!` : `${count} makes ${count / 2} pairs. Even!`);
    assert.equal(paired.line, pairLine(state)); fits(paired.line);
    const view = fieldView(state, paired.ui);
    assert.equal(view.groups.reduce((total, n) => total + n, 0), count);
    assert.equal(view.groups.filter(n => n === 2).length, Math.floor(count / 2));
    assert.equal(view.groups.filter(n => n === 1).length, count % 2);
    contract(state, paired.ui);
  }
  for (const count of [-1, NaN, Infinity, {}, null, Symbol('count')]) assert.deepEqual(pairs(count), { pairs: 0, left: 0 });
  assert.deepEqual(pairs(99), { pairs: 12, left: 1 });
});

test('invalid taps, disabled clear, finish and unknown actions preserve state and ui identity', () => {
  for (const saved of [undefined, fixture]) {
    const { state, ui } = freeze(rows.start(saved));
    for (const action of [null, {}, { type: 'bad', slot: 0 }, cmd('finish'), cmd('missing'), cmd({}), ...[-1, 25, 0.1, '0', null, undefined, NaN, Infinity, {}, Symbol('slot')].map(field)]) {
      const result = rows.act(state, ui, action);
      assert.deepEqual(result, { state, ui }); assert.equal(result.state, state); assert.equal(result.ui, ui);
    }
    for (const slot of [-1, 25, '0', 0.1, NaN]) assert.equal(toggleCrate(state, slot), state);
  }
  const { state, ui } = freeze(rows.start());
  assert.deepEqual(rows.act(state, ui, cmd('clear')), { state, ui });
  const added = toggleCrate(state, 24);
  assert.deepEqual(added.crates, [24]); assert.deepEqual(toggleCrate(added, 24), state);
});

test('help, stamp, dialogue and field labels fit the sentence and page limits', () => {
  assert.deepEqual(HELP, ['Tap a slot to put a crate on the cart.', 'Make equal rows with no gaps.', 'Choose Pair up to count by twos.', 'When the rows add up to the order, choose Send cart.']);
  assert.equal(rows.help, HELP); assert.equal(rows.notReadyLine, LINES.notReady);
  assert.equal(STAMP_ROWS, 'Equal rows add up: 4 + 4 + 4 = 12.');
  for (const text of [...HELP, STAMP_ROWS, rows.title, rows.rewardLabel, ...Object.values(LINES).filter(line => typeof line === 'string')]) fits(text);
  for (const target of TARGETS) for (let count = 0; count <= 25; count++) {
    const state = snapshot({ target, crates: Array.from({ length: count }, (_, i) => i) });
    for (const paired of [false, true]) {
      const view = fieldView(state, { paired });
      for (const line of [view.order, view.sum, view.count, view.pairs, ...view.slots.map(slot => slot.label), placeLine(state), pairLine(state), rowsOpening(state)]) fits(line);
    }
  }
  assert.equal(fieldView(snapshot({ crates: rectangle(5, 2), target: 10 }), {}).sum, '2 + 2 + 2 + 2 + 2 = 10');
  assert.equal(fieldView(snapshot({ crates: [0] }), { paired: true }).pairs, '0 pairs · 1 left · Odd');
});

test('mounted field builds once, changes slots in place and clears every listener on destroy', () => {
  const { doc, host, mount, actions, current } = mounted();
  const root = host.children[0], slots = root.querySelectorAll('.rows-slot'), groups = root.querySelectorAll('.rows-pair');
  assert.equal(slots.length, 25); assert.equal(groups.length, 13);
  assert.equal(root.querySelectorAll('button').length, 25);
  assert.equal(root.querySelectorAll('input, textarea').length, 0);
  assert.equal(root.querySelector('.rows-order').textContent, 'Order: 12 crates');
  assert.equal(root.querySelector('.rows-count').textContent, '0 of 12 crates');
  assert.equal(root.querySelector('.rows-sum').textContent, 'Make equal rows');
  assert.ok(slots.every(button => button.querySelector('.rows-crate').getAttribute('hidden') !== null));
  for (const slot of fixture.crates) slots[slot].querySelector('.rows-empty').click();
  assert.deepEqual(actions, fixture.crates.map(field));
  assert.deepEqual(current().state, fixture);
  assert.equal(root.querySelector('.rows-sum').textContent, '4 + 4 + 4 = 12');
  assert.equal(root.querySelector('.rows-count').textContent, '12 of 12 crates');
  assert.equal(root.querySelectorAll('[data-row-ok]').length, 12);
  assert.equal(slots[0].getAttribute('aria-pressed'), 'true');
  assert.equal(slots[4].getAttribute('aria-pressed'), 'false');
  assert.equal(slots[0].querySelector('.rows-crate').getAttribute('hidden'), null);
  assert.equal(doc.activeElement, slots[13]);
  mount.update(current().state, { paired: true });
  assert.equal(root.querySelector('.rows-pairs-label').textContent, '6 pairs · Even');
  assert.equal(groups.filter(group => !group.hidden).length, 6);
  assert.ok(groups.slice(0, 6).every(group => !group.querySelector('.rows-pair-bracket').hidden));
  slots[13].click();
  assert.equal(root.querySelectorAll('[data-row-ok]').length, 0);
  assert.equal(root.querySelector('.rows-sum').getAttribute('data-ready'), null);
  assert.ok(groups.every(group => group.hidden));
  assert.deepEqual(root.querySelectorAll('.rows-slot'), slots);
  assert.deepEqual(root.querySelectorAll('.rows-pair'), groups);
  assert.equal(doc.activeElement, slots[13]);
  mount.destroy();
  assert.equal(host.children.length, 0);
  assert.ok(Object.values(root.listeners).every(list => list.length === 0));
  const before = actions.length;
  slots[0].click();
  assert.equal(actions.length, before);
});

test('pair brackets show twelve pairs and a distinct leftover at the maximum cart size', () => {
  const { host, mount } = mounted();
  const root = host.children[0], groups = root.querySelectorAll('.rows-pair');
  mount.update(snapshot({ crates: rectangle(5, 5) }), { paired: true });
  assert.equal(root.querySelector('.rows-pairs-label').textContent, '12 pairs · 1 left · Odd');
  assert.equal(groups.filter(group => !group.hidden).length, 13);
  assert.equal(groups.filter(group => !group.querySelector('.rows-pair-bracket').hidden).length, 12);
  assert.equal(groups[12].children[1].getAttribute('hidden'), '');
  assert.equal(groups[12].getAttribute('data-left'), '');
  mount.update(fixture, { paired: true });
  assert.equal(groups[0].children[1].getAttribute('hidden'), null);
  mount.destroy();
});

test('roving arrows traverse the grid, yield Down at the last row and keep native button activation', () => {
  const { doc, host, mount, actions } = mounted(), slots = host.querySelectorAll('.rows-slot');
  slots[0].focus();
  for (const [key, next] of [['ArrowRight', 1], ['ArrowDown', 6], ['ArrowLeft', 5], ['ArrowUp', 0]]) {
    assert.equal(pressKey(doc.activeElement, 'keydown', key).defaultPrevented, true);
    assert.equal(doc.activeElement, slots[next]);
    assert.equal(slots.filter(button => button.tabIndex === 0).length, 1);
  }
  assert.equal(actions.length, 0);
  slots[4].focus(); pressKey(slots[4], 'keydown', 'ArrowRight'); assert.equal(doc.activeElement, slots[4]);
  for (const slot of [20, 21, 22, 23, 24]) {
    slots[slot].focus();
    assert.equal(pressKey(slots[slot], 'keydown', 'ArrowDown').defaultPrevented, false);
    assert.equal(doc.activeElement, slots[slot]);
  }
  slots[7].focus();
  assert.equal(slots[7].tabIndex, 0); assert.equal(slots[24].tabIndex, -1);
  for (const key of ['Tab', 'Escape']) assert.equal(pressKey(slots[7], 'keydown', key).defaultPrevented, false);
  assert.equal(pressKey(slots[7], 'keydown', 'ArrowRight', { ctrlKey: true }).defaultPrevented, false);
  for (const key of ['Enter', ' ']) {
    assert.equal(routeIntent({ target: slots[7], key }), 'native');
    assert.equal(pressKey(slots[7], 'keydown', key).defaultPrevented, false);
    pressKey(slots[7], 'keyup', key);
  }
  assert.deepEqual(actions, [field(7), field(7)]);
  assert.equal(slots[7].getAttribute('aria-pressed'), 'false');
  const count = actions.length;
  host.querySelector('.rows-order').dispatchEvent(new Event('click'));
  assert.equal(actions.length, count);
  mount.destroy();
});

test('a keyboard-only play-through fills the ready rectangle without recreating controls', () => {
  const { doc, host, mount, current } = mounted(), slots = host.querySelectorAll('.rows-slot');
  slots[0].focus();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      pressKey(doc.activeElement, 'keydown', 'Enter');
      if (col < 3) pressKey(doc.activeElement, 'keydown', 'ArrowRight');
    }
    if (row < 2) {
      pressKey(doc.activeElement, 'keydown', 'ArrowDown');
      for (let col = 0; col < 3; col++) pressKey(doc.activeElement, 'keydown', 'ArrowLeft');
    }
  }
  assert.deepEqual(current().state, fixture);
  assert.equal(rows.commands(current().state, current().ui).at(-1).disabled, false);
  assert.equal(doc.activeElement, slots[13]);
  assert.deepEqual(host.querySelectorAll('.rows-slot'), slots);
  mount.destroy();
});

test('creation SVG shows the saved slots, wheels and sum with safe bounded markup', () => {
  const svg = rowsCreationMarkup(fixture);
  assert.match(svg, /^<svg class="creation creation--math creation--rows" viewBox="0 0 90 45" role="img"/);
  assert.match(svg, /aria-label="Your crate rows: 3 rows of 4 make 12"/);
  assert.equal((svg.match(/class="rows-creation-crate"/g) ?? []).length, 12);
  assert.match(svg, />4 \+ 4 \+ 4<\/text>/); assert.match(svg, />= 12<\/text>/);
  assert.match(svg, /x="25" y="17" width="6" height="6"/);
  const fiveRows = rowsCreationMarkup(snapshot({ target: 10, crates: rectangle(5, 2) }));
  assert.match(fiveRows, />2 \+ 2 \+ 2<\/text>/); assert.match(fiveRows, />\+ 2 \+ 2 = 10<\/text>/);
  assert.match(fiveRows, /font-size="6.5" textLength="36" lengthAdjust="spacingAndGlyphs"/);
  assert.doesNotMatch(rowsCreationMarkup(snapshot({ crates: [0, 2] })), /<text/);
  const attack = '<script onload="bad">&\'';
  for (const junk of [null, undefined, {}, [], 'bad', NaN, Infinity, Symbol('rows'), { ...fixture, target: attack, crates: [attack, -1, Infinity, 24], name: attack }]) {
    const markup = rowsCreationMarkup(junk);
    assert.equal((markup.match(/<svg/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /<script|onload|onerror|NaN|Infinity|undefined|<filter|<image|gradient/i);
  }
});

const css = readFileSync(new URL('../src/ui/activities/rows.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');

test('the bed, grid, two-line plaque and pair strip fit the specified field geometry', () => {
  const px = (selector, property) => parseFloat(declarations(css, selector)[property]);
  assert.equal(px('.rows-field', 'width'), 520); assert.equal(px('.rows-field', 'height'), 268);
  assert.equal(px('.rows-bed', 'left'), 10); assert.equal(px('.rows-bed', 'top'), 8);
  assert.equal(px('.rows-bed', 'width'), 216); assert.equal(px('.rows-bed', 'height'), 216);
  assert.equal(px('.rows-bed', 'border'), 4); assert.equal(px('.rows-bed', 'gap'), 2);
  assert.equal(5 * px('.rows-slot', 'width') + 4 * px('.rows-bed', 'gap') + 2 * px('.rows-bed', 'border'), px('.rows-bed', 'width'));
  assert.equal(px('.rows-crate', 'width'), 32); assert.equal(px('.rows-crate', 'height'), 32);
  for (const selector of ['.rows-order', '.rows-sum', '.rows-pairs', '.rows-count']) {
    assert.equal(px(selector, 'left'), 244); assert.equal(px(selector, 'width'), 268);
    assert.ok(px(selector, 'top') + px(selector, 'height') <= 268);
  }
  assert.equal(px('.rows-sum', 'height'), 60);
  assert.ok(2 * 24 * 1.05 + 2 * 2 + 2 * 2 <= 60, 'two large field-font lines fit the plaque');
  assert.ok(7 * 28 + 6 * 6 <= 268 - 2 * 2 - 2 * 8, 'seven pair brackets fit across the panel');
  assert.ok(20 * 1.2 + 4 + 2 * 24 + 2 + 2 * 4 + 2 * 2 <= 96, 'large label plus thirteen groups fits');
  assert.ok(px('.rows-wheel', 'top') + px('.rows-wheel', 'height') <= 268);
});

test('field words use shared font tokens and grow in Bigger words mode', () => {
  const { doc, host, mount } = mounted();
  const styles = `${tokens}\n${css}`;
  for (const large of [false, true]) {
    doc.body.classList.toggle('large-text', large);
    for (const selector of ['.rows-order', '.rows-sum', '.rows-count']) {
      assert.equal(controlStyle(host.querySelector(selector), styles)['font-size'], large ? '24px' : '20px');
    }
    assert.equal(controlStyle(host.querySelector('.rows-pairs-label'), styles)['font-size'], large ? '20px' : '16px');
  }
  assert.equal(declarations(css, '.rows-sum')['white-space'], 'normal');
  mount.destroy();
});


test('another cycles fresh orders and preserves request through cleaning', () => {
  let state = rows.start(null, { grade: 2, chapter: 1 }).state;
  for (const target of [10, 8, 12]) {
    const result = rows.another(state, { paired: true });
    assert.equal(result.state.target, target);
    assert.deepEqual(result.state.crates, []);
    assert.deepEqual(result.ui, { paired: false });
    assert.equal(cleanRowsCreation(result.state).request, result.state.request);
    assert.equal(result.line, rows.opening(result.state));
    state = result.state;
  }
});
