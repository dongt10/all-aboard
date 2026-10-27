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

test('scenario normalization keeps valid optional data and reconciles scenario tiles', async () => {
  const { scenariosFor } = await import('../src/sign-scenarios.js');
  const item = scenariosFor(1)[0];
  const tiles = item.tiles.phrases.slice(0, 2);
  const input = { text: tiles.join(' '), scenario: item.id, tiles, kept: ['NASA', 'nasa', 'Word'], ignored: true };
  assert.deepEqual(normalizeSign(input, 1), { text: input.text, scenario: item.id, tiles, kept: ['nasa', 'word'] });
  assert.deepEqual(normalizeSign({ text: '', scenario: 2, kept: ['ok', 3] }, 1), { text: '' });
  assert.equal(normalizeSign({ kept: Array.from({ length: 25 }, (_, i) => `w${i}`) }, 1).kept.length, 20);
  assert.deepEqual(normalizeSign({ text: input.text, scenario: 'missing', tiles }, 1).tiles,
    tiles.every(tile => signWords(1).includes(tile)) ? tiles : []);
});

test('a scenario sign retains legitimate legacy tile history', async () => {
  const { scenariosFor } = await import('../src/sign-scenarios.js');
  const scenario = scenariosFor(1)[0];
  const tiles = ['Welcome', 'Come'];
  assert.deepEqual(normalizeSign({ text: tiles.join(' '), scenario: scenario.id, tiles }, 1).tiles, tiles);
});

test('scenario opening, checker options, and issue ordering integrate', async () => {
  const { scenariosFor } = await import('../src/sign-scenarios.js');
  const item = scenariosFor(1)[0];
  const draft = { ...state('', 1), scenario: item.id };
  assert.equal(signOpening(draft), item.prompt);
  const report = signReport('hello!', 1, { vocabulary: item.vocabulary });
  assert.ok(report.missing.length);
  assert.equal(report.missing[0], signHint({ ...draft, text: 'hello!' }));
  assert.equal(signReady({ ...draft, text: item.example }), true);
  for (const grade of [1, 2, 3, 4, 5]) assert.ok(signHelp(grade).includes('Tap a marked word for a hint. Fix it or Keep it.'));
  for (const item of [0, 1, 2, 3, 4, 5].flatMap(scenariosFor)) assert.ok(item.prompt.length <= 56);
});

test('scenario collection has usable band-specific content and deterministic selection', async () => {
  const { SIGN_SCENARIOS, scenariosFor, scenarioById, scenarioOrder, nextScenario, tilesFor } = await import('../src/sign-scenarios.js');
  assert.ok(Object.isFrozen(SIGN_SCENARIOS));
  assert.equal(scenarioById('missing', 1), null);
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const items = scenariosFor(grade), order = scenarioOrder(grade, 123);
    assert.ok(items.length >= 2);
    assert.deepEqual(order, scenarioOrder(grade, 123));
    assert.deepEqual(new Set(order), new Set(items.map(item => item.id)));
    for (const item of items) {
      assert.equal(scenarioById(item.id, grade), item);
      assert.deepEqual(tilesFor(item, grade), item.tiles);
      assert.ok(item.tiles.phrases.length > 0);
      assert.equal(signReady({ ...state(item.example, grade), scenario: item.id }), true, item.id);
      assert.ok(item.tiles.phrases.every(tile => /[\p{L}\p{N}]/u.test(tile)));
    }
    const current = order[0];
    assert.equal(nextScenario(grade, { seed: 123, current }).id, order[1]);
    assert.equal(nextScenario(grade, { seed: 123, current, seen: order.slice(1) }).id, current);
    assert.equal(nextScenario(grade, { seed: 123, current, seen: order }).id, order[1]);
  }
});

test('scenario prompt remains visible when ready and reason goal affects readiness', async () => {
  const { scenariosFor } = await import('../src/sign-scenarios.js');
  const item = scenariosFor(3).find(scenario => scenario.goal === 'reason');
  assert.ok(item);
  const draft = { ...state(item.example, 3), scenario: item.id };
  assert.equal(signReady(draft), true);
  assert.equal(signOpening(draft), item.prompt);
  assert.equal(signReady({ ...draft, text: 'Hello! We are bright.' }), false);
  assert.ok(signReport('Hello! We are bright.', 3, { goal: item.goal }).missing.includes('Tell why. Use because or so.'));
});

test('normalization retains only valid optional metadata and is idempotent', () => {
  assert.deepEqual(normalizeSign({ text: 'Hello', scenario: null, kept: 'hello', tiles: null, other: 1 }, 0), { text: 'Hello', tiles: [] });
  assert.deepEqual(normalizeSign({ scenario: '', kept: ['Hi', 'HI', 'HELLO'], tiles: [] }, 0), { text: '', scenario: '', kept: ['hi', 'hello'], tiles: [] });
  const normalized = normalizeSign({ scenario: 'retired', kept: ['Hello', 'hello'], text: 'Hi' }, 1);
  assert.deepEqual(normalizeSign(normalized, 1), normalized);
});

test('report lists every checker issue with blocking issues first', async () => {
  const { checkSign } = await import('../src/sign-check.js');
  const text = 'mysteryzz hello';
  const checked = checkSign(text, { grade: 3 });
  const expected = [...checked.issues].sort((a, b) => Number(b.blocking) - Number(a.blocking)).map(issue => issue.line);
  assert.ok(checked.issues.some(issue => issue.blocking));
  assert.ok(checked.issues.some(issue => !issue.blocking));
  assert.deepEqual(signReport(text, 3).missing, expected);
});

test('legacy reports and checker agree on scenario describing vocabulary', async () => {
  const { scenariosFor, tilesFor } = await import('../src/sign-scenarios.js');
  for (const item of scenariosFor(3)) for (const tile of tilesFor(item, 3).describing) {
    const vocabulary = [...item.vocabulary, tile];
    const text = `Hello! It is ${tile.replace(/[.!?]+$/, '')}.`;
    const result = signReport(text, 3, { vocabulary, goal: 'two-sentences-describing' });
    assert.equal(result.describing, true, `${item.id}: ${tile}`);
    assert.ok(!result.missing.includes(SIGN_RULE_LINES.describing));
  }
});

test('kept words persist through normalization and the scenario readiness path', async () => {
  const { scenariosFor } = await import('../src/sign-scenarios.js');
  const scenario = scenariosFor(1)[0].id;
  const draft = { kind: 'writing', grade: 1, ...normalizeSign({ text: 'Hello frend!', scenario, kept: ['FREND'] }, 1) };
  assert.equal(signReady(draft), true);
  assert.equal(signHint(draft), '');
  assert.equal(signReady({ ...draft, kept: [] }), false);
  assert.match(signHint({ ...draft, kept: [] }), /frend/);
});
