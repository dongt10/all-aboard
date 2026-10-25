import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import banner, { stampPosition, stampAt, BANNER_SHAPES, BANNER_LINES } from '../src/ui/activities/banner.js';
import { cleanCreation } from '../src/progress.js';

const field = (s, action, grade) => banner.act(s.state, s.ui, { type: 'field', ...action }, grade);
const cmd = (s, id, grade = 1) => banner.act(s.state, s.ui, { type: 'command', id }, grade);
const sentences = text => text.split(/(?<=[.!?])\s+/).filter(Boolean);

test('stamps land on the tapped cell with the chosen paint, shape and turn', () => {
  let s = banner.start(null, { chapter: 1, grade: 1 });
  s = field(s, { color: '#559fc7' }, 1); s = field(s, { shape: 'leaf' }, 1);
  s = cmd(s, 'turn');
  s = field(s, { cell: 29 }, 1);
  const [stamp] = s.state.stamps;
  assert.deepEqual([stamp.shape, stamp.color, stamp.rotation, stamp.y], ['leaf', '#559fc7', 45, 90]);
  assert.ok(Math.abs(stamp.x - 91.63) < 1e-6);
  assert.deepEqual(stampPosition(0), { x: 8.33, y: 10 });
});
test('the cloth holds thirty stamps', () => {
  let s = banner.start(null, { chapter: 0, grade: 0 });
  for (let i = 0; i < 31; i++) s = field(s, { cell: i % 30 }, 0);
  assert.equal(s.state.stamps.length, 30);
  // The 31st tap hits cell 0 again, so it swaps that stamp rather than refusing.
  assert.equal(s.line, BANNER_LINES.stamped);
  s = field(s, { color: '#6dbea0' }, 0);
  s = field(s, { cell: 5 }, 0);
  assert.equal(s.state.stamps.length, 30);
  assert.equal(s.state.stamps[stampAt(s.state, 5)].color, '#6dbea0');
});
test('turning cycles in 45° steps, fill paints the cloth, and undo needs something to undo', () => {
  let s = banner.start(null, { chapter: 1, grade: 5 });
  assert.equal(banner.commands(s.state, s.ui, 5)[0].disabled, true);
  for (let i = 0; i < 8; i++) s = cmd(s, 'turn', 5);
  assert.equal(s.ui.rotation, 0);
  assert.equal(s.line, 'Turned.');
  s = cmd(s, 'fill', 5);
  assert.equal(s.state.background, '#e96163');
  assert.deepEqual(BANNER_SHAPES, ['star', 'flower', 'leaf', 'circle']);
});

// The contract details the encounter frame leans on.
test('the banner names itself and opens with Yuki', () => {
  const s = banner.start(null, { chapter: 1, grade: 2 });
  assert.equal(banner.kind, 'art'); assert.equal(banner.title, 'Your colors, flying high');
  assert.deepEqual(banner.help, ['Pick a paint and a stamp.', 'Tap the cloth to stamp it.', 'Turn, Fill cloth or Undo any time.', 'Choose Hang banner.']);
  assert.equal(banner.notReadyLine, 'Nothing on the cloth yet.');
  assert.deepEqual(s.ui, { color: '#e96163', shape: 'star', rotation: 0, history: [] });
  assert.deepEqual([s.state.kind, s.state.grade, s.state.chapter, s.state.background, s.state.stamps], ['art', 2, 1, '#fff1cf', []]);
  assert.equal(banner.opening(s.state, s.ui, 2), 'Tap the cloth to add a stamp.');
});
test('commands: Turn carries no number, and the finish is last, shown from the start and disabled until a stamp lands', () => {
  let s = banner.start(null, { chapter: 1, grade: 3 });
  const list = banner.commands(s.state, s.ui, 3);
  assert.deepEqual(list.map(c => [c.id, c.icon, c.label]), [['undo', 'undo', 'Undo'], ['turn', 'turn', 'Turn'], ['fill', 'fill', 'Fill cloth'], ['finish', 'check', 'Hang banner']]);
  assert.deepEqual([list[3].finish, list[3].disabled], [true, true]);
  for (const c of list) assert.ok(c.label.length <= 12 && c.icon, `${c.label} is short and pictured`);
  for (let i = 0; i < 7; i++) s = cmd(s, 'turn', 3);
  assert.equal(s.ui.rotation, 315);
  assert.equal(banner.commands(s.state, s.ui, 3)[1].label, 'Turn');
  s = field(s, { cell: 3 }, 3);
  const ready = banner.commands(s.state, s.ui, 3);
  assert.deepEqual([ready[0].disabled, ready[3].disabled], [false, false]);
});
test('every pick and command speaks a short line a dialogue page can hold', () => {
  const s0 = banner.start(null, { chapter: 1, grade: 1 });
  assert.equal(field(s0, { color: '#e96163' }, 1).line, 'Coral paint.');
  assert.equal(field(s0, { color: '#9d7fbd' }, 1).line, 'Lavender paint.');
  assert.equal(field(s0, { shape: 'star' }, 1).line, 'Star stamp.');
  assert.equal(field(s0, { shape: 'flower' }, 1).line, 'Flower stamp.');
  assert.equal(cmd(s0, 'turn').line, 'Turned.');
  assert.equal(cmd(field(s0, { color: '#9d7fbd' }, 1), 'fill').line, 'The cloth is Lavender now.');
  assert.equal(cmd(field(s0, { cell: 1 }, 1), 'undo').line, 'Undone. Nothing on the cloth yet.');
  assert.equal(cmd(field(field(s0, { cell: 1 }, 1), { cell: 2 }, 1), 'undo').line, 'Undone.');
  const lines = [BANNER_LINES.stamped, BANNER_LINES.turned, BANNER_LINES.undone, BANNER_LINES.notReady, banner.notReadyLine,
    ...banner.help, BANNER_LINES.paint('#9d7fbd'), BANNER_LINES.stamp('flower'), BANNER_LINES.filled('#9d7fbd'),
    'The cloth has 30 stamps. Undo one to make room, or hang your banner.'];
  for (const line of lines) for (const sentence of sentences(line)) assert.ok(sentence.length <= 56, `"${sentence}" fits a Bigger-words page`);
});
test('stamping, undo and fill speak the brief lines and stay pure', () => {
  const s0 = banner.start(null, { chapter: 1, grade: 1 });
  const s1 = field(s0, { cell: 7 }, 1);
  assert.equal(s1.line, 'Keep stamping, or hang your banner.');
  assert.equal(s0.state.stamps.length, 0);
  assert.deepEqual(s1.state.stamps[0], { shape: 'star', color: '#e96163', rotation: 0, ...stampPosition(7) });
  const s2 = cmd(s1, 'undo');
  assert.equal(s2.state.stamps.length, 0); assert.equal(s1.state.stamps.length, 1);
  const painted = cmd(field(s0, { color: '#9d7fbd' }, 1), 'fill');
  assert.equal(painted.line, 'The cloth is Lavender now.');
  assert.equal(s0.state.background, '#fff1cf');
});
test('tapping an occupied cell swaps the stamp instead of stacking', () => {
  let s = banner.start(null, { chapter: 0, grade: 0 });
  s = field(s, { cell: 8 }, 0);
  s = field(s, { cell: 9 }, 0);
  s = field(s, { color: '#559fc7' }, 0); s = field(s, { shape: 'circle' }, 0);
  s = field(s, { cell: 8 }, 0);
  assert.equal(s.state.stamps.length, 2);
  assert.deepEqual([s.state.stamps[1].shape, s.state.stamps[1].color, s.state.stamps[0].shape], ['circle', '#559fc7', 'star']);
  assert.equal(stampAt(s.state, 8), 1); assert.equal(stampAt(s.state, 9), 0); assert.equal(stampAt(s.state, 10), -1);
  // Undo brings the old stamp back.
  s = cmd(s, 'undo', 0);
  assert.deepEqual([s.state.stamps.length, s.state.stamps[0].shape, s.state.stamps[0].color], [2, 'star', '#e96163']);
});
test('undo reverses Fill cloth too, in order, and the history stays in ui', () => {
  let s = banner.start(null, { chapter: 1, grade: 2 });
  s = field(s, { cell: 0 }, 2);
  s = field(s, { color: '#6dbea0' }, 2);
  s = cmd(s, 'fill', 2);
  assert.equal(s.state.background, '#6dbea0');
  assert.equal(s.ui.history.length, 2);
  assert.equal(banner.commands(s.state, s.ui, 2)[0].disabled, false);
  // Filling with the same paint again changes nothing and adds no history.
  const same = cmd(s, 'fill', 2);
  assert.equal(same.state, s.state); assert.equal(same.ui.history.length, 2); assert.equal(same.line, 'The cloth is Mint now.');
  s = cmd(s, 'undo', 2);
  assert.deepEqual([s.state.background, s.state.stamps.length, s.line], ['#fff1cf', 1, 'Undone.']);
  s = cmd(s, 'undo', 2);
  assert.deepEqual([s.state.stamps.length, s.ui.history.length, s.line], [0, 0, 'Undone. Nothing on the cloth yet.']);
  assert.equal(banner.commands(s.state, s.ui, 2)[0].disabled, true);
  assert.equal(cmd(s, 'undo', 2).state, s.state);
  assert.ok(!('history' in s.state), 'history never enters the saved snapshot');
});
test('a fresh cloth can be filled and that fill undone', () => {
  let s = banner.start(null, { chapter: 0, grade: 0 });
  s = field(s, { color: '#f4bf4f' }, 0);
  s = cmd(s, 'fill', 0);
  assert.equal(banner.commands(s.state, s.ui, 0)[0].disabled, false);
  assert.equal(banner.commands(s.state, s.ui, 0)[3].disabled, true, 'a filled cloth with no stamp is not ready');
  s = cmd(s, 'undo', 0);
  assert.equal(s.state.background, '#fff1cf');
  assert.equal(s.line, 'Undone. Nothing on the cloth yet.');
});
test('unknown picks and spare commands leave the state untouched', () => {
  const s = banner.start(null, { chapter: 1, grade: 1 });
  for (const action of [{ color: '#000000' }, { shape: 'heart' }, { cell: 30 }, { cell: -1 }, { cell: 2.5 }]) {
    const next = field(s, action, 1);
    assert.equal(next.state, s.state); assert.deepEqual(next.ui, s.ui);
  }
  assert.equal(cmd(s, 'undo').state, s.state);
  assert.equal(cmd(s, 'finish').state, s.state);
  assert.equal(field(s, { color: '#6dbea0' }, 1).state, s.state);
});
test('a saved banner comes back as it was, and Undo still lifts its last stamp', () => {
  const snapshot = { kind: 'art', background: '#f4bf4f', stamps: [{ shape: 'flower', color: '#6dbea0', x: 25, y: 30, rotation: 90 }, { shape: 'star', color: '#e96163', x: 8.33, y: 10, rotation: 0 }] };
  const s = banner.start(snapshot, { chapter: 1, grade: 4 });
  assert.equal(s.state.background, '#f4bf4f'); assert.equal(s.state.stamps.length, 2);
  assert.deepEqual(s.ui.history, []);
  assert.equal(banner.commands(s.state, s.ui, 4)[3].disabled, false);
  assert.equal(banner.commands(s.state, s.ui, 4)[0].disabled, false);
  const undone = cmd(s, 'undo', 4);
  assert.deepEqual([undone.state.stamps.length, undone.state.stamps[0].shape, undone.line], [1, 'flower', 'Undone.']);
  // A saved stamp on cell 0 is found again, so tapping cell 0 swaps it.
  assert.equal(stampAt(s.state, 0), 1);
  const swapped = field(s, { cell: 0 }, 4);
  assert.equal(swapped.state.stamps.length, 2); assert.equal(swapped.state.stamps[1].color, '#e96163');
});

test('resumed Undo lifts the last replacement and keeps the untouched cell at grades K–2', () => {
  for (const grade of [0, 1, 2]) {
    const scope = { grade, chapter: grade === 0 ? 0 : 1 };
    let s = banner.start(null, scope);
    s = field(s, { cell: 0 }, grade);
    s = field(s, { cell: 1 }, grade);
    const before = s;
    s = field(field(s, { shape: 'flower' }, grade), { cell: 0 }, grade);
    assert.equal(s.state.stamps[stampAt(s.state, 0)].shape, 'flower');
    assert.deepEqual(cmd(s, 'undo', grade).state, before.state, 'live history restores the replaced stamp');
    s = banner.start(JSON.parse(JSON.stringify(cleanCreation('art', s.state))), scope);
    assert.deepEqual(s.ui.history, []);
    s = cmd(s, 'undo', grade);
    assert.equal(stampAt(s.state, 0), -1, 'the most recently edited cell is undone');
    assert.equal(s.state.stamps[stampAt(s.state, 1)].shape, 'star', 'the older untouched cell remains');
  }
});
test('a stacked save from earlier today: a tap swaps the stamp on top, the one the kid can see', () => {
  const under = { shape: 'leaf', color: '#6dbea0', rotation: 0, ...stampPosition(0) };
  const over = { shape: 'circle', color: '#9d7fbd', rotation: 90, ...stampPosition(0) };
  const s = banner.start({ kind: 'art', background: '#fff1cf', stamps: [under, over, { shape: 'star', color: '#e96163', rotation: 0, ...stampPosition(4) }] }, { chapter: 1, grade: 2 });
  assert.equal(s.state.stamps.length, 3);
  assert.equal(stampAt(s.state, 0), 1, 'the last stamp drawn on the cell is the one found');
  const next = field(s, { cell: 0 }, 2);
  assert.equal(next.line, BANNER_LINES.stamped);
  assert.deepEqual(next.state.stamps[0], under, 'the hidden stamp stays where it was');
  assert.equal(stampAt(next.state, 0), 2);
  assert.deepEqual([next.state.stamps[2].shape, next.state.stamps[2].color, next.state.stamps[2].rotation], ['star', '#e96163', 0]);
  assert.equal(next.ui.history.length, 1);
});
test('the very same stamp on the same cell changes nothing and leaves Undo nothing to take back', () => {
  let s = banner.start(null, { chapter: 1, grade: 1 });
  s = field(s, { cell: 12 }, 1);
  const again = field(s, { cell: 12 }, 1);
  assert.equal(again.state, s.state, 'no new state');
  assert.equal(again.ui.history.length, 1, 'no new history entry');
  assert.equal(again.line, BANNER_LINES.stamped);
  // A different turn on the same cell is a real change again.
  const turned = field(cmd(s, 'turn'), { cell: 12 }, 1);
  assert.notEqual(turned.state, s.state);
  assert.equal(turned.state.stamps[0].rotation, 45);
  assert.equal(turned.ui.history.length, 2);
});
test('a full cloth from a stacked save refuses a 31st stamp and says why', () => {
  const stamps = Array.from({ length: 30 }, (_, i) => ({ shape: 'star', color: '#e96163', rotation: 0, ...stampPosition(i % 3) }));
  const s = banner.start({ kind: 'art', background: '#fff1cf', stamps }, { chapter: 0, grade: 0 });
  assert.equal(s.state.stamps.length, 30);
  const refused = field(s, { cell: 20 }, 0);
  assert.equal(refused.state, s.state);
  assert.equal(refused.line, 'The cloth has 30 stamps. Undo one to make room, or hang your banner.');
  // A tap on a taken cell still swaps, so the kid is never stuck.
  const swapped = field(field(s, { shape: 'leaf' }, 0), { cell: 1 }, 0);
  assert.equal(swapped.state.stamps.length, 30);
  assert.equal(swapped.state.stamps[stampAt(swapped.state, 1)].shape, 'leaf');
});
test('field stamps wear the ink outline and the turn chip holds no number', () => {
  const css = readFileSync(new URL('../src/ui/activities/banner.css', import.meta.url), 'utf8');
  assert.match(css, /\.banner-stamp\s*\{[^}]*shape-rendering:\s*crispEdges/);
  assert.match(css, /\.banner-option__turn\s*\{/);
  assert.match(css, /\.banner-option__turn:empty\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.banner-option__turn\s*\{[^}]*font/, 'the chip is a picture, not text');
  const js = readFileSync(new URL('../src/ui/activities/banner.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(js, /°/, 'the visible turn chip holds no degree text');
});

// A few lines of fake DOM so the field can be mounted without a browser (the story test's pattern, plus
// dataset, style, listeners and focus, which the banner field uses).
function fakeDocument() {
  const focused = { el: null };
  const make = tag => {
    const el = {
      tagName: tag, children: [], attrs: {}, classes: new Set(), dataset: {}, style: {}, listeners: {}, _text: '', _html: '', tabIndex: 0,
      get className() { return [...el.classes].join(' '); }, set className(v) { el.classes = new Set(v.split(/\s+/).filter(Boolean)); },
      get textContent() { return el._text; }, set textContent(v) { el._text = String(v); el.children = []; },
      get innerHTML() { return el._html; }, set innerHTML(v) { el._html = String(v); el.children = parse(String(v)); },
      setAttribute: (k, v) => { el.attrs[k] = String(v); }, getAttribute: k => el.attrs[k] ?? null,
      append: (...kids) => el.children.push(...kids), remove() {},
      querySelector: sel => el.querySelectorAll(sel)[0] ?? null,
      querySelectorAll: sel => all(el).filter(n => n !== el && n.classes.has(sel.slice(1))),
      addEventListener: (type, fn) => { el.listeners[type] = fn; }, removeEventListener: type => { delete el.listeners[type]; },
      contains: node => all(el).includes(node), closest: sel => (sel === 'button' && el.tagName === 'button' ? el : null),
      focus: () => { focused.el = el; },
    };
    return el;
  };
  const all = el => [el, ...el.children.flatMap(all)];
  function parse(html) {
    const stack = [{ children: [] }];
    for (const m of html.matchAll(/<(\/?)([a-z]+)([^>]*)>([^<]*)/g)) {
      const [, close, tag, attrs, text] = m;
      if (close) { if (stack.length > 1) stack.pop(); if (text.trim()) stack.at(-1).children.at(-1)._text += text; continue; }
      const el = make(tag);
      const cls = /class="([^"]*)"/.exec(attrs);
      if (cls) el.className = cls[1];
      el._text = text;
      stack.at(-1).children.push(el);
      stack.push(el);
    }
    return stack[0].children;
  }
  return { createElement: make, focused };
}

test('cloth cells describe empty spaces and the top stamp after replacing, undoing and reopening', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const host = document.createElement('div');
    const view = banner.mountField(host, { dispatch() {} });
    const cells = host.querySelector('.banner-grid').children;
    let s = banner.start(null, { grade: 1 });
    view.update(s.state, s.ui);
    assert.equal(cells[0].getAttribute('aria-label'), 'Row 1, column 1. Empty. Tap to stamp.');
    s = field(s, { cell: 0 });
    s = field(s, { shape: 'leaf' });
    s = field(s, { color: '#6dbea0' });
    s = cmd(s, 'turn');
    s = field(s, { cell: 1 });
    view.update(s.state, s.ui);
    assert.equal(cells[0].getAttribute('aria-label'), 'Row 1, column 1. Coral star, rotated 0 degrees. Tap to replace.');
    assert.equal(cells[1].getAttribute('aria-label'), 'Row 1, column 2. Mint leaf, rotated 45 degrees. Tap to replace.');
    const before = s;
    s = field(s, { cell: 0 });
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Mint leaf, rotated 45 degrees/);
    s = cmd(s, 'undo');
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Coral star, rotated 0 degrees/);
    // Old saves can stack stamps; announce the one drawn on top.
    const stacked = { ...before.state, stamps: [...before.state.stamps, { ...before.state.stamps[1], ...stampPosition(0) }] };
    s = banner.start(stacked, { grade: 1 });
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Mint leaf, rotated 45 degrees/);
    view.destroy();
  } finally { globalThis.document = previous; }
});

test('the field draws outlined stamps, marks the turned preview without a number, and taps dispatch cells', () => {
  globalThis.document = fakeDocument();
  try {
    const dispatched = [];
    const host = globalThis.document.createElement('div');
    const mounted = banner.mountField(host, { dispatch: a => dispatched.push(a) });
    const root = host.children[0];
    let s = banner.start(null, { chapter: 1, grade: 1 });
    mounted.update(s.state, s.ui);
    const unturned = root.querySelector('.banner-shape-pic').innerHTML;
    s = cmd(s, 'turn'); s = field(s, { cell: 7 }, 1);
    mounted.update(s.state, s.ui);

    const layer = root.querySelector('.banner-stamps');
    assert.match(layer.innerHTML, /class="banner-stamp"/, 'field stamps carry the outlined class');
    assert.match(layer.innerHTML, /shape-rendering="crispEdges"/);
    assert.match(layer.innerHTML, /fill="#1f2147"/, 'the closed pixel outline is ink');
    assert.equal(layer.getAttribute('aria-label'), 'Your banner, Cream cloth, 1 stamp');

    const options = root.querySelector('.banner-shapes').children;
    const star = options.find(b => b.dataset.value === 'star'), flower = options.find(b => b.dataset.value === 'flower');
    assert.equal(star.getAttribute('aria-checked'), 'true');
    assert.equal(star.getAttribute('aria-label'), 'Star, turned');
    assert.equal(flower.getAttribute('aria-label'), 'Flower');
    const chip = star.querySelector('.banner-option__turn');
    assert.match(chip.innerHTML, /class="icon"/, 'the chip is the turn arrow');
    assert.doesNotMatch(chip.innerHTML.replace(/<[^>]*>/g, ''), /\d|°/, 'no number on the chip');
    assert.equal(chip.style.transform, 'rotate(45deg)');
    assert.equal(flower.querySelector('.banner-option__turn').innerHTML, '');
    const turned = star.querySelector('.banner-shape-pic').innerHTML;
    assert.notEqual(turned, unturned, 'Turn changes the pixels of the preview');
    assert.ok(layer.innerHTML.includes(turned), 'the cloth stamp has the same turn as its preview');
    assert.doesNotMatch(turned, /transform:|<circle|<path/, 'turned pixels stay on the grid instead of rotating in CSS');

    // Back at 0° the chip empties again.
    let back = s; for (let i = 0; i < 7; i++) back = cmd(back, 'turn');
    mounted.update(back.state, back.ui);
    assert.equal(chip.innerHTML, ''); assert.equal(chip.style.transform, ''); assert.equal(star.getAttribute('aria-label'), 'Star');
    assert.equal(star.querySelector('.banner-shape-pic').innerHTML, unturned, 'eight turns restore the original pixels');

    // Tapping a cell dispatches it and moves the roving focus there.
    const cells = root.querySelector('.banner-grid').children;
    root.listeners.click({ target: cells[13] });
    assert.deepEqual(dispatched.at(-1), { type: 'field', cell: 13 });
    assert.equal(globalThis.document.focused.el, cells[13]); assert.equal(cells[13].tabIndex, 0); assert.equal(cells[0].tabIndex, -1);
    // Paint and stamp picks dispatch too.
    const pot = root.querySelector('.banner-paints').children[2];
    root.listeners.click({ target: pot });
    assert.deepEqual(dispatched.at(-1), { type: 'field', color: pot.dataset.value });
    assert.equal(pot.dataset.value, '#6dbea0', 'the third pot is Mint');
    root.listeners.click({ target: flower });
    assert.deepEqual(dispatched.at(-1), { type: 'field', shape: 'flower' });

    // Arrow keys: right from the cloth's last column lands on the chosen stamp; down on a rail picks the next option.
    let prevented = 0;
    const key = (target, k) => root.listeners.keydown({ target, key: k, preventDefault: () => prevented++, stopPropagation() {} });
    key(cells[13], 'ArrowRight'); key(cells[14], 'ArrowRight'); key(cells[15], 'ArrowRight'); key(cells[16], 'ArrowRight');
    assert.equal(globalThis.document.focused.el, cells[17]);
    key(cells[17], 'ArrowRight');
    assert.equal(globalThis.document.focused.el, star, 'past the last column the chosen stamp takes focus');
    key(star, 'ArrowDown');
    assert.equal(globalThis.document.focused.el, flower);
    assert.deepEqual(dispatched.at(-1), { type: 'field', shape: 'flower' });
    assert.ok(prevented >= 6);
    root.listeners.click({ target: cells[2] });
    key(cells[2], 'ArrowUp');
    assert.equal(globalThis.document.focused.el, cells[2], 'the cloth\'s top edge leaves the key to the frame');

    mounted.destroy();
    assert.deepEqual(root.listeners, {});
  } finally { delete globalThis.document; }
});
