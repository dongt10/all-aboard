import test from 'node:test';
import assert from 'node:assert/strict';
import sign, { signWords } from '../src/ui/activities/sign.js';

const field = (s, action, grade) => sign.act(s.state, s.ui, { type: 'field', ...action }, grade);
test('word tiles grow with the grade', () => {
  assert.deepEqual(signWords(0), ['Hello', 'friend!', 'Welcome', '♡']);
  assert.deepEqual([signWords(2).length, signWords(5).length], [8, 5]);
});
test('tiles build the sign, Remove word takes the last one, and the sign caps at 120 characters', () => {
  let s = sign.start(null, { chapter: 0, grade: 0 });
  for (const word of ['Hello', 'friend!']) s = field(s, { word }, 0);
  assert.equal(s.state.text, 'Hello friend!');
  s = sign.act(s.state, s.ui, { type: 'command', id: 'remove' }, 0);
  assert.equal(s.state.text, 'Hello');
  s = field(s, { typed: 'x'.repeat(200) }, 0);
  assert.equal(s.state.text.length, 120);
});
test('the sign goes up only when it has visible words', () => {
  let s = sign.start(null, { chapter: 1, grade: 3 });
  const finish = () => sign.commands(s.state, s.ui, 3).find(c => c.finish);
  assert.equal(finish().disabled, true);
  s = field(s, { typed: '   ' }, 3); assert.equal(finish().disabled, true);
  s = field(s, { word: 'Everyone belongs here.' }, 3); assert.equal(finish().disabled, false);
  s = sign.act(s.state, s.ui, { type: 'command', id: 'clear' }, 3); assert.equal(s.state.text, '');
});
test('the activity names, commands, help and lines follow the brief', () => {
  assert.deepEqual([sign.kind, sign.title], ['writing', 'A sign from you']);
  assert.deepEqual(sign.help, ['Tap words to add them.', 'Grades 1–5 can type on the sign.', 'Remove word takes one back.', 'Choose Put up sign.']);
  const s = sign.start(null, { chapter: 1, grade: 2 });
  assert.equal(sign.opening(s.state, s.ui, 2), 'Choose words for your welcome sign.');
  assert.deepEqual(sign.commands(s.state, s.ui, 2).map(c => [c.id, c.label, c.icon]),
    [['remove', 'Remove word', 'back'], ['clear', 'Clear sign', 'trash'], ['finish', 'Put up sign', 'check']]);
  assert.equal(field(s, { word: 'Welcome' }, 2).line, 'Your sign is ready. Add words or put it up.');
});
test('tiles join with one space, slice to 120, and act stays pure', () => {
  let s = sign.start({ kind: 'writing', text: '  Hi  ' }, { chapter: 1, grade: 4 });
  const before = s.state;
  s = field(s, { word: 'there' }, 4);
  assert.equal(s.state.text, 'Hi there');
  assert.equal(before.text, '  Hi  ');
  s = field(s, { typed: 'y'.repeat(118) }, 4);
  assert.equal(field(s, { word: 'Come explore' }, 4).state.text, `${'y'.repeat(118)} C`);
});
test('Remove word on an empty sign keeps it empty; unknown actions change nothing', () => {
  const s = sign.start(null, { chapter: 1, grade: 1 });
  assert.equal(sign.act(s.state, s.ui, { type: 'command', id: 'remove' }, 1).state.text, '');
  const same = sign.act(s.state, s.ui, { type: 'command', id: 'nope' }, 1);
  assert.equal(same.state, s.state);
  const typed = field(s, { typed: 'Come  play ' }, 1);
  assert.equal(sign.act(typed.state, typed.ui, { type: 'command', id: 'remove' }, 1).state.text, 'Come');
});
