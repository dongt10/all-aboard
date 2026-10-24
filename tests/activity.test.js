import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getActivity } from '../src/data.js';
import { isActivityAnswerCorrect } from '../src/activity.js';

const activities = CHARACTERS.flatMap(({ id }) => [
  getActivity(id, 0),
  ...[1, 2, 3, 4, 5].map(grade => getActivity(id, 1, grade)),
]);

test('each sample accepts its authored answer and rejects empty or unknown selections', () => {
  for (const activity of activities) {
    const answer = activity.type === 'order' ? activity.correct
      : [activity.type === 'create' ? activity.options[0].id : activity.correct];
    assert.equal(isActivityAnswerCorrect(activity, answer), true, activity.id);
    assert.equal(isActivityAnswerCorrect(activity, []), false, activity.id);
    assert.equal(isActivityAnswerCorrect(activity, ['unknown']), false, activity.id);
    assert.equal(isActivityAnswerCorrect(activity, null), false, activity.id);
  }
});

test('order requires the whole sequence, in order, without repeated pieces', () => {
  const activity = getActivity('writing', 1, 2);
  assert.equal(isActivityAnswerCorrect(activity, activity.correct.slice(1)), false);
  assert.equal(isActivityAnswerCorrect(activity, [...activity.correct].reverse()), false);
  assert.equal(isActivityAnswerCorrect(activity, [activity.correct[0], activity.correct[0]]), false);
  assert.equal(isActivityAnswerCorrect(activity, [...activity.correct, activity.correct[0]]), false);
});

test('choice accepts one correct option; creative choice accepts any one valid option', () => {
  const choice = getActivity('math', 0);
  const wrong = choice.options.find(option => option.id !== choice.correct).id;
  assert.equal(isActivityAnswerCorrect(choice, [wrong]), false);
  assert.equal(isActivityAnswerCorrect(choice, [wrong, choice.correct]), false);
  const art = getActivity('art', 0);
  for (const option of art.options) assert.equal(isActivityAnswerCorrect(art, [option.id]), true);
  assert.equal(isActivityAnswerCorrect(art, art.options.map(option => option.id)), false);
});
