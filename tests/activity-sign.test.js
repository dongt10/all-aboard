import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sign, { signWords, signHelp, reactionLine, reconcileTiles, SIGN_LINES } from '../src/ui/activities/sign.js';
import { signReady, signHint, signTileGroups, SIGN_RULE_LINES } from '../src/sign-rules.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { createState, saveDraft, publishCreation, saveState, loadState, getDraft, getCreations } from '../src/progress.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { controlStyle, declarations } from './helpers/css.js';

const field = (s, action) => sign.act(s.state, s.ui, { type: 'field', ...action });
const command = (s, id) => sign.act(s.state, s.ui, { type: 'command', id });
const fresh = grade => sign.start(null, { grade, chapter: grade ? 1 : 0 });
const path = grade => grade === 0 ? ['Hello', 'friend!'] : grade < 3 ? ['Welcome', 'festival!'] : ['Welcome, neighbors!', 'The lanterns are', 'bright.'];
const fits = text => {
  for (const sentence of text.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  for (const limit of Object.values(PAGE_CHARS)) {
    const pages = paginate(text, limit);
    assert.ok(pages.every(page => page.length <= limit));
    assert.equal(pages.join(' '), text);
  }
};
function contract(s) {
  const commands = sign.commands(s.state, s.ui);
  assert.ok(commands.length <= 4); assert.equal(new Set(commands.map(c => c.id)).size, commands.length);
  assert.equal(commands.filter(c => c.finish).length, 1); assert.equal(commands.at(-1).id, 'finish');
  assert.equal(commands.at(-1).disabled, !signReady(s.state)); assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  assert.ok(commands.every(c => c.label.length <= 12 && ICON_NAMES.includes(c.icon)));
  fits(sign.opening(s.state));
}

for (let grade = 0; grade <= 5; grade++) test(`grade ${grade}: tap a complete sign, remove a tile, and clear it`, () => {
  let s = fresh(grade); contract(s);
  assert.equal(signReady(s.state), false); assert.deepEqual(s.ui, { tiles: [] });
  for (const [index, word] of path(grade).entries()) {
    Object.freeze(s.state.tiles); Object.freeze(s.state); Object.freeze(s.ui.tiles); Object.freeze(s.ui);
    const before = s;
    s = field(s, { word });
    assert.equal(s.state.text, path(grade).slice(0, index + 1).join(' '));
    assert.equal(before.state.text, path(grade).slice(0, index).join(' '));
    assert.equal(s.line, `${reactionLine('Added', word)} ${signReady(s.state) ? SIGN_LINES.readyNow : signHint(s.state)}`);
    fits(s.line); contract(s);
  }
  assert.equal(signReady(s.state), true); assert.equal(sign.opening(s.state), SIGN_LINES.ready);
  const removed = command(s, 'remove');
  assert.equal(removed.state.text, path(grade).slice(0, -1).join(' '));
  assert.equal(removed.line, `${reactionLine('Removed', path(grade).at(-1))} ${signHint(removed.state)}`);
  assert.equal(signReady(removed.state), false); fits(removed.line); contract(removed);
  const clear = command(s, 'clear');
  assert.equal(clear.state.text, ''); assert.deepEqual(clear.state.tiles, []); assert.deepEqual(clear.ui.tiles, []);
  assert.equal(clear.line, SIGN_LINES.cleared); contract(clear);
});

test('the sign names its commands and gives grade-specific goals in Help and openings', () => {
  assert.deepEqual([sign.kind, sign.title], ['writing', 'A sign from you']);
  assert.equal(sign.helpFor, signHelp); assert.deepEqual(sign.help, signHelp(1));
  assert.equal(signHelp(0)[1], 'Two words make a sign.');
  assert.equal(signHelp(1)[1], 'Start with a capital letter. End with . or !');
  assert.equal(signHelp(3)[1], 'Write two sentences. Use a describing word.');
  assert.ok(signHelp(0).every(step => !/typ/i.test(step)));
  assert.deepEqual(sign.commands(fresh(1).state).map(c => [c.id, c.label, c.icon]), [['remove', 'Remove word', 'back'], ['clear', 'Clear sign', 'trash'], ['finish', 'Put up sign', 'check']]);
  assert.equal(sign.opening(fresh(0).state), SIGN_RULE_LINES.openingK);
  assert.equal(sign.opening(fresh(1).state), SIGN_RULE_LINES.openingSentence);
  assert.equal(sign.opening(fresh(4).state), SIGN_RULE_LINES.openingDescribing);
});

test('typing speaks on word counts and readiness flips, including punctuation and capital edits', () => {
  let s = fresh(2);
  s = field(s, { typed: 'W' }); assert.equal(s.line, SIGN_RULE_LINES.end);
  s = field(s, { typed: 'We' }); assert.equal(s.line, undefined);
  s = field(s, { typed: 'We ' }); assert.equal(s.line, undefined);
  s = field(s, { typed: 'We c' }); assert.equal(s.line, SIGN_RULE_LINES.end);
  s = field(s, { typed: 'We came!' }); assert.equal(s.line, SIGN_LINES.typed); assert.equal(signReady(s.state), true);
  s = field(s, { typed: 'We came' }); assert.equal(s.line, SIGN_RULE_LINES.end); assert.equal(signReady(s.state), false);
  s = field(s, { typed: 'we came!' }); assert.equal(s.line, undefined, 'no word or readiness change');
  s = field(s, { typed: 'We came!' }); assert.equal(s.line, SIGN_LINES.typed, 'capital-only edit completes the sign');
  s = field(s, { typed: '' }); assert.equal(s.line, SIGN_RULE_LINES.capital);
  let older = fresh(5);
  older = field(older, { typed: 'Hello! Lights glow.' }); assert.equal(older.line, SIGN_RULE_LINES.describing);
  older = field(older, { typed: 'Hello! Bright lights.' }); assert.equal(older.line, SIGN_LINES.typed, 'a typed describing word counts with no word-count change');
  older = field(older, { typed: 'Hello? Bright lights.' }); assert.equal(older.line, SIGN_RULE_LINES.end);
});

test('removal takes whole current tiles but never cuts a typed word into a tile suffix', () => {
  let s = fresh(1);
  s = field(s, { typed: 'Come  play ' }); assert.equal(s.line, SIGN_RULE_LINES.end);
  s = command(s, 'remove'); assert.equal(s.state.text, 'Come'); assert.equal(s.line, `Removed: play. ${SIGN_RULE_LINES.end}`);
  s = field(s, { word: 'festival!' }); assert.deepEqual(s.ui.tiles, ['festival!']);
  s = field(s, { typed: `${s.state.text} now` }); assert.deepEqual(s.ui.tiles, []);
  s = command(s, 'remove'); assert.equal(s.state.text, 'Come festival!');
  s = command(s, 'remove'); assert.equal(s.state.text, 'Come');
  s = field(fresh(1), { word: 'us.' }); s = field(s, { typed: 'Come bus.' });
  assert.deepEqual(s.ui.tiles, []);
  s = command(s, 'remove'); assert.equal(s.state.text, 'Come');
  assert.equal(s.line, `Removed: bus. ${SIGN_RULE_LINES.end}`);
  let phrases = field(fresh(3), { word: 'Come explore our festival.' });
  phrases = command(phrases, 'remove'); assert.equal(phrases.state.text, '');
  assert.equal(phrases.line, `Removed: Come explore our festival. ${SIGN_RULE_LINES.capital}`);
});

test('120-character limits refuse a tile whole, allow an exact fit, and cap typing', () => {
  const word = signTileGroups(4).phrases[1];
  let s = field(fresh(4), { typed: 'y'.repeat(118) });
  const refused = field(s, { word });
  assert.equal(refused.state, s.state); assert.equal(refused.ui, s.ui); assert.equal(refused.line, SIGN_LINES.full);
  s = field(fresh(4), { typed: 'y'.repeat(119 - word.length) });
  s = field(s, { word }); assert.equal(s.state.text.length, 120); assert.ok(s.state.text.endsWith(word));
  const typed = field(fresh(1), { typed: 'x'.repeat(200) });
  assert.equal(typed.state.text.length, 120); assert.equal(typed.line, SIGN_LINES.full); fits(typed.line);
});

test('spaces, unchanged typing, retired tiles and unknown actions never enable the finish', () => {
  const s = fresh(1);
  for (const action of [{ type: 'command', id: 'remove' }, { type: 'command', id: 'clear' }, { type: 'command', id: 'finish' }, { type: 'command', id: 'nope' }, { type: 'field', word: 'foreign' }, { type: 'field', typed: '' }, null]) {
    const next = sign.act(s.state, s.ui, action); assert.equal(next.state, s.state); assert.equal(next.ui, s.ui);
  }
  const k = fresh(0); assert.deepEqual(field(k, { typed: 'Hello friend!' }), k, 'Kindergarten has only tap controls');
  const spaces = field(s, { typed: '   ' });
  assert.equal(sign.commands(spaces.state).find(c => c.id === 'remove').disabled, true);
  assert.equal(sign.commands(spaces.state).find(c => c.id === 'clear').disabled, false);
  assert.equal(sign.commands(spaces.state).at(-1).disabled, true);
  const older = fresh(4); assert.deepEqual(field(older, { word: 'Everyone belongs here.' }), older);
});

test('tiles join with a single space and reaction lines stay within sentence and page limits', () => {
  const s = sign.start({ kind: 'writing', text: '  Hi  ' }, { chapter: 1, grade: 4 });
  const next = field(s, { word: 'bright.' }); assert.equal(next.state.text, 'Hi bright.'); assert.equal(s.state.text, '  Hi  ');
  for (const line of [...Object.values(SIGN_LINES), ...Object.values(SIGN_RULE_LINES), ...signHelp(0), ...signHelp(1), ...signHelp(3)]) fits(line);
  for (const grade of [0, 1, 3]) for (const word of signWords(grade)) for (const verb of ['Added', 'Removed']) fits(reactionLine(verb, word));
  fits(reactionLine('Added', 'a'.repeat(200))); fits(reactionLine('Removed', 'a'.repeat(120)));
  assert.equal(reactionLine('Added', 'Welcome, neighbors!'), 'Added: Welcome, neighbors!');
  assert.equal(reactionLine('Added', 'Hello'), 'Added: Hello.');
  assert.ok(reactionLine('Added', 'a'.repeat(200)).endsWith('…'));
});

function mount(grade) {
  const doc = new Doc(), host = doc.createElement('div'); doc.body.append(host);
  let s = fresh(grade);
  const dispatch = action => { s = sign.act(s.state, s.ui, action); view.update(s.state, s.ui); };
  const view = sign.mountField(host, { grade, dispatch }); view.update(s.state, s.ui);
  return { doc, host, view, dispatch, state: () => s };
}

test('the older field stacks describing tiles below the board and keeps four phrase tiles on the right', () => {
  const { doc, host, view, dispatch, state } = mount(4);
  const root = host.children[0], board = host.querySelector('.sign-board'), input = host.querySelector('textarea');
  const phrases = host.querySelector('.sign-tiles--phrases'), describing = host.querySelector('.sign-tiles--describing');
  assert.ok(root.classList.contains('sign-field--phrases'));
  assert.equal(board.parentElement, describing.parentElement); assert.equal(root.children[1], phrases);
  assert.equal(phrases.children.length, 4); assert.equal(describing.children.length, 6);
  const buttons = host.querySelectorAll('.sign-tile');
  const tile = word => buttons.find(button => button.textContent === word);
  for (const word of path(4)) tile(word).click();
  assert.equal(state().state.text, 'Welcome, neighbors! The lanterns are bright.');
  assert.equal(doc.activeElement, tile('bright.'));
  assert.ok(board.classList.contains('sign-board--ready'));
  for (const word of path(4)) { assert.ok(tile(word).classList.contains('sign-tile--used')); assert.equal(tile(word).getAttribute('aria-description'), 'On the sign'); }
  dispatch({ type: 'command', id: 'remove' });
  assert.equal(tile('bright.').getAttribute('aria-description'), null); assert.equal(board.classList.contains('sign-board--ready'), false);
  input.focus(); input.value = 'Hello! The drums are loud.'; input.dispatchEvent(new Event('input'));
  assert.ok(board.classList.contains('sign-board--ready')); assert.deepEqual(state().state.tiles, []);
  assert.equal(host.querySelector('textarea'), input); assert.equal(host.querySelector('.sign-board'), board); assert.deepEqual(host.querySelectorAll('.sign-tile'), buttons);
  assert.equal(doc.activeElement, input, 'updates keep typing focus');
  dispatch({ type: 'command', id: 'clear' }); assert.ok(buttons.every(button => !button.classList.contains('sign-tile--used')));
  const before = state(); view.destroy(); assert.equal(host.children.length, 0);
  input.dispatchEvent(new Event('input')); tile('bright.').click(); assert.equal(state(), before, 'destroy removes listeners');
});

test('tile grids use roving focus, cross between older groups, and let the bottom edge reach the menu', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const { doc, host, view, state } = mount(grade);
    const groups = host.querySelectorAll('.sign-tiles');
    for (const group of groups) assert.equal(group.children.filter(button => button.tabIndex === 0).length, 1);
    const phrases = host.querySelector('.sign-tiles--phrases');
    const key = (button, value) => { button.focus(); const event = new Event('keydown', { key: value }); button.dispatchEvent(event); return event; };
    if (grade >= 3) {
      const describing = host.querySelector('.sign-tiles--describing');
      key(describing.children[0], 'ArrowRight'); assert.equal(doc.activeElement, describing.children[1]);
      key(describing.children[1], 'ArrowRight'); assert.equal(doc.activeElement, phrases.children[0]);
      key(phrases.children[0], 'ArrowDown'); assert.equal(doc.activeElement, phrases.children[1]);
      key(phrases.children[1], 'ArrowLeft'); assert.equal(doc.activeElement, describing.children[3]);
      key(describing.children[0], 'ArrowUp'); assert.equal(doc.activeElement, host.querySelector('textarea'));
      assert.equal(key(describing.children[5], 'ArrowDown').defaultPrevented, false);
      assert.equal(key(phrases.children[3], 'ArrowDown').defaultPrevented, false);
    } else {
      key(phrases.children[0], 'ArrowRight'); assert.equal(doc.activeElement, phrases.children[1]);
      if (grade > 0) { key(phrases.children[1], 'ArrowDown'); assert.equal(doc.activeElement, phrases.children[5]); }
      assert.equal(key(phrases.children.at(-1), 'ArrowDown').defaultPrevented, false);
      phrases.children[0].focus(); pressKey(phrases.children[0], 'keydown', 'Enter'); assert.equal(state().state.text, signWords(grade)[0]);
    }
    for (const group of groups) assert.equal(group.children.filter(button => button.tabIndex === 0).length, 1);
    if (grade === 0) assert.equal(host.querySelector('textarea'), null);
    else { const input = host.querySelector('textarea'); assert.equal(key(input, 'ArrowDown').defaultPrevented, false, 'typing retains native arrow keys'); }
    view.destroy();
  }
});

test('saved drafts and published signs retain current whole-tile removal and used marks at every grade', () => {
  for (let grade = 0; grade <= 5; grade++) for (const save of [saveDraft, publishCreation]) {
    const chapter = grade ? 1 : 0, words = path(grade);
    let s = fresh(grade);
    for (const word of words) s = field(s, { word });
    const storage = { value: null, getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
    saveState(save({ ...createState(), chapter, grade: grade || 1 }, 'writing', s.state), storage);
    const loaded = loadState(storage), snapshot = save === publishCreation ? getCreations(loaded).writing : getDraft(loaded, 'writing');
    s = sign.start(snapshot, { chapter, grade }); assert.deepEqual(s.state.tiles, words); assert.deepEqual(s.ui.tiles, words); assert.equal(signReady(s.state), true);
    const { host, view } = mount(grade); view.update(s.state, s.ui);
    assert.equal(host.querySelectorAll('.sign-tile--used').length, words.length);
    while (words.length) {
      words.pop(); s = command(s, 'remove'); assert.equal(s.state.text, words.join(' ')); assert.deepEqual(s.state.tiles, words);
      view.update(s.state, s.ui); assert.equal(host.querySelectorAll('.sign-tile--used').length, words.length);
    }
    view.destroy();
  }
});

test('legacy lower-grade tiles recover while retired older phrase runs reset without changing text', () => {
  for (const grade of [0, 1, 2]) {
    const words = path(grade), text = `My words ${words.join(' ')}`;
    const s = sign.start({ kind: 'writing', text }, { chapter: grade ? 1 : 0, grade });
    assert.deepEqual(s.ui.tiles, words); assert.equal(command(s, 'remove').state.text, `My words ${words[0]}`);
  }
  for (const grade of [3, 4, 5]) {
    const text = 'Welcome, neighbors! Everyone belongs here.';
    const s = sign.start({ kind: 'writing', text, tiles: ['Welcome, neighbors!', 'Everyone belongs here.'] }, { chapter: 1, grade });
    assert.equal(s.state.text, text); assert.deepEqual(s.ui.tiles, []);
    assert.equal(command(s, 'remove').state.text, 'Welcome, neighbors! Everyone belongs');
  }
  let s = field(fresh(5), { typed: 'Welcome, neighbors!' }); s = sign.start(s.state, { chapter: 1, grade: 5 });
  assert.deepEqual(s.ui.tiles, []); assert.equal(command(s, 'remove').state.text, 'Welcome,');
  assert.deepEqual(reconcileTiles(['us.'], 'Come bus.'), []);
});

test('sign start stays pure across interleaved grades and Help never changes its fallback', () => {
  const fallback = [...sign.help], k = fresh(0), before = structuredClone(k);
  for (const grade of [5, 0, 2, 1, 3, 4]) {
    const context = Object.freeze({ chapter: grade ? 1 : 0, grade });
    sign.start(null, context); assert.deepEqual(sign.helpFor(grade), signHelp(grade)); assert.deepEqual(sign.help, fallback); assert.deepEqual(k, before);
  }
});

test('sign typography uses growing tokens and budgets both tile groups inside the field', () => {
  const css = readFileSync(new URL('../src/ui/activities/sign.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  assert.equal(declarations(css, '.sign-field')['max-height'], '268px');
  assert.equal(declarations(css, '.sign-field--phrases .sign-tiles--describing')['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
  assert.equal(declarations(css, '.sign-field--phrases .sign-tiles--describing')['grid-template-rows'], 'repeat(3, minmax(0, 1fr))');
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
  const innerHeight = 268 - 12, describingHeight = 122, gap = 6;
  assert.equal((describingHeight - 2 * 4) / 3, 38);
  assert.equal(innerHeight - describingHeight - gap, 128);
  assert.ok((innerHeight - 3 * gap) / 4 >= 2 * 20 * 1.1 + 4, 'each phrase row fits two Bigger-words lines');
});
