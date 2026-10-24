import test from 'node:test';
import assert from 'node:assert/strict';
import banner, { stampPosition, BANNER_SHAPES } from '../src/ui/activities/banner.js';

const field = (s, action, grade) => banner.act(s.state, s.ui, { type: 'field', ...action }, grade);
test('stamps land on the tapped cell with the chosen paint, shape and turn', () => {
  let s = banner.start(null, { chapter: 1, grade: 1 });
  s = field(s, { color: '#559fc7' }, 1); s = field(s, { shape: 'leaf' }, 1);
  s = banner.act(s.state, s.ui, { type: 'command', id: 'turn' }, 1);
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
  assert.equal(s.line, 'The cloth has 30 stamps. Undo one to make room, or hang your banner.');
});
test('turning cycles in 45° steps, fill paints the cloth, and undo needs a stamp', () => {
  let s = banner.start(null, { chapter: 1, grade: 5 });
  assert.equal(banner.commands(s.state, s.ui, 5)[0].disabled, true);
  for (let i = 0; i < 8; i++) s = banner.act(s.state, s.ui, { type: 'command', id: 'turn' }, 5);
  assert.equal(s.ui.rotation, 0);
  s = banner.act(s.state, s.ui, { type: 'command', id: 'fill' }, 5);
  assert.equal(s.state.background, '#e96163');
  assert.deepEqual(BANNER_SHAPES, ['star', 'flower', 'leaf', 'circle']);
});

// Beyond the brief: the contract details the encounter frame leans on.
const cmd = (s, id, grade = 1) => banner.act(s.state, s.ui, { type: 'command', id }, grade);
test('the banner names itself and opens with Yuki', () => {
  const s = banner.start(null, { chapter: 1, grade: 2 });
  assert.equal(banner.kind, 'art'); assert.equal(banner.title, 'Your colors, flying high');
  assert.deepEqual(banner.help, ['Pick a paint and a stamp.', 'Tap the cloth to stamp.', 'Turn or undo any time.', 'Choose Hang banner.']);
  assert.deepEqual(s.ui, { color: '#e96163', shape: 'star', rotation: 0 });
  assert.deepEqual([s.state.kind, s.state.grade, s.state.chapter, s.state.background, s.state.stamps], ['art', 2, 1, '#fff1cf', []]);
  assert.equal(banner.opening(s.state, s.ui, 2), 'Tap the cloth to add a stamp.');
});
test('commands carry icons, short labels and one finish that waits for a stamp', () => {
  let s = banner.start(null, { chapter: 1, grade: 3 });
  const list = banner.commands(s.state, s.ui, 3);
  assert.deepEqual(list.map(c => [c.id, c.icon, c.label]), [['undo', 'undo', 'Undo'], ['turn', 'turn', 'Turn 0°'], ['fill', 'fill', 'Fill cloth'], ['finish', 'check', 'Hang banner']]);
  assert.deepEqual([list[3].finish, list[3].disabled], [true, true]);
  for (let i = 0; i < 7; i++) s = cmd(s, 'turn', 3);
  assert.equal(banner.commands(s.state, s.ui, 3)[1].label, 'Turn 315°');
  s = field(s, { cell: 3 }, 3);
  const ready = banner.commands(s.state, s.ui, 3);
  assert.deepEqual([ready[0].disabled, ready[3].disabled], [false, false]);
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
test('a saved banner comes back as it was', () => {
  const snapshot = { kind: 'art', background: '#f4bf4f', stamps: [{ shape: 'flower', color: '#6dbea0', x: 25, y: 30, rotation: 90 }] };
  const s = banner.start(snapshot, { chapter: 1, grade: 4 });
  assert.equal(s.state.background, '#f4bf4f'); assert.equal(s.state.stamps.length, 1);
  assert.equal(banner.commands(s.state, s.ui, 4)[3].disabled, false);
});
