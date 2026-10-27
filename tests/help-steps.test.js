import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFor } from '../src/ui/registry.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { helpSteps, stepIndex, stepPicture } from '../src/ui/help-steps.js';
import { encounterReady } from '../src/encounters.js';
import { expectedAt, stampPosition } from '../src/banner-rules.js';
import { expectedEnergy } from '../src/chain.js';
import { helpSetFor } from '../src/helpday.js';
import { ERRAND_IDS } from '../src/compass.js';
import { scenariosFor } from '../src/sign-scenarios.js';

const kinds = ['math', 'science', 'art', 'reading', 'writing', 'community'];
const stamp = (cell, shape = 'star', color = '#e96163') => ({ ...stampPosition(cell), shape, color, rotation: 0, flipped: false });
function fixtures(kind, grade, state) {
  switch (state.activity ?? kind) {
    case 'math': return [{ right: [state.left[0]] }, { right: [...state.left], rolled: true }];
    case 'science': return [{ canopy: 'left' }, { canopy: 'left', time: 10 }];
    case 'art': {
      if (grade === 0) return [{ stamps: [] }, { stamps: [stamp(0)] }];
      if (grade < 3) return [{ stamps: [{ ...stamp(3), ...expectedAt(grade, 3) }] }, { stamps: [3, 4, 5].map(i => ({ ...stamp(i), ...expectedAt(grade, i) })) }];
      const stamps = [stamp(0), stamp(5), stamp(6, 'circle', '#559fc7'), stamp(11, 'circle', '#559fc7'), stamp(12), stamp(17)];
      return [{ stamps: stamps.slice(0, 1) }, { stamps }];
    }
    case 'writing': return [{ text: 'Hello' }, { text: scenariosFor(grade)[0].example, scenario: scenariosFor(grade)[0].id }];
    case 'reading': return [{ found: ['key'] }, { found: ['key', 'umbrella', 'book'] }];
    case 'community': { const placements = [{ item: 'bench', x: 10, y: 90 }, { item: 'quiet', x: 10, y: 10 }]; return [{ placements: placements.slice(0, 1) }, { placements, tried: true }]; }
    case 'rows': return [{ target: 12, crates: [0] }, { target: 12, crates: [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13] }];
    case 'beans': return [{ change: 'water', weeks: 1 }, { change: 'water', weeks: 2, bed: ['seed', 'sun', 'water'] }];
    case 'compass': return [{ done: [ERRAND_IDS[0]] }, { done: ERRAND_IDS }];
    case 'ribbon': return [{ why: true, steps: 1 }, { why: true, steps: 3, lesson: true }];
    case 'pizza': return [{ slices: 8, plates: [2, 0, 0, 0] }, { slices: 8, plates: [4, 4, 4, 4], halves: grade >= 5, tried: true }];
    case 'chain': { const chain = grade === 4 ? ['pondweed', 'snail', 'frog'] : ['plant', 'fish', 'gull']; return [{ chain: [chain[0], null, null] }, { chain, energy: expectedEnergy(grade), shone: true }]; }
    case 'helpday': { const crew = Object.entries(helpSetFor(grade).fits).map(([job, helper]) => ({ job, helper })); return [{ crew: crew.slice(0, 1) }, { crew }]; }
    case 'tales': return [{ deck: 0, solved: ['momo-kitchen'] }, { deck: 0, solved: ['momo-kitchen', 'taro-pier', 'kiko-stage'] }];
  }
}

test('every served grade has valid fresh, saved middle, and ready steps', () => {
  for (let grade = 0; grade <= 5; grade++) for (const kind of kinds) {
    const activity = activityFor(kind, grade), { state, ui } = activity.start(null, { grade, chapter: 1 });
    const steps = helpSteps(activity, grade), [mid, ready] = fixtures(kind, grade, state);
    const saved = changes => activity.start({ ...state, ...changes }, { grade, chapter: 1 }).state;
    const middleState = saved(mid), readyState = saved(ready), label = `${grade} ${kind}`;
    assert.equal(stepIndex(activity, state, ui, grade), 0, label);
    const expectedMiddle = state.activity === 'ribbon' ? 2 : kind === 'art' && grade === 0 ? 0 : kind === 'math' && !state.activity ? 2 : kind === 'community' && !state.activity && grade === 0 ? 2 : 1;
    assert.equal(stepIndex(activity, middleState, {}, grade), expectedMiddle, label);
    assert.equal(encounterReady(readyState), true, `fixture ready: ${label}`);
    assert.equal(stepIndex(activity, readyState, {}, grade), steps.length - 1, label);
    for (const current of [state, middleState, readyState]) {
      const index = stepIndex(activity, current, {}, grade);
      assert.ok(index >= 0 && index < steps.length, label);
    }
    for (let i = 0; i < steps.length; i++) assert.ok(ICON_NAMES.includes(stepPicture(activity, state, i, grade)));
    assert.equal(stepPicture(activity, state, -1, grade), null);
    assert.equal(stepPicture(activity, state, steps.length, grade), null);
  }
});

test('help source supports grade functions and arrays', () => {
  assert.deepEqual(helpSteps({ helpFor: g => [`grade ${g}`], help: ['fallback'] }, 4), ['grade 4']);
  assert.deepEqual(helpSteps({ help: g => [`grade ${g}`] }, 2), ['grade 2']);
  assert.deepEqual(helpSteps({ help: ['one'] }, 2), ['one']);
  assert.deepEqual(helpSteps({}, 2), []);
});

test('pattern, checklist, discoveries and unknown activity use truthful saved progress', () => {
  const art = activityFor('art', 1), a = art.start(null, { grade: 1, chapter: 1 }).state;
  assert.equal(stepIndex(art, { ...a, stamps: [stamp(3)] }, {}, 1), 0); // wrong pattern
  assert.equal(stepIndex(art, { ...a, stamps: [{ ...stamp(3), ...expectedAt(1, 3) }] }, {}, 1), 1);
  const square = activityFor('community', 1), s = square.start(null, { grade: 1, chapter: 1 }).state;
  assert.equal(stepIndex(square, { ...s, placements: [{ item: 'bench', x: 10, y: 50 }] }, {}, 1), 0);
  assert.equal(stepIndex(square, { ...s, placements: [{ item: 'bench', x: 10, y: 90 }, { item: 'quiet', x: 10, y: 10 }] }, {}, 1), 2);
  const story = activityFor('reading', 0), r = story.start(null, { grade: 0, chapter: 1 }).state;
  assert.equal(stepIndex(story, { ...r, found: ['hat'] }, { review: 'hat' }, 0), 0);
  assert.equal(stepIndex(story, { ...r, found: ['key'] }, {}, 0), 1);
  assert.equal(stepIndex(story, { ...r, found: ['key'] }, { review: 'key' }, 0), 2, 'review explains the packed picture');
  for (const grade of [3, 4, 5]) {
    const mirror = activityFor('art', grade), state = mirror.start(null, { grade, chapter: 1 }).state;
    assert.equal(stepIndex(mirror, { ...state, stamps: [stamp(0), stamp(5)] }, {}, grade), 2, 'matching pairs still need more stamps or colors');
    assert.equal(stepPicture(mirror, state, 1, grade), 'turn');
  }
  const wrong = { kind: 'science', activity: 'pizza', grade: 3, plates: [2, 0, 0, 0], canopy: 'none', time: 0 };
  assert.equal(stepIndex(activityFor('science', 3), wrong, {}, 3), 0);
  assert.equal(stepPicture(activityFor('science', 3), wrong, 0, 3), null);
  assert.equal(stepIndex({ kind: 'math', title: 'Unknown', help: ['a', 'b'] }, { kind: 'math', left: [1], right: [1], rolled: true }, {}, 0), 1);
});

test('helpers preserve saved request fields and do not mutate inputs', () => {
  const activity = activityFor('math', 3), { state, ui } = activity.start(null, { grade: 3, chapter: 1 });
  const draft = { ...state, request: { slices: 8 }, plates: [2, 0, 0, 0] };
  const before = structuredClone({ draft, ui });
  stepIndex(activity, draft, ui, 3); stepPicture(activity, draft, 1, 3); helpSteps(activity, 3);
  assert.deepEqual({ draft, ui }, before);
});
