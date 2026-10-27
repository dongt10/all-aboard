import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sign, { signWords, signHelp, reactionLine, reconcileTiles, shuffledTiles, SIGN_LINES } from '../src/ui/activities/sign.js';
import { checkSign } from '../src/sign-check.js';
import { signReady, normalizeSign, signOpening, signHelp as ruleHelp } from '../src/sign-rules.js';
import { encounterReady } from '../src/encounters.js';
import { scenarioById, scenariosFor, tilesFor } from '../src/sign-scenarios.js';
import { createState, saveDraft, publishCreation, saveState, loadState, getDraft, getCreations } from '../src/progress.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { controlStyle, declarations } from './helpers/css.js';

const fresh = grade => sign.start(null, { grade, chapter: grade ? 1 : 0, seed: 42 });
const field = (s, action) => sign.act(s.state, s.ui, { type: 'field', ...action });
const command = (s, id) => sign.act(s.state, s.ui, { type: 'command', id });
const scenario = s => scenarioById(s.state.scenario, s.state.grade);
const report = s => {
  const sc = scenario(s), tiles = tilesFor(sc, s.state.grade);
  return checkSign(s.state.text, { grade: s.state.grade, goal: sc?.goal, vocabulary: [...(sc?.vocabulary ?? []), ...[...tiles.phrases, ...tiles.describing].flatMap(word => word.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [])], kept: s.state.kept ?? [] });
};
const fits = line => { if (line) assert.ok(line.length <= 56, `${line.length}: ${line}`); };

for (let grade = 0; grade <= 5; grade++) test(`grade ${grade}: scenario, commands and immutable field actions`, () => {
  let s = fresh(grade);
  const sc = scenario(s);
  assert.ok(sc); assert.equal(sign.opening(s.state), sc.prompt);
  assert.deepEqual(s.ui.seen, [sc.id]); assert.equal(s.ui.seed, 42);
  const commands = sign.commands(s.state, s.ui);
  assert.deepEqual(commands.map(c => c.id), ['remove', 'clear', 'next', 'finish']);
  assert.equal(commands.at(-1).disabled, !report(s).ready);
  assert.ok(commands.every(c => c.label.length <= 12 && ICON_NAMES.includes(c.icon)));
  const word = tilesFor(sc, grade).phrases[0], before = structuredClone(s);
  Object.freeze(s.state.tiles); Object.freeze(s.state); Object.freeze(s.ui.tiles); Object.freeze(s.ui);
  s = field(s, { word });
  assert.deepEqual(before.state.text, ''); assert.equal(s.state.text, word);
  assert.equal(s.state.scenario, sc.id); fits(s.line);
  const blocked = command(s, 'next');
  assert.equal(blocked.state, s.state); assert.equal(blocked.ui, s.ui);
  assert.equal(blocked.line, 'Clear the sign first, then choose Next sign.');
  s = command(s, 'remove'); assert.equal(s.state.text, ''); fits(s.line);
  s = field(s, { word }); s = command(s, 'clear');
  assert.equal(s.state.text, ''); assert.deepEqual(s.ui.tiles, []); fits(s.line);
  const next = command(s, 'next'); assert.ok(scenario(next));
  if (scenariosFor(grade).length > 1) assert.notEqual(next.state.scenario, sc.id);
  assert.equal(next.ui.seen.includes(next.state.scenario), true);
});

test('scenario survives round trips and invalid scenario can be replaced explicitly', () => {
  let s = fresh(2), id = s.state.scenario;
  s = field(s, { typed: 'Welcome friend!' });
  const restored = sign.start(s.state, { grade: 2, chapter: 1, seed: 42 });
  assert.equal(restored.state.scenario, id); assert.equal(restored.state.text, s.state.text);
  const other = scenariosFor(2).find(item => item.id !== id);
  if (other) assert.equal(field(restored, { scenario: other.id }).state.scenario, id);
  const invalid = sign.start({ ...s.state, scenario: 'missing' }, { grade: 2, chapter: 1, seed: 42 });
  const selected = field(invalid, { scenario: id });
  assert.equal(selected.state.scenario, id);
});

test('shuffle is pure and deterministic and preserves every tile', () => {
  const words = ['one', 'two', 'three', 'four', 'five']; Object.freeze(words);
  const a = shuffledTiles(words, 42), b = shuffledTiles(words, 42);
  assert.deepEqual(a, b); assert.notEqual(a, words);
  assert.deepEqual([...a].sort(), [...words].sort());
});

test('help, reaction lines and action feedback fit dialogue limits', () => {
  assert.equal(sign.helpFor, signHelp); assert.deepEqual(sign.help, signHelp(1));
  for (const grade of [0, 1, 3]) {
    const help = signHelp(grade); assert.match(help.at(-1), /Put up sign/i);
    if (grade >= 1) assert.match(help[2], /check|fix|word/i);
    for (const line of help) fits(line);
    for (const word of signWords(grade)) for (const verb of ['Added', 'Removed']) fits(reactionLine(verb, word));
  }
  for (const line of Object.values(SIGN_LINES)) fits(line);
  fits(reactionLine('Added', 'a'.repeat(200)));
  assert.deepEqual(reconcileTiles(['us.'], 'Come bus.'), []);
});

test('whole-tile removal, typed words, and the 120-character limit', () => {
  let s = fresh(1), word = tilesFor(scenario(s), 1).phrases[0];
  s = field(s, { typed: 'Come play ' }); s = command(s, 'remove'); assert.equal(s.state.text, 'Come'); fits(s.line);
  s = field(s, { word }); assert.ok(s.ui.tiles.includes(word));
  s = field(s, { typed: `${s.state.text} now` }); assert.deepEqual(s.ui.tiles, []);
  s = command(s, 'remove'); assert.equal(s.state.text, `Come ${word}`);
  s = field(fresh(1), { typed: 'y'.repeat(118) });
  const refused = field(s, { word }); assert.equal(refused.state, s.state); assert.equal(refused.ui, s.ui); fits(refused.line);
  s = field(fresh(1), { typed: 'y'.repeat(119 - word.length) }); s = field(s, { word }); assert.equal(s.state.text.length, 120);
  const typed = field(fresh(1), { typed: 'x'.repeat(200) }); assert.equal(typed.state.text.length, 120); fits(typed.line);
});

test('typed feedback surfaces readiness and issue changes', () => {
  let s = fresh(1);
  s = field(s, { typed: 'Welcome friend' }); fits(s.line); assert.ok(s.line);
  s = field(s, { typed: 'Welcome friend!' }); fits(s.line); assert.equal(sign.commands(s.state, s.ui).at(-1).disabled, !report(s).ready);
  s = field(s, { typed: 'welcome friend!' }); fits(s.line); assert.ok(s.line);
  s = field(s, { typed: 'Welcome friend!' }); fits(s.line); assert.ok(s.line);
});

function mount(grade, update = true) {
  const doc = new Doc(), host = doc.createElement('div'); doc.body.append(host);
  let s = fresh(grade); let view;
  const dispatch = action => { s = sign.act(s.state, s.ui, action); view.update(s.state, s.ui); };
  view = sign.mountField(host, { grade, dispatch }); if (update) view.update(s.state, s.ui);
  return { doc, host, view, dispatch, state: () => s };
}

test('mount creates fallback tiles before update and retains tile nodes on text changes', () => {
  const { host, view, dispatch } = mount(4, false);
  assert.ok(host.querySelectorAll('.sign-tile').length);
  const s = fresh(4); view.update(s.state, s.ui);
  const buttons = host.querySelectorAll('.sign-tile'), input = host.querySelector('textarea');
  dispatch({ type: 'field', typed: 'Hello!' });
  assert.deepEqual(host.querySelectorAll('.sign-tile'), buttons);
  assert.equal(host.querySelector('textarea'), input); view.destroy();
});

test('word issues render actionable accessible checks and preserve focus', () => {
  const { doc, host, view, dispatch, state } = mount(1);
  dispatch({ type: 'field', typed: 'Wellcome friend!' });
  const strip = host.querySelector('.sign-checks'); assert.ok(strip);
  const hint = strip.querySelector('[data-hint]'), fix = strip.querySelector('[data-fix]');
  assert.ok(hint); assert.ok(fix); assert.ok(hint.querySelector('svg')); assert.ok(hint.getAttribute('aria-label'));
  hint.focus(); hint.click(); assert.ok(state().line); fits(state().line);
  assert.ok(doc.activeElement === hint || doc.activeElement?.getAttribute('data-hint') !== null);
  for (let i = 0; i < 4; i++) { host.querySelector('[data-hint]').click(); fits(state().line); }
  host.querySelector('[data-fix]').click(); assert.match(state().state.text, /Welcome/i);
  assert.equal(doc.activeElement, host.querySelector('textarea'));
  dispatch({ type: 'field', typed: 'Welcome zorb!' });
  const keep = host.querySelector('[data-keep]'); assert.ok(keep); keep.click();
  assert.ok(state().state.kept.some(word => word.toLowerCase() === 'zorb'));
  view.destroy();
});

test('check strip and tile keyboard navigation stays within the field', () => {
  const { doc, host, view, dispatch } = mount(4);
  dispatch({ type: 'field', typed: 'Wellcome frend!' });
  const strip = host.querySelector('.sign-checks'), hint = strip.querySelector('[data-hint]');
  const board = host.querySelector('.sign-board'), describing = host.querySelector('.sign-tiles--describing');
  assert.equal(strip.parentElement, board.parentElement); assert.equal(strip.parentElement, describing.parentElement);
  const key = (button, value) => { button.focus(); button.dispatchEvent(new Event('keydown', { key: value })); };
  key(hint, 'ArrowUp'); assert.equal(doc.activeElement, host.querySelector('textarea'));
  key(hint, 'ArrowDown'); assert.ok(doc.activeElement.classList.contains('sign-tile'));
  key(describing.children[0], 'ArrowUp'); assert.equal(doc.activeElement, host.querySelector('textarea'));
  view.destroy();
});

test('state serialization preserves scenario and kept words', () => {
  let s = field(fresh(1), { typed: 'Welcome zorb!' });
  s = field(s, { keep: 'zorb' });
  const restored = sign.start(JSON.parse(JSON.stringify(s.state)), { grade: 1, chapter: 1, seed: 42 });
  assert.equal(restored.state.scenario, s.state.scenario);
  assert.deepEqual(restored.state.kept, ['zorb']);
});

test('sign typography scales for larger text', () => {
  const css = readFileSync(new URL('../src/ui/activities/sign.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  for (const grade of [0, 1, 3]) {
    const { host, view } = mount(grade);
    for (const large of [false, true]) {
      host.className = large ? 'large-text' : '';
      for (const button of host.querySelectorAll('.sign-tile')) {
        const style = controlStyle(button, `${kit}\n${css}`);
        assert.equal(style['font-size'], grade >= 3 ? large ? '20px' : '16px' : large ? '24px' : '20px');
      }
    }
    view.destroy();
  }
});


test('hints advance exactly through the report and repeat the last', () => {
  let s = field(fresh(1), { typed: 'Wellcome friend!' });
  const issue = report(s).issues.findIndex(i => i.kind === 'spelling');
  const hints = report(s).issues[issue].hints;
  assert.equal(hints.length, 3);
  for (const expected of [...hints, hints.at(-1)]) {
    Object.freeze(s.state.tiles); Object.freeze(s.state); Object.freeze(s.ui.hints); Object.freeze(s.ui.seen); Object.freeze(s.ui.tiles); Object.freeze(s.ui);
    s = field(s, { hint: issue }); assert.equal(s.line, expected);
  }
  s = field(s, { typed: 'Wellcome friend! Hello.' }); assert.deepEqual(s.ui.hints, {});
});

test('fix changes only the word issue and keep preserves text and clears the issue', () => {
  let s = field(fresh(1), { typed: 'Wellcome friend!' });
  let idx = report(s).issues.findIndex(i => i.kind === 'spelling');
  assert.equal(report(s).ready, false);
  const fix = report(s).issues[idx].fix; const expected = s.state.text.slice(0, fix.start) + fix.text + s.state.text.slice(fix.end);
  s = field(s, { fix: idx }); assert.equal(s.state.text, expected);
  s = field(s, { typed: 'Welcome zorb!' }); assert.equal(report(s).ready, true);
  assert.ok(report(s).issues.some(i => i.kind === 'unknown'));
  s = field(s, { keep: 'zorb' }); assert.equal(s.state.text, 'Welcome zorb!');
  assert.ok(!report(s).issues.some(i => i.word === 'zorb'));
  Object.freeze(s.state.kept); Object.freeze(s.state.tiles); Object.freeze(s.state);
  const restored = sign.start(s.state, { grade: 1, chapter: 1, seed: 42 });
  assert.deepEqual(restored.state.kept, ['zorb']);
  const full = { ...s.state, kept: Array.from({length: 20}, (_, i) => `word${i}`) };
  const limited = sign.act(full, s.ui, { type: 'field', keep: 'zorb' });
  assert.equal(limited.state, full); assert.equal(limited.line, SIGN_LINES.keptFull);
});

test('name chips appear while sentence-level issues have no chip', () => {
  const { host, view, dispatch } = mount(1);
  dispatch({ type: 'field', typed: 'momo friend' });
  const strip = host.querySelector('.sign-checks');
  assert.ok(strip.querySelector('[data-fix]'));
  assert.match(strip.textContent, /momo/);
  assert.equal(strip.querySelectorAll('[data-hint]').length, 1);
  view.destroy();
});

test('Fix it and Keep it retain sentence guidance until the sign is ready', () => {
  let s = field(fresh(1), { typed: 'wellcome friend!' });
  s = field(s, { fix: report(s).issues.findIndex(issue => issue.word === 'wellcome') });
  assert.equal(s.state.text, 'welcome friend!');
  assert.equal(signReady(s.state), false);
  assert.match(s.line, /Start with a capital letter/); fits(s.line);
  s = field(s, { typed: 'Welcome frend!' });
  s = field(s, { fix: report(s).issues.findIndex(issue => issue.word === 'frend') });
  assert.equal(signReady(s.state), true);
  assert.match(s.line, /Put up sign/); fits(s.line);
  const sc = scenariosFor(3).find(item => item.goal === 'reason');
  s = sign.start({ kind: 'writing', scenario: sc.id, text: 'Hello Zephyr! The festival is bright.' }, { grade: 3, chapter: 1 });
  s = field(s, { keep: 'Zephyr' });
  assert.equal(s.state.text, 'Hello Zephyr! The festival is bright.');
  assert.deepEqual(s.state.kept, ['zephyr']);
  assert.equal(signReady(s.state), false);
  assert.match(s.line, /Tell why\. Use because or so\./); fits(s.line);
});

test('invalid actions are inert and whitespace prevents switching', () => {
  const s = fresh(1);
  for (const action of [null, {type:'command', id:'nope'}, {type:'command', id:'finish'}, {type:'field', word:'not a tile'}, {type:'field', hint:999}, {type:'field', fix:999}, {type:'field', keep:'nothing'}]) {
    const result = sign.act(s.state, s.ui, action); assert.equal(result.state, s.state); assert.equal(result.ui, s.ui);
  }
  const spaces = field(s, {typed:'   '});
  const next = command(spaces, 'next'); assert.equal(next.state, spaces.state); assert.equal(next.line, SIGN_LINES.next);
});

test('Next visits every scenario before cycling', () => {
  for (let grade = 0; grade <= 5; grade++) {
    let s = fresh(grade); const seen = new Set([s.state.scenario]);
    for (let i = 1; i < scenariosFor(grade).length; i++) {
      s = command(s, 'next'); assert.ok(!seen.has(s.state.scenario)); seen.add(s.state.scenario);
    }
    assert.equal(seen.size, scenariosFor(grade).length);
    s = command(s, 'next'); assert.equal(s.ui.seen.length, 1); assert.ok(seen.has(s.state.scenario));
  }
});

test('rendered tiles use seeded phrase order and kindergarten keeps original order', () => {
  for (const grade of [0, 1, 4]) {
    const { host, view, state } = mount(grade), s = state();
    const actual = host.querySelector('.sign-tiles--phrases').children.map(b => b.textContent);
    const words = tilesFor(scenario(s), grade).phrases;
    assert.deepEqual(actual, grade === 0 ? words : shuffledTiles(words, s.ui.seed));
    view.update(s.state, s.ui); assert.deepEqual(host.querySelector('.sign-tiles--phrases').children.map(b => b.textContent), actual);
    view.destroy();
  }
});

test('all scenario examples meet their own checker goals', () => {
  for (let grade = 0; grade <= 5; grade++) for (const sc of scenariosFor(grade)) {
    const words = tilesFor(sc, grade);
    const vocabulary = [...sc.vocabulary, ...[...words.phrases, ...words.describing].flatMap(word => word.match(/[A-Za-z]+/g) ?? [])];
    assert.equal(checkSign(sc.example, {grade, goal:sc.goal, vocabulary}).ready, true, `${sc.id}: ${sc.example}`);
  }
});

test('screen and shared rules agree for every scenario, correction and goal', () => {
  assert.equal(sign.opening, signOpening);
  assert.equal(signHelp, ruleHelp);
  for (let grade = 0; grade <= 5; grade++) for (const sc of scenariosFor(grade)) {
    for (const text of [sc.example, 'Wellcome frend!', 'come to the fesival', 'Hello momo!', 'Hello Zephyr!',
      'Hello! The festival is bright.', 'Hello! Come because the festival is bright.', '']) {
      for (const kept of [[], ['wellcome', 'frend', 'fesival', 'momo', 'zephyr']]) {
        const state = { kind: 'writing', grade, chapter: grade ? 1 : 0, scenario: sc.id, text, kept };
        const ready = signReady(state), finish = sign.commands(state).at(-1);
        assert.equal(!finish.disabled, ready, `${sc.id}: ${text} (${kept})`);
        assert.equal(encounterReady(state), ready);
        if (text === sc.example) assert.equal(ready, true, sc.id);
        if (grade >= 3 && sc.goal === 'reason' && text === 'Hello! The festival is bright.') assert.equal(ready, false);
        if (grade >= 1 && text === 'Wellcome frend!') assert.equal(ready, grade < 3 && kept.length > 0);
      }
    }
  }
});

test('every scenario retains text, kept words and tile history through both real save paths', () => {
  for (let grade = 0; grade <= 5; grade++) for (const sc of scenariosFor(grade)) for (const save of [saveDraft, publishCreation]) {
    const chapter = grade ? 1 : 0, tile = tilesFor(sc, grade).phrases[0];
    const source = { kind: 'writing', grade, chapter, scenario: sc.id, kept: ['Zephyr', 'zephyr'],
      text: `Hello Zephyr! ${tile}`, tiles: [tile] };
    const storage = { value: null, getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
    assert.ok(saveState(save({ ...createState(), chapter, grade: grade || 1 }, 'writing', source), storage));
    const loaded = loadState(storage);
    const draft = save === saveDraft ? getDraft(loaded, 'writing') : getCreations(loaded).writing;
    assert.deepEqual(draft, { ...source, request: 1, kept: ['zephyr'] });
    const restored = sign.start(draft, { grade, chapter, seed: 99 });
    assert.deepEqual(restored.state, draft);
    assert.deepEqual(restored.ui.tiles, [tile]);
    assert.equal(command(restored, 'remove').state.text, 'Hello Zephyr!');
  }
});

test('screen normalization cannot restore invalid metadata rejected by the save path', () => {
  const source = { kind: 'writing', text: 'Hello Zephyr!', scenario: scenariosFor(1)[0].id,
    kept: ['Zephyr', 4], tiles: ['not a tile'] };
  const clean = normalizeSign(source, 1);
  const started = sign.start(source, { grade: 1, chapter: 1 });
  assert.deepEqual(started.state, { kind: 'writing', grade: 1, chapter: 1, ...clean });
  assert.ok(report(started).issues.some(issue => issue.kind === 'unknown' && issue.word === 'Zephyr'));
});

test('older tile and check navigation, native typing, and destruction', () => {
  const { doc, host, view, dispatch, state } = mount(4);
  const describing = host.querySelector('.sign-tiles--describing'), phrases = host.querySelector('.sign-tiles--phrases');
  const key = (el, value) => { el.focus(); const event = new Event('keydown', {key:value}); el.dispatchEvent(event); return event; };
  key(describing.children[0], 'ArrowRight'); assert.equal(doc.activeElement, describing.children[1]);
  key(describing.children[1], 'ArrowRight'); assert.equal(doc.activeElement, phrases.children[0]);
  key(phrases.children[0], 'ArrowDown'); assert.equal(doc.activeElement, phrases.children[1]);
  key(phrases.children[1], 'ArrowLeft'); assert.equal(doc.activeElement, describing.children[3]);
  dispatch({type:'field', typed:'Wellcome frend!'});
  const checks = host.querySelector('.sign-checks'), buttons = checks.querySelectorAll('button');
  key(buttons[0], 'ArrowRight'); assert.equal(doc.activeElement, buttons[1]);
  key(buttons[1], 'ArrowLeft'); assert.equal(doc.activeElement, buttons[0]);
  assert.equal(key(buttons[0], 'Escape').defaultPrevented, false);
  const input = host.querySelector('textarea'); assert.equal(key(input, 'ArrowDown').defaultPrevented, false);
  const before = state(); view.destroy(); input.value = 'changed'; input.dispatchEvent(new Event('input')); phrases.children[0].click(); assert.equal(state(), before);
});


test('field dimensions leave enough room for larger text and visible checks', () => {
  const css = readFileSync(new URL('../src/ui/activities/sign.css', import.meta.url), 'utf8');
  const fieldStyle = declarations(css, '.sign-field'), tileStyle = declarations(css, '.sign-tiles');
  const checks = declarations(css, '.sign-checks'), work = declarations(css, '.sign-work');
  const desc = declarations(css, '.sign-field--phrases .sign-tiles--describing');
  assert.equal(fieldStyle['max-height'], '268px'); assert.equal(fieldStyle.padding, '6px 8px');
  assert.equal(tileStyle['grid-auto-rows'], '64px'); assert.equal(tileStyle.padding, '4px');
  assert.equal(checks.height, '60px'); assert.equal(work.flex, '0 0 244px'); assert.equal(work.gap, '6px');
  assert.equal(desc.flex, '0 0 122px'); assert.equal(desc.gap, '4px');
  const inner = 268 - 12, tileGrid = 2 * 64 + 4 + 8;
  assert.equal(inner - tileGrid - 60, 56);
  assert.equal(inner - 122 - 60 - 2 * 6, 62);
  assert.equal((122 - 2 * 4) / 3, 38);
  assert.ok((inner - 3 * 6) / 4 >= 2 * 20 * 1.1 + 12);
});

test('scenario field actions persist the initial pick without changing a valid choice', () => {
  const s = fresh(1);
  const saved = field(s, { scenario: s.state.scenario });
  assert.notEqual(saved.state, s.state, 'the frame can detect a saveable change');
  assert.deepEqual(saved.state, s.state);
  for (const initial of [{ ...s.state, scenario: 'retired' }, { ...s.state, scenario: undefined }]) {
    const result = sign.act(initial, s.ui, { type: 'field', scenario: s.state.scenario });
    assert.equal(result.state.scenario, s.state.scenario); fits(result.line);
  }
  assert.equal(field(s, { scenario: 'retired' }).state, s.state);
});

test('correcting an earlier issue keeps focus on the same later word and action', () => {
  const { doc, host, view, dispatch } = mount(1);
  dispatch({ type: 'field', typed: 'Wellcome frend!' });
  host.querySelectorAll('[data-hint]')[1].focus();
  dispatch({ type: 'field', typed: 'Welcome frend!' });
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Hint for frend');
  host.querySelector('[data-fix]').focus();
  dispatch({ type: 'field', typed: 'Welcome dear frend!' });
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Fix frend');
  view.destroy();
});

test('fixing a typed word retains an unrelated trailing tile and refuses overflow whole', () => {
  let s = field(fresh(1), { typed: 'My frend' });
  const tile = tilesFor(scenario(s), 1).phrases[0];
  s = field(s, { word: tile });
  const index = report(s).issues.findIndex(issue => issue.word === 'frend');
  s = field(s, { fix: index });
  assert.equal(s.state.text, `My friend ${tile}`);
  assert.deepEqual(s.state.tiles, [tile]); assert.deepEqual(s.ui.tiles, [tile]);
  assert.equal(command(s, 'remove').state.text, 'My friend');
  s = field(fresh(1), { typed: `${'X'.repeat(113)} frend!` });
  assert.equal(s.state.text.length, 120);
  const refused = field(s, { fix: report(s).issues.findIndex(issue => issue.word === 'frend') });
  assert.equal(refused.state, s.state); assert.equal(refused.line, SIGN_LINES.full);
});

test('sentence guidance refreshes when another issue changes behind the first one', () => {
  let s = field(fresh(3), { typed: 'hello! bright lights' });
  const before = report(s).issues.filter(issue => issue.blocking);
  s = field(s, { typed: 'hello! bright lights.' });
  assert.equal(report(s).issues.find(issue => issue.blocking).line, before[0].line);
  assert.ok(s.line); fits(s.line);
});

test('tap controls keep native Enter and Space activation, roving focus, and used marks', () => {
  for (const grade of [0, 1, 3]) {
    const { host, view, state, dispatch, doc } = mount(grade);
    const tiles = host.querySelector('.sign-tiles--phrases').children;
    const input = host.querySelector('textarea');
    tiles[0].focus(); pressKey(tiles[0], 'keydown', 'Enter');
    assert.equal(state().state.text, tiles[0].textContent);
    assert.equal(tiles[0].getAttribute('aria-description'), 'On the sign');
    tiles[1].focus(); pressKey(tiles[1], 'keydown', ' '); pressKey(tiles[1], 'keyup', ' ');
    assert.equal(state().state.text, `${tiles[0].textContent} ${tiles[1].textContent}`);
    assert.equal(doc.activeElement, tiles[1]);
    for (const group of host.querySelectorAll('.sign-tiles')) assert.equal(group.children.filter(button => button.tabIndex === 0).length, 1);
    const down = new Event('keydown', { key: 'ArrowDown' });
    tiles.at(-1).dispatchEvent(down); assert.equal(down.defaultPrevented, false);
    if (input) {
      tiles[0].dispatchEvent(new Event('keydown', { key: 'ArrowUp' })); assert.equal(doc.activeElement, input);
      const escape = new Event('keydown', { key: 'Escape' }); input.dispatchEvent(escape);
      assert.equal(escape.defaultPrevented, false); assert.ok(!escape.stopped);
    }
    dispatch({ type: 'command', id: 'clear' });
    assert.equal(host.querySelectorAll('.sign-tile--used').length, 0);
    if (grade === 0) assert.equal(field(state(), { typed: 'No typing here!' }).state, state().state);
    view.destroy();
  }
});

test('text boxes, controls and focus padding fit their measured CSS budgets in both text modes', () => {
  const css = readFileSync(new URL('../src/ui/activities/sign.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/kit.css', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  const px = value => Number.parseFloat(value);
  const board = declarations(css, '.sign-board'), face = declarations(css, '.sign-face');
  const oldBoard = declarations(css, '.sign-field--phrases .sign-board');
  const fieldStyle = declarations(css, '.sign-field'), work = declarations(css, '.sign-work');
  const strip = declarations(css, '.sign-checks'), tileGrid = declarations(css, '.sign-tiles');
  const controls = declarations(kit, '.px-button'), frame = declarations(kit, '.px-frame');
  // Border is inherited from the kit's shared frame rule.
  const border = px(frame.border ?? declarations(kit, '.px-button').border);
  assert.equal(border, 4);
  const inner = px(fieldStyle['max-height']) - 2 * px(fieldStyle.padding);
  const gridHeight = 2 * px(tileGrid['grid-auto-rows']) + px(tileGrid.gap) + 2 * px(tileGrid.padding);
  const height = inner - gridHeight - px(strip.height);
  const content = height - 2 * (px(board.padding) + px(board.border) + px(face.padding) + px(face.border));
  const oldContent = inner - 122 - px(strip.height) - 2 * px(work.gap)
    - 2 * (px(oldBoard.padding) + px(board.border) + px(face.padding) + px(face.border));
  for (const large of [false, true]) {
    const { host, view, dispatch } = mount(1); host.className = large ? 'large-text' : '';
    dispatch({ type: 'field', typed: 'Wellcome frend!' });
    const all = `${tokens}\n${kit}\n${css}`;
    const input = controlStyle(host.querySelector('textarea'), all);
    const button = controlStyle(host.querySelector('.sign-tile'), all);
    const check = controlStyle(host.querySelector('.sign-check'), all);
    assert.ok(content >= px(input['font-size']) * px(face.font.split('/')[1]), 'at least one whole writing line');
    assert.ok(px(tileGrid['grid-auto-rows']) >= 2 * px(button['font-size']) * px(button['line-height']) + 2 * (border + px(button.padding)));
    assert.ok(px(strip.height) >= px(check['min-height']) + 2 * px(strip.padding) + 6, 'thin scrollbar and focus padding fit');
    assert.ok(oldContent >= (large ? 20 : 16) * 1.3);
    view.destroy();
  }
  assert.equal(px(fieldStyle['max-width']) - 16 - px(work.flex.split(' ').at(-1)) - 10, 250);
  assert.equal(px(controls['min-width']), 48);
});

test('legacy saved tile runs still remove whole tiles after either save path', () => {
  for (let grade = 0; grade <= 5; grade++) for (const save of [saveDraft, publishCreation]) {
    const tiles = grade === 0 ? ['Hello', 'friend!'] : grade < 3 ? ['Welcome', 'festival!'] : ['Welcome, neighbors!', 'The lanterns are', 'bright.'];
    const chapter = grade ? 1 : 0;
    const snapshot = { kind: 'writing', text: tiles.join(' '), tiles, chapter, grade };
    const storage = { value: null, getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
    saveState(save({ ...createState(), chapter, grade: grade || 1 }, 'writing', snapshot), storage);
    const loaded = loadState(storage), draft = save === saveDraft ? getDraft(loaded, 'writing') : getCreations(loaded).writing;
    let s = sign.start(draft, { grade, chapter, seed: 42 });
    assert.equal(s.state.text, snapshot.text); assert.deepEqual(s.state.tiles, tiles);
    // Once assigned a scenario, old tile history must still survive the next save.
    assert.ok(saveState(save(loaded, 'writing', s.state), storage));
    s = sign.start(getDraft(loadState(storage), 'writing'), { grade, chapter, seed: 99 });
    assert.deepEqual(s.state.tiles, tiles);
    const remaining = [...tiles];
    while (remaining.length) {
      remaining.pop(); s = command(s, 'remove');
      assert.equal(s.state.text, remaining.join(' ')); assert.deepEqual(s.state.tiles, remaining);
    }
  }
  const legacy = sign.start({ kind: 'writing', text: 'My words Hello friend!' }, { grade: 0, seed: 42 });
  assert.deepEqual(legacy.ui.tiles, ['Hello', 'friend!']);
  assert.equal(command(legacy, 'remove').state.text, 'My words Hello');
  const retired = sign.start({ kind: 'writing', text: 'Everyone belongs here.', tiles: ['Everyone belongs here.'] }, { grade: 3, chapter: 1 });
  assert.deepEqual(retired.ui.tiles, []); assert.equal(command(retired, 'remove').state.text, 'Everyone belongs');
});

test('all screen feedback paths stay within 56 characters', () => {
  for (let grade = 0; grade <= 5; grade++) for (const sc of scenariosFor(grade)) {
    const s = sign.start({ kind: 'writing', scenario: sc.id }, { grade, chapter: grade ? 1 : 0, seed: 42 });
    fits(sign.opening(s.state)); fits(command(s, 'next').line);
    for (const word of [...tilesFor(sc, grade).phrases, ...tilesFor(sc, grade).describing]) {
      const added = field(s, { word }); fits(added.line); fits(command(added, 'remove').line);
    }
    if (grade === 0) continue;
    for (const text of ['Wellcome frend!', 'momo', 'come to the fesival', 'Hello? Bright lights.', 'Hi zorb!', 'Hello! Bright lights.', 'X'.repeat(120), 'x'.repeat(200), '']) {
      const typed = field(s, { typed: text }); fits(typed.line);
      for (const [index, issue] of report(typed).issues.entries()) {
        let hint = typed;
        for (let step = 0; step < 4; step++) { hint = field(hint, { hint: index }); fits(hint.line); }
        fits(field(typed, { fix: index }).line);
        if (issue.word) fits(field(typed, { keep: issue.word }).line);
      }
      fits(command(typed, 'remove').line); fits(command(typed, 'clear').line); fits(command(typed, 'next').line);
    }
  }
});

test('another chooses a fresh deterministic scenario and resets the sign', () => {
  for (let grade = 0; grade <= 5; grade++) {
    const first = fresh(grade);
    const ready = { ...first.state, text: scenario(first).example };
    const second = sign.another(ready, first.ui);
    assert.deepEqual(second, sign.another(ready, first.ui));
    assert.equal(second.state.request, 2);
    assert.notEqual(second.state.scenario, ready.scenario);
    assert.equal(second.state.text, '');
    assert.deepEqual(second.ui.hints, {});
    assert.equal(second.line, sign.opening(second.state));
    assert.equal(sign.another(second.state, second.ui).state.request, 1);
  }
});
