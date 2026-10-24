import test from 'node:test';
import assert from 'node:assert/strict';
import square, { cellPosition, nextNeed } from '../src/ui/activities/square.js';

const field = (s, action, grade) => square.act(s.state, s.ui, { type: 'field', ...action }, grade);
const cmd = (s, id, grade) => square.act(s.state, s.ui, { type: 'command', id }, grade);

test('What’s left names one next step at a time', () => {
  const empty = square.start(null, { chapter: 1, grade: 2 }).state;
  assert.equal(nextNeed(empty), 'Put a quiet garden by the quiet trees, top left.');
  const quiet = { ...empty, placements: [{ item: 'quiet', x: 10, y: 10 }] };
  assert.equal(nextNeed(quiet), 'Put a bench beside the path.');
  const rest = { ...quiet, placements: [...quiet.placements, { item: 'bench', x: 50, y: 90 }] };
  assert.equal(nextNeed(rest), 'Choose Invite so neighbors can try it.');
  assert.equal(nextNeed({ ...rest, tried: true }), 'Everything is ready! Choose Open square.');
  assert.equal(nextNeed({ ...rest, placements: [...rest.placements, { item: 'bench', x: 30, y: 50 }] }), 'Move benches and gardens off the path.');
});
test('placing with the chosen tool fills cells, and Invite unlocks the finish', () => {
  let s = square.start(null, { chapter: 1, grade: 4 });
  s = field(s, { tool: 'quiet' }, 4); s = field(s, { cell: 0 }, 4);
  s = field(s, { tool: 'bench' }, 4); s = field(s, { cell: 22 }, 4);
  assert.deepEqual(cellPosition(22), { x: 50, y: 90 });
  s = square.act(s.state, s.ui, { type: 'command', id: 'invite' }, 4);
  assert.equal(s.line, 'A clear path, a bench, and a quiet spot. Ready!');
  assert.equal(square.commands(s.state, s.ui, 4).find(c => c.finish).disabled, false);
});
test('removing from an empty cell explains itself', () => {
  let s = square.start(null, { chapter: 0, grade: 0 });
  s = field(s, { tool: 'remove' }, 0); s = field(s, { cell: 7 }, 0);
  assert.equal(s.line, 'There is nothing here to remove.');
});

test('the square starts with a bench tool and three commands, finish locked', () => {
  const s = square.start(null, { chapter: 1, grade: 3 });
  assert.equal(square.kind, 'community'); assert.equal(square.title, 'Room for every neighbor');
  assert.deepEqual(s.ui, { tool: 'bench' });
  assert.deepEqual(square.help, ['Pick a tool.', 'Tap the map to place it.', 'Choose What’s left if you are stuck.', 'Choose Invite, then Open square.']);
  assert.equal(square.opening(s.state, s.ui, 3), 'Put a garden by the quiet trees and a bench off the path.');
  const commands = square.commands(s.state, s.ui, 3);
  assert.deepEqual(commands.map(c => [c.id, c.label, c.icon]), [['invite', 'Invite', 'people'], ['needs', 'What’s left', 'help'], ['finish', 'Open square', 'check']]);
  assert.equal(commands[2].finish, true); assert.equal(commands[2].disabled, true);
});
test('placement lines, replacing, removing and the 12-item limit', () => {
  let s = square.start(null, { chapter: 1, grade: 3 });
  s = field(s, { cell: 3 }, 3);
  assert.equal(s.line, 'The square changed. Invite neighbors to try it.');
  assert.deepEqual(s.state.placements, [{ item: 'bench', x: 70, y: 10 }]);
  s = field(s, { cell: 3 }, 3);
  assert.equal(s.line, 'That item is already here. Choose another place.');
  s = field(s, { tool: 'sign' }, 3); s = field(s, { cell: 3 }, 3);
  assert.deepEqual(s.state.placements, [{ item: 'sign', x: 70, y: 10 }]);
  s = field(s, { tool: 'remove' }, 3); s = field(s, { cell: 3 }, 3);
  assert.deepEqual(s.state.placements, []);
  s = field(s, { tool: 'bench' }, 3);
  for (let cell = 0; cell < 12; cell++) s = field(s, { cell }, 3);
  s = field(s, { cell: 20 }, 3);
  assert.equal(s.line, 'All 12 places are used. Remove an item or replace one already on the map.');
  assert.equal(s.state.placements.length, 12);
});
test('Invite reports the first problem, and changing the map resets it', () => {
  let s = square.start(null, { chapter: 1, grade: 3 });
  s = field(s, { cell: 12 }, 3);
  s = cmd(s, 'invite', 3);
  assert.equal(s.state.tried, true);
  assert.equal(s.line, 'A neighbor is blocked. Move that object off the path.');
  s = field(s, { tool: 'remove' }, 3); s = field(s, { cell: 12 }, 3);
  assert.equal(s.state.tried, false);
  assert.equal(cmd(s, 'invite', 3).line, 'Add a quiet garden by the upper-left trees.');
  assert.equal(cmd(s, 'needs', 3).line, 'Put a quiet garden by the quiet trees, top left.');
});
test('act is pure and the tool lives in ui', () => {
  const s = square.start(null, { chapter: 1, grade: 3 });
  const before = JSON.stringify(s);
  const next = field(s, { tool: 'quiet' }, 3);
  assert.deepEqual(next.ui, { tool: 'quiet' }); assert.equal(next.state, s.state);
  field(next, { cell: 0 }, 3); cmd(s, 'invite', 3);
  assert.equal(JSON.stringify(s), before);
});
