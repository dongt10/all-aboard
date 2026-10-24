import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivity } from '../src/data.js';
import { createState, scopeKey, loadState, saveState, completeActivity, getCompleted, getRewards } from '../src/progress.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('progress is isolated by chapter and elementary grade; K grade zero shares K scope', () => {
  let state = createState();
  state = completeActivity(state, getActivity('math', 0));
  state = completeActivity(state, getActivity('art', 1, 2), 'Ocean blue');
  state = completeActivity(state, getActivity('music', 1, 5));
  assert.deepEqual(getCompleted(state, 0, 0), ['math']);
  assert.deepEqual(getCompleted(state, 0, 5), ['math']);
  assert.deepEqual(getCompleted(state, 1, 1), []);
  assert.deepEqual(getCompleted(state, 1, 2), ['art']);
  assert.deepEqual(getCompleted(state, 1, 5), ['music']);
  assert.equal(scopeKey(0, 0), 'chapter-0');
  assert.throws(() => scopeKey(1, 0), RangeError);
  assert.throws(() => scopeKey(2, 1), RangeError);
});

test('completion is pure, records one subject once, and rewards are independent copies', () => {
  const original = createState();
  const activity = getActivity('art', 1, 3);
  const first = completeActivity(original, activity, 'Blue and green: calm');
  const second = completeActivity(first, activity, 'Red and yellow: lively');
  assert.deepEqual(original, createState());
  assert.equal(second.hasStarted, true);
  assert.equal(getCompleted(second, 1, 3).length, 1);
  const rewards = getRewards(second, 1, 3);
  assert.equal(rewards[0].subjectId, 'art');
  assert.equal(rewards[0].activityId, activity.id);
  assert.equal(rewards[0].creation, 'Red and yellow: lively');
  assert.ok(Number.isFinite(Date.parse(rewards[0].completedAt)));
  rewards[0].reward.label = 'Changed outside state';
  assert.equal(second.progress['chapter-1-grade-3'].art.reward.label, activity.reward.label);
  assert.equal(first.progress['chapter-1-grade-3'].art.creation, 'Blue and green: calm');
});

test('saved settings, selection, and progress survive storage round trips', () => {
  const storage = memoryStorage();
  const state = completeActivity(createState(), getActivity('reading', 1, 4));
  state.chapter = 1;
  state.grade = 4;
  state.settings = { largeText: true, reducedMotion: false };
  assert.equal(saveState(state, storage), true);
  assert.ok(storage.getItem('all-aboard-demo-v1'));
  const loaded = loadState(storage);
  assert.deepEqual(loaded, state);
  assert.deepEqual(getCompleted(loaded), ['reading']);
});

test('missing, corrupt, incompatible, and denied storage yield a usable fresh state', () => {
  const badReads = [null, '', '{broken', 'null', '[]', '{"version":2}', '{"version":1,"chapter":9,"grade":99,"settings":{"largeText":"true"}}'];
  for (const value of badReads) {
    assert.deepEqual(loadState({ getItem: () => value }), createState());
  }
  const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } };
  assert.deepEqual(loadState(denied), createState());
  assert.equal(saveState(createState(), denied), false);
  assert.deepEqual(loadState(null), createState());
  assert.equal(saveState(createState(), null), false);
});

test('corrupt records and prototype keys are discarded without losing valid progress', () => {
  const state = completeActivity(createState(), getActivity('math', 0));
  const parsed = JSON.parse(JSON.stringify(state));
  parsed.progress['chapter-0'].science = { activityId: 'bad', reward: { label: 'Missing date' } };
  parsed.progress['chapter-0'].constructor = parsed.progress['chapter-0'].math;
  parsed.progress['chapter-99'] = { math: parsed.progress['chapter-0'].math };
  const storage = memoryStorage();
  storage.setItem('all-aboard-demo-v1', JSON.stringify(parsed).replace('"progress":{', '"progress":{"__proto__":{"polluted":true},'));
  const loaded = loadState(storage);
  assert.deepEqual(getCompleted(loaded), ['math']);
  assert.deepEqual(Object.keys(loaded.progress), ['chapter-0']);
  assert.equal(Object.hasOwn(loaded.progress, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(completeActivity(state, { ...getActivity('math', 0), subjectId: '__proto__' }), state);
  const unsafe = completeActivity(state, getActivity('art', 0), '<script>bad()</script>');
  assert.equal(getRewards(unsafe).find(record => record.subjectId === 'art').creation, null);
});
