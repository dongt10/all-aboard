import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES } from '../src/ui/registry.js';
import { encounterReady } from '../src/encounters.js';
import { arrangeCommands } from '../src/ui/menu.js';

// [chapter, grade] for Kindergarten and grades 1 to 5.
const SCOPES = [[0, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]];
const GRADES = SCOPES.map(([, grade]) => grade);
// Saved creations that are ready at every grade. The community one carries a sign by the stage (row 0,
// column 4) so it stays ready once grades 3–5 ask for one.
const READY = {
  math: { kind: 'math', left: [2], right: [2], rolled: true },
  science: { kind: 'science', canopy: 'left', time: 10 },
  art: { kind: 'art', background: '#fff1cf', stamps: [{ shape: 'star', color: '#e96163', x: 50, y: 50, rotation: 0 }] },
  reading: { kind: 'reading', found: ['key', 'umbrella', 'book'] },
  writing: { kind: 'writing', text: 'Hello!' },
  community: { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 10 }] },
};
// Reading's menu holds four picture choices while packing, so it alone may hide the finish until ready.
const MAY_HIDE_FINISH_UNTIL_READY = new Set(['reading']);

const where = (kind, grade) => `${kind} ${grade === 0 ? 'K' : `grade ${grade}`}`;
const finishesOf = commands => commands.filter(c => c.finish);

test('every subject but music has an activity module', () => {
  assert.deepEqual(Object.keys(ACTIVITIES).sort(), ['art', 'community', 'math', 'reading', 'science', 'writing']);
});

test('every activity has the contract shape at every grade', () => {
  for (const [kind, activity] of Object.entries(ACTIVITIES)) for (const [chapter, grade] of SCOPES) {
    const at = where(kind, grade);
    const { state, ui } = activity.start(null, { chapter, grade });
    assert.equal(activity.kind, kind, at); assert.equal(state.kind, kind, at);
    assert.equal(typeof activity.title, 'string', at); assert.equal(typeof activity.mountField, 'function', at);
    assert.ok(activity.help.length >= 1 && activity.help.length <= 4, `${at} help has 1–4 steps`);
    assert.equal(typeof activity.opening(state, ui, grade), 'string', at);
    const ready = activity.start(READY[kind], { chapter, grade });
    for (const opening of [activity.opening(state, ui, grade), activity.opening(ready.state, ready.ui, grade)]) {
      for (const sentence of opening.split(/(?<=[.!?…])\s+/)) assert.ok(sentence.length <= 56, `${at} opening sentence fits one Bigger words page: "${sentence}"`);
    }
    if (activity.notReadyLine !== undefined) assert.ok(typeof activity.notReadyLine === 'string' && activity.notReadyLine.length <= 56, `${at} notReadyLine fits one Bigger words page`);
  }
});

// One subtest per activity, so a failing subject names itself (Phase 2 lanes fix each activity in turn).
test('commands at the start: at most four, unique ids, short pictured labels, one disabled finish last', async t => {   // plan 1A
  for (const [kind, activity] of Object.entries(ACTIVITIES)) await t.test(kind, () => { for (const [chapter, grade] of SCOPES) {
    const at = where(kind, grade);
    const { state, ui } = activity.start(null, { chapter, grade });
    assert.equal(encounterReady(state), false, `${at} starts unfinished`);
    const commands = activity.commands(state, ui, grade);
    assert.ok(commands.length <= 4, `${at} has at most 4 commands`);
    assert.equal(new Set(commands.map(c => c.id)).size, commands.length, `${at} ids are unique`);
    for (const c of commands) {
      assert.ok(typeof c.label === 'string' && c.label.length <= 12, `${at} "${c.label}" is at most 12 characters`);
      assert.ok(c.icon || c.art, `${at} "${c.label}" has an icon or art`);
    }
    const finishes = finishesOf(commands);
    assert.ok(finishes.length <= 1, `${at} has at most one finish`);
    if (!MAY_HIDE_FINISH_UNTIL_READY.has(kind)) assert.equal(finishes.length, 1, `${at} shows the finish from the start`);
    if (finishes.length) {
      assert.equal(finishes[0].id, 'finish', `${at} finish id is "finish" (the only id the encounter sends to finish())`);
      assert.equal(finishes[0].icon, 'check', `${at} finish icon is check`);
      assert.ok(finishes[0].disabled, `${at} finish is disabled until ready`);
      assert.equal(commands.at(-1), finishes[0], `${at} finish is the last command`);
    }
  } });
});

test('a ready creation gives exactly one enabled finish, last, at every grade', async t => {
  for (const [kind, activity] of Object.entries(ACTIVITIES)) await t.test(kind, () => { for (const [chapter, grade] of SCOPES) {
    const at = where(kind, grade);
    const { state, ui } = activity.start(READY[kind], { chapter, grade });
    assert.equal(encounterReady(state), true, `${at} saved creation loads ready`);
    const commands = activity.commands(state, ui, grade);
    assert.ok(commands.length <= 4, `${at} has at most 4 commands`);
    const finishes = finishesOf(commands);
    assert.equal(finishes.length, 1, `${at} has exactly one finish`);
    assert.equal(finishes[0].id, 'finish', `${at} finish id is "finish"`);
    assert.equal(finishes[0].icon, 'check', `${at} finish icon is check`);
    assert.ok(!finishes[0].disabled, `${at} finish is enabled`);
    assert.equal(commands.at(-1), finishes[0], `${at} finish is the last command`);
    assert.ok(activity.help.at(-1).includes(finishes[0].label), `${at} help ends by naming ${finishes[0].label}`);
    // Every other usable command either says something, changes nothing saved, or unreadies the creation
    // (the frame then says so): a saved change with no line would leave the old line on screen.
    for (const command of commands) {
      if (command.finish || command.disabled) continue;
      const result = activity.act(state, ui, { type: 'command', id: command.id }, grade);
      assert.ok(result.line || result.state === state || !encounterReady(result.state), `${at} "${command.label}" changes the creation without a line`);
    }
  } });
});

test('the encounter frame renders every finish bottom-right, whatever the activity returned', () => {
  for (const [kind, activity] of Object.entries(ACTIVITIES)) for (const grade of GRADES) {
    for (const snapshot of [null, READY[kind]]) {
      const { state, ui } = activity.start(snapshot, { chapter: grade === 0 ? 0 : 1, grade });
      const arranged = arrangeCommands(activity.commands(state, ui, grade));
      const finishes = finishesOf(arranged.filter(Boolean));
      if (!finishes.length) continue;
      assert.equal(arranged.length, 4, `${where(kind, grade)} menu fills four slots`);
      assert.equal(arranged[3], finishes[0], `${where(kind, grade)} finish is in slot 4`);
    }
  }
});
