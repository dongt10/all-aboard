import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import beans, { HELP, LINES as UI_LINES, fieldView } from '../src/ui/activities/beans.js';
import {
  GRADES_BEANS, STAMP_BEANS, BED_TILES, TRAY_TILES, CHANGES, TILE_NAMES, LINES,
  normalizeBeans, cleanBeansCreation, beansReady, beansOpening, chooseChange, waitWeek,
  toggleTile, testDone, cupState, nextStepLine, beanGlyphMarkup, beansCreationMarkup,
} from '../src/beans.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { routeIntent } from '../src/ui/input.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { controlStyle, declarations, cssRules } from './helpers/css.js';

const command = id => ({ type: 'command', id });
const field = data => ({ type: 'field', ...data });
const snapshot = parts => normalizeBeans(parts, 2, 1);
const ready = change => snapshot({ change: change ?? 'water', weeks: 2, bed: BED_TILES });
const step = (result, action) => beans.act(result.state, result.ui, action);
const freeze = state => { Object.freeze(state.bed); return Object.freeze(state); };
const beds = Array.from({ length: 16 }, (_, mask) => BED_TILES.filter((tile, i) => mask & (1 << i)));
const states = () => beds.flatMap(bed => [snapshot({ bed }), ...CHANGES.flatMap(change =>
  [0, 1, 2].map(weeks => snapshot({ change, weeks, bed }))) ]);

test('week two names Plant bed when the bed was filled first, for either change', () => {
  for (const change of CHANGES) for (const bed of beds) {
    let result = beans.start();
    for (const tile of bed) result = step(result, field({ tile }));
    result = step(result, field({ change }));
    result = step(result, command('wait'));
    const before = result.state;
    result = step(result, command('wait'));
    assert.equal(before.weeks, 1, 'the previous state is untouched');
    assert.equal(result.state.weeks, 2);
    const complete = ['seed', 'sun', 'water'].every(tile => bed.includes(tile));
    assert.equal(beans.commands(result.state, result.ui).at(-1).disabled, !complete);
    assert.match(result.line, change === 'water' ? /Plants need water!/ : /Plants need sunlight!/);
    assert.ok(result.line.endsWith(complete ? 'Choose Plant bed.' : 'Fill the bed card.'));
    if (complete) assert.doesNotMatch(result.line, /Fill the bed card/);
    fits(result.line);
  }
});

function fits(text) {
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 0);
  for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
    assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  }
  for (const limit of Object.values(PAGE_CHARS)) {
    const pages = paginate(text, limit);
    assert.ok(pages.every(page => page.length <= limit));
    assert.equal(pages.join(' '), text);
  }
}
function contract(state, ui = {}) {
  const commands = beans.commands(state, ui);
  assert.equal(commands.length, 4);
  assert.equal(new Set(commands.map(c => c.id)).size, 4);
  assert.deepEqual(commands.map(c => c.id), ['wait', 'next', 'reset', 'finish']);
  assert.deepEqual(commands.map(c => c.label), ['Wait a week', 'Next step', 'Start over', 'Plant bed']);
  assert.deepEqual(commands.map(c => c.icon), ['clock', 'help', 'undo', 'check']);
  assert.equal(commands.filter(c => c.finish).length, 1);
  assert.deepEqual(commands.at(-1), { id: 'finish', label: 'Plant bed', icon: 'check', finish: true, disabled: !beansReady(state) });
  assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  for (const c of commands) { assert.ok(c.label.length <= 12); assert.ok(ICON_NAMES.includes(c.icon)); fits(c.label); }
  assert.equal(commands[2].disabled, state.change === 'none' && state.weeks === 0 && !state.bed.length);
  fits(beans.opening(state, ui));
  return commands;
}
function mounted(initial = beans.start()) {
  const doc = new Doc(), host = doc.createElement('section'), actions = [];
  doc.body.append(host);
  let result = initial;
  const view = beans.mountField(host, { grade: 2, dispatch(action) {
    actions.push(action); result = step(result, action); view.update(result.state, result.ui);
  } });
  view.update(result.state, result.ui);
  return { doc, host, view, actions, root: host.firstElementChild, get result() { return result; } };
}

test('beans imports standalone with the exact grade, snapshot, title, reward, and tile order', () => {
  assert.deepEqual(GRADES_BEANS, [2]);
  assert.deepEqual(BED_TILES, ['seed', 'sun', 'water', 'bee']);
  assert.deepEqual(TRAY_TILES, ['seed', 'sun', 'water', 'bee', 'dark', 'dry']);
  assert.deepEqual(CHANGES, ['water', 'dark']);
  assert.deepEqual(beans.start(), { state: {
    kind: 'science', activity: 'beans', request: 1, grade: 2, chapter: 1, change: 'none', weeks: 0, bed: [],
  }, ui: {} });
  assert.equal(beans.kind, 'science');
  assert.equal(beans.title, 'Momo’s bean test');
  assert.equal(beans.rewardLabel, 'Garden bed card');
  assert.ok(beans.rewardLabel.length <= 16);
  assert.equal(UI_LINES, LINES);
  for (const name of ['start', 'opening', 'commands', 'act', 'mountField']) assert.equal(typeof beans[name], 'function');
  contract(beans.start().state);
});

test('legacy science saves and other activities start fresh at grades K through 2', () => {
  for (const grade of [0, 1, 2]) for (const chapter of [0, 1]) {
    const fresh = beans.start(null, { grade, chapter });
    for (const legacy of [
      { kind: 'science', grade, chapter, canopy: 'left', time: 20 },
      { kind: 'science', change: 'dark', weeks: 2, bed: BED_TILES },
      { ...ready(), activity: 'chain' }, { ...ready(), kind: 'math' },
    ]) assert.deepEqual(beans.start(legacy, { grade, chapter }), fresh);
  }
  for (const change of CHANGES) {
    const saved = snapshot({ change, weeks: 1, bed: ['bee', 'water'] });
    assert.deepEqual(beans.start(saved).state, saved);
    assert.deepEqual(beans.start(saved).ui, {});
  }
});

test('cleaning rejects unrelated junk; normalization bounds and filters without mutating', () => {
  for (const junk of [null, undefined, 7, 'beans', [], {}, Symbol('beans'),
    { kind: 'science' }, { kind: 'math', activity: 'beans' }, { kind: 'science', activity: 'ice' }]) {
    assert.equal(cleanBeansCreation(junk), null);
    assert.deepEqual(normalizeBeans(junk), snapshot());
  }
  const source = Object.freeze({ change: 'dark', weeks: 99,
    bed: Object.freeze(['bee', 'seed', 'dark', 'sun', 'seed', 'dry', null, {}, 'water']), ui: { phase: 'done' }, extra: '<script>' });
  const clean = normalizeBeans(source);
  assert.deepEqual(clean, ready('dark'));
  assert.deepEqual(Object.keys(clean).sort(), ['activity', 'bed', 'change', 'chapter', 'grade', 'kind', 'request', 'weeks']);
  assert.deepEqual(source.bed, ['bee', 'seed', 'dark', 'sun', 'seed', 'dry', null, {}, 'water']);
  for (const bad of [null, 'seed', 12, {}, Symbol('bed')]) assert.deepEqual(normalizeBeans({ bed: bad }).bed, []);
  for (const change of [undefined, null, 'same', 'Water', 'both', {}, ['water'], Symbol('change')]) {
    const s = normalizeBeans({ change, weeks: 2, bed: ['water'] });
    assert.equal(s.change, 'none'); assert.equal(s.weeks, 0); assert.deepEqual(s.bed, ['water']);
  }
});

test('grade and chapter normalization preserve the scope; unsupported grades never become grade 2', () => {
  assert.deepEqual(cleanBeansCreation({ kind: 'science', activity: 'beans' }), { ...snapshot(), grade: 0, chapter: 0 });
  assert.deepEqual(cleanBeansCreation({ ...ready(), chapter: undefined, grade: undefined }), { ...ready(), grade: 0, chapter: 0 });
  for (const [grade, expected] of [[-99, 0], [99, 5], [2.6, 3], ['4', 4], [NaN, 0], [Infinity, 0],
    [-Infinity, 0], [null, 0], [{}, 0], [Symbol('grade'), 0], [2n, 0]]) {
    for (const chapter of [0, 1, 2, 99, null, '1', NaN, Symbol('chapter')]) {
      const s = normalizeBeans(ready(), grade, chapter);
      assert.equal(s.grade, expected); assert.equal(s.chapter, chapter === 1 ? 1 : 0);
      assert.deepEqual(cleanBeansCreation(s), s);
      assert.deepEqual(normalizeBeans(s, s.grade, s.chapter), s);
    }
  }
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const s = cleanBeansCreation({ ...ready(), grade });
    assert.equal(s.grade, grade); assert.equal(beansReady(s), grade === 2);
  }
});

test('weeks are bounded whole counts and always zero before a change', () => {
  for (const [weeks, expected] of [[-1, 0], [0, 0], [0.6, 1], [1, 1], [1.7, 2], [2, 2], [99, 2],
    ['2', 2], [null, 0], [undefined, 0], [NaN, 0], [Infinity, 0], [{}, 0], [Symbol('weeks'), 0]]) {
    for (const change of CHANGES) assert.equal(normalizeBeans({ change, weeks }).weeks, expected);
    assert.equal(normalizeBeans({ change: 'none', weeks }).weeks, 0);
  }
});

test('every valid subset and test stage is idempotent and survives a saved creation round-trip', () => {
  for (const state of states()) {
    freeze(state);
    assert.deepEqual(normalizeBeans(state, state.grade, state.chapter), state);
    assert.deepEqual(cleanBeansCreation(state), state);
    assert.deepEqual(cleanBeansCreation(JSON.parse(JSON.stringify(state))), state);
    assert.deepEqual(beans.start(state).state, state);
    contract(state);
  }
});

test('readiness requires grade 2, chapter 1, one real change, two weeks, and the three plant tiles', () => {
  for (const change of CHANGES) {
    const s = ready(change);
    assert.equal(beansReady(s), true); assert.equal(testDone(s), true);
    assert.equal(beansReady({ ...s, bed: ['seed', 'sun', 'water'] }), true);
    for (const extra of [
      { kind: 'math' }, { activity: 'ice' }, { activity: undefined }, { chapter: 0 }, { chapter: '1' },
      ...[0, 1, 3, 4, 5, 2.5, '2', undefined].map(grade => ({ grade })),
      { change: 'none' }, { change: 'both' }, { weeks: 0 }, { weeks: 1 }, { weeks: 3 }, { weeks: '2' },
      ...[null, {}, [], Array(4), [...BED_TILES, 'bee'], ['seed', 'seed', 'seed', 'seed'],
        ['seed', 'sun', 'water', 'dark'], [...BED_TILES].reverse()].map(bed => ({ bed })),
      ...['seed', 'sun', 'water'].map(tile => ({ bed: BED_TILES.filter(id => id !== tile) })),
    ]) assert.equal(beansReady({ ...s, ...extra }), false, JSON.stringify(extra));
  }
  for (const bad of [null, undefined, 1, [], {}, 'beans']) { assert.equal(beansReady(bad), false); assert.equal(testDone(bad), false); }
});

test('each final plant tile explains itself, and bee is a separate optional pollen tap', () => {
  for (const last of ['seed', 'sun', 'water']) {
    let s = beans.start(snapshot({ change: 'water', weeks: 2 }));
    for (const tile of ['seed', 'sun', 'water'].filter(tile => tile !== last)) s = step(s, field({ tile }));
    s = step(s, field({ tile: last }));
    assert.equal(s.line, `${LINES[last]} ${LINES.allFour}`);
    assert.equal(beans.commands(s.state).at(-1).disabled, false);
    assert.equal(s.state.bed.includes('bee'), false);
    const saved = beans.start(JSON.parse(JSON.stringify(s.state)));
    assert.equal(beansReady(saved.state), true);
    s = step(saved, field({ tile: 'bee' }));
    assert.equal(s.line, LINES.bee);
    assert.equal(beansReady(s.state), true);
    s = step(s, field({ tile: 'bee' }));
    assert.equal(beansReady(s.state), true);
  }
});

test('Same as A and a wait before choosing explain the test without changing saved work', () => {
  for (const state of [snapshot(), snapshot({ bed: BED_TILES }), ready()]) {
    const ui = Object.freeze({}); freeze(state);
    assert.deepEqual(chooseChange(state, 'none'), { state, status: 'same' });
    const same = beans.act(state, ui, field({ change: 'none' }));
    assert.equal(same.state, state); assert.equal(same.ui, ui);
    assert.equal(same.line, 'Same conditions cannot test water or light. Pick a change.'); fits(same.line);
    if (state.change === 'none') {
      assert.equal(waitWeek(state), state);
      const wait = beans.act(state, ui, command('wait'));
      assert.equal(wait.state, state); assert.equal(wait.ui, ui);
      assert.equal(wait.line, 'Pick one change for cup B first. Change one thing only. Then you know why.'); fits(wait.line);
    }
  }
});

for (const change of CHANGES) test(`${change}: choose, watch two weeks, fill the bed, remove, restore, and start over`, () => {
  let result = beans.start();
  const say = action => {
    const previous = freeze(result.state), ui = Object.freeze(result.ui);
    const next = step(result, action);
    assert.equal(next.ui, ui); fits(next.line); contract(next.state, next.ui);
    assert.deepEqual(cleanBeansCreation(next.state), next.state);
    assert.ok(Object.isFrozen(previous)); result = next;
    return next.line;
  };
  assert.equal(beans.opening(result.state), 'Two bean cups. Cup A gets sun and water. What will cup B get?');
  assert.equal(say(field({ change })), change === 'water' ? LINES.changeWater : LINES.changeDark);
  assert.equal(result.state.weeks, 0);
  assert.equal(beans.opening(result.state), 'Week 0 of 2. Choose Wait a week.');
  assert.equal(say(command('wait')), change === 'water'
    ? 'Week 1. Cup A sprouts. Dry cup B stays a seed.' : 'Week 1. Both cups sprout. Cup B is pale.');
  assert.equal(cupState(result.state, 'a'), 'sprout');
  assert.equal(cupState(result.state, 'b'), change === 'water' ? 'seed' : 'pale');
  assert.equal(say(command('next')), 'Week 1 of 2. Choose Wait a week.');
  assert.equal(say(command('wait')), change === 'water'
    ? 'Week 2. Cup A grows tall. Cup B is still a seed. Plants need water! Fill the bed card.'
    : 'Week 2. Cup A grows tall. Cup B grows weak and pale. Plants need sunlight! Fill the bed card.');
  assert.equal(cupState(result.state, 'a'), 'tall');
  assert.equal(cupState(result.state, 'b'), change === 'water' ? 'seed' : 'pale');
  assert.equal(testDone(result.state), true); assert.equal(beansReady(result.state), false);
  const done = result.state;
  assert.equal(say(command('wait')), LINES.done); assert.equal(result.state, done);
  assert.equal(say(command('next')), LINES.done); assert.equal(result.state, done);
  for (const tile of BED_TILES) {
    assert.equal(say(field({ tile })), tile === 'water' ? `${LINES.water} ${LINES.allFour}` : LINES[tile]);
  }
  assert.equal(beansReady(result.state), true);
  assert.equal(beans.opening(result.state), 'Your bed card is ready. Plant bed, or Try another.');
  assert.equal(say(command('next')), LINES.ready);
  assert.equal(say(field({ tile: 'water' })), 'The water is back in the tray.');
  assert.equal(beansReady(result.state), false); assert.equal(result.state.weeks, 2);
  assert.equal(say(field({ tile: 'water' })), `${LINES.water} ${LINES.allFour}`);
  assert.equal(beansReady(result.state), true);
  assert.equal(say(command('reset')), 'Fresh cups. Cup A gets sun and water again.');
  assert.deepEqual(result.state, snapshot());
  const reset = result.state;
  say(command('reset')); assert.equal(result.state, reset);
});

test('bed tiles can be collected early, in any order; the experiment still gates finishing', () => {
  for (const change of CHANGES) {
    let result = beans.start();
    for (const tile of [...BED_TILES].reverse()) result = step(result, field({ tile }));
    assert.deepEqual(result.state.bed, BED_TILES);
    assert.equal(result.line, `${LINES.seed} ${LINES.early}`);
    assert.equal(beansReady(result.state), false);
    result = step(result, field({ change }));
    result = step(result, command('wait')); assert.equal(beansReady(result.state), false);
    result = step(result, command('wait')); assert.equal(beansReady(result.state), true);
    assert.equal(step(result, command('next')).line, LINES.ready);
  }
});

test('switching the changed condition restarts the cups while preserving the bed', () => {
  for (const change of CHANGES) for (const weeks of [0, 1, 2]) {
    const state = freeze(snapshot({ change, weeks, bed: ['seed', 'sun'] })), ui = Object.freeze({});
    const other = CHANGES.find(id => id !== change);
    const result = beans.act(state, ui, field({ change: other }));
    assert.equal(result.state.change, other); assert.equal(result.state.weeks, 0);
    assert.equal(result.state.bed, state.bed); assert.equal(result.ui, ui);
    assert.equal(chooseChange(state, other).status, weeks > 0 ? 'restart' : 'changed');
    assert.equal(result.line, `${weeks > 0 ? 'New test! ' : ''}${other === 'water' ? LINES.changeWater : LINES.changeDark}`);
    assert.equal(cupState(result.state, 'a'), 'seed'); assert.equal(cupState(result.state, 'b'), 'seed');
    assert.equal(beans.act(state, ui, field({ change })).state, state);
    assert.deepEqual(chooseChange(state, change), { state, status: 'unchanged' });
    fits(result.line);
  }
});

test('both decoys preserve the card, readiness, and UI and explain the missing need', () => {
  for (const state of states()) for (const tile of ['dark', 'dry']) {
    freeze(state); const ui = Object.freeze({});
    assert.equal(toggleTile(state, tile), state);
    const result = beans.act(state, ui, field({ tile }));
    assert.equal(result.state, state); assert.equal(result.ui, ui);
    assert.equal(result.line, tile === 'dark'
      ? 'Plants need sunlight. No dark box in the bed.' : 'Plants need water. Keep the water in the bed.');
    fits(result.line);
  }
});

test('every tile can be added and removed; removing the last-added tile restores the saved values', () => {
  for (const state of states()) for (const tile of BED_TILES) {
    freeze(state);
    const next = toggleTile(state, tile);
    assert.notEqual(next, state); assert.notEqual(next.bed, state.bed);
    assert.equal(next.bed.includes(tile), !state.bed.includes(tile));
    assert.deepEqual(toggleTile(next, tile), state);
    assert.equal(next.change, state.change); assert.equal(next.weeks, state.weeks);
  }
});

test('unknown and ambiguous actions are no-ops and helpers reject unknown ids', () => {
  for (const state of [snapshot(), ready()]) {
    freeze(state); const ui = Object.freeze({});
    for (const action of [null, undefined, {}, 'wait', command('finish'), command('unknown'),
      { type: 'other', tile: 'seed' }, field({}), field({ change: 'both' }), field({ change: null }),
      field({ change: '__proto__' }), field({ tile: '__proto__' }), field({ tile: ['sun'] }),
      field({ tile: 0 }), field({ tile: Symbol('tile') }), field({ change: 'dark', tile: 'sun' })]) {
      assert.deepEqual(beans.act(state, ui, action), { state, ui });
    }
    for (const invalid of ['both', '', null, [], {}, Symbol('invalid')]) {
      assert.deepEqual(chooseChange(state, invalid), { state, status: 'invalid' });
      assert.equal(toggleTile(state, invalid), state);
    }
  }
});

test('all command and field transitions are pure across every valid state', () => {
  const actions = [command('wait'), command('next'), command('reset'), command('finish'),
    ...['none', ...CHANGES].map(change => field({ change })), ...TRAY_TILES.map(tile => field({ tile }))];
  for (const state of states()) {
    const before = structuredClone(state), ui = Object.freeze({}); freeze(state);
    for (const action of actions) {
      const result = beans.act(state, ui, action);
      assert.deepEqual(state, before); assert.equal(result.ui, ui);
      if (JSON.stringify(result.state) === JSON.stringify(state)) assert.equal(result.state, state);
      assert.deepEqual(normalizeBeans(result.state), result.state);
      contract(result.state, result.ui);
      if (result.line) fits(result.line);
    }
  }
});

test('next-step advice and openings derive from the saved phase', () => {
  for (const state of states()) {
    const expected = beansReady(state) ? LINES.ready : testDone(state) ? LINES.done
      : state.change === 'none' ? LINES.nextChange : LINES.running(state.weeks);
    assert.equal(nextStepLine(state), expected);
    assert.equal(beansOpening(state), state.change === 'none' ? LINES.opening : expected);
    assert.equal(beans.opening(state), beansOpening(state));
    assert.equal(beans.act(state, {}, command('next')).state, state);
  }
});

test('cup growth always contrasts healthy cup A with the one changed condition', () => {
  for (const change of ['none', ...CHANGES]) for (const weeks of [0, 1, 2]) {
    const state = snapshot({ change, weeks });
    const expectedA = state.weeks === 0 ? 'seed' : state.weeks === 1 ? 'sprout' : 'tall';
    const expectedB = state.weeks === 0 ? 'seed' : change === 'dark' ? 'pale' : 'seed';
    for (const cup of ['a', 'A']) assert.equal(cupState(state, cup), expectedA);
    for (const cup of ['b', 'B']) assert.equal(cupState(state, cup), expectedB);
  }
  assert.equal(cupState(null, 'a'), 'seed'); assert.equal(cupState(ready(), 'unknown'), 'seed');
});

test('help, stamps, field labels, and every generated sentence fit normal and Bigger words pages', () => {
  assert.equal(STAMP_BEANS, 'Plants need sun and water. Change one thing to test.');
  assert.equal(beans.notReadyLine, 'The bed card changed. Add seed, sun, and water.');
  assert.equal(beans.help, HELP);
  assert.deepEqual(HELP, ['Tap one change for cup B: No water or Dark box.',
    'Choose Wait a week two times. Watch both cups.', 'Add seed, sun, and water. Bee is optional.',
    'Tap Bee for pollen facts, or choose Plant bed.']);
  assert.equal(LINES.seed, 'A seed starts the plant.');
  assert.equal(LINES.sun, 'Sun! Plants need sunlight to grow well.');
  assert.equal(LINES.water, 'Water! Plants need water to grow well.');
  assert.equal(LINES.bee, 'Bees move pollen between flowers. Beans can self-pollinate.');
  for (const line of [...HELP, STAMP_BEANS, beans.title, beans.rewardLabel, ...Object.values(LINES).filter(v => typeof v === 'string')]) { assert.ok(line.length <= 96, line); fits(line); }
  for (const tile of BED_TILES) fits(LINES.removed(TILE_NAMES[tile].toLowerCase()));
  for (const state of states()) {
    const view = fieldView(state);
    for (const line of [view.week, view.bed.title, view.bed.label, ...view.cups.flatMap(c => [c.name, c.label]),
      ...view.changes.map(c => c.name), ...view.bed.slots.map(s => s.label), ...view.tray.flatMap(t => [t.name, t.label])]) fits(line);
    assert.deepEqual(view.tray.map(t => t.tile), TRAY_TILES);
    assert.equal(view.bed.slots.filter(s => s.filled).length, state.bed.length);
    assert.equal(view.changes.filter(c => c.checked).length, 1);
    assert.equal(view.cups[0].growth, cupState(state, 'a'));
    assert.equal(view.cups[1].growth, cupState(state, 'b'));
  }
});

test('creation has one safe SVG, four canonical spots, the soil strip, and the exact accessible name', () => {
  for (const bed of beds) {
    const markup = beansCreationMarkup(snapshot({ bed }));
    assert.match(markup, /^<svg class="creation creation--science creation--beans"/);
    assert.match(markup, /viewBox="0 0 100 65"/);
    assert.match(markup, /role="img" aria-label="Your garden bed card: seed, sun, water and optional bee"/);
    assert.match(markup, /shape-rendering="crispEdges"/);
    assert.equal((markup.match(/<svg\b/g) ?? []).length, 1);
    assert.equal((markup.match(/class="beans-creation-slot"/g) ?? []).length, 4);
    assert.equal((markup.match(/stroke-dasharray/g) ?? []).length, 4 - bed.length);
    assert.deepEqual([...markup.matchAll(/data-tile="([^"]+)"/g)].map(m => m[1]), BED_TILES);
    assert.match(markup, /x="5" y="49" width="90" height="11"/);
    assert.doesNotMatch(markup, /<script|onload|NaN|Infinity|undefined|<image|<filter|[Gg]radient/);
  }
  const attack = '"><script>alert(1)</script><svg onload="evil"';
  for (const input of [null, [], 'bad', NaN, Infinity, Symbol('bad'), { name: attack, bed: [attack, 'seed'], weeks: Infinity },
    { ...ready(), bed: [attack, {}, NaN, Infinity], change: attack, grade: attack }]) {
    assert.doesNotMatch(beansCreationMarkup(input), /<script|onload|NaN|Infinity|undefined|alert\(/);
  }
  for (const tile of TRAY_TILES) assert.match(beanGlyphMarkup(tile), /<(?:path|rect)/);
  assert.equal(beanGlyphMarkup('__proto__'), ''); assert.equal(beanGlyphMarkup('unknown'), '');
});

test('the data module only imports the palette and child-facing science uses grows weak', () => {
  const data = readFileSync(new URL('../src/beans.js', import.meta.url), 'utf8');
  assert.deepEqual([...data.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['./ui/palette.js']);
  assert.match(LINES.week2Water, /still a seed/); assert.match(LINES.week2Dark, /grows weak/);
  assert.doesNotMatch(data, /does not grow/);
});

test('mounted field keeps cups, growth pictures, buttons, and slots in place across every state', () => {
  const m = mounted(), nodes = m.root.querySelectorAll('*');
  const changes = m.root.querySelectorAll('.beans-change'), tiles = m.root.querySelectorAll('.beans-tile');
  assert.equal(changes.length, 3); assert.equal(tiles.length, 6);
  assert.equal(m.root.querySelectorAll('.beans-slot').length, 4);
  assert.equal(m.root.querySelectorAll('.beans-cup').length, 2);
  assert.equal(m.root.querySelector('.beans-changes').getAttribute('role'), 'radiogroup');
  tiles[2].focus();
  for (const state of states()) {
    m.view.update(state);
    assert.deepEqual(m.root.querySelectorAll('*'), nodes);
    assert.equal(m.doc.activeElement, tiles[2]);
    assert.equal(m.root.querySelector('.beans-week').textContent, `Week ${state.weeks} of 2`);
    assert.equal(m.root.querySelectorAll('.beans-slot--filled').length, state.bed.length);
    assert.equal(tiles.filter(t => t.getAttribute('aria-pressed') === 'true').length, state.bed.length);
    assert.equal(changes.find(t => t.getAttribute('aria-checked') === 'true').dataset.change, state.change);
    for (const [i, cup] of m.root.querySelectorAll('.beans-cup').entries()) {
      const shown = cup.querySelectorAll('.beans-growth').filter(g => g.getAttribute('visibility') === 'visible');
      assert.equal(shown.length, 1);
      assert.equal(cup.dataset.growth, cupState(state, i === 0 ? 'a' : 'b'));
      const needs = cup.querySelectorAll('[data-need]').filter(n => !n.hidden).map(n => n.dataset.need);
      assert.deepEqual(new Set(needs), new Set(fieldView(state).cups[i].needs));
      fits(cup.getAttribute('aria-label'));
    }
  }
  m.view.destroy();
  assert.equal(m.host.children.length, 0);
  assert.ok(Object.values(m.root.listeners).every(list => list.length === 0));
  assert.equal(m.doc.activeElement, m.doc.body);
  const count = m.actions.length;
  changes[0].click(); tiles[0].click();
  assert.equal(m.actions.length, count);
});

test('nested picture taps dispatch exactly one action and preserve focused controls on updates', () => {
  const m = mounted(), changes = m.root.querySelectorAll('.beans-change'), tiles = m.root.querySelectorAll('.beans-tile');
  changes[1].querySelector('svg').click();
  assert.deepEqual(m.actions, [field({ change: 'dark' })]);
  assert.equal(m.result.state.change, 'dark'); assert.equal(m.doc.activeElement, changes[1]);
  tiles[0].querySelector('.beans-tile-pic').click();
  assert.deepEqual(m.actions.at(-1), field({ tile: 'seed' }));
  assert.equal(m.doc.activeElement, tiles[0]);
  assert.deepEqual(m.result.state.bed, ['seed']);
  const before = m.result.state;
  tiles[4].click(); assert.equal(m.result.state, before); assert.equal(m.result.line, LINES.dark);
  changes[2].click(); assert.equal(m.result.state, before); assert.equal(m.result.line, LINES.same);
  assert.equal(changes[1].getAttribute('aria-checked'), 'true');
  tiles[0].click(); assert.deepEqual(m.result.state.bed, []);
  m.view.destroy();
});

test('change radios rove with arrows, native keys activate once, and Down at the edge reaches the menu', () => {
  const m = mounted(), changes = m.root.querySelectorAll('.beans-change');
  assert.deepEqual(changes.map(b => b.tabIndex), [0, -1, -1]);
  changes[0].focus();
  const down = pressKey(changes[0], 'keydown', 'ArrowDown');
  assert.equal(down.defaultPrevented, true);
  assert.equal(m.doc.activeElement, changes[1]); assert.equal(m.result.state.change, 'dark');
  assert.deepEqual(changes.map(b => b.tabIndex), [-1, 0, -1]);
  const back = pressKey(changes[1], 'keydown', 'ArrowLeft');
  assert.equal(back.defaultPrevented, true); assert.equal(m.doc.activeElement, changes[0]);
  assert.equal(m.result.state.change, 'water');
  changes[2].focus();
  assert.equal(pressKey(changes[2], 'keydown', 'ArrowDown').defaultPrevented, false);
  assert.equal(pressKey(changes[2], 'keydown', 'Tab').defaultPrevented, false);
  const before = m.result.state;
  for (const key of ['Enter', ' ']) {
    const count = m.actions.length;
    assert.equal(routeIntent({ target: changes[2], key }), 'native');
    assert.equal(pressKey(changes[2], 'keydown', key).defaultPrevented, false);
    pressKey(changes[2], 'keyup', key);
    assert.equal(m.actions.length, count + 1); assert.equal(m.result.state, before);
  }
  m.view.destroy();
});

test('tray arrows move focus without toggling; Tab, Down, and modified keys remain available', () => {
  const m = mounted(), tiles = m.root.querySelectorAll('.beans-tile');
  assert.deepEqual(tiles.map(b => b.tabIndex), [0, -1, -1, -1, -1, -1]);
  tiles[0].focus();
  for (let i = 0; i < 5; i++) {
    assert.equal(pressKey(tiles[i], 'keydown', 'ArrowRight').defaultPrevented, true);
    assert.equal(m.doc.activeElement, tiles[i + 1]);
  }
  assert.deepEqual(m.actions, []);
  assert.deepEqual(tiles.map(b => b.tabIndex), [-1, -1, -1, -1, -1, 0]);
  for (const key of ['ArrowDown', 'Tab', 'Escape']) assert.equal(pressKey(tiles[5], 'keydown', key).defaultPrevented, false);
  assert.equal(pressKey(tiles[5], 'keydown', 'ArrowLeft', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(m.doc.activeElement, tiles[5]);
  for (let i = 5; i > 0; i--) pressKey(tiles[i], 'keydown', 'ArrowLeft');
  const count = m.actions.length;
  pressKey(tiles[0], 'keydown', 'Enter'); pressKey(tiles[0], 'keyup', 'Enter');
  assert.equal(m.actions.length, count + 1); assert.deepEqual(m.result.state.bed, ['seed']);
  pressKey(tiles[0], 'keydown', ' '); pressKey(tiles[0], 'keyup', ' ');
  assert.deepEqual(m.result.state.bed, []);
  const outside = new Event('keydown', { key: 'ArrowRight' }); m.root.dispatchEvent(outside);
  assert.equal(outside.defaultPrevented, false);
  m.view.destroy();
});

test('a keyboard-only mounted run reaches a ready card and keeps two roving tab stops', () => {
  const m = mounted(), changes = m.root.querySelectorAll('.beans-change');
  changes[0].focus(); pressKey(changes[0], 'keydown', 'Enter');
  let result = step(m.result, command('wait')); result = step(result, command('wait'));
  m.view.destroy();
  const done = mounted(result), tray = done.root.querySelectorAll('.beans-tile');
  tray[0].focus();
  for (let i = 0; i < 4; i++) {
    pressKey(tray[i], 'keydown', 'Enter');
    if (i < 3) pressKey(tray[i], 'keydown', 'ArrowRight');
  }
  assert.equal(beansReady(done.result.state), true);
  assert.equal(beans.commands(done.result.state).at(-1).disabled, false);
  assert.equal(done.root.querySelectorAll('button').filter(b => b.tabIndex === 0).length, 2);
  assert.equal(done.doc.activeElement, tray[3]);
  assert.equal(pressKey(tray[3], 'keydown', 'ArrowDown').defaultPrevented, false);
  done.view.destroy();
});

test('field CSS uses readable font tokens in normal and Bigger words modes', () => {
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/kit.css', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/ui/activities/beans.css', import.meta.url), 'utf8');
  const combined = `${tokens}\n${kit}\n${css}`, m = mounted();
  for (const large of [false, true]) {
    m.host.classList.toggle('large-text', large);
    for (const selector of ['.beans-week', '.beans-cup-name', '.beans-change-name', '.beans-bed-title', '.beans-tile-name']) {
      for (const element of m.root.querySelectorAll(selector)) {
        assert.equal(controlStyle(element, combined)['font-size'], large ? '20px' : '16px', selector);
      }
    }
    for (const selector of ['.beans-clock', '.beans-cup-name', '.beans-bed-title']) {
      const style = controlStyle(m.root.querySelector(selector), combined);
      assert.equal(style.border, '1px solid transparent');
      assert.ok(Number.parseFloat(style.height) - 2 >= (large ? 20 : 16), selector);
    }
  }
  for (const rule of cssRules(css)) if (rule.declarations['font-size']) assert.match(rule.declarations['font-size'], /^var\(--text-/);
  assert.doesNotMatch(css, /(?:linear|radial)-gradient|blur\(|text-overflow:\s*ellipsis/);
  m.view.destroy();
});

test('fixed field geometry preserves the planned cups, choices, bed, and all six tray slots', () => {
  const css = readFileSync(new URL('../src/ui/activities/beans.css', import.meta.url), 'utf8');
  const decl = selector => declarations(css, selector);
  const px = (selector, property) => Number.parseFloat(decl(selector)[property]);
  assert.equal(px('.beans-field', 'width'), 520); assert.equal(px('.beans-field', 'height'), 268);
  assert.equal(px('.beans-cup', 'top'), 48); assert.equal(px('.beans-cup', 'width'), 96); assert.equal(px('.beans-cup', 'height'), 134);
  assert.equal(px('.beans-cup--a', 'left'), 10); assert.equal(px('.beans-cup--b', 'left'), 112);
  assert.equal(px('.beans-changes', 'left'), 214); assert.equal(px('.beans-changes', 'width'), 136);
  assert.equal(px('.beans-change', 'height') * 3 + px('.beans-changes', 'gap') * 2, 134);
  assert.equal(px('.beans-bed', 'left'), 356); assert.equal(px('.beans-bed', 'width'), 156);
  assert.equal(px('.beans-slot', 'width'), 48); assert.equal(px('.beans-slot', 'height'), 48);
  assert.equal(px('.beans-tray', 'top'), 190); assert.equal(px('.beans-tile', 'width'), 76); assert.equal(px('.beans-tile', 'height'), 72);
  assert.ok(px('.beans-tray', 'left') + 6 * px('.beans-tile', 'width') + 5 * px('.beans-tray', 'gap') <= 520);
  assert.equal(px('.beans-tray', 'top') + px('.beans-tile', 'height'), 262);
  assert.ok(px('.beans-slots', 'top') + 2 * px('.beans-slot', 'height') + px('.beans-slots', 'gap') < px('.beans-bed', 'height'));
});


test('another starts a fresh dark cup and keeps its request', () => {
  const first = beans.start(null, { grade: 2, chapter: 1 });
  const next = beans.another(first.state, first.ui);
  assert.equal(next.state.request, 2);
  assert.equal(next.state.change, 'dark');
  assert.equal(next.state.weeks, 0);
  assert.equal(cleanBeansCreation(next.state).request, 2);
  assert.equal(beans.another(next.state, next.ui).state.request, 1);
});

test('request two reset returns to the dark cup and disables reset', () => {
  const second = beans.another(beans.start(null, { grade: 2, chapter: 1 }).state, {});
  assert.equal(beans.commands(second.state)[2].disabled, true);
  const advanced = beans.act(second.state, second.ui, { type: 'command', id: 'wait' });
  const reset = beans.act(advanced.state, advanced.ui, { type: 'command', id: 'reset' });
  assert.deepEqual(reset.state, second.state);
  assert.match(reset.line, /dark box/);
});
