import test from 'node:test';
import assert from 'node:assert/strict';
import story from '../src/ui/activities/story.js';

const cmd = id => ({ type: 'command', id });
test('the four pictures are the commands, and the opening asks the first question', () => {
  const { state, ui } = story.start(null, { chapter: 1, grade: 2 });
  const commands = story.commands(state, ui, 2);
  assert.deepEqual(commands.map(c => c.label), ['Key', 'Umbrella', 'Book', 'Cup']);
  assert.ok(commands.every(c => c.art.startsWith('<svg')));
  assert.match(story.opening(state, ui, 2), /What does Sora pack to lock her door\?$/);
});
test('a right pick explains why, then Next moves to the next part', () => {
  const s = story.start(null, { chapter: 1, grade: 2 });
  const picked = story.act(s.state, s.ui, cmd('pick-key'), 2);
  assert.deepEqual([picked.state.found, picked.line], [['key'], 'Key packed! The key fits the lock on Sora’s door.']);
  assert.deepEqual(story.commands(picked.state, picked.ui, 2).map(c => c.id), ['next']);
  const next = story.act(picked.state, picked.ui, cmd('next'), 2);
  assert.equal(next.line, 'What does Sora pack to stay dry?');
  assert.equal(story.commands(next.state, next.ui, 2).find(c => c.id === 'pick-key').disabled, true);
});
test('a wrong pick keeps progress and gives a hint', () => {
  const s = story.start(null, { chapter: 1, grade: 3 });
  const wrong = story.act(s.state, s.ui, cmd('pick-cup'), 3);
  assert.deepEqual([wrong.state.found, wrong.line], [[], 'A cup holds a drink. Look for the thing that fits a door lock.']);
  assert.equal(story.commands(wrong.state, wrong.ui, 3).length, 4);
});
test('packing all three offers Read again and Share story', () => {
  const s = story.start({ kind: 'reading', found: ['key', 'umbrella'] }, { chapter: 0, grade: 0 });
  const done = story.act(s.state, s.ui, cmd('pick-book'), 0);
  assert.match(done.line, /All three are packed/);
  assert.deepEqual(story.commands(done.state, done.ui, 0).map(c => c.label), ['Read again', 'Share story']);
  assert.deepEqual(story.act(done.state, done.ui, cmd('again'), 0).state.found, []);
});
