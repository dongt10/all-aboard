import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeChoices, chooseGrade } from '../src/ui/screens/title.js';
import { withScope, toggleSetting, chooseAvatar } from '../src/ui/save.js';
import { createState } from '../src/progress.js';

test('grade tiles are Kindergarten then grades 1–5', () => {
  assert.deepEqual(gradeChoices().map(c => c.label), ['K', '1', '2', '3', '4', '5']);
  assert.deepEqual(gradeChoices()[0], { chapter: 0, grade: 0, label: 'K', name: 'Kindergarten' });
  assert.deepEqual(gradeChoices()[3], { chapter: 1, grade: 3, label: '3', name: 'Grade 3' });
});
test('choosing Kindergarten keeps the last elementary grade for later', () => {
  const state = { ...createState(), chapter: 1, grade: 4 };
  const next = chooseGrade(state, gradeChoices()[0]);
  assert.deepEqual([next.chapter, next.grade, next.hasStarted], [0, 4, true]);
  assert.equal(state.chapter, 1);
  const two = chooseGrade(createState(), gradeChoices()[2]);
  assert.deepEqual([two.chapter, two.grade], [1, 2]);
});
test('comfort toggles return a new state and reject unknown settings', () => {
  const state = createState();
  assert.equal(toggleSetting(state, 'autoRead').settings.autoRead, true);
  assert.equal(state.settings.autoRead, false);
  assert.throws(() => toggleSetting(state, 'volume'), RangeError);
});
test('saved snapshots carry their chapter and grade', () => {
  assert.deepEqual(withScope({ kind: 'art' }, { ...createState(), chapter: 0, grade: 4 }), { kind: 'art', chapter: 0, grade: 0 });
  assert.deepEqual(withScope({ kind: 'art' }, { ...createState(), chapter: 1, grade: 4 }), { kind: 'art', chapter: 1, grade: 4 });
});
test('choosing who you are returns a new state and rejects anything else', () => {
  const state = createState();
  assert.equal(chooseAvatar(state, 'girl').avatar, 'girl');
  assert.equal(chooseAvatar(state, 'boy').avatar, 'boy');
  assert.equal(state.avatar, 'boy');
  assert.throws(() => chooseAvatar(state, 'player'), RangeError);
});
