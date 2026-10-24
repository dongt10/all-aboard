import test from 'node:test';
import assert from 'node:assert/strict';
import { keyIntent, routeIntent, moveCursor, gridMove } from '../src/ui/input.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { nextCursorIndex } from '../src/ui/menu.js';
import { createSceneManager, onceAtATime } from '../src/ui/scenes.js';

const key = (k, tagName = 'DIV') => ({ key: k, target: { tagName, isContentEditable: false }, altKey: false, ctrlKey: false, metaKey: false });

test('keys map to A, B and directions outside text fields', () => {
  for (const k of ['Enter', ' ', 'z', 'Z']) assert.equal(keyIntent(key(k)), 'a');
  for (const k of ['Escape', 'x', 'X', 'Backspace']) assert.equal(keyIntent(key(k)), 'b');
  assert.deepEqual(['ArrowUp', 'w', 'ArrowDown', 's', 'ArrowLeft', 'a', 'ArrowRight', 'D'].map(k => keyIntent(key(k))), ['up', 'up', 'down', 'down', 'left', 'left', 'right', 'right']);
  assert.equal(keyIntent({ ...key('z'), metaKey: true }), null);
});
test('text fields hand only Escape to the game', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) for (const k of ['z', 'x', 'Backspace', ' ', 'a', 'Enter', 'ArrowLeft']) assert.equal(keyIntent(key(k, tag)), null, `${tag} ${k}`);
  assert.equal(keyIntent(key('Escape', 'TEXTAREA')), 'b');
});
test('A on a focused button is left to the browser, except Z which clicks it', () => {   // Review Focus 1
  assert.equal(routeIntent(key('Enter', 'BUTTON')), 'native');
  assert.equal(routeIntent(key(' ', 'BUTTON')), 'native');
  assert.equal(routeIntent(key('z', 'BUTTON')), 'click-target');
  assert.equal(routeIntent(key('Enter')), 'scene');
  assert.equal(routeIntent(key('Escape', 'BUTTON')), 'scene');
  assert.equal(routeIntent(key('ArrowDown', 'BUTTON')), 'scene');
  assert.equal(routeIntent(key('q')), null);
});
test('the 2×2 cursor stays on real commands', () => {
  assert.deepEqual([moveCursor(0, 'right', 4), moveCursor(1, 'right', 4), moveCursor(0, 'down', 4), moveCursor(2, 'up', 4), moveCursor(3, 'left', 4)], [1, 1, 2, 0, 2]);
  assert.deepEqual([moveCursor(1, 'down', 3), moveCursor(2, 'right', 3)], [1, 2]);
});
test('field grids move by rows and columns and stop at edges', () => {
  assert.deepEqual([gridMove(0, 'left', 6, 30), gridMove(5, 'right', 6, 30), gridMove(0, 'down', 6, 30), gridMove(27, 'down', 6, 30), gridMove(7, 'up', 6, 30)], [0, 5, 6, 27, 1]);
});
test('dialogue pages break between sentences within the limit', () => {
  assert.deepEqual(paginate('Hello, builder! Will you help me check my cart?', 32), ['Hello, builder!', 'Will you help me check my cart?']);
  assert.deepEqual(paginate('Hello, builder! Will you help me check my cart?', PAGE_CHARS.normal), ['Hello, builder! Will you help me check my cart?']);
  assert.deepEqual(paginate('   ', 96), []);
});
test('Bigger words pages split long sentences between words and keep every word', () => {   // Review Focus 3
  const text = 'Both trays start with equal ice cubes and one tray sits in the shade for ten model minutes.';
  const pages = paginate(text, PAGE_CHARS.large);
  assert.deepEqual(PAGE_CHARS, { normal: 96, large: 56 });
  assert.ok(pages.length === 2 && pages.every(page => page.length <= 56));
  assert.equal(pages.join(' '), text);
});
test('the menu cursor follows the same command when commands change', () => {   // Review Focus 5
  const a = [{ id: 'load-left' }, { id: 'load-right' }, { id: 'weight' }, { id: 'roll' }];
  const b = [{ id: 'load-left' }, { id: 'load-right' }, { id: 'weight' }, { id: 'finish', finish: true }];
  assert.equal(nextCursorIndex(a, a, 2), 2);
  assert.equal(nextCursorIndex(a, b, 3), 3);
  assert.equal(nextCursorIndex([{ id: 'x' }, { id: 'y' }], [{ id: 'y' }, { id: 'x' }], 0), 1);
  assert.equal(nextCursorIndex(a, [{ id: 'p', disabled: true }, { id: 'q' }], 0), 1);
  assert.equal(nextCursorIndex(a, [{ id: 'p', disabled: true }], 0), -1);
});
test('scene changes destroy the old scene before mounting the next', async () => {   // Review Focus 4
  const log = [];
  const scenes = createSceneManager({ create: name => ({ mount: () => log.push(`mount ${name}`), destroy: () => log.push(`destroy ${name}`) }) });
  await scenes.go('village'); await scenes.go('encounter', { id: 'math' });
  assert.deepEqual(log, ['mount village', 'destroy village', 'mount encounter']);
  assert.equal(scenes.current, 'encounter');
});
test('a second scene change during a transition is ignored', async () => {   // Review Focus 1
  let mounts = 0;
  const scenes = createSceneManager({ create: () => ({ mount: () => { mounts++; }, destroy() {} }), transition: swap => new Promise(resolve => setTimeout(async () => { await swap(); resolve(); }, 5)) });
  const first = scenes.go('village');
  assert.equal(await scenes.go('parade'), false);
  assert.equal(await first, true); assert.equal(mounts, 1); assert.equal(scenes.busy, false);
});
test('pausing reaches only the current scene', async () => {   // Review Focus 4
  const paused = [];
  const scenes = createSceneManager({ create: name => ({ mount() {}, destroy() {}, pause: () => paused.push(name) }) });
  scenes.pause(); await scenes.go('music'); scenes.pause();
  assert.deepEqual(paused, ['music']);
});
test('onceAtATime ignores repeat calls until the first settles', async () => {   // Review Focus 1
  let calls = 0, release;
  const run = onceAtATime(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  run(); run(); assert.equal(calls, 1);
  release(); await new Promise(resolve => setTimeout(resolve, 0));
  run(); assert.equal(calls, 2);
});
