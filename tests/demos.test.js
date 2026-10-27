import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { demoFor } from '../src/ui/demos.js';
import { activityFor } from '../src/ui/registry.js';
import { encounterReady, normalizeEncounterSnapshot } from '../src/encounters.js';
import { currentStory } from '../src/ribbon.js';
import { Doc, pressKey } from './helpers/dom.js';

const SUBJECTS = ['math', 'science', 'reading', 'art', 'writing', 'community'];
const GRADES = [0, 1, 2, 3, 4, 5];
const CASES = SUBJECTS.flatMap(kind => GRADES.map(grade => ({
  kind, grade, activity: activityFor(kind, grade), options: { grade, chapter: grade === 0 ? 0 : 1, seed: 42 },
})));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function fits(line, limit = 96) {
  assert.equal(typeof line, 'string');
  assert.ok(line.trim().length > 0, 'dialogue is not empty');
  assert.ok(line.length <= limit, `${line.length}/${limit}: ${line}`);
  for (const sentence of line.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) {
    assert.ok(sentence.length <= 56, `${sentence.length}/56: ${sentence}`);
  }
  assert.doesNotMatch(line, /\b(?:todo|tbd|fixme|placeholder|undefined|null|NaN|lorem|ipsum)\b/i);
  assert.doesNotMatch(line, /\bFINISH\b|\{[^}]+\}|<[^>]+>/, 'no template placeholders');
}

function availableCommand(activity, state, ui, action, grade) {
  assert.deepEqual(Object.keys(action).sort(), ['id', 'type']);
  const choice = activity.commands(state, ui, grade).find(c => c.id === action.id);
  assert.ok(choice, `command ${action.id} is offered at this step`);
  assert.ok(!choice.disabled, `command ${action.id} is enabled`);
  assert.ok(!choice.finish, 'the runner hands back the turn without publishing');
}

for (const { kind, grade, activity, options } of CASES) {
  test(`${kind}, grade ${grade}: a short, normalized demo reaches a real enabled finish`, () => {
    const demo = freeze(demoFor(activity, grade));
    assert.ok(demo, `${activity.title} has a demo`);
    assert.ok(demo.steps.length >= 2 && demo.steps.length <= 6);
    fits(demo.intro);
    fits(demo.done);
    assert.match(demo.done, /when yours is ready\. Your turn!$/);
    assert.deepEqual(demo.snapshot, normalizeEncounterSnapshot(kind, demo.snapshot, grade, options.chapter));
    let { state, ui } = activity.start(demo.snapshot, options);
    assert.deepEqual(state, demo.snapshot, 'start accepts the example without repairing or reseeding it');
    assert.equal(encounterReady(state), false, 'the example still has work to demonstrate');
    for (const { action, line } of demo.steps) {
      fits(line, 56);
      assert.ok(['command', 'field'].includes(action.type));
      if (action.type === 'command') availableCommand(activity, state, ui, action, grade);
      else assert.equal(Object.keys(action).length, 2, 'one actual field choice per step');
      const before = structuredClone({ state, ui });
      freeze(state); freeze(ui);
      const result = activity.act(state, ui, action, grade);
      assert.ok(!isDeepStrictEqual(result.state, state) || !isDeepStrictEqual(result.ui, ui) || result.line,
        `no dead step: ${JSON.stringify(action)}`);
      assert.deepEqual({ state, ui }, before, 'steps do not mutate the previous draft or UI');
      ({ state, ui } = result);
      assert.deepEqual(state, normalizeEncounterSnapshot(kind, state, grade, options.chapter),
        'each intermediate snapshot also normalizes without changing');
    }
    assert.equal(encounterReady(state), true, 'all current demos finish; none need an early-stop exception');
    const finish = activity.commands(state, ui, grade).find(c => c.finish);
    assert.ok(finish && !finish.disabled);
    assert.ok(demo.done.includes(finish.label), `handoff names ${finish.label}`);
    assert.deepEqual(demoFor(activity, String(grade)), demo, 'numeric string grades follow the registry');
  });
}

// Locate the existing control rather than inventing field actions in a second dispatcher.
function controlFor(host, state, action) {
  const [key] = Object.keys(action).filter(key => key !== 'type');
  if (state.activity === 'ribbon') {
    const story = currentStory(state);
    const choice = {
      why: ['.ribbon-option', story.options.map(option => option.id)],
      card: ['.ribbon-card', story.shuffled],
      lesson: ['.ribbon-lesson', story.lessons.map(lesson => lesson.id)],
    }[key];
    return host.querySelectorAll(choice[0])[choice[1].indexOf(action[key])];
  }
  if (key === 'line') return host.querySelectorAll('.tales-line')[action.line];
  if (key === 'pizza') return host.querySelector('.pizza-board');
  if (key === 'color' || key === 'shape') {
    return [...host.querySelectorAll(`.banner-${key === 'color' ? 'paints' : 'shapes'} button`)]
      .find(button => button.dataset.value === action[key]);
  }
  return [...host.querySelectorAll('button')].find(button => String(button.dataset[key]) === String(action[key]));
}

for (const mode of ['tap', 'keyboard']) for (const { kind, grade, activity, options } of CASES) {
  test(`${kind}, grade ${grade}: ${mode} controls emit every demo field action and draw each step`, t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const doc = new Doc(), host = doc.createElement('div');
    doc.body.append(host);
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    t.after(() => previous ? Object.defineProperty(globalThis, 'document', previous) : delete globalThis.document);
    const demo = demoFor(activity, grade);
    let { state, ui } = activity.start(demo.snapshot, options);
    let emitted = [];
    const view = activity.mountField(host, { grade, dispatch: action => emitted.push(action) });
    t.after(() => view.destroy());
    view.update(state, ui);
    for (const { action } of demo.steps) {
      if (action.type === 'field') {
        const button = controlFor(host, state, action);
        assert.ok(button, `a control exists for ${JSON.stringify(action)}`);
        assert.ok(!button.disabled, 'the control is enabled');
        for (let node = button; node; node = node.parentElement) assert.ok(!node.hidden, 'the control is visible');
        emitted = [];
        if (mode === 'tap') button.click();
        else {
          button.focus();
          assert.equal(doc.activeElement, button, 'the control can take keyboard focus');
          pressKey(button, 'keydown', 'Enter');
        }
        assert.deepEqual(emitted, [action], 'one tap or Enter emits the exact scripted action');
      } else availableCommand(activity, state, ui, action, grade);
      ({ state, ui } = activity.act(state, ui, action, grade));
      view.update(state, ui);
    }
    assert.equal(encounterReady(state), true);
  });
}

for (const activity of new Set(CASES.map(item => item.activity))) {
  test(`${activity.title}: unsupported grades return null without throwing`, () => {
    for (const grade of GRADES) if (activityFor(activity.kind, grade) !== activity) {
      assert.equal(demoFor(activity, grade), null);
      assert.equal(demoFor(activity, String(grade)), null);
    }
    for (const grade of [-1, 6, 1.5, NaN, Infinity, null, undefined, '', ' ', 'K', 'nope', {}, [], Symbol('grade')]) {
      assert.equal(demoFor(activity, grade), null);
    }
  });
}

test('music, missing activities, and unregistered activities have no encounter demo', () => {
  for (const activity of [null, undefined, {}, { kind: 'music' }, { kind: 'math', title: 'Unknown cart' }, { kind: 'toString' }]) {
    for (const grade of GRADES) assert.equal(demoFor(activity, grade), null);
  }
});

function separateObjects(first, second) {
  if (!first || typeof first !== 'object') return;
  assert.notEqual(first, second, 'each replay owns every snapshot, step, array and action');
  for (const key of Object.keys(first)) separateObjects(first[key], second[key]);
}

test('replays have independent data and use alternate examples where the rules allow them', () => {
  for (const { activity, grade, options } of CASES) {
    const first = demoFor(activity, grade), second = demoFor(activity, grade);
    assert.deepEqual(first, second, 'scripts are deterministic');
    separateObjects(first, second);
    const normal = activity.start(null, options).state;
    const sample = first.snapshot;
    const key = { rows: 'target', pizza: 'slices', ribbon: 'story', tales: 'deck', beans: 'bed', chain: 'chain',
      compass: 'done', helpday: 'crew' }[sample.activity]
      ?? { math: 'left', science: 'canopy', reading: 'found', art: 'background', community: 'placements' }[sample.kind];
    // Signs choose a random scenario in normal play. The demo pins its own scenario instead.
    if (key) assert.notDeepEqual(sample[key], normal[key], `${activity.title} uses a different ${key}`);
  }
});
