import test from 'node:test';
import assert from 'node:assert/strict';
import { createScriptedWalk, stepScriptedWalk } from '../src/ui/scripted-walk.js';

const p = (x, y) => ({ x, y });

test('crosses corners and carries remaining distance without mutating inputs', () => {
  const pos = p(0, 0), path = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
  const original = structuredClone({ pos, path });
  const walk = createScriptedWalk(pos, path, 10);
  const before = structuredClone(walk);
  const next = stepScriptedWalk(walk, 2500);
  assert.deepEqual(next.pos, p(5, 10));
  assert.deepEqual(next.path, [p(0, 10)]);
  assert.equal(next.facing, 'left');
  assert.deepEqual(walk, before);
  assert.deepEqual({ pos, path }, original);
  assert.notStrictEqual(next.path[0], walk.path[2]);
});

test('arrives exactly at endpoint and handles repeated waypoints', () => {
  const walk = createScriptedWalk(p(0, 0), [p(0, 0), p(5, 0), p(5, 0), p(5, 5), p(5, 5)], 10);
  const next = stepScriptedWalk(walk, 5000);
  assert.deepEqual(next.pos, p(5, 5));
  assert.deepEqual(next.path, []);
  assert.equal(next.arrived, true);
  assert.equal(next.facing, 'front');
  assert.equal(next.step, 0);
  assert.equal(next.clock, 1000);
});

test('null, empty and malformed paths arrive gracefully', () => {
  for (const path of [null, [], [null], [p(NaN, 0)]]) {
    const walk = createScriptedWalk(p(1, 2), path);
    assert.equal(walk.arrived, true);
    assert.deepEqual(walk.path, []);
    assert.deepEqual(stepScriptedWalk(walk, 100).pos, p(1, 2));
  }
});

test('invalid time and speed never move', () => {
  for (const speed of [0, -1, NaN, Infinity]) {
    const walk = createScriptedWalk(p(0, 0), [p(10, 0)], speed);
    assert.deepEqual(stepScriptedWalk(walk, 1000).pos, p(0, 0));
  }
  const walk = createScriptedWalk(p(0, 0), [p(10, 0)]);
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(stepScriptedWalk(walk, dt), walk);
});

test('stride follows village timing and facing follows each segment', () => {
  let walk = createScriptedWalk(p(0, 0), [p(100, 0), p(100, 100), p(0, 100)], 240);
  assert.equal(stepScriptedWalk(walk, 1).step, 1);
  assert.equal(stepScriptedWalk(walk, 80).step, 0);
  assert.equal(stepScriptedWalk(walk, 160).step, 2);
  assert.equal(stepScriptedWalk(walk, 240).step, 0);
  walk = stepScriptedWalk(walk, 500);
  assert.equal(walk.facing, 'front');
  walk = stepScriptedWalk(walk, 400);
  assert.equal(walk.facing, 'left');
  assert.equal(stepScriptedWalk(createScriptedWalk(p(0, 0), [p(100, 0)], 100), 120).step, 0);
});

test('covers 400 pixels in under two seconds at default speed', () => {
  const walk = createScriptedWalk(p(0, 0), [p(400, 0)]);
  const next = stepScriptedWalk(walk, 1700);
  assert.equal(next.arrived, true);
  assert.deepEqual(next.pos, p(400, 0));
  assert.ok(next.clock < 2000);
});
