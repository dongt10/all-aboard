import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import banner, { stampPosition, stampAt, BANNER_SHAPES, BANNER_LINES } from '../src/ui/activities/banner.js';
import { cleanCreation } from '../src/progress.js';
import { creationMarkup } from '../src/ui/creations.js';
import { Doc, Event } from './helpers/dom.js';
import { controlStyle, declarations } from './helpers/css.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { PATTERN_CELLS, expectedAt, bannerHelp, bannerReady, BANNER_RULE_LINES } from '../src/banner-rules.js';

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
  assert.deepEqual(banner.help, bannerHelp(1));
  assert.equal(banner.helpFor, bannerHelp);
  assert.equal(banner.notReadyLine, 'Nothing on the cloth yet.');
  assert.deepEqual(s.ui, { color: '#e96163', shape: 'star', rotation: 0, flipped: false, history: [] });
  assert.deepEqual([s.state.kind, s.state.grade, s.state.chapter, s.state.background, s.state.stamps], ['art', 2, 1, '#fff1cf', []]);
  assert.equal(banner.opening(s.state, s.ui, 2), BANNER_RULE_LINES.openingPattern);
});
test('commands: Turn carries no number, and the finish waits for four mirror stamps at grade 3', () => {
  let s = banner.start(null, { chapter: 1, grade: 3 });
  const list = banner.commands(s.state, s.ui, 3);
  assert.deepEqual(list.map(c => [c.id, c.icon, c.label]), [['undo', 'undo', 'Undo'], ['turn', 'turn', 'Turn'], ['fill', 'fill', 'Fill cloth'], ['finish', 'check', 'Hang banner']]);
  assert.deepEqual([list[3].finish, list[3].disabled], [true, true]);
  for (const c of list) assert.ok(c.label.length <= 12 && c.icon, `${c.label} is short and pictured`);
  for (let i = 0; i < 7; i++) s = cmd(s, 'turn', 3);
  assert.equal(s.ui.rotation, 315);
  assert.equal(banner.commands(s.state, s.ui, 3)[1].label, 'Turn');
  s = field(s, { cell: 3 }, 3);
  assert.equal(banner.commands(s.state, s.ui)[3].disabled, true);
  s = field(s, { flipped: true }); s = field(s, { cell: 2 }, 3);
  s = field(s, { flipped: false }); s = field(s, { cell: 6 }, 3);
  s = field(s, { flipped: true }); s = field(s, { cell: 11 }, 3);
  const ready = banner.commands(s.state, s.ui, 3);
  assert.deepEqual([ready[0].disabled, ready[3].disabled], [false, false]);
});
test('every pick and command speaks a short line a dialogue page can hold', () => {
  const s0 = banner.start(null, { chapter: 1, grade: 0 });
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
  const s0 = banner.start(null, { chapter: 1, grade: 0 });
  const s1 = field(s0, { cell: 7 }, 1);
  assert.equal(s1.line, 'Keep stamping, or hang your banner.');
  assert.equal(s0.state.stamps.length, 0);
  assert.deepEqual(s1.state.stamps[0], { shape: 'star', color: '#e96163', rotation: 0, flipped: false, ...stampPosition(7) });
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
  s = field(s, { cell: 6 }, 2);
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
  assert.deepEqual([s.state.stamps.length, s.ui.history.length, s.line], [0, 0, 'Undone.']);
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
  assert.equal(banner.commands(s.state, s.ui, 4)[3].disabled, true);
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
    s = field(s, { cell: 6 }, grade);
    s = field(s, { cell: 7 }, grade);
    const before = s;
    s = field(field(s, { shape: 'flower' }, grade), { cell: 6 }, grade);
    assert.equal(s.state.stamps[stampAt(s.state, 6)].shape, 'flower');
    assert.deepEqual(cmd(s, 'undo', grade).state, before.state, 'live history restores the replaced stamp');
    s = banner.start(JSON.parse(JSON.stringify(cleanCreation('art', s.state))), scope);
    assert.deepEqual(s.ui.history, []);
    s = cmd(s, 'undo', grade);
    assert.equal(stampAt(s.state, 6), -1, 'the most recently edited cell is undone');
    assert.equal(s.state.stamps[stampAt(s.state, 7)].shape, 'star', 'the older untouched cell remains');
  }
});
test('a stacked save from earlier today: a tap swaps the stamp on top, the one the kid can see', () => {
  const under = { shape: 'leaf', color: '#6dbea0', rotation: 0, ...stampPosition(0) };
  const over = { shape: 'circle', color: '#9d7fbd', rotation: 90, ...stampPosition(0) };
  const s = banner.start({ kind: 'art', background: '#fff1cf', stamps: [under, over, { shape: 'star', color: '#e96163', rotation: 0, ...stampPosition(4) }] }, { chapter: 1, grade: 0 });
  assert.equal(s.state.stamps.length, 3);
  assert.equal(stampAt(s.state, 0), 1, 'the last stamp drawn on the cell is the one found');
  const next = field(s, { cell: 0 }, 2);
  assert.equal(next.line, BANNER_LINES.stamped);
  assert.deepEqual(next.state.stamps[0], { ...under, flipped: false }, 'the hidden stamp stays where it was');
  assert.equal(stampAt(next.state, 0), 2);
  assert.deepEqual([next.state.stamps[2].shape, next.state.stamps[2].color, next.state.stamps[2].rotation], ['star', '#e96163', 0]);
  assert.equal(next.ui.history.length, 1);
});
test('the very same stamp on the same cell changes nothing and leaves Undo nothing to take back', () => {
  let s = banner.start(null, { chapter: 1, grade: 0 });
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

test('cloth cells describe empty spaces and the top stamp after replacing, undoing and reopening', () => {
  const previous = globalThis.document;
  globalThis.document = new Doc();
  try {
    const host = document.createElement('div'); document.body.append(host);
    const view = banner.mountField(host, { dispatch() {} });
    const cells = host.querySelector('.banner-grid').children;
    let s = banner.start(null, { grade: 0 });
    view.update(s.state, s.ui);
    assert.equal(cells[0].getAttribute('aria-label'), 'Row 1, column 1. Empty. Tap to stamp.');
    s = field(s, { cell: 0 });
    s = field(s, { shape: 'leaf' });
    s = field(s, { color: '#6dbea0' });
    s = cmd(s, 'turn');
    s = field(s, { cell: 1 });
    view.update(s.state, s.ui);
    assert.equal(cells[0].getAttribute('aria-label'), 'Row 1, column 1. Coral star, rotated 0 degrees, plain. Tap to replace.');
    assert.equal(cells[1].getAttribute('aria-label'), 'Row 1, column 2. Mint leaf, rotated 45 degrees, plain. Tap to replace.');
    const before = s;
    s = field(s, { cell: 0 });
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Mint leaf, rotated 45 degrees/);
    s = cmd(s, 'undo');
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Coral star, rotated 0 degrees/);
    // Old saves can stack stamps; announce the one drawn on top.
    const stacked = { ...before.state, stamps: [...before.state.stamps, { ...before.state.stamps[1], ...stampPosition(0) }] };
    s = banner.start(stacked, { grade: 0 });
    view.update(s.state, s.ui);
    assert.match(cells[0].getAttribute('aria-label'), /Mint leaf, rotated 45 degrees/);
    view.destroy();
  } finally { globalThis.document = previous; }
});

test('the field draws outlined stamps, marks the turned preview without a number, and taps dispatch cells', () => {
  globalThis.document = new Doc();
  try {
    const dispatched = [];
    const host = globalThis.document.createElement('div'); document.body.append(host);
    const mounted = banner.mountField(host, { dispatch: a => dispatched.push(a) });
    const root = host.children[0];
    let s = banner.start(null, { chapter: 1, grade: 0 });
    mounted.update(s.state, s.ui);
    const unturned = root.querySelector('.banner-shape-pic').innerHTML;
    s = cmd(s, 'turn'); s = field(s, { cell: 7 }, 1);
    mounted.update(s.state, s.ui);

    const layer = root.querySelector('.banner-stamps');
    assert.match(layer.querySelectorAll('.banner-stamp-spot').filter(s => !s.hidden).map(s => s.innerHTML).join(''), /class="banner-stamp"/, 'field stamps carry the outlined class');
    assert.match(layer.querySelectorAll('.banner-stamp-spot').filter(s => !s.hidden).map(s => s.innerHTML).join(''), /shape-rendering="crispEdges"/);
    assert.match(layer.querySelectorAll('.banner-stamp-spot').filter(s => !s.hidden).map(s => s.innerHTML).join(''), /fill="#1f2147"/, 'the closed pixel outline is ink');
    assert.equal(layer.getAttribute('aria-label'), 'Your banner, Cream cloth, 1 stamp');

    const options = root.querySelector('.banner-shapes').children;
    const star = options.find(b => b.dataset.value === 'star'), flower = options.find(b => b.dataset.value === 'flower');
    assert.equal(star.getAttribute('aria-checked'), 'true');
    assert.equal(star.getAttribute('aria-label'), 'Star, turned, plain');
    assert.equal(flower.getAttribute('aria-label'), 'Flower, plain');
    const chip = star.querySelector('.banner-option__turn');
    assert.match(chip.innerHTML, /class="icon"/, 'the chip is the turn arrow');
    assert.doesNotMatch(chip.innerHTML.replace(/<[^>]*>/g, ''), /\d|°/, 'no number on the chip');
    assert.equal(chip.style.transform, 'rotate(45deg)');
    assert.equal(flower.querySelector('.banner-option__turn').innerHTML, '');
    const turned = star.querySelector('.banner-shape-pic').innerHTML;
    assert.notEqual(turned, unturned, 'Turn changes the pixels of the preview');
    assert.ok(layer.querySelectorAll('.banner-stamp-spot').some(s => !s.hidden && s.innerHTML === turned), 'the cloth stamp has the same turn as its preview');
    assert.doesNotMatch(turned, /transform:|<circle|<path/, 'turned pixels stay on the grid instead of rotating in CSS');

    // Back at 0° the chip empties again.
    let back = s; for (let i = 0; i < 7; i++) back = cmd(back, 'turn');
    mounted.update(back.state, back.ui);
    assert.equal(chip.innerHTML, ''); assert.equal(chip.style.transform, ''); assert.equal(star.getAttribute('aria-label'), 'Star, plain');
    assert.equal(star.querySelector('.banner-shape-pic').innerHTML, unturned, 'eight turns restore the original pixels');

    // Tapping a cell dispatches it and moves the roving focus there.
    const cells = root.querySelector('.banner-grid').children;
    cells[13].click();
    assert.deepEqual(dispatched.at(-1), { type: 'field', cell: 13 });
    assert.equal(globalThis.document.activeElement, cells[13]); assert.equal(cells[13].tabIndex, 0); assert.equal(cells[0].tabIndex, -1);
    // Paint and stamp picks dispatch too.
    const pot = root.querySelector('.banner-paints').children[2];
    pot.click();
    assert.deepEqual(dispatched.at(-1), { type: 'field', color: pot.dataset.value });
    assert.equal(pot.dataset.value, '#6dbea0', 'the third pot is Mint');
    flower.click();
    assert.deepEqual(dispatched.at(-1), { type: 'field', shape: 'flower' });

    // Arrow keys: right from the cloth's last column lands on the chosen stamp; down on a rail picks the next option.
    let prevented = 0;
    const key = (target, k) => { const event = new Event('keydown', { key: k }); target.dispatchEvent(event); if (event.defaultPrevented) prevented++; };
    key(cells[13], 'ArrowRight'); key(cells[14], 'ArrowRight'); key(cells[15], 'ArrowRight'); key(cells[16], 'ArrowRight');
    assert.equal(globalThis.document.activeElement, cells[17]);
    key(cells[17], 'ArrowRight');
    assert.equal(globalThis.document.activeElement, star, 'past the last column the chosen stamp takes focus');
    key(star, 'ArrowDown');
    assert.equal(globalThis.document.activeElement, flower);
    assert.deepEqual(dispatched.at(-1), { type: 'field', shape: 'flower' });
    assert.ok(prevented >= 6);
    cells[2].click();
    key(cells[2], 'ArrowUp');
    assert.equal(globalThis.document.activeElement, cells[2], 'the cloth\'s top edge leaves the key to the frame');

    mounted.destroy();
    assert.ok(Object.values(root.listeners).every(list => list.length === 0));
    assert.equal(host.children.length, 0);
  } finally { delete globalThis.document; }
});

for (const grade of [1, 2]) test(`grade ${grade}: complete the pattern, reject a wrong stamp, and undo readiness`, () => {
  let s = banner.start(null, { chapter: 1, grade });
  const contract = () => {
    const commands = banner.commands(s.state, s.ui);
    assert.equal(commands.length, 4); assert.equal(new Set(commands.map(c => c.id)).size, 4);
    assert.equal(commands.filter(c => c.finish).length, 1); assert.equal(arrangeCommands(commands)[3], commands.at(-1));
    assert.equal(commands.at(-1).disabled, !bannerReady(s.state));
    assert.ok(commands.every(c => c.label.length <= 12 && ICON_NAMES.includes(c.icon)));
  };
  contract();
  Object.freeze(s.state.stamps); Object.freeze(s.state); Object.freeze(s.ui.history); Object.freeze(s.ui);
  for (const cell of [0, 1, 2]) {
    const refused = field(s, { cell }); assert.equal(refused.state, s.state); assert.equal(refused.ui, s.ui);
    assert.equal(refused.line, BANNER_RULE_LINES.yuki);
  }
  const wrong = field(s, { cell: 3 });
  assert.equal(wrong.state, s.state); assert.notEqual(wrong.ui, s.ui); assert.equal(wrong.line, BANNER_RULE_LINES.wrongShape);
  s = field(s, { cell: 8 }); assert.equal(s.line, BANNER_RULE_LINES.free);
  for (const cell of PATTERN_CELLS) {
    const expected = expectedAt(grade, cell);
    s = field(field(s, { color: expected.color }), { shape: expected.shape });
    s = cmd(s, 'turn'); s = field(s, { cell });
    assert.equal(s.line, cell === 5 ? BANNER_RULE_LINES.patternDone : BANNER_RULE_LINES.fits);
    contract();
  }
  assert.equal(bannerReady(s.state), true); assert.equal(s.state.stamps.length, 4, 'Yuki adds no saved stamps');
  const before = s.state;
  s = field(s, { shape: 'leaf' });
  const refused = field(s, { cell: 5 }); assert.equal(refused.state, before); assert.notEqual(refused.ui, s.ui);
  assert.equal(bannerReady(refused.state), true, 'a wrong replacement keeps the correct row');
  s = cmd(s, 'undo');
  assert.equal(s.line, `Undone. ${BANNER_RULE_LINES.patternAgain}`); assert.equal(bannerReady(s.state), false); contract();
});

for (const grade of [3, 4, 5]) test(`grade ${grade}: mirror feedback follows pairs, count, colors and undo`, () => {
  let s = banner.start(null, { grade, chapter: 1 });
  s = field(s, { cell: 6 }); assert.equal(s.line, BANNER_RULE_LINES.mirror);
  s = field(s, { cell: 11 }); assert.equal(s.line, grade === 3 ? BANNER_RULE_LINES.pair : BANNER_RULE_LINES.pairColors);
  for (const cell of [7, 10]) s = field(s, { cell });
  if (grade >= 4) {
    assert.equal(bannerReady(s.state), false);
    for (const cell of [12, 17]) s = field(s, { cell });
    assert.equal(s.line, BANNER_RULE_LINES.secondColor);
    s = field(s, { color: '#559fc7' }); s = field(s, { shape: 'circle' });
    s = field(s, { cell: 12 }); assert.equal(s.line, BANNER_RULE_LINES.mirror);
    s = field(s, { cell: 17 });
  }
  assert.equal(s.line, BANNER_RULE_LINES.mirrorDone); assert.equal(banner.commands(s.state, s.ui).at(-1).disabled, false);
  const reopened = banner.start(cleanCreation('art', s.state), { grade, chapter: 1 });
  assert.deepEqual(reopened.state, s.state); assert.equal(banner.opening(reopened.state), BANNER_RULE_LINES.readyOpening);
  s = cmd(s, 'undo');
  assert.equal(s.line, `Undone. ${BANNER_RULE_LINES.mirrorAgain}`); assert.equal(bannerReady(s.state), false);
});

test('mounted banner keeps controls and stamp slots, shows Yuki tags and updates mirror outlines', () => {
  const previous = globalThis.document, doc = new Doc(); globalThis.document = doc;
  try {
    const host = doc.createElement('div'); doc.body.append(host);
    let s = banner.start(null, { grade: 1, chapter: 1 });
    const view = banner.mountField(host, { dispatch: action => { s = banner.act(s.state, s.ui, action); view.update(s.state, s.ui); } });
    view.update(s.state, s.ui);
    const cells = host.querySelectorAll('.banner-cell'), spots = host.querySelectorAll('.banner-stamp-spot');
    assert.equal(host.querySelectorAll('.banner-stamp-spot--yuki').filter(spot => !spot.hidden).length, 3);
    assert.equal(cells[0].getAttribute('aria-label'), 'Row 1, column 1. Yuki’s Coral star. Part of the pattern.');
    assert.ok(cells.slice(0, 3).every(cell => cell.classList.contains('banner-cell--yuki')));
    cells[0].click(); assert.equal(s.state.stamps.length, 0); assert.equal(s.line, BANNER_RULE_LINES.yuki);
    assert.equal(host.querySelector('.banner-fold').hidden, true);
    s = banner.start(null, { grade: 3, chapter: 1 });
    s = field(s, { cell: 6 }); view.update(s.state, s.ui);
    assert.equal(host.querySelector('.banner-fold').hidden, false);
    assert.ok(cells[6].classList.contains('banner-cell--lonely')); assert.match(cells[6].getAttribute('aria-label'), /Needs its mirror\./);
    assert.ok(cells.every(cell => !cell.classList.contains('banner-cell--yuki')));
    s = field(s, { cell: 11 }); view.update(s.state, s.ui);
    assert.ok(cells.every(cell => !cell.classList.contains('banner-cell--lonely')));
    assert.deepEqual(host.querySelectorAll('.banner-cell'), cells); assert.deepEqual(host.querySelectorAll('.banner-stamp-spot'), spots);
    cells[24].click(); const down = new Event('keydown', { key: 'ArrowDown' }); cells[24].dispatchEvent(down);
    assert.equal(down.defaultPrevented, false, 'bottom edge can reach the menu');
    view.destroy(); assert.equal(host.children.length, 0);
  } finally { globalThis.document = previous; }
});

test('banner names keep the small font token and its grade cues add no text width', () => {
  const css = readFileSync(new URL('../src/ui/activities/banner.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  assert.equal(declarations(css, '.banner-field').width, '520px'); assert.equal(declarations(css, '.banner-field').height, '268px');
  assert.equal(declarations(css, '.banner-fold').left, '50%');
  const tag = declarations(css, '.banner-stamp-spot--yuki::after'); assert.equal(tag.width, '4px'); assert.equal(tag.height, '4px');
  const doc = new Doc(), stage = doc.createElement('div'), button = doc.createElement('button');
  button.className = 'banner-option'; stage.append(button); doc.body.append(stage);
  for (const large of [false, true]) {
    stage.className = large ? 'large-text' : '';
    assert.equal(controlStyle(button, `${kit}\n${css}`)['font-size'], large ? '20px' : '16px');
  }
});

test('grade 1 can complete the shape pattern with blue circles and mixed paints', () => {
  let s = banner.start(null, { grade: 1, chapter: 1 });
  for (const [cell, shape, color] of [[3, 'circle', '#559fc7'], [4, 'star', '#6dbea0'], [5, 'circle', '#9d7fbd']]) {
    s = field(field(field(s, { shape }), { color }), { cell });
  }
  assert.equal(s.line, BANNER_RULE_LINES.patternDone);
  assert.equal(banner.commands(s.state, s.ui).at(-1).disabled, false);
  const reopened = banner.start(cleanCreation('art', s.state), { grade: 1, chapter: 1 });
  assert.deepEqual(reopened.state, s.state);
  assert.equal(bannerReady(reopened.state), true);
});

test('pattern retries name the mismatch then give an answer without changing the work', () => {
  for (const grade of [1, 2]) {
    let s = field(banner.start(null, { grade, chapter: 1 }), { cell: 8 });
    const before = s.state, history = s.ui.history;
    s = field(s, { cell: 3 });
    assert.equal(s.line, BANNER_RULE_LINES.wrongShape);
    s = field(s, { cell: 3 });
    assert.equal(s.line, grade === 1 ? 'Try a circle here.' : 'Try a flower here.');
    assert.equal(s.state, before); assert.equal(s.ui.history, history);
    assert.ok(s.line.length <= 56);
    s = field(s, { shape: expectedAt(grade, 3).shape });
    if (grade === 2) {
      s = field(s, { cell: 3 }); assert.equal(s.line, BANNER_RULE_LINES.wrongColor);
      s = field(s, { cell: 3 }); assert.equal(s.line, 'Try blue paint here.');
      assert.equal(s.state, before); assert.equal(s.ui.history, history);
      s = field(s, { color: '#559fc7' });
    }
    s = field(s, { cell: 3 });
    assert.equal(s.line, BANNER_RULE_LINES.fits); assert.equal(s.ui.patternHint, null);
    const placed = s.state;
    s = field(s, { shape: 'leaf' }); s = field(s, { cell: 3 });
    assert.equal(s.line, BANNER_RULE_LINES.wrongShape); assert.equal(s.state, placed);
    s = field(s, { cell: 5 });
    assert.equal(s.line, BANNER_RULE_LINES.wrongShape, 'a different position starts its own hint');
    s = cmd(s, 'undo'); assert.deepEqual(s.state, before, 'wrong tries add no undo steps');
  }
});

test('selected paint and stamp have a persistent non-color outline separate from focus', () => {
  const css = readFileSync(new URL('../src/ui/activities/banner.css', import.meta.url), 'utf8');
  const selected = declarations(css, '.banner-option[aria-checked="true"]');
  assert.equal(selected.outline, '2px solid var(--ink)');
  assert.equal(selected['outline-offset'], '-4px');
  assert.notEqual(declarations(css, '.banner-option:focus-visible')['outline-offset'], selected['outline-offset']);
  const previous = globalThis.document, doc = new Doc(); globalThis.document = doc;
  try {
    const host = doc.createElement('div'); doc.body.append(host);
    let s = banner.start(null, { grade: 1 });
    const view = banner.mountField(host, { dispatch: action => {
      s = banner.act(s.state, s.ui, action); view.update(s.state, s.ui);
    } });
    view.update(s.state, s.ui);
    for (const [rail, value] of [['banner-paints', '#559fc7'], ['banner-shapes', 'circle']]) {
      const options = host.querySelector(`.${rail}`).querySelectorAll('.banner-option');
      assert.equal(options.filter(b => b.getAttribute('aria-checked') === 'true').length, 1);
      const picked = options.find(b => b.dataset.value === value); picked.click();
      assert.deepEqual(options.filter(b => b.getAttribute('aria-checked') === 'true'), [picked]);
      assert.equal(picked.tabIndex, 0);
    }
    view.destroy();
  } finally { globalThis.document = previous; }
});

test('flipping replaces a stamp, survives saving and reopening, and undo restores it', () => {
  let s = banner.start(null, { grade: 3, chapter: 1 });
  s = field(s, { shape: 'leaf' }); s = field(s, { cell: 6 });
  s = field(s, { flipped: true }); s = field(s, { cell: 6 });
  assert.equal(s.state.stamps[0].flipped, true);
  const reopened = banner.start(cleanCreation('art', s.state), { grade: 3, chapter: 1 });
  assert.equal(reopened.state.stamps[0].flipped, true);
  s = cmd(s, 'undo'); assert.equal(s.state.stamps[0].flipped, false);
});

test('turned, flipped editor pixels match finished banner pixels and descriptions', () => {
  globalThis.document = new Doc();
  try {
    const host = document.createElement('div'); document.body.append(host);
    let s = banner.start(null, { chapter: 1, grade: 3 });
    const view = banner.mountField(host, { dispatch: action => { s = banner.act(s.state, s.ui, action); view.update(s.state, s.ui); } });
    view.update(s.state, s.ui);
    const flip = host.querySelector('.banner-flip');
    assert.ok(flip.classList.contains('banner-option'));
    flip.click(); assert.equal(flip.getAttribute('aria-pressed'), 'true');
    s = field(s, { shape: 'leaf' }); s = cmd(s, 'turn'); s = field(s, { cell: 6 }); view.update(s.state, s.ui);
    assert.match(host.querySelectorAll('.banner-cell')[6].getAttribute('aria-label'), /rotated 45 degrees, flipped/);
    const editor = host.querySelectorAll('.banner-stamp-spot').find(spot => !spot.hidden).innerHTML;
    const finished = creationMarkup('art', s.state);
    assert.match(finished, /1 flipped stamp/);
    const pixels = (markup, runs) => {
      const found = new Set();
      for (const match of markup.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="[^"]+"\/>/g)) {
        const [x, y, width] = match.slice(1).map(Number);
        if (runs || width === 1) for (let i = 0; i < width; i++) found.add(`${x + i},${y}`);
      }
      return [...found].sort();
    };
    const stampMarkup = finished.match(/<svg x="-7" y="-7" width="14" height="14" viewBox="0 0 32 32">([\s\S]*?)<\/svg>/)[1];
    assert.deepEqual(pixels(editor, true), pixels(stampMarkup, false));
    assert.doesNotMatch(stampMarkup, /(?:x|y|width|height)="-?\d+\.\d/);
    view.destroy();
  } finally { delete globalThis.document; }
});
