import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoRunner } from '../src/ui/demo.js';

function setup(calm = false) {
  const child = { state: { values: ['child'] }, ui: { selected: 'child' } };
  const demo = { snapshot: { values: ['example'] }, intro: 'Watch!', steps: [
    { line: 'First', action: { value: 'one' } }, { line: 'Second', action: { value: 'two' } },
  ], done: 'Your turn!' };
  let work = child, serial = 0;
  const timers = new Map(), lines = [], restores = [], running = [];
  const activity = {
    start(snapshot, scope) { assert.deepEqual(scope, { chapter: 2, grade: 3 }); return { state: snapshot, ui: { selected: 'example' } }; },
    act(state, ui, action) { state.values.push(action.value); ui.selected = action.value; return { state, ui }; },
  };
  const runner = createDemoRunner({ activity, demo, chapter: 2, grade: 3,
    getWork: () => work, setWork: value => { work = value; }, update() {}, say: line => lines.push(line),
    calm: () => calm, onRunning: value => running.push(value), onRestore: value => restores.push(value),
    setTimer: (fn, delay) => { assert.equal(delay, 1400); const id = ++serial; timers.set(id, fn); return id; },
    clearTimer: id => timers.delete(id),
  });
  return { runner, child, demo, timers, lines, restores, running, get work() { return work; },
    tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}

test('automatic example is isolated and restores exact references on completion and replay', () => {
  const t = setup();
  assert.equal(t.runner.start(), true);
  assert.notEqual(t.work.state, t.child.state);
  t.tick(); t.tick(); t.tick();
  assert.equal(t.work.state, t.child.state);
  assert.equal(t.work.ui, t.child.ui);
  assert.deepEqual(t.child.state.values, ['child']);
  assert.deepEqual(t.demo.snapshot.values, ['example']);
  assert.deepEqual(t.lines, ['Watch!', 'First', 'Second', 'Your turn!']);
  assert.deepEqual(t.restores, ['complete']);
  assert.deepEqual(t.running, [true, false]);
  assert.equal(t.runner.start(), true);
  t.tick(); t.runner.stop();
  assert.deepEqual(t.restores, ['complete', 'stop']);
  assert.equal(t.timers.size, 0);
});

test('calm mode waits for Next and stop restores only once', () => {
  const t = setup(true);
  t.runner.start();
  assert.equal(t.timers.size, 0);
  t.runner.next();
  assert.deepEqual(t.work.state.values, ['example', 'one']);
  t.runner.stop(); t.runner.stop(); t.runner.next();
  assert.equal(t.work.state, t.child.state);
  assert.deepEqual(t.restores, ['stop']);
});

test('Next cancels the pending timer and disposal clears it and prevents replay', () => {
  const t = setup();
  t.runner.start();
  t.runner.next();
  assert.equal(t.timers.size, 1);
  t.runner.dispose(); t.runner.dispose();
  assert.equal(t.timers.size, 0);
  assert.equal(t.work.ui, t.child.ui);
  assert.deepEqual(t.restores, ['dispose']);
  assert.equal(t.runner.start(), false);
});

test('missing demo and a second start while active are rejected; stop before first step restores', () => {
  const absent = createDemoRunner({ demo: null });
  assert.equal(absent.start(), false);
  const t = setup();
  assert.equal(t.runner.start(), true);
  assert.equal(t.runner.start(), false);
  t.runner.stop();
  assert.equal(t.work.state, t.child.state);
  assert.equal(t.timers.size, 0);
  assert.deepEqual(t.lines, ['Watch!']);
});

test('a pending timer respects a newly enabled calm setting', () => {
  let calm = false, pending;
  let work = { state: {}, ui: {} };
  const lines = [];
  const runner = createDemoRunner({ activity: { start: () => ({ state: {}, ui: {} }), act: (state, ui) => ({ state, ui }) },
    demo: { snapshot: {}, steps: [{ line: 'Step', action: {} }] }, getWork: () => work,
    setWork: value => { work = value; }, update() {}, say: line => lines.push(line), calm: () => calm,
    setTimer: fn => { pending = fn; return 1; }, clearTimer() {} });
  runner.start(); calm = true; pending();
  assert.deepEqual(lines, []);
  runner.next();
  assert.deepEqual(lines, ['Step']);
  runner.stop();
});

test('redraws see example changes before restoring the exact original work', () => {
  const child = { state: { count: 9 }, ui: {} }, seen = [], events = [];
  let work = child;
  const runner = createDemoRunner({ activity: { start: () => ({ state: { count: 0 }, ui: {} }),
    act: (state, ui, action) => { action.value = 42; state.count++; return { state, ui }; } },
    demo: { snapshot: {}, steps: [{ action: { value: 1 } }], done: 'Done' }, getWork: () => work,
    setWork: value => { work = value; }, update: () => seen.push(work.state.count), say: line => events.push(line),
    calm: () => true, onRunning: value => events.push(value), onRestore: reason => events.push(reason) });
  runner.start(); runner.next(); runner.next();
  assert.deepEqual(seen, [0, 1, 9]);
  assert.deepEqual(events, [true, 'Done', false, 'complete']);
  assert.equal(work, child);
});

test('action mutation cannot change the demo definition across replays', () => {
  const action = { nested: { value: 1 } };
  let work = { state: {}, ui: {} };
  const runner = createDemoRunner({ activity: { start: () => ({ state: {}, ui: {} }),
    act: (state, ui, input) => { input.nested.value++; return { state, ui }; } },
    demo: { snapshot: {}, steps: [{ action }] }, getWork: () => work, setWork: value => { work = value; },
    update() {}, say() {}, calm: () => true });
  runner.start(); runner.next(); runner.next(); runner.start(); runner.next();
  assert.equal(action.nested.value, 1);
  runner.stop();
});

test('errors in act or redraw restore and release controls before propagating', () => {
  for (const source of ['act', 'update']) {
    const child = { state: {}, ui: {} }, events = [], failure = new Error(source);
    let work = child, updates = 0, pending;
    const runner = createDemoRunner({ activity: { start: () => ({ state: {}, ui: {} }),
      act: (state, ui) => { if (source === 'act') throw failure; return { state, ui }; } },
      demo: { snapshot: {}, steps: [{ action: {} }] }, getWork: () => work, setWork: value => { work = value; },
      update: () => { if (source === 'update' && ++updates === 2) throw failure; }, say() {},
      setTimer: fn => { pending = fn; return 1; }, clearTimer: () => { pending = null; },
      onRunning: value => events.push(value), onRestore: reason => events.push(reason) });
    runner.start();
    assert.throws(() => runner.next(), error => error === failure);
    assert.equal(work, child);
    assert.equal(runner.active, false);
    assert.equal(pending, null);
    assert.deepEqual(events, [true, false, 'error']);
  }
});

test('resume schedules one wait when a pause ends', () => {
  let calm = true, work = { state: {}, ui: {} }, serial = 0;
  const timers = new Map();
  const runner = createDemoRunner({ activity: { start: () => ({ state: {}, ui: {} }), act: (state, ui) => ({ state, ui }) },
    demo: { snapshot: {}, steps: [{ line: 'Step', action: {} }] }, getWork: () => work,
    setWork: value => { work = value; }, update() {}, say() {}, calm: () => calm,
    setTimer: (fn, delay) => { assert.equal(delay, 1400); const id = ++serial; timers.set(id, fn); return id; },
    clearTimer: id => timers.delete(id) });
  runner.start(); runner.next();
  assert.equal(timers.size, 0);
  calm = false; runner.resume(); runner.resume();
  assert.equal(timers.size, 1);
  runner.stop(); runner.resume();
  assert.equal(timers.size, 0);
});
