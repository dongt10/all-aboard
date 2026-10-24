import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getActivity } from '../src/data.js';

const scopes = [{ chapter: 0, grade: 1 }, ...[1, 2, 3, 4, 5].map(grade => ({ chapter: 1, grade }))];
const activities = CHARACTERS.flatMap(character => scopes.map(({ chapter, grade }) => getActivity(character.id, chapter, grade)));

test('cast and activities have complete, unique scopes', () => {
  assert.equal(CHARACTERS.length, 7);
  assert.equal(new Set(CHARACTERS.map(character => character.id)).size, 7);
  assert.equal(activities.length, 42);
  assert.equal(new Set(activities.map(activity => activity.id)).size, 42);
  for (const character of CHARACTERS) {
    for (const key of ['id', 'name', 'species', 'subject', 'location', 'color', 'description', 'greeting']) {
      assert.equal(typeof character[key], 'string');
      assert.ok(character[key].trim());
    }
    assert.ok(character.position.x > 0 && character.position.x < 100);
    assert.ok(character.position.y > 0 && character.position.y < 100);
    assert.equal(activities.filter(activity => activity.subjectId === character.id).length, 6);
  }
});

test('all activity interactions are playable with visible labels and valid answers', () => {
  for (const activity of activities) {
    for (const key of ['title', 'story', 'prompt', 'hint', 'success']) {
      assert.equal(typeof activity[key], 'string', `${activity.id}: ${key}`);
      assert.ok(activity[key].trim());
    }
    assert.ok(['choice', 'order', 'create'].includes(activity.type));
    assert.ok(activity.options.length >= 2);
    const optionIds = activity.options.map(option => option.id);
    assert.equal(new Set(optionIds).size, optionIds.length);
    assert.ok(activity.options.every(option => typeof option.label === 'string' && option.label.trim()));
    assert.ok(activity.reward.label && activity.reward.icon);
    if (activity.type === 'order') {
      assert.ok(Array.isArray(activity.correct));
      assert.equal(new Set(activity.correct).size, activity.correct.length, 'Each card is used once');
      assert.deepEqual([...activity.correct].sort(), [...optionIds].sort(), 'Every provided card belongs in the answer');
    } else if (activity.type === 'choice') {
      assert.equal(typeof activity.correct, 'string');
      assert.ok(optionIds.includes(activity.correct));
    } else {
      assert.equal(activity.correct, null);
    }
    if (activity.subjectId === 'music') {
      assert.ok(activity.options.every(option => /[a-z]/i.test(option.label)), 'Music has visible word labels');
    }
  }
});

test('requests are deterministic and returned activity edits do not alter later lessons', () => {
  for (const activity of activities) {
    const requestGrade = activity.chapter === 0 ? 1 : activity.grade;
    assert.deepEqual(getActivity(activity.subjectId, activity.chapter, requestGrade), activity);
  }
  const original = getActivity('writing', 1, 3);
  const edited = getActivity('writing', 1, 3);
  edited.options[0].label = 'Changed';
  edited.correct.reverse();
  edited.reward.label = 'Changed';
  assert.deepEqual(getActivity('writing', 1, 3), original);
});

test('kindergarten selection is independent of elementary grade and default grade is one', () => {
  assert.deepEqual(getActivity('math', 0, 5), getActivity('math', 0));
  assert.equal(getActivity('math', 0).grade, 0);
  assert.deepEqual(getActivity('math', 1), getActivity('math', 1, 1));
});

test('invalid subject, chapter, and grade requests fail explicitly', () => {
  for (const subject of ['unknown', '__proto__', 'constructor', '', null, undefined]) {
    assert.throws(() => getActivity(subject, 1, 1), RangeError);
  }
  for (const chapter of [-1, 2, '1', null, undefined, NaN, 0.5]) {
    assert.throws(() => getActivity('math', chapter, 1), RangeError);
  }
  for (const chapter of [0, 1]) {
    for (const grade of [0, 6, -1, '2', null, NaN, 1.5, Infinity]) {
      assert.throws(() => getActivity('math', chapter, grade), RangeError);
    }
  }
});
