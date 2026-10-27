import test from 'node:test';
import assert from 'node:assert/strict';
import square, { cellPosition, nextNeed, walkLine, blockedLine, landmark, LINES, HELP } from '../src/ui/activities/square.js';
import { encounterReady, encounterOpeningDialogue, STAGE_CELLS } from '../src/encounters.js';

const field = (s, action, grade) => square.act(s.state, s.ui, { type: 'field', ...action }, grade);
const cmd = (s, id, grade) => square.act(s.state, s.ui, { type: 'command', id }, grade);
const start = grade => square.start(null, { chapter: grade === 0 ? 0 : 1, grade });
const finish = s => square.commands(s.state, s.ui, s.state.grade).find(c => c.finish);
// Cells: 0 is top-left (quiet trees), 22 is bottom row middle (off the path), 12 is the path's middle,
// 4 is the stage corner, 3 and 9 touch it.
const QUIET = 0, OFF_PATH = 22, PATH = 12, STAGE = 4, BESIDE_STAGE = 3, UNDER_STAGE = 9;

const sentences = text => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const fitsOnePage = text => sentences(text).every(s => s.length <= 56);

test('every line fits one Bigger words page, sentence by sentence', () => {
  const lines = [...Object.values(LINES), ...HELP];
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const s = start(grade);
    lines.push(square.opening(s.state, s.ui, grade), walkLine(s.state), nextNeed(s.state));
    const bench = { ...s.state, placements: [{ item: 'bench', x: 50, y: 90 }] };
    const garden = { ...bench, placements: [...bench.placements, { item: 'quiet', x: 10, y: 10 }] };
    const sign = { ...garden, placements: [...garden.placements, { item: 'sign', x: 90, y: 10 }], tried: true };
    for (const state of [bench, garden, sign]) lines.push(walkLine(state), nextNeed(state), square.opening(state, s.ui, grade));
    lines.push(blockedLine({ ...s.state, placements: [{ item: 'quiet', x: 50, y: 50 }] }));
  }
  for (const line of lines) {
    assert.equal(typeof line, 'string', `line is a string: ${line}`);
    assert.ok(fitsOnePage(line), `"${line}" has a sentence over 56 characters`);
  }
});

test('the square starts with the bench tool, three commands and a locked finish at every grade', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const s = start(grade);
    assert.equal(square.kind, 'community'); assert.equal(square.title, 'Room for every neighbor');
    assert.deepEqual(s.ui, { tool: 'bench' });
    const commands = square.commands(s.state, s.ui, grade);
    assert.deepEqual(commands.map(c => [c.id, c.label, c.icon]), [['invite', 'Try it', 'people'], ['needs', 'Next step', 'help'], ['finish', 'Open square', 'check']]);
    for (const c of commands) assert.ok(c.label.length <= 12, `${c.label} fits`);
    assert.equal(commands.at(-1).finish, true); assert.equal(commands.at(-1).disabled, true);
  }
  assert.deepEqual(square.help, [
    'Pick a tool, then tap the map to place it.',
    'Choose Next step if you are stuck.',
    'Choose Try it to walk the square.',
    'Choose Open square.',
  ]);
  assert.equal(square.notReadyLine, 'Something changed. Choose Try it again.');
});

test('the opening grows with the grade and says so when a saved square is already ready', () => {
  // The wording belongs to encounters.js (the rules lane); the square only has to pass it through per band.
  assert.equal(square.opening(start(0).state), 'Put a bench off the path for a tired neighbor.');
  for (const grade of [0, 1, 2, 3, 4, 5]) assert.equal(square.opening(start(grade).state), encounterOpeningDialogue(start(grade).state));
  assert.notEqual(square.opening(start(0).state), square.opening(start(2).state));
  assert.notEqual(square.opening(start(2).state), square.opening(start(3).state));
  assert.match(square.opening(start(2).state), /garden by the quiet trees/);
  assert.match(square.opening(start(3).state), /sign by the stage/);
  const saved = { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 10 }] };
  const s = square.start(saved, { chapter: 1, grade: 5 });
  assert.equal(encounterReady(s.state), true);
  assert.equal(square.opening(s.state), 'Your square is ready to open. You can still change it.');
  assert.equal(finish(s).disabled, false);
});

test('Next step names one step at a time, per band', () => {
  // Kindergarten: bench, then Try it.
  let s = start(0);
  assert.equal(nextNeed(s.state), 'Put a bench off the path.');
  s = field(s, { cell: OFF_PATH });
  assert.equal(nextNeed(s.state), 'Choose Try it to walk the square.');
  assert.equal(cmd(s, 'needs').line, 'Choose Try it to walk the square.');
  s = cmd(s, 'invite');
  assert.equal(nextNeed(s.state), 'Everything is ready! Choose Open square.');
  assert.equal(finish(s).disabled, false);

  // Grades 1–2 add the garden by the quiet trees.
  s = start(2);
  s = field(s, { cell: OFF_PATH });
  assert.equal(nextNeed(s.state), 'Put a garden by the quiet trees.');
  s = field(s, { tool: 'quiet' }); s = field(s, { cell: QUIET });
  assert.equal(nextNeed(s.state), 'Choose Try it to walk the square.');
  s = cmd(s, 'invite');
  assert.equal(finish(s).disabled, false);

  // Grades 3–5 add a sign next to the stage; a sign elsewhere does not count.
  s = start(4);
  s = field(s, { cell: OFF_PATH }); s = field(s, { tool: 'quiet' }); s = field(s, { cell: QUIET });
  assert.equal(nextNeed(s.state), 'Put a sign next to the stage.');
  s = field(s, { tool: 'sign' }); s = field(s, { cell: 20 });
  assert.equal(nextNeed(s.state), 'Put a sign next to the stage.');
  s = cmd(s, 'invite');
  assert.equal(finish(s).disabled, true, 'a sign far from the stage does not open the square');
  s = field(s, { cell: UNDER_STAGE });
  assert.equal(nextNeed(s.state), 'Choose Try it to walk the square.');
  s = cmd(s, 'invite');
  assert.equal(finish(s).disabled, false);
});

test('a blocked path names the item in the way, before anything else', () => {
  let s = start(3);
  s = field(s, { cell: PATH });
  assert.equal(blockedLine(s.state), 'Choose Remove, then tap the bench. Put a bench off the path.');
  assert.equal(nextNeed(s.state), 'Choose Remove, then tap the bench. Put a bench off the path.');
  assert.equal(cmd(s, 'invite').line, 'Choose Remove, then tap the bench. Put a bench off the path.');
  s = field(s, { tool: 'quiet' }); s = field(s, { cell: PATH });
  assert.equal(nextNeed(s.state), 'Choose Remove, then tap the garden. Put a garden by the quiet trees.');
  // A sign on the path is fine: people walk past signs.
  s = field(s, { tool: 'sign' }); s = field(s, { cell: PATH });
  assert.equal(blockedLine(s.state), null);
  assert.equal(nextNeed(s.state), 'Put a bench off the path.');
});

test('Try it walks the square and reports the first thing missing, per band', () => {
  // Kindergarten only needs the bench.
  let k = start(0);
  assert.equal(cmd(k, 'invite').line, 'A tired neighbor needs a bench off the path.');
  k = field(k, { cell: OFF_PATH });
  k = cmd(k, 'invite');
  assert.equal(k.state.tried, true);
  assert.equal(k.line, 'A clear path and a bench to rest. Ready! Choose Open square.');
  assert.equal(encounterReady(k.state), true);

  // Grade 1 asks for the garden too, and the garden is always "a garden by the quiet trees".
  let g1 = start(1);
  g1 = field(g1, { cell: OFF_PATH });
  assert.equal(cmd(g1, 'invite').line, 'Neighbors want a garden by the quiet trees.');
  g1 = field(g1, { tool: 'quiet' }); g1 = field(g1, { cell: QUIET });
  assert.equal(cmd(g1, 'invite').line, 'A clear path, a bench, and a quiet garden. Ready! Choose Open square.');

  // Grade 4 asks for the sign next to the stage.
  let g4 = start(4);
  g4 = field(g4, { tool: 'quiet' }); g4 = field(g4, { cell: QUIET });
  g4 = field(g4, { tool: 'bench' }); g4 = field(g4, { cell: OFF_PATH });
  assert.deepEqual(cellPosition(OFF_PATH), { x: 50, y: 90 });
  g4 = cmd(g4, 'invite');
  assert.equal(g4.line, 'Neighbors cannot find the stage. Put a sign next to the stage.');
  assert.equal(finish(g4).disabled, true);
  g4 = field(g4, { tool: 'sign' }); g4 = field(g4, { cell: BESIDE_STAGE });
  g4 = cmd(g4, 'invite');
  assert.equal(g4.line, 'A clear path, a bench, a garden, and a sign. Ready! Choose Open square.');
  assert.equal(finish(g4).disabled, false);
});

test('every stage cell counts for the sign, and the cells read "by the stage"', () => {
  const stageCells = [STAGE, BESIDE_STAGE, UNDER_STAGE];
  assert.deepEqual(stageCells.map(cellPosition), STAGE_CELLS);
  for (const cell of stageCells) {
    let s = start(5);
    s = field(s, { cell: OFF_PATH }); s = field(s, { tool: 'quiet' }); s = field(s, { cell: QUIET });
    s = field(s, { tool: 'sign' }); s = field(s, { cell });
    s = cmd(s, 'invite');
    assert.equal(finish(s).disabled, false, `cell ${cell} is next to the stage`);
    assert.equal(landmark(cell), 'by the stage');
  }
  assert.equal(landmark(QUIET), 'by the quiet trees');
  assert.equal(landmark(PATH), 'on the path');
  assert.equal(landmark(20), 'by the entrance');
  assert.equal(landmark(OFF_PATH), '');
  assert.equal(landmark(8), '', 'row 1 column 3 is not a stage cell');
});

test('placing, replacing, removing and the 12-item limit each say what happened', () => {
  let s = start(3);
  s = field(s, { cell: BESIDE_STAGE });
  assert.equal(s.line, 'Placed. Choose Try it when you are ready.');
  assert.deepEqual(s.state.placements, [{ item: 'bench', x: 70, y: 10 }]);
  s = field(s, { cell: BESIDE_STAGE });
  assert.equal(s.line, 'That item is already here. Choose another place.');
  s = field(s, { tool: 'sign' }); s = field(s, { cell: BESIDE_STAGE });
  assert.equal(s.line, 'Replaced the bench with a sign. Choose Try it when you are ready.');
  assert.deepEqual(s.state.placements, [{ item: 'sign', x: 70, y: 10 }]);
  s = field(s, { tool: 'remove' }); s = field(s, { cell: BESIDE_STAGE });
  assert.equal(s.line, 'Removed. Choose Try it when you are ready.');
  assert.deepEqual(s.state.placements, []);
  s = field(s, { tool: 'bench' });
  for (let cell = 0; cell < 12; cell++) s = field(s, { cell });
  s = field(s, { cell: 20 });
  assert.equal(s.line, 'All 12 places are used. Remove an item or replace one already on the map.');
  assert.equal(s.state.placements.length, 12);
});

test('removing from an empty cell explains itself', () => {
  let s = start(0);
  s = field(s, { tool: 'remove' }); s = field(s, { cell: 7 });
  assert.equal(s.line, 'There is nothing here to remove.');
});

test('changing the map after Try it undoes the walk and says so, keeping the work', () => {
  let s = start(0);
  s = field(s, { cell: OFF_PATH });
  s = cmd(s, 'invite');
  assert.equal(encounterReady(s.state), true);
  s = field(s, { cell: 23 });
  assert.equal(s.state.tried, false);
  assert.equal(s.line, 'Something changed. Choose Try it again.');
  assert.equal(s.state.placements.length, 2, 'the bench placed before stays');
  assert.equal(finish(s).disabled, true);
  s = cmd(s, 'invite');
  assert.equal(finish(s).disabled, false);
  // A blocking item after the walk-through is explained on the next Try it.
  s = field(s, { tool: 'quiet' }); s = field(s, { cell: PATH });
  assert.equal(s.line, 'Something changed. Choose Try it again.');
  assert.equal(cmd(s, 'invite').line, 'Choose Remove, then tap the garden. Put a garden by the quiet trees.');
});

test('replacement names both items before and after Try it and retains other work', () => {
  for (const tried of [false, true]) for (const [oldItem, newItem] of [['bench', 'quiet'], ['quiet', 'sign'], ['sign', 'bench']]) {
    const base = start(1);
    const state = { ...base.state, tried, placements: [{ item: oldItem, ...cellPosition(QUIET) }, { item: 'bench', ...cellPosition(OFF_PATH) }] };
    const result = square.act(state, { tool: newItem }, { type: 'field', cell: QUIET });
    const word = item => item === 'quiet' ? 'garden' : item;
    assert.equal(result.line, `Replaced the ${word(oldItem)} with a ${word(newItem)}. ${tried ? 'Choose Try it again.' : 'Choose Try it when you are ready.'}`);
    assert.ok(fitsOnePage(result.line));
    assert.ok(result.line.length <= 96);
    assert.equal(result.state.tried, false);
    assert.deepEqual(result.state.placements.find(p => p.x === 50 && p.y === 90), state.placements[1]);
  }
});

test('a saved square from today still loads, and an old grade-3 save without a sign is just not ready', () => {
  const saved = { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }] };
  const g2 = square.start(saved, { chapter: 1, grade: 2 });
  assert.equal(encounterReady(g2.state), true);
  assert.equal(finish(g2).disabled, false);
  const g3 = square.start(saved, { chapter: 1, grade: 3 });
  assert.deepEqual(g3.state.placements, saved.placements);
  assert.equal(finish(g3).disabled, true);
  assert.equal(nextNeed(g3.state), 'Put a sign next to the stage.');
});

test('a second Try it returns the same state object, so nothing is saved twice', () => {
  let s = start(0);
  s = field(s, { cell: OFF_PATH });
  s = cmd(s, 'invite');
  const again = cmd(s, 'invite');
  assert.equal(again.state, s.state);
  assert.equal(again.line, 'A clear path and a bench to rest. Ready! Choose Open square.', 'the ready line is still spoken');
});

test('act is pure and the tool lives in ui', () => {
  const s = start(3);
  const before = JSON.stringify(s);
  const next = field(s, { tool: 'quiet' });
  assert.deepEqual(next.ui, { tool: 'quiet' }); assert.equal(next.state, s.state);
  field(next, { cell: 0 }); cmd(s, 'invite'); cmd(s, 'needs');
  assert.equal(JSON.stringify(s), before);
});

// A few lines of fake DOM so the field can be mounted without a browser (the shape mountField uses: dataset,
// tabIndex, classList, innerHTML, append, querySelector by class, and keydown listeners on the root).
function fakeDocument() {
  const make = tag => {
    const listeners = {};
    const el = {
      tagName: tag, children: [], attrs: {}, classes: new Set(), dataset: {}, tabIndex: -1, hidden: false, _html: '',
      get className() { return [...el.classes].join(' '); }, set className(v) { el.classes = new Set(v.split(/\s+/).filter(Boolean)); },
      classList: { toggle: (c, on) => { on ? el.classes.add(c) : el.classes.delete(c); }, contains: c => el.classes.has(c) },
      get innerHTML() { return el._html; }, set innerHTML(v) { el._html = String(v); el.children = parse(String(v)); },
      setAttribute: (k, v) => { el.attrs[k] = String(v); }, getAttribute: k => el.attrs[k] ?? null,
      append: (...kids) => { kids.forEach(k => { k.parent = el; }); el.children.push(...kids); }, remove() {},
      focus() { globalThis.document.activeElement = el; },
      closest(sel) { for (let n = el; n; n = n.parent) if (n.classes.has(sel.slice(1))) return n; return null; },
      addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: type => { delete listeners[type]; },
      fire: (type, event) => listeners[type]?.(event),
      querySelector: sel => el.querySelectorAll(sel)[0] ?? null,
      querySelectorAll: sel => all(el).filter(n => n !== el && n.classes.has(sel.slice(1))),
    };
    return el;
  };
  const all = el => [el, ...el.children.flatMap(all)];
  function parse(html) {
    const stack = [{ children: [] }];
    for (const m of html.matchAll(/<(\/?)([a-z]+)([^>]*)>/g)) {
      const [, close, tag, attrs] = m;
      if (close) { stack.pop(); continue; }
      const el = make(tag);
      const cls = /class="([^"]*)"/.exec(attrs);
      if (cls) el.className = cls[1];
      stack.at(-1).children.push(el);
      if (!attrs.trim().endsWith('/')) stack.push(el);
    }
    return stack[0].children;
  }
  return { createElement: make, activeElement: null };
}

test('the map marks exactly the three stage cells, and only from grade 3 on', () => {
  globalThis.document = fakeDocument();
  try {
    const host = globalThis.document.createElement('div');
    const mounted = square.mountField(host, {});
    const root = host.children[0];
    const cells = root.querySelectorAll('.square-cell');
    assert.equal(cells.length, 25);
    const marked = cells.filter(c => 'stage' in c.dataset).map(c => Number(c.dataset.cell));
    assert.deepEqual(marked, [BESIDE_STAGE, STAGE, UNDER_STAGE]);
    assert.deepEqual(marked.map(cellPosition).sort((a, b) => a.x - b.x || a.y - b.y), [...STAGE_CELLS].sort((a, b) => a.x - b.x || a.y - b.y));
    for (const grade of [0, 1, 2]) {
      const s = start(grade); mounted.update(s.state, s.ui);
      assert.equal(root.classList.contains('square-field--stage-marked'), false, `grade ${grade} does not mark the stage`);
    }
    for (const grade of [3, 4, 5]) {
      const s = start(grade); mounted.update(s.state, s.ui);
      assert.equal(root.classList.contains('square-field--stage-marked'), true, `grade ${grade} marks the stage`);
    }
    // Placed items draw in their cell; the aria name says where the cell is.
    let s = start(4); s = field(s, { tool: 'sign' }); s = field(s, { cell: BESIDE_STAGE });
    mounted.update(s.state, s.ui);
    assert.equal(cells[BESIDE_STAGE].dataset.item, 'sign');
    assert.match(cells[BESIDE_STAGE].getAttribute('aria-label'), /By the stage\.$/);
    mounted.destroy();
  } finally { delete globalThis.document; }
});

test('an arrow the grid cannot use (down on the bottom row) bubbles so the scene can focus the menu', () => {
  globalThis.document = fakeDocument();
  try {
    const host = globalThis.document.createElement('div');
    const dispatched = [];
    const mounted = square.mountField(host, { dispatch: a => dispatched.push(a) });
    const root = host.children[0];
    const cells = root.querySelectorAll('.square-cell');
    const s = start(3); mounted.update(s.state, s.ui);
    const press = (target, key) => { const e = { key, target, prevented: false, preventDefault() { e.prevented = true; } }; root.fire('keydown', e); return e; };
    // Four downs from the top-left reach the bottom row, each one taken by the grid.
    for (let i = 0; i < 4; i++) assert.equal(press(cells[i * 5], 'ArrowDown').prevented, true);
    assert.equal(globalThis.document.activeElement, cells[20]);
    assert.equal(cells[20].tabIndex, 0); assert.equal(cells[0].tabIndex, -1);
    // A fifth down has nowhere to go: left alone so the scene's own handler moves focus to the menu.
    assert.equal(press(cells[20], 'ArrowDown').prevented, false);
    // Up on the top row and left on the first column stay inside the field (nothing scrolls).
    assert.equal(press(cells[0], 'ArrowUp').prevented, true);
    assert.equal(press(cells[20], 'ArrowLeft').prevented, true);
    // The tool rail: right/down moves to the next tool and picks it; down on the last tool bubbles.
    const tools = root.querySelectorAll('.square-tool');
    assert.equal(press(tools[0], 'ArrowDown').prevented, true);
    assert.deepEqual(dispatched.at(-1), { type: 'field', tool: 'sign' });
    assert.equal(press(tools[3], 'ArrowDown').prevented, false);
    mounted.destroy();
  } finally { delete globalThis.document; }
});

test('all square cell labels use short sentences and describe unchanged items accurately', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const host = document.createElement('div'), mounted = square.mountField(host, {});
    const cells = host.children[0].querySelectorAll('.square-cell');
    const base = start(1).state;
    let longest = '';
    for (const tool of ['bench', 'quiet', 'sign', 'remove']) for (const item of ['', 'bench', 'quiet', 'sign']) {
      const placements = item ? Array.from({ length: 25 }, (_, i) => ({ item, ...cellPosition(i) })) : [];
      mounted.update({ ...base, placements }, { tool });
      for (const [i, cell] of cells.entries()) {
        const label = cell.getAttribute('aria-label');
        if (label.length > longest.length) longest = label;
        for (const sentence of label.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) {
          assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
        }
        assert.match(label, new RegExp(`Row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}\\.`));
        if (item === tool) {
          assert.doesNotMatch(label, /Replace/);
          assert.match(label, /^(Quiet garden|Bench|Sign) here\./);
        }
      }
    }
    assert.equal(longest, 'Replace quiet garden with bench. Row 1, column 1. By the quiet trees.');
    mounted.update({ ...base, placements: [{ item: 'quiet', ...cellPosition(0) }] }, { tool: 'quiet' });
    assert.equal(cells[0].getAttribute('aria-label'), 'Quiet garden here. Row 1, column 1. By the quiet trees.');
    mounted.destroy();
  } finally { globalThis.document = previous; }
});
