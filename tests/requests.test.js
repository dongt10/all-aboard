import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFor } from '../src/ui/registry.js';
import { encounterReady, normalizeEncounterSnapshot, squareSteps } from '../src/encounters.js';
import { cleanCreation, createState, saveDraft, publishCreation, getDraft, getCreations, getCompleted, saveState, loadState } from '../src/progress.js';
import { readingItems } from '../src/reading.js';
import { TALE_DECKS } from '../src/tales.js';
import { BED_TILES } from '../src/beans.js';
import { chainFor, expectedEnergy } from '../src/chain.js';
import { helpSetFor } from '../src/helpday.js';
import { stampPosition, expectedAt, yukiStamps } from '../src/banner-rules.js';
import { errandsFor } from '../src/compass.js';
import { scenarioById } from '../src/sign-scenarios.js';
import { remainingUnits } from '../src/pizza.js';

const kinds = ['math', 'science', 'art', 'reading', 'writing', 'community'];
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const context = grade => ({ grade, chapter: grade ? 1 : 0, seed: 42 });
const command = id => ({ type: 'command', id });
const field = values => ({ type: 'field', ...values });
function complete(activity, kind, grade, start) {
  let { state, ui } = start;
  const act = action => {
    const result = activity.act(state, ui, action, grade);
    if (result.line) short(result.line, `${kind} ${grade} action`);
    ({ state, ui } = result);
  };
  if (state.activity === 'rows') {
    const width = state.target === 10 ? 5 : 4;
    for (let i = 0; i < state.target; i++) act(field({ slot: Math.floor(i / width) * 5 + i % width }));
    return { state, ui };
  }
  if (state.activity === 'beans') {
    if (state.change === 'none') act(field({ change: 'water' }));
    act(command('wait')); act(command('wait'));
    for (const tile of BED_TILES) act(field({ tile }));
    return { state, ui };
  }
  if (kind === 'science' && !state.activity) {
    if (state.canopy === 'none') act(command('shade-left'));
    act(command('wait')); act(command('wait')); return { state, ui };
  }
  if (kind === 'reading' && !state.activity) {
    for (const item of readingItems(state.request)) { act(command(`pick-${item}`)); if (!encounterReady(state)) act(command('next')); }
    return { state, ui };
  }
  if (state.activity === 'pizza') {
    if (grade === 5) act(field({ pizza: true }));
    let i = 0; while (remainingUnits(state) > 0 && i < 60) act(field({ give: i++ % 4 }));
    act(command('try')); return { state, ui };
  }
  let patch;
  if (state.activity === 'chain') patch = { chain: chainFor(grade, state.request).cards, energy: expectedEnergy(grade), shone: true };
  else if (state.activity === 'compass') patch = { done: state.request === 2 ? ['north', 'east', 'south'] : ['north', 'west', 'lantern'] };
  else if (state.activity === 'helpday') patch = { crew: Object.entries(helpSetFor(grade, state.request).fits).map(([job, helper]) => ({ job, helper })) };
  else if (state.activity === 'ribbon') patch = { why: true, steps: 3, lesson: true };
  else if (state.activity === 'tales') patch = { solved: TALE_DECKS[state.deck].map(t => t.id) };
  else if (kind === 'math') patch = { left: [2], right: [2], rolled: true };
  else if (kind === 'community') patch = { placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 10 }], tried: true };
  else if (kind === 'writing') patch = { text: scenarioById(state.scenario, grade)?.example ?? 'Hello friend!' };
  else if (kind === 'art') {
    const cells = grade === 0 ? [0] : grade <= 2 ? [3,4,5] : grade === 3 && state.request === 1 ? [0,1,4,5] : grade >= 4 && state.request === 2 ? [0,1,2,3,4,5,6,11] : [0,1,2,3,4,5];
    patch = { stamps: cells.map((cell, i) => ({ ...(expectedAt(grade, cell, state.request) ?? { shape: grade === 0 && state.request === 2 ? 'flower' : 'circle', color: [1,4].includes(cell) ? '#559fc7' : '#e96163' }), ...stampPosition(cell), rotation: 0, flipped: false })) };
  }
  return activity.start({ ...state, ...patch }, context(grade));
}
function short(line, name) {
  assert.equal(typeof line, 'string', name);
  assert.ok(line.length <= 96, `${name}: ${line.length}: ${line}`);
  for (const sentence of line.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 56, `${name}: ${sentence}`);
}
for (const kind of kinds) for (let grade = 0; grade <= 5; grade++) test(`${kind} grade ${grade}: another request and persistence`, () => {
  const activity = activityFor(kind, grade), ctx = context(grade), fresh = activity.start(null, ctx);
  const done = complete(activity, kind, grade, fresh);
  assert.ok(encounterReady(done.state), `fixture ${kind} ${grade}: ${JSON.stringify(done.state)}`);
  const old = { ...done.state }; delete old.request;
  assert.deepEqual(activity.start(old, ctx).state, done.state, 'legacy state keeps request 1 mechanics');
  assert.equal(cleanCreation(kind, old).request, 1);
  assert.match(activity.opening(done.state, done.ui, grade), /Try another/);
  short(activity.opening(done.state, done.ui, grade), 'ready opening');
  const commands = activity.commands(done.state, done.ui, grade);
  assert.ok(commands.length <= 4); assert.ok(commands.every(c => c.label.length <= 12));
  freeze(done.state); freeze(done.ui);
  assert.equal(typeof activity.another, 'function');
  const next = activity.another(done.state, done.ui, grade);
  assert.deepEqual(activity.another(done.state, done.ui, grade), next, 'another is deterministic and pure');
  assert.equal(next.state.request, 2); assert.ok(!encounterReady(next.state));
  assert.notDeepEqual(next.state, done.state);
  const firstFresh = activity.start(null, ctx);
  if (kind === 'reading' && !next.state.activity) assert.notDeepEqual(readingItems(next.state.request), readingItems(1));
  else if (next.state.activity === 'rows') assert.notEqual(next.state.target, firstFresh.state.target);
  else if (next.state.activity === 'pizza') assert.notEqual(next.state.slices, firstFresh.state.slices);
  else if (next.state.activity === 'ribbon') assert.notEqual(next.state.story, firstFresh.state.story);
  else if (next.state.activity === 'tales') assert.notEqual(next.state.deck, firstFresh.state.deck);
  else if (kind === 'writing') assert.notEqual(next.state.scenario, done.state.scenario);
  else if (kind === 'math') assert.notDeepEqual(next.state.left, firstFresh.state.left);
  else if (kind === 'science' && !next.state.activity) assert.notEqual(next.state.canopy, firstFresh.state.canopy);
  else if (next.state.activity === 'beans') assert.notEqual(next.state.change, firstFresh.state.change);
  else if (next.state.activity === 'chain') assert.notDeepEqual(chainFor(grade, 2).cards, chainFor(grade, 1).cards);
  else if (next.state.activity === 'helpday') assert.notDeepEqual(helpSetFor(grade, 2).jobIds, helpSetFor(grade, 1).jobIds);
  else if (next.state.activity === 'compass') assert.notDeepEqual(errandsFor(next.state), errandsFor(firstFresh.state));
  else if (kind === 'community') assert.notDeepEqual(squareSteps(next.state), squareSteps(firstFresh.state));
  else if (kind === 'art') {
    if (grade === 1 || grade === 2) assert.notDeepEqual(yukiStamps(grade, 2), yukiStamps(grade, 1));
    assert.equal(encounterReady({ ...done.state, request: 2 }), false, 'the old banner does not satisfy the new pattern or count');
  }
  short(next.line, 'another opening');
  short(activity.opening(next.state, next.ui, grade), 'reopened request opening');
  assert.deepEqual(activity.start(next.state, ctx).state, next.state);
  assert.deepEqual(normalizeEncounterSnapshot(kind, next.state, grade, ctx.chapter), next.state);
  assert.deepEqual(cleanCreation(kind, next.state), next.state);
  const freshCommands = activity.commands(next.state, next.ui, grade);
  assert.ok(freshCommands.length <= 4); assert.ok(freshCommands.every(c => c.label.length <= 12));
  const help = activity.helpFor ? activity.helpFor(grade) : typeof activity.help === 'function' ? activity.help(grade) : activity.help;
  help.forEach(line => short(line, 'help'));
  let save = createState(); save.chapter = ctx.chapter; save.grade = grade;
  save = publishCreation(save, kind, done.state);
  const published = getCreations(save)[kind];
  save = saveDraft(save, kind, next.state);
  assert.equal(getDraft(save, kind).request, 2);
  assert.deepEqual(getCreations(save)[kind], published);
  assert.ok(getCompleted(save).includes(kind));
  const finishedNext = complete(activity, kind, grade, next);
  assert.ok(encounterReady(finishedNext.state), `second fixture ${kind} ${grade}: ${JSON.stringify(finishedNext.state)}`);
  save = publishCreation(save, kind, finishedNext.state);
  assert.equal(getCreations(save)[kind].request, 2);
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(saveState(save, storage), true);
  assert.equal(getCreations(loadState(storage))[kind].request, 2);
  const count = kind === 'math' && (grade < 5) ? 3 : 2;
  let last = finishedNext;
  if (count === 3) { const third = activity.another(last.state, last.ui, grade); assert.equal(third.state.request, 3); last = complete(activity, kind, grade, third); assert.ok(encounterReady(last.state), `third fixture ${kind} ${grade}`); }
  const wrapped = activity.another(last.state, last.ui, grade);
  assert.equal(wrapped.state.request, 1); assert.ok(!encounterReady(wrapped.state));
  for (const [value, expected] of [[undefined, 1], [0, 1], [-3, 1], [999, count], [1.5, 1], ['2', 1]]) {
    assert.equal(activity.start({ ...next.state, request: value }, ctx).state.request, expected, `${kind} ${grade} request ${value}`);
  }
  if (grade > 0) { save.grade = grade === 5 ? 4 : grade + 1; assert.equal(getDraft(save, kind), null); assert.equal(getCreations(save)[kind], undefined); }
});
