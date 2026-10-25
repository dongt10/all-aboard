import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import compass, { HELP, fieldView } from '../src/ui/activities/compass.js';
import {
  GRID, GRADES_COMPASS, STAMP_COMPASS, PLACES, ERRANDS, ERRAND_IDS, DIRECTION_HINT, ROUTE_STYLES, LINES,
  normalizeCompass, cleanCompassCreation, compassReady, compassOpening, currentErrand,
  deliver, routes, placeAt, tapLine, compassCreationMarkup, compassGlyph,
} from '../src/compass.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { PAGE_CHARS, paginate } from '../src/ui/dialogue.js';
import { routeIntent } from '../src/ui/input.js';
import { contrastRatio } from '../src/ui/palette.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { controlStyle, declarations, cssRules } from './helpers/css.js';

const cmd = id => ({ type: 'command', id });
const field = cell => ({ type: 'field', cell });
const snapshot = (done = [], grade = 2, chapter = 1) => ({ kind: 'community', activity: 'compass', grade, chapter, done });
const cellOf = ([row, col]) => row * GRID + col;
const subsets = Array.from({ length: 8 }, (_, mask) => ERRAND_IDS.filter((_, i) => mask & (1 << i)));
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function fits(line) {
  assert.equal(typeof line, 'string');
  for (const sentence of line.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  for (const cap of Object.values(PAGE_CHARS)) {
    const pages = paginate(line, cap);
    assert.ok(pages.every(page => page.length <= cap));
    assert.equal(pages.join(' '), line.trim());
  }
}

function contract(state, ui = {}) {
  const commands = compass.commands(state, ui);
  assert.equal(commands.length, 4);
  assert.equal(new Set(commands.map(command => command.id)).size, 4);
  assert.equal(commands.filter(command => command.finish).length, 1);
  assert.deepEqual(commands.at(-1), { id: 'finish', label: 'Hang map', icon: 'check', finish: true, disabled: !compassReady(state) });
  assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  for (const command of commands) {
    assert.ok(command.label.length <= 12);
    assert.ok(ICON_NAMES.includes(command.icon));
  }
  fits(compass.opening(state, ui));
  return commands;
}

function mount(dispatch = () => {}) {
  const doc = new Doc(), host = doc.createElement('section');
  doc.body.append(host);
  const mounted = compass.mountField(host, { grade: 2, dispatch });
  return { doc, host, mounted, root: host.firstElementChild, cells: host.querySelectorAll('.compass-cell') };
}

test('compass imports independently and exposes the grade-2 activity contract', () => {
  assert.deepEqual(GRADES_COMPASS, [2]);
  assert.equal(compass.kind, 'community');
  assert.equal(compass.title, 'Hana’s compass errands');
  assert.equal(compass.rewardLabel, 'Delivery map');
  assert.ok(compass.rewardLabel.length <= 16);
  for (const key of ['start', 'opening', 'commands', 'act', 'mountField']) assert.equal(typeof compass[key], 'function');
  const imports = [...source('../src/compass.js').matchAll(/^import\s+.*?from\s+['"](.+?)['"]/gm)].map(match => match[1]);
  assert.deepEqual(imports, ['./ui/palette.js']);
  assert.deepEqual(compass.start(), { state: snapshot(), ui: {} });
  contract(compass.start().state);
});

test('the map and errand paths match all six places and the two-step lantern trip', () => {
  assert.equal(GRID, 5);
  assert.deepEqual(PLACES, { kiosk: [2, 2], bakery: [1, 2], stage: [2, 0], shed: [2, 4], workshop: [3, 4], pond: [4, 2] });
  assert.deepEqual(ERRANDS, [
    { id: 'north', target: [1, 2], path: [[2, 2], [1, 2]], near: { cell: [0, 2] } },
    { id: 'west', target: [2, 0], path: [[2, 2], [2, 1], [2, 0]] },
    { id: 'lantern', target: [3, 4], path: [[2, 2], [2, 3], [2, 4], [3, 4]], near: { cell: [2, 4] } },
  ]);
  assert.deepEqual(ERRAND_IDS, ['north', 'west', 'lantern']);
  for (const [place, point] of Object.entries(PLACES)) assert.equal(placeAt(cellOf(point)), place);
  for (const cell of [0, 1, 2, 24, -1, 25, 1.5, '7', null, NaN, {}, Symbol('cell')]) assert.equal(placeAt(cell), null);
  assert.deepEqual(DIRECTION_HINT, { north: 'North is up on the map.', west: 'West is left on the map.', lantern: 'East is right, south is down.' });
});

test('start ignores legacy K–2 community saves and unrelated activity snapshots', () => {
  const fresh = compass.start();
  for (const input of [null, undefined, [], 'compass', 7, Symbol('snapshot'),
    { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }], done: ERRAND_IDS },
    { kind: 'community', activity: 'helpday', done: ERRAND_IDS },
    { kind: 'math', activity: 'compass', done: ERRAND_IDS },
    { kind: 'community', done: ERRAND_IDS }]) assert.deepEqual(compass.start(input), fresh);
  const resumed = compass.start(snapshot(['north']));
  assert.deepEqual(resumed.state, snapshot(['north']));
  assert.deepEqual(resumed.ui, {});
  assert.equal(compass.opening(resumed.state), 'Errand 2 of 3. The stage is west of the kiosk. Tap the stage.');
  assert.equal(compass.opening(resumed.state), compassOpening(resumed.state));
  assert.equal(compass.start(snapshot([], 5), { grade: 1, chapter: 0 }).state.grade, 1);
  assert.equal(compass.start(snapshot([], 5), { grade: 1, chapter: 0 }).state.chapter, 0);
});

test('normalization removes junk, orders unique errands, and never mutates the input', () => {
  for (const junk of [null, undefined, [], 'compass', 42, NaN, Infinity, Symbol('snapshot'), {}]) assert.deepEqual(normalizeCompass(junk), snapshot());
  for (const done of [undefined, null, 'north', {}, 7, Array(3)]) assert.deepEqual(normalizeCompass({ done }).done, []);
  const input = Object.freeze({ ...snapshot(Object.freeze(['lantern', 'west', 'north', 'north', null, {}, '__proto__'])),
    phase: 'ready', title: '<script>', extra: 'discard' });
  const safe = normalizeCompass(input);
  assert.deepEqual(safe, snapshot(['north', 'west', 'lantern']));
  assert.notEqual(safe.done, input.done);
  for (const done of subsets) {
    const state = normalizeCompass({ done });
    assert.deepEqual(normalizeCompass(state, state.grade, state.chapter), state);
    assert.deepEqual(cleanCompassCreation(state), state);
    assert.deepEqual(cleanCompassCreation(cleanCompassCreation(state)), state);
  }
});

test('grade and chapter bounds preserve normalized grades instead of forcing grade 2', () => {
  for (const [grade, expected] of [[-99, 0], [99, 5], [2.49, 2], [2.5, 3], ['4', 4], [NaN, 0], [Infinity, 0], [-Infinity, 0], [{}, 0], [Symbol('grade'), 0], [null, 0]]) {
    for (const chapter of [0, 1, 2, -1, '1', null, NaN, Infinity, Symbol('chapter')]) {
      const state = normalizeCompass({ done: ERRAND_IDS }, grade, chapter);
      assert.equal(state.grade, expected);
      assert.equal(state.chapter, chapter === 1 ? 1 : 0);
      assert.deepEqual(cleanCompassCreation(state), state);
      assert.deepEqual(normalizeCompass(state, state.grade, state.chapter), state);
    }
  }
  for (const grade of [0, 1, 2, 3, 4, 5]) assert.equal(cleanCompassCreation(snapshot(ERRAND_IDS, grade)).grade, grade);
  for (const junk of [null, undefined, 7, 'compass', [], {}, Symbol('creation'), { kind: 'community' },
    { kind: 'math', activity: 'compass' }, { kind: 'community', activity: 'square' }]) assert.equal(cleanCompassCreation(junk), null);
});

test('ready requires the right kind, activity, grade, chapter, and all three errands', () => {
  const ready = snapshot(['north', 'west', 'lantern']);
  assert.equal(compassReady(ready), true);
  for (const done of subsets) assert.equal(compassReady(snapshot(done)), done.length === 3);
  for (const done of [[], ['north', 'north', 'north'], ['north', 'west', 'other'], [...ERRAND_IDS, 'extra'], null, {}, 'north west lantern', Array(3)]) {
    assert.equal(compassReady({ ...ready, done }), false);
  }
  for (const extra of [{ kind: 'math' }, { activity: 'helpday' }, { activity: undefined },
    ...[0, 1, 3, 4, 5, 6, -1, 2.5, '2', null, undefined].map(grade => ({ grade })),
    ...[0, 2, '1', undefined].map(chapter => ({ chapter }))]) assert.equal(compassReady({ ...ready, ...extra }), false);
  for (const junk of [null, undefined, {}, [], 2, Symbol('state')]) assert.equal(compassReady(junk), false);
});

test('four fixed commands stay visible, with reset and finish gated by saved work', () => {
  for (const done of subsets) for (const grade of [0, 1, 2, 3, 4, 5]) {
    const state = snapshot(done, grade), commands = contract(state);
    assert.deepEqual(commands.map(command => [command.id, command.label, command.icon]), [
      ['next', 'Next errand', 'next'], ['rose', 'Compass', 'map'], ['reset', 'Start over', 'undo'], ['finish', 'Hang map', 'check'],
    ]);
    assert.equal(commands[2].disabled, done.length === 0);
    assert.equal(commands[3].disabled, grade !== 2 || done.length !== 3);
  }
});

test('all 25 cells have the correct outcome for each errand, with no saving on a wrong try', () => {
  for (const [n, errand] of ERRANDS.entries()) {
    const state = Object.freeze(snapshot(Object.freeze(ERRAND_IDS.slice(0, n)))), ui = Object.freeze({});
    assert.equal(currentErrand(state), errand);
    for (let cell = 0; cell < GRID * GRID; cell++) {
      const expected = cell === cellOf(errand.target) ? 'done' : cell === 12 ? 'kiosk' : errand.near && cell === cellOf(errand.near.cell) ? 'near' : 'wrong';
      const result = deliver(state, cell), action = compass.act(state, ui, field(cell));
      assert.equal(result.status, expected, `${errand.id}, cell ${cell}`);
      assert.equal(action.ui, ui);
      assert.deepEqual(action.state, result.state);
      assert.equal(action.line, tapLine(state, cell));
      fits(action.line);
      if (expected === 'done') {
        assert.notEqual(result.state, state);
        assert.deepEqual(result.state.done, ERRAND_IDS.slice(0, n + 1));
      } else {
        assert.equal(result.state, state); assert.equal(action.state, state);
        assert.deepEqual(compass.commands(action.state, action.ui), compass.commands(state, ui));
      }
    }
    assert.deepEqual(state.done, ERRAND_IDS.slice(0, n));
  }
});

test('near misses teach the final step; the lantern shed is not the lantern destination', () => {
  const north = snapshot(), lantern = snapshot(['north', 'west']);
  assert.equal(tapLine(north, 2), 'North is right! Pip stops one square up.');
  assert.equal(deliver(north, 2).state, north);
  assert.equal(tapLine(lantern, 14), 'That is the lantern shed. Now go south 1.');
  assert.equal(deliver(lantern, 14).state, lantern);
  assert.equal(deliver(lantern, 19).status, 'done');
  assert.equal(tapLine(north, 12), 'That is the kiosk, where you start.');
  for (const [n, errand] of ERRANDS.entries()) assert.equal(tapLine(snapshot(ERRAND_IDS.slice(0, n)), 24), `That is a different way. ${DIRECTION_HINT[errand.id]}`);
});

test('full play-through explains the three jobs, resumes, hangs the map, and can start over', () => {
  let { state, ui } = compass.start();
  assert.equal(compass.opening(state), 'Three errands today. Pip walks north from the kiosk. Tap where Pip stops.');
  const expectedLines = [
    'The baker needs flour. Pip the courier helps. Choose Next errand.',
    'Kiko needs a drum on the stage. Taro carries it. Choose Next errand.',
    'Taro needs light to work. Your lantern helps! All three errands are done! Choose Hang map.',
  ];
  for (const [n, errand] of ERRANDS.entries()) {
    Object.freeze(state.done); Object.freeze(state); Object.freeze(ui);
    const next = compass.act(state, ui, cmd('next'));
    assert.equal(next.state, state); assert.equal(next.ui, ui); fits(next.line);
    const result = compass.act(state, ui, field(cellOf(errand.target)));
    assert.equal(result.line, expectedLines[n]); fits(result.line);
    assert.equal(result.ui, ui);
    assert.equal(state.done.length, n);
    ({ state, ui } = result);
    contract(state, ui);
    assert.deepEqual(compass.start(state).state, state);
    assert.deepEqual(cleanCompassCreation(state), state);
    const repeated = compass.act(state, ui, field(cellOf(errand.target)));
    assert.equal(repeated.state, state); assert.equal(repeated.ui, ui); fits(repeated.line);
  }
  assert.equal(currentErrand(state), null);
  assert.equal(compassReady(state), true);
  assert.equal(compass.opening(state), 'All three errands are done. Hang map, or start over.');
  assert.equal(compass.commands(state).at(-1).disabled, false);
  assert.deepEqual(compass.act(state, ui, cmd('finish')), { state, ui });
  const reset = compass.act(state, ui, cmd('reset'));
  assert.deepEqual(reset.state, snapshot());
  assert.equal(reset.ui, ui);
  assert.equal(reset.line, 'The map is clear. Start with errand 1.');
  assert.equal(compassReady(reset.state), false);
  assert.equal(compass.commands(reset.state).at(-1).disabled, true);
  assert.deepEqual(compass.act(reset.state, ui, cmd('reset')), { state: reset.state, ui });
});

test('Next errand only repeats the first unfinished errand and cannot skip ahead', () => {
  for (const done of subsets) {
    const state = Object.freeze(snapshot(Object.freeze([...done]))), ui = Object.freeze({});
    const expected = ERRANDS.find(errand => !done.includes(errand.id)) ?? null;
    assert.equal(currentErrand(state), expected);
    for (let n = 0; n < 4; n++) {
      const result = compass.act(state, ui, cmd('next'));
      assert.equal(result.state, state); assert.equal(result.ui, ui);
      assert.equal(result.line, compassOpening(state)); fits(result.line);
    }
  }
  assert.equal(compassOpening(snapshot(['west'])), `Errand 1 of 3. ${LINES.prompts.north}`);
});

test('malformed taps and unknown actions preserve frozen state and ui exactly', () => {
  for (const done of [[], ERRAND_IDS]) {
    const state = Object.freeze(snapshot(Object.freeze([...done]))), ui = Object.freeze({});
    for (const action of [null, undefined, {}, cmd('finish'), cmd('unknown'), cmd('__proto__'),
      { type: 'command', id: {} }, { type: 'field' }, { type: 'other', cell: 7 },
      ...[-1, 25, 2.5, '7', null, undefined, NaN, Infinity, {}, [1, 2], Symbol('cell')].map(field)]) {
      const result = compass.act(state, ui, action);
      assert.deepEqual(result, { state, ui });
      assert.equal(result.state, state); assert.equal(result.ui, ui);
    }
    const rose = compass.act(state, ui, cmd('rose'));
    assert.equal(rose.state, state); assert.equal(rose.ui, ui);
    assert.equal(rose.line, 'North is up, south is down. West is left, east is right.');
    assert.equal(rose.line.length, 56);
  }
  const state = snapshot();
  for (const cell of [-1, 25, null, '7', Symbol('cell')]) {
    assert.deepEqual(deliver(state, cell), { state, status: 'wrong' });
    assert.equal(tapLine(state, cell), null);
  }
  for (const grade of [0, 1, 3, 4, 5]) {
    const state = snapshot([], grade);
    assert.equal(deliver(state, 7).state, state);
  }
});

test('a finished map can be explored without changing its saved routes', () => {
  const state = Object.freeze(snapshot(Object.freeze([...ERRAND_IDS]))), ui = Object.freeze({});
  for (let cell = 0; cell < 25; cell++) {
    assert.deepEqual(deliver(state, cell), { state, status: 'ready' });
    const result = compass.act(state, ui, field(cell));
    assert.equal(result.state, state); assert.equal(result.ui, ui);
    assert.equal(result.line, LINES.places[placeAt(cell)] ?? 'Just grass here.');
    fits(result.line);
  }
  assert.equal(tapLine(state, 7), 'The bakery is north of the kiosk.');
  assert.equal(tapLine(state, 19), 'Taro’s workshop is south of the lantern shed.');
});

test('done routes have distinct colors and end shapes and cannot mutate the map paths', () => {
  const complete = routes(snapshot(['lantern', 'north', 'west', 'north', 'foreign']));
  assert.deepEqual(complete.map(route => route.id), ERRAND_IDS);
  assert.equal(new Set(complete.map(route => route.color)).size, 3);
  assert.deepEqual(complete.map(route => route.marker), ['circle', 'square', 'triangle']);
  assert.deepEqual(complete.map(route => route.path), ERRANDS.map(errand => errand.path));
  for (const route of complete) assert.deepEqual({ color: route.color, marker: route.marker }, ROUTE_STYLES[route.id]);
  assert.deepEqual(routes(null), []);
  assert.deepEqual(routes(snapshot()), []);
  complete[0].path[0][0] = 99;
  assert.deepEqual(routes(snapshot(ERRAND_IDS))[0].path, [[2, 2], [1, 2]]);
});

test('field text is bounded, Pip moves once, and clue cards never name the destination', () => {
  for (const done of subsets) {
    const state = snapshot(done), view = fieldView(state);
    assert.equal(view.cells.length, 25);
    assert.equal(view.pip, done.includes('north') ? 7 : 12);
    assert.equal(view.cells.filter(cell => cell.pip).length, 1);
    assert.equal(view.ready, compassReady(state));
    assert.deepEqual(view.routes, routes(state));
    for (const text of [view.head, view.card.title, view.card.hint, view.card.label, ...view.card.clues.flatMap(clue => [clue.text, clue.label]), ...view.cells.map(cell => cell.label)]) fits(text);
    assert.doesNotMatch(JSON.stringify(view.card), /bakery|stage|workshop/i);
    if (view.errand) assert.equal(view.head, `Errand ${ERRAND_IDS.indexOf(view.errand) + 1} of 3`);
  }
  assert.deepEqual(fieldView(snapshot()).card.clues.map(clue => clue.text), ['↑ 1']);
  assert.deepEqual(fieldView(snapshot(['north'])).card.clues.map(clue => clue.text), ['← 1']);
  assert.deepEqual(fieldView(snapshot(['north', 'west'])).card.clues.map(clue => clue.text), ['→ 2', '↓ 1']);
  const detached = fieldView(snapshot()); detached.card.clues[0].text = 'changed';
  assert.equal(fieldView(snapshot()).card.clues[0].text, '↑ 1');
});

test('help, stamp, openings and every static or generated sentence meet the dialogue limits', () => {
  assert.deepEqual(HELP, [
    'North is up on the map. East is right.',
    'Listen to the errand. Tap the square it names.',
    'Choose Compass or Next errand if you are stuck.',
    'Do all three errands, then choose Hang map.',
  ]);
  assert.equal(compass.help, HELP);
  assert.equal(compass.notReadyLine, 'An errand is open again. Finish all three.');
  assert.equal(STAMP_COMPASS, 'A compass shows north, south, east and west.');
  const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  for (const line of [...HELP, STAMP_COMPASS, ...strings(LINES), ...Object.values(DIRECTION_HINT)]) fits(line);
  assert.equal(LINES.compass.length, 56);
  for (let n = 1; n <= 3; n++) fits(LINES.openingMid(n));
  for (const id of ERRAND_IDS) fits(LINES.wrong(id));
});

test('creation draws one labeled square map, the grid, places, north arrow and only completed routes', () => {
  for (const done of subsets) {
    const markup = compassCreationMarkup(snapshot(done)), doc = new Doc(), host = doc.createElement('div');
    host.innerHTML = markup;
    const svg = host.querySelector('svg');
    assert.equal(host.querySelectorAll('svg').length, 1);
    assert.equal(svg.getAttribute('viewBox'), '0 0 100 100');
    assert.equal(svg.getAttribute('role'), 'img');
    assert.equal(svg.className, 'creation creation--community creation--compass');
    assert.equal(svg.getAttribute('aria-label'), `Your delivery map, ${done.length} of 3 errands drawn`);
    fits(svg.getAttribute('aria-label'));
    assert.equal(svg.querySelector('text').textContent, 'N');
    assert.deepEqual(svg.querySelectorAll('.compass-route').map(route => route.dataset.errand), done);
    assert.equal(svg.querySelectorAll('.compass-route').length, done.length);
    assert.ok(markup.includes('M5 5v90M5 5h90'));
    assert.ok(markup.includes('M95 5v90M5 95h90'));
    assert.equal(svg.querySelectorAll('[transform]').length, 6);
    assert.doesNotMatch(markup, /<script|onload|NaN|Infinity|undefined/);
  }
});

test('creation discards hostile values and escapes any interpolated route strings', () => {
  const attack = '<script onload="boom">&\'';
  const markup = compassCreationMarkup({ ...snapshot(), done: [attack, '__proto__', 'north', 'north'], title: attack, grade: attack, chapter: attack, path: attack, color: attack });
  assert.match(markup, /Your delivery map, 1 of 3 errands drawn/);
  assert.doesNotMatch(markup, /<script|onload|__proto__|NaN|Infinity|undefined/);
  for (const junk of [null, undefined, [], {}, NaN, Infinity, attack, Symbol('creation')]) {
    assert.doesNotMatch(compassCreationMarkup(junk), /<script|onload|NaN|Infinity|undefined/);
  }
  const color = ROUTE_STYLES.north.color;
  try {
    ROUTE_STYLES.north.color = '"/><script>bad</script>&\'';
    const escaped = compassCreationMarkup(snapshot(['north']));
    assert.ok(escaped.includes('&quot;/&gt;&lt;script&gt;bad&lt;/script&gt;&amp;&#39;'));
    assert.doesNotMatch(escaped, /<script/);
  } finally { ROUTE_STYLES.north.color = color; }
  for (const name of [...Object.keys(PLACES), 'flour', 'drum']) {
    assert.match(compassGlyph(name), /viewBox="0 0 24 24"/);
    assert.doesNotMatch(compassGlyph(name), /<image|<filter|<linearGradient|<radialGradient/);
  }
  assert.doesNotMatch(compassGlyph('__proto__'), /\[object Object\]/);
});

test('mounted field builds once and keeps every button, figure, route and card node in place', () => {
  const { doc, host, mounted, root, cells } = mount();
  const nodes = root.querySelectorAll('*'), paths = root.querySelectorAll('.compass-route');
  assert.equal(cells.length, 25);
  assert.equal(root.querySelectorAll('button').length, 25);
  assert.equal(root.querySelectorAll('input, textarea, select').length, 0);
  assert.equal(root.querySelectorAll('.figure--pip').length, 1);
  assert.equal(root.querySelectorAll('.figure--community').length, 1);
  for (const figure of root.querySelectorAll('.figure')) assert.match(figure.getAttribute('style'), /width:32px;height:32px/);
  assert.deepEqual(root.querySelectorAll('.compass-letter').map(letter => letter.textContent), ['N', 'E', 'S', 'W']);
  assert.equal(root.querySelector('.compass-rose').getAttribute('aria-label'), LINES.compass);
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
  assert.equal(cells[12].tabIndex, 0);
  cells[7].focus();
  for (const done of [[], ['north'], ['north', 'west'], ERRAND_IDS, []]) {
    const state = snapshot(done), view = fieldView(state);
    mounted.update(state, {});
    assert.equal(doc.activeElement, cells[7]);
    assert.equal(cells[7].tabIndex, 0);
    assert.deepEqual(root.querySelectorAll('*'), nodes);
    assert.equal(root.querySelector('.compass-count').textContent, view.head);
    assert.equal(root.querySelector('.compass-card__title').textContent, view.card.title);
    assert.deepEqual(paths.filter(path => path.getAttribute('visibility') === 'visible').map(path => path.dataset.errand), done);
    assert.equal(root.querySelectorAll('.compass-picture').filter(picture => !picture.hidden).length, 1);
    assert.equal(root.querySelectorAll('.compass-picture').find(picture => !picture.hidden).dataset.picture, view.card.picture);
    assert.equal(root.querySelector('.compass-pip').style.left, '118px');
    assert.equal(root.querySelector('.compass-pip').style.top, done.includes('north') ? '68px' : '118px');
    for (const cell of cells) fits(cell.getAttribute('aria-label'));
  }
  assert.deepEqual(paths.map(path => path.dataset.marker), ['circle', 'square', 'triangle']);
  for (const path of paths) {
    const lines = path.querySelectorAll('polyline');
    assert.equal(lines.at(-1).parentElement.getAttribute('stroke-width'), '4');
    assert.equal(lines.at(-1).getAttribute('stroke-dasharray'), '8 5');
  }
  mounted.destroy();
  assert.equal(host.children.length, 0);
  assert.equal(Object.values(root.listeners).flat().length, 0);
});

test('nested map taps dispatch numeric cells and update the activity without replacing focus', () => {
  let session = compass.start(), env;
  const actions = [];
  env = mount(action => { actions.push(action); session = compass.act(session.state, session.ui, action); env.mounted.update(session.state, session.ui); });
  const { root, cells, doc, mounted } = env;
  for (const cell of [7, 10, 14, 19]) {
    cells[cell].firstElementChild.dispatchEvent(new Event('click'));
    assert.deepEqual(actions.at(-1), field(cell));
    assert.equal(doc.activeElement, cells[cell]);
    assert.equal(cells[cell].tabIndex, 0);
  }
  assert.equal(actions.length, 4);
  assert.equal(compassReady(session.state), true);
  root.querySelector('.compass-clue').click();
  assert.equal(actions.length, 4);
  mounted.destroy();
  cells[0].click();
  assert.equal(actions.length, 4);
});

test('keyboard arrows rove the 5 by 5 map and leave bottom-edge Down for the menu', () => {
  const actions = [], { doc, cells, mounted } = mount(action => actions.push(action));
  for (let at = 0; at < 25; at++) {
    for (const [key, offset, allowed] of [
      ['ArrowUp', -5, at >= 5], ['ArrowDown', 5, at < 20],
      ['ArrowLeft', -1, at % 5 > 0], ['ArrowRight', 1, at % 5 < 4],
    ]) {
      cells[at].focus();
      const event = pressKey(cells[at], 'keydown', key);
      assert.equal(doc.activeElement, cells[allowed ? at + offset : at]);
      assert.equal(event.defaultPrevented, key !== 'ArrowDown' || allowed);
      assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
    }
  }
  assert.deepEqual(actions, []);
  cells[12].focus();
  for (const key of ['Tab', 'Escape', 'ArrowRight']) {
    const event = pressKey(cells[12], 'keydown', key, key === 'ArrowRight' ? { ctrlKey: true } : {});
    assert.equal(event.defaultPrevented, false);
    assert.equal(doc.activeElement, cells[12]);
  }
  const event = pressKey(cells[12], 'keydown', 'w');
  assert.equal(event.defaultPrevented, true); assert.equal(doc.activeElement, cells[7]);
  mounted.destroy();
});

test('native Enter and Space each make one delivery and retain the cell focus', () => {
  let session = compass.start(), env;
  const actions = [];
  env = mount(action => { actions.push(action); session = compass.act(session.state, session.ui, action); env.mounted.update(session.state, session.ui); });
  for (const [cell, key] of [[7, 'Enter'], [10, ' '], [19, 'Enter']]) {
    env.cells[cell].focus();
    assert.equal(routeIntent({ target: env.cells[cell], key }), 'native');
    assert.equal(pressKey(env.cells[cell], 'keydown', key).defaultPrevented, false);
    assert.equal(pressKey(env.cells[cell], 'keyup', key).defaultPrevented, false);
    assert.equal(env.doc.activeElement, env.cells[cell]);
  }
  assert.deepEqual(actions, [field(7), field(10), field(19)]);
  assert.equal(compassReady(session.state), true);
  env.mounted.destroy();
});

test('CSS keeps the exact field, 50px tap cells and the rose and card inside the right column', () => {
  const css = source('../src/ui/activities/compass.css');
  const rule = selector => declarations(css, selector);
  const px = (selector, property) => parseFloat(rule(selector)[property]);
  assert.equal(px('.compass-field', 'width'), 520); assert.equal(px('.compass-field', 'height'), 268);
  assert.equal(px('.compass-map', 'left'), 4); assert.equal(px('.compass-map', 'top'), 5);
  assert.equal(px('.compass-map', 'width'), 258); assert.equal(px('.compass-map', 'height'), 258);
  assert.equal(px('.compass-map', 'border'), 4);
  assert.equal(rule('.compass-grid')['grid-template-columns'], 'repeat(5, 50px)');
  assert.equal(rule('.compass-grid')['grid-template-rows'], 'repeat(5, 50px)');
  assert.equal(px('.compass-cell', 'width'), 50); assert.equal(px('.compass-cell', 'height'), 50);
  assert.equal(px('.compass-map', 'width') - 2 * px('.compass-map', 'border'), 5 * px('.compass-cell', 'width'));
  assert.equal(px('.compass-side', 'left'), 272); assert.equal(px('.compass-side', 'width'), 244);
  assert.equal(px('.compass-side', 'left') + px('.compass-side', 'width'), 516);
  for (const child of ['.compass-map', '.compass-side']) assert.ok(px(child, 'top') + px(child, 'height') <= 268);
  assert.equal(px('.compass-rose', 'width'), 100); assert.equal(px('.compass-rose', 'height'), 100);
  assert.ok(px('.compass-rose', 'top') + px('.compass-rose', 'height') < px('.compass-card', 'top'));
  assert.equal(px('.compass-card', 'top') + px('.compass-card', 'height'), 258);
  assert.equal(rule('.compass-routes')['pointer-events'], 'none');
  assert.equal(rule('.compass-pip')['pointer-events'], 'none');
  assert.equal(rule('.compass-cell:focus-visible')['z-index'], undefined, 'a focused cell must not paint over Pip or its route marker');
  assert.doesNotMatch(rule('.compass-card').overflow ?? '', /hidden/);
});

test('all field words use font tokens and reserve room for Bigger words without shrinking them', () => {
  const css = source('../src/ui/activities/compass.css'), combined = `${source('../src/ui/tokens.css')}\n${css}`;
  for (const { declarations: values } of cssRules(css)) {
    if (values['font-size']) assert.match(values['font-size'], /^var\(--text-(?:small|field|body)\)$/);
  }
  const { doc, root, mounted } = mount();
  for (const large of [false, true]) {
    doc.body.classList.toggle('large-text', large);
    for (const [selector, size] of [['.compass-count', large ? 20 : 16], ['.compass-letter', large ? 24 : 20],
      ['.compass-card__title', large ? 24 : 20], ['.compass-clue', large ? 24 : 20], ['.compass-card__hint', large ? 20 : 16]]) {
      assert.equal(controlStyle(root.querySelector(selector), combined)['font-size'], `${size}px`);
    }
    for (const done of subsets) {
      mounted.update(snapshot(done));
      const view = fieldView(snapshot(done)), titleStyle = controlStyle(root.querySelector('.compass-card__title'), combined);
      const clueStyle = controlStyle(root.querySelector('.compass-clue'), combined), smallSize = large ? 20 : 16;
      assert.ok(view.head.length * smallSize * 0.6 + 20 <= 244);
      assert.ok(view.card.title.length * parseFloat(titleStyle['font-size']) * 0.6 <= 184);
      assert.ok(view.card.hint.length * smallSize * 0.6 <= 228);
      assert.ok(view.card.clues.reduce((width, clue) => width + clue.text.length * parseFloat(clueStyle['font-size']) * 0.6 + 18, 0) + 8 <= 228);
      assert.ok(contrastRatio(titleStyle.color, controlStyle(root.querySelector('.compass-card'), combined).background) >= 4.5);
      assert.ok(contrastRatio(clueStyle.color, clueStyle.background) >= 4.5);
    }
  }
  const card = declarations(css, '.compass-card');
  assert.ok(36 + 30 + 20 + 8 + 2 * (parseFloat(card.padding) + parseFloat(card.border)) <= parseFloat(card.height));
  mounted.destroy();
});
