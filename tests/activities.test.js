import { helpSetFor } from '../src/helpday.js';
import { expectedEnergy } from '../src/chain.js';
import { stampPosition } from '../src/ui/activities/banner.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, activityFor } from '../src/ui/registry.js';
import { encounterReady, gradeBand, normalizeEncounterSnapshot } from '../src/encounters.js';
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
  writing: { kind: 'writing', text: 'Hello friend!' },
  community: { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 10 }] },
};
const patternFor = grade => grade === 1
  ? [{ shape: 'star', color: '#e96163' }, { shape: 'circle', color: '#e96163' }]
  : [{ shape: 'flower', color: '#e96163' }, { shape: 'flower', color: '#559fc7' }];
const stamp = (cell, shape = 'star', color = '#e96163') => ({ ...stampPosition(cell), shape, color, rotation: 0 });
const readyFor = (kind, grade) => {
  if (kind === 'art' && grade > 0) {
    const [a, b] = patternFor(grade);
    const stamps = grade < 3 ? [b, a, b].map((value, i) => stamp(i + 3, value.shape, value.color))
      : [6, 11, 7, 10].map(cell => stamp(cell)).concat(grade >= 4 ? [12, 17].map(cell => stamp(cell, 'circle', '#559fc7')) : []);
    return { ...READY.art, stamps };
  }
  if (kind === 'writing') return { kind, text: grade === 0 ? 'Hello friend!' : grade < 3 ? 'Hello!' : 'Welcome, neighbors! The lanterns are bright.' };
  if (grade < 3) return READY[kind];
  return {
    math: { kind, activity: 'pizza', ...(grade === 5 ? { slices: 6, halves: true, plates: [3, 3, 3, 3] } : { slices: 8, halves: false, plates: [4, 4, 4, 4] }), tried: true },
    science: { kind, activity: 'chain', chain: grade === 4 ? ['pondweed', 'snail', 'koi'] : ['plant', 'fish', 'otter'], energy: expectedEnergy(grade), shone: true },
    community: { kind, activity: 'helpday', crew: Object.entries(helpSetFor(grade).fits).map(([job, helper]) => ({ job, helper })) },
    reading: { kind, activity: 'tales', deck: 0, solved: ['momo-kitchen', 'taro-pier', 'kiko-stage'] },
  }[kind] ?? READY[kind];
};

const where = (kind, grade) => `${kind} ${grade === 0 ? 'K' : `grade ${grade}`}`;
const finishesOf = commands => commands.filter(c => c.finish);

test('every subject but music has an activity module', () => {
  assert.deepEqual(Object.keys(ACTIVITIES).sort(), ['art', 'community', 'math', 'reading', 'science', 'writing']);
});

test('every activity has the contract shape at every grade', () => {
  for (const kind of Object.keys(ACTIVITIES)) for (const [chapter, grade] of SCOPES) {
    const activity = activityFor(kind, grade);
    const at = where(kind, grade);
    const { state, ui } = activity.start(null, { chapter, grade });
    assert.equal(activity.kind, kind, at); assert.equal(state.kind, kind, at);
    assert.equal(typeof activity.title, 'string', at); assert.equal(typeof activity.mountField, 'function', at);
    assert.ok(activity.help.length >= 1 && activity.help.length <= 4, `${at} help has 1–4 steps`);
    assert.equal(typeof activity.opening(state, ui, grade), 'string', at);
    const ready = activity.start(readyFor(kind, grade), { chapter, grade });
    for (const opening of [activity.opening(state, ui, grade), activity.opening(ready.state, ready.ui, grade)]) {
      for (const sentence of opening.split(/(?<=[.!?…])\s+/)) assert.ok(sentence.length <= 56, `${at} opening sentence fits one Bigger words page: "${sentence}"`);
    }
    if (activity.notReadyLine !== undefined) assert.ok(typeof activity.notReadyLine === 'string' && activity.notReadyLine.length <= 56, `${at} notReadyLine fits one Bigger words page`);
  }
});

// One subtest per activity, so a failing subject names itself (Phase 2 lanes fix each activity in turn).
test('commands at the start: at most four, unique ids, short pictured labels, one disabled finish last', async t => {   // plan 1A
  for (const kind of Object.keys(ACTIVITIES)) await t.test(kind, () => { for (const [chapter, grade] of SCOPES) {
    const activity = activityFor(kind, grade);
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
    if (!(kind === 'reading' && grade < 3)) assert.equal(finishes.length, 1, `${at} shows the finish from the start`);
    if (finishes.length) {
      assert.equal(finishes[0].id, 'finish', `${at} finish id is "finish" (the only id the encounter sends to finish())`);
      assert.equal(finishes[0].icon, 'check', `${at} finish icon is check`);
      assert.ok(finishes[0].disabled, `${at} finish is disabled until ready`);
      assert.equal(commands.at(-1), finishes[0], `${at} finish is the last command`);
    }
  } });
});

test('a ready creation gives exactly one enabled finish, last, at every grade', async t => {
  for (const kind of Object.keys(ACTIVITIES)) await t.test(kind, () => { for (const [chapter, grade] of SCOPES) {
    const activity = activityFor(kind, grade);
    const at = where(kind, grade);
    const { state, ui } = activity.start(readyFor(kind, grade), { chapter, grade });
    assert.equal(encounterReady(state), true, `${at} saved creation loads ready`);
    const commands = activity.commands(state, ui, grade);
    assert.ok(commands.length <= 4, `${at} has at most 4 commands`);
    assert.equal(new Set(commands.map(c => c.id)).size, commands.length, `${at} ids are unique`);
    for (const command of commands) {
      assert.ok(command.label.length <= 12, `${at} ready label fits`);
      assert.ok(command.icon || command.art, `${at} ready command has a picture`);
    }
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
  for (const kind of Object.keys(ACTIVITIES)) for (const grade of GRADES) {
    const activity = activityFor(kind, grade);
    for (const snapshot of [null, readyFor(kind, grade)]) {
      const { state, ui } = activity.start(snapshot, { chapter: grade === 0 ? 0 : 1, grade });
      const arranged = arrangeCommands(activity.commands(state, ui, grade));
      const finishes = finishesOf(arranged.filter(Boolean));
      if (!finishes.length) continue;
      assert.equal(arranged.length, 4, `${where(kind, grade)} menu fills four slots`);
      assert.equal(arranged[3], finishes[0], `${where(kind, grade)} finish is in slot 4`);
    }
  }
});


test('grade bands select new activities only in grades 3–5', () => {
  assert.deepEqual(GRADES.map(gradeBand), [0, 1, 1, 3, 3, 3]);
  const banded = { math: 'pizza', science: 'chain', community: 'helpday', reading: 'tales' };
  for (const kind of Object.keys(ACTIVITIES)) for (const grade of GRADES) {
    const activity = activityFor(kind, grade);
    if (grade < 3 || !banded[kind]) assert.equal(activity, ACTIVITIES[kind]);
    else assert.equal(activity.start(null, { grade, chapter: 1 }).state.activity, banded[kind]);
  }
  const cart = ACTIVITIES.math;
  const options = { grade: 1, chapter: 1 };
  assert.deepEqual(cart.start(readyFor('math', 3), options), cart.start(null, options));
});

test('legacy snapshots retain their old shape and readiness at every grade', () => {
  for (const [chapter, grade] of SCOPES) for (const kind of Object.keys(READY)) {
    const input = { ...(['art', 'writing'].includes(kind) ? readyFor(kind, grade) : READY[kind]), grade, chapter };
    assert.deepEqual(normalizeEncounterSnapshot(kind, input, grade, chapter), input);
    assert.equal(encounterReady(input), true);
  }
});

test('the encounter resolves the saved grade at mount, including Kindergarten chapter scope', async () => {
  const { createEncounterScene } = await import('../src/ui/screens/encounter.js');
  const { createState } = await import('../src/progress.js');
  const stopBeforeDOM = new Error('start observed');
  for (const kind of Object.keys(ACTIVITIES)) for (const [chapter, grade] of SCOPES) {
    // Construction can happen before a grade change; mount must read the latest state.
    let app = { ...createState(), chapter: 1, grade: grade === 3 ? 1 : 3 };
    const scene = createEncounterScene({ getState: () => app }, { id: kind });
    app = { ...app, chapter, grade: chapter === 0 ? 5 : grade };
    const chosen = activityFor(kind, grade);
    const original = chosen.start;
    let observed;
    chosen.start = (snapshot, options) => { observed = { snapshot, options }; throw stopBeforeDOM; };
    try {
      assert.throws(() => scene.mount(), error => error === stopBeforeDOM);
      assert.deepEqual(observed, { snapshot: null, options: { chapter, grade } });
    } finally {
      chosen.start = original;
    }
  }
});
