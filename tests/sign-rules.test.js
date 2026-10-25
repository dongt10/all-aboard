import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESCRIBING_WORDS, signTileGroups, signWords, reconcileTiles, normalizeSign, splitSentences, isSentence,
  hasDescribingWord, signReport, signReady, signHint, signOpening, signHelp, SIGN_RULE_LINES,
} from '../src/sign-rules.js';
import { normalizeSign as encounterNormalize, signWords as encounterWords, reconcileTiles as encounterTiles, encounterReady, encounterOpeningDialogue } from '../src/encounters.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';

const state = (text, grade) => ({ kind: 'writing', text, grade });

test('sign vocabulary is ordered by sentence role and grouped by grade', () => {
  assert.deepEqual(DESCRIBING_WORDS, ['bright', 'warm', 'kind', 'happy', 'big', 'loud']);
  assert.deepEqual(signWords(0), ['Hello', 'friend!', 'Welcome', '♡']);
  for (const grade of [1, 2]) assert.deepEqual(signWords(grade), ['Welcome', 'Come', 'to', 'our', 'play', 'with', 'festival!', 'us.']);
  for (const grade of [3, 4, 5]) {
    const groups = signTileGroups(grade);
    assert.deepEqual(groups.phrases, ['Welcome, neighbors!', 'Come explore our festival.', 'The lanterns are', 'Everyone here is']);
    assert.deepEqual(groups.describing, ['bright.', 'warm.', 'kind.', 'happy.', 'big.', 'loud.']);
    assert.deepEqual(signWords(grade), [...groups.phrases, ...groups.describing]);
  }
  for (const grade of [0, 1, 2]) assert.deepEqual(signTileGroups(grade).describing, []);
  assert.equal(encounterNormalize, normalizeSign); assert.equal(encounterWords, signWords); assert.equal(encounterTiles, reconcileTiles);
});

test('sentence splitting preserves unfinished tails and question marks never complete a sentence', () => {
  assert.deepEqual(splitSentences('  Hello!\nThe lights are bright.  '), ['Hello!', 'The lights are bright.']);
  assert.deepEqual(splitSentences('Hello!The lights glow. More'), ['Hello!', 'The lights glow.', 'More']);
  assert.deepEqual(splitSentences('Are you happy? Bright lights!'), ['Are you happy?', 'Bright lights!']);
  for (const text of ['Hello!', 'Hello.', 'The lanterns are bright.', 'HELLO!']) assert.equal(isSentence(text), true, text);
  for (const text of ['', ' ', 'hello!', 'Hello', 'Hello?', 'Hello?!', '?Hello!', 'Hello! Next.', '...']) assert.equal(isSentence(text), false, text);
  assert.equal(signReady(state('Welcome? The lanterns are bright.', 3)), false);
  assert.equal(signReady(state('Welcome! Are you happy? Bright lights!', 3)), false);
  for (const junk of [null, undefined, {}, 42]) { assert.deepEqual(splitSentences(junk), []); assert.equal(isSentence(junk), false); }
});

test('typed describing words count as whole lowercased tokens', () => {
  for (const word of DESCRIBING_WORDS) for (const text of [`${word}.`, word.toUpperCase(), `So ${word}!`, `(${word})`]) assert.equal(hasDescribingWord(text), true);
  for (const text of ['brightly', 'warmth', 'kindness', 'unhappy', 'bigger', 'loudly', '', null]) assert.equal(hasDescribingWord(text), false);
});

test('K needs two whitespace-separated words while grades 1–2 need every sentence complete', () => {
  for (const text of ['Hello', '♡', '', '    ']) assert.equal(signReady(state(text, 0)), false);
  for (const text of ['Hello friend!', 'Welcome ♡', 'one two']) assert.equal(signReady(state(text, 0)), true);
  assert.equal(signReady(state('Hello friend!', undefined)), true);
  for (const grade of [1, 2]) {
    for (const text of ['Hello!', 'Welcome, friends.', 'Hello! Come play.']) assert.equal(signReady(state(text, grade)), true, text);
    for (const text of ['Hello', 'hello!', 'Hello?', 'Hello! More', 'Hello! more.', 'Hello! .', '']) assert.equal(signReady(state(text, grade)), false, text);
  }
});

test('grades 3–5 need two complete sentences and a describing word, including typed words', () => {
  for (const grade of [3, 4, 5]) {
    for (const text of ['Welcome, neighbors! The lanterns are bright.', 'Hello! Everyone is KIND.', 'Big drums! Come play. Welcome!']) {
      const draft = state(text, grade);
      assert.equal(signReady(draft), true, text); assert.equal(encounterReady(draft), true);
      assert.equal(encounterOpeningDialogue(draft), SIGN_RULE_LINES.ready);
    }
    for (const text of ['Welcome, neighbors!', 'The lanterns are bright.', 'Welcome! The lanterns glow.', 'welcome! Bright lights.', 'Welcome! The lights are bright', 'Welcome! Bright lights. More']) assert.equal(signReady(state(text, grade)), false, text);
  }
  for (const junk of [null, undefined, {}, { kind: 'art', text: 'Hello friend!' }]) assert.equal(signReady(junk), false);
});

test('reports expose counts, completion, describing words and the next precise hint', () => {
  assert.deepEqual(signReport('Hello friend!', 0), { words: 2, sentences: ['Hello friend!'], allComplete: true, describing: false, missing: [] });
  for (const [text, grade, hint] of [
    ['', 0, 'One more word.'], ['Hello', 0, 'One more word.'], ['hello!', 1, 'Start with a capital letter.'],
    ['Hello', 1, 'End your sentence with . or !'], ['Hello?', 1, 'End your sentence with . or !'],
    ['Bright lights!', 3, 'One more sentence.'], ['Hello! Come play.', 3, 'Add a describing word, like bright.'],
    ['Hello! Bright lights!', 3, ''],
  ]) assert.equal(signHint(state(text, grade)), hint);
  assert.equal(signReport('Hello! More', 1).allComplete, false);
});

test('normalization keeps text and current whole tiles, resets retired phrases, and is idempotent', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const words = signWords(grade).slice(0, 3), text = words.join(' ');
    const input = { text, tiles: words }, before = structuredClone(input);
    Object.freeze(input.tiles); Object.freeze(input);
    const clean = normalizeSign(input, grade);
    assert.deepEqual(clean, before); assert.deepEqual(normalizeSign(clean, grade), clean); assert.deepEqual(input, before);
    assert.deepEqual(normalizeSign({ text: 'My own words', tiles: words }, grade), { text: 'My own words', tiles: [] });
    for (const junk of [null, undefined, 42, [], 'text']) assert.equal(normalizeSign(junk, grade).text, '');
    assert.equal(normalizeSign({ text: 'x'.repeat(200) }, grade).text.length, 120);
  }
  const oldWords = ['Welcome, neighbors!', 'Come explore', 'our summer festival.', 'Everyone belongs here.', 'Please keep the path clear.'];
  for (const grade of [3, 4, 5]) {
    assert.deepEqual(normalizeSign({ text: oldWords.join(' '), tiles: oldWords }, grade), { text: oldWords.join(' ').slice(0, 120), tiles: [] });
    assert.deepEqual(normalizeSign({ text: 'Welcome, neighbors!' }, grade), { text: 'Welcome, neighbors!' });
  }
  assert.deepEqual(normalizeSign({ text: 'Hello friend!' }, 0), { text: 'Hello friend!' });
  assert.deepEqual(reconcileTiles(['us.'], 'Come bus.'), []);
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Hello to'), ['to']);
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Hi Welcome to  '), ['Welcome', 'to']);
});

test('sign goals, hints, openings and help fit both dialogue sizes', () => {
  const lines = [...Object.values(SIGN_RULE_LINES)];
  for (let grade = 0; grade <= 5; grade++) {
    lines.push(signOpening(state('', grade)), ...signHelp(grade), ...signWords(grade));
    assert.equal(signHelp(grade).length, 4); assert.equal(signHelp(grade).at(-1), 'Choose Put up sign.');
  }
  for (const line of lines) {
    for (const sentence of line.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
    for (const limit of Object.values(PAGE_CHARS)) for (const page of paginate(line, limit)) assert.ok(page.length <= limit);
  }
});
