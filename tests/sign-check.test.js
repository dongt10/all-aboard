import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSign, applyFix, knownWords, isKnown, DESCRIBING_WORDS } from '../src/sign-check.js';
import { scenariosFor, tilesFor } from '../src/sign-scenarios.js';

const report = (text, extra = {}) => checkSign(text, { grade: 1, ...extra });
const kinds = result => result.issues.map(issue => issue.kind);
const wordIssue = (result, word) => result.issues.find(issue => issue.word === word);
const allLinesFit = result => {
  for (const issue of result.issues) {
    assert.equal(typeof issue.blocking, 'boolean');
    assert.ok(issue.hints.length >= 1 && issue.hints.length <= 3, issue.kind);
    for (const line of [issue.line, ...issue.hints]) {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0 && line.length <= 56, `${line.length}: ${line}`);
      assert.doesNotMatch(line, /\bwrong\b/i);
    }
  }
};

test('tokens cover repeated words with their exact source spans', () => {
  const text = 'Hi, frend! Hi frend.';
  const result = report(text);
  assert.deepEqual(result.tokens, [
    { word: 'Hi', start: 0, end: 2, ok: true },
    { word: 'frend', start: 4, end: 9, ok: false },
    { word: 'Hi', start: 11, end: 13, ok: true },
    { word: 'frend', start: 14, end: 19, ok: false },
  ]);
  assert.deepEqual(result.issues.filter(issue => issue.kind === 'spelling').map(({ start, end }) => [start, end]), [[4, 9], [14, 19]]);
  for (const token of result.tokens) assert.equal(text.slice(token.start, token.end), token.word);
});

test('Unicode words, combining accents, apostrophes and numbers keep source offsets', () => {
  const text = "Momo’s cafe\u0301! Élodie, don't run. café 12";
  const result = report(text, { vocabulary: ['café', 'Élodie'] });
  assert.deepEqual(result.tokens.map(token => token.word), ['Momo’s', 'cafe\u0301', 'Élodie', "don't", 'run', 'café', '12']);
  let last = 0;
  for (const token of result.tokens) {
    assert.equal(text.slice(token.start, token.end), token.word);
    assert.ok(token.start >= last);
    assert.equal(token.ok, true, token.word);
    last = token.end;
  }
});

test('wellcome, frend and fesival get specific blocking corrections', () => {
  const result = report('Wellcome, frend! Come to the fesival.');
  assert.equal(result.ready, false);
  for (const [word, suggestion] of [['Wellcome', 'Welcome'], ['frend', 'friend'], ['fesival', 'festival']]) {
    const issue = wordIssue(result, word);
    assert.equal(issue.kind, 'spelling');
    assert.equal(issue.blocking, true);
    assert.equal(issue.suggestion, suggestion);
    assert.deepEqual(issue.fix, { start: issue.start, end: issue.end, text: suggestion });
  }
  assert.deepEqual(wordIssue(result, 'frend').hints, ['It starts with f-r-i.', 'f-r-i-e-n-d.', 'Fix it to friend?']);
  allLinesFit(result);
});

test('extra doubled letters and swapped neighbors get a usable spelling fix', () => {
  for (const [word, suggestion] of [['frriend', 'friend'], ['freind', 'friend'], ['teh', 'the'], ['welcoem', 'welcome']]) {
    const issue = wordIssue(report(`Hello ${word}!`), word);
    assert.equal(issue?.kind, 'spelling', word);
    assert.equal(issue.suggestion, suggestion, word);
    assert.equal(applyFix(`Hello ${word}!`, issue), `Hello ${suggestion}!`);
  }
});

test('missing apostrophes suggest the contraction rather than an unrelated short word', () => {
  for (const [word, suggestion] of [['dont', "don't"], ['cant', "can't"], ['wont', "won't"], ['Im', "I'm"], ['youre', "you're"], ['theyre', "they're"], ['weve', "we've"]]) {
    const issue = wordIssue(report(`Hello ${word}!`), word);
    assert.equal(issue?.suggestion, suggestion, word);
    assert.equal(report(applyFix(`Hello ${word}!`, issue)).ready, true);
  }
});

test('one edit is allowed for short words; two edits are allowed for longer words', () => {
  const nearShort = wordIssue(report('Hello qzxv!', { vocabulary: ['qzuv'] }), 'qzxv');
  assert.equal(nearShort.kind, 'spelling'); assert.equal(nearShort.suggestion, 'qzuv');
  assert.equal(wordIssue(report('Hello qzxv!', { vocabulary: ['qzab'] }), 'qzxv').kind, 'unknown');
  const nearLong = wordIssue(report('Hello qzxvzz!', { vocabulary: ['qzuvyz'] }), 'qzxvzz');
  assert.equal(nearLong.kind, 'spelling'); assert.equal(nearLong.suggestion, 'qzuvyz');
  assert.equal(wordIssue(report('Hello qzxvzz!', { vocabulary: ['qzuvab'] }), 'qzxvzz').kind, 'unknown');
});

test('unlisted words without a close match remain nonblocking and can be kept', () => {
  const result = report('Welcome Qzxv!');
  const issue = wordIssue(result, 'Qzxv');
  assert.equal(issue.kind, 'unknown'); assert.equal(issue.blocking, false);
  assert.match(issue.line, /name/); assert.equal(issue.fix, undefined);
  assert.equal(result.ready, true);
  assert.equal(result.tokens.find(token => token.word === 'Qzxv').ok, false);
  const kept = report('Welcome Qzxv!', { kept: ['qzxv'] });
  assert.deepEqual(kept.issues, []); assert.ok(kept.tokens.every(token => token.ok));
});

test('kept words bypass word corrections without bypassing sentence goals', () => {
  const kept = ['FREND', 'momo', 'qzxv'];
  const text = 'Hello frend, momo and Qzxv!';
  assert.deepEqual(report(text, { kept }).issues, []);
  assert.equal(report(text, { kept }).ready, true);
  const unfinished = report('frend', { kept });
  assert.ok(kinds(unfinished).includes('capital'));
  assert.ok(kinds(unfinished).includes('end'));
  assert.ok(!kinds(unfinished).includes('spelling'));
  assert.equal(unfinished.ready, false);
});

test('every lowercase cast name has a capital fix, including inside a sentence', () => {
  for (const name of ['Taro', 'Momo', 'Sora', 'Fumi', 'Yuki', 'Hana', 'Kiko', 'Pip', 'Nori', 'Cricket']) {
    const text = `Hello ${name.toLowerCase()}!`, result = report(text);
    const issue = wordIssue(result, name.toLowerCase());
    assert.equal(issue.kind, 'name'); assert.equal(issue.blocking, true);
    assert.equal(issue.suggestion, name);
    assert.equal(applyFix(text, issue), `Hello ${name}!`);
    assert.equal(report(applyFix(text, issue)).ready, true);
    allLinesFit(result);
  }
});

test('scenario names and cast possessives retain their capital and apostrophe style', () => {
  const named = report('Hello Amaya!', { vocabulary: ['Amaya'] });
  assert.equal(named.ready, true); assert.deepEqual(named.issues, []);
  assert.equal(wordIssue(report('Hello amaya!', { vocabulary: ['Amaya'] }), 'amaya').suggestion, 'Amaya');
  for (const apostrophe of ["'", '’']) {
    const text = `See momo${apostrophe}s sign!`;
    const issue = wordIssue(report(text), `momo${apostrophe}s`);
    assert.equal(issue.kind, 'name');
    assert.equal(applyFix(text, issue), `See Momo${apostrophe}s sign!`);
  }
});

test('capitalized tile words do not become names regardless of vocabulary order', () => {
  const vocabulary = ['you', 'You', 'Come', 'We', 'The', 'Amaya'];
  for (const list of [vocabulary, [...vocabulary].reverse()]) {
    const result = report('We thank you. Come to the festival, Amaya!', { vocabulary: list });
    assert.equal(result.ready, true, JSON.stringify(result.issues));
    assert.equal(wordIssue(report('Hello amaya!', { vocabulary: list }), 'amaya').suggestion, 'Amaya');
    assert.equal(wordIssue(report('Hello momo!', { vocabulary: list }), 'momo').suggestion, 'Momo');
  }
});

test('capital, end and question issues keep all incomplete sentences unready', () => {
  for (const [text, expected] of [
    ['hello!', 'capital'], ['Hello! come play.', 'capital'], ['Hello', 'end'],
    ['Hello! Come play', 'end'], ['Hello?', 'question'], ['Hello?!', 'question'],
  ]) {
    const result = report(text);
    assert.ok(kinds(result).includes(expected), text);
    assert.equal(result.ready, false, text);
    allLinesFit(result);
  }
  for (const text of ['Hello!', 'HELLO!', 'Come play. Have fun!', 'Élodie!']) {
    assert.equal(report(text, { vocabulary: ['Élodie'] }).ready, true, text);
  }
});

test('punctuation alone and empty input never count as completed writing', () => {
  for (const grade of [1, 2, 3, 4, 5]) for (const text of ['', ' ', '...', '?', '!', 'Hello! .']) {
    assert.equal(report(text, { grade }).ready, false, `${grade}: ${text}`);
  }
  for (const value of [undefined, null, 5, {}, []]) {
    const result = report(value);
    assert.deepEqual(result.tokens, []); assert.deepEqual(result.sentences, []);
    assert.equal(result.ready, false);
  }
});

test('sentence splitting preserves unfinished tails and question marks', () => {
  assert.deepEqual(report('  Hello!\nCome play. More').sentences, ['Hello!', 'Come play.', 'More']);
  assert.deepEqual(report('Hello?Come play!').sentences, ['Hello?', 'Come play!']);
  assert.deepEqual(report('Hello!Hello!').sentences, ['Hello!', 'Hello!']);
});

test('spacing suggestions are nonblocking, fixable, and preserve the message', () => {
  let text = 'Hello  friend !';
  let result = report(text);
  assert.equal(result.ready, true);
  assert.equal(result.issues.filter(issue => issue.kind === 'space').length, 2);
  assert.ok(result.issues.every(issue => !issue.blocking));
  while (result.issues.some(issue => issue.kind === 'space')) {
    text = applyFix(text, result.issues.find(issue => issue.kind === 'space'));
    result = report(text);
  }
  assert.equal(text, 'Hello friend!'); assert.equal(result.ready, true);
  assert.deepEqual(result.issues, []);
});

test('grades 3 through 5 require two sentences and a whole describing word', () => {
  for (const grade of [3, 4, 5]) {
    assert.ok(kinds(report('The lanterns are bright.', { grade })).includes('sentence'));
    assert.ok(kinds(report('Hello! Come play.', { grade })).includes('describing'));
    assert.equal(report('Hello! The lanterns are bright.', { grade }).ready, true);
    for (const word of DESCRIBING_WORDS) assert.equal(report(`Hello! It is ${word}.`, { grade }).ready, true, word);
    for (const word of ['brightly', 'warmth', 'kindness', 'unhappy', 'bigger', 'loudly']) {
      assert.ok(kinds(report(`Hello! ${word}.`, { grade, kept: [word] })).includes('describing'), word);
    }
  }
});

test('reason goals require because or so as whole words as well as the other goals', () => {
  for (const grade of [3, 4, 5]) {
    const options = { grade, goal: 'reason' };
    assert.ok(kinds(report('Hello! The lanterns are bright.', options)).includes('reason'));
    assert.ok(kinds(report('Hello! Some bright lanterns glow.', options)).includes('reason'));
    assert.equal(report('Come play. We have bright lanterns so come see.', options).ready, true);
    assert.equal(report('Come play. The festival is fun because the lights are bright.', options).ready, true);
    assert.equal(report('Come because it is bright.', options).ready, false);
    assert.ok(kinds(report('Come play. We have music so come see.', options)).includes('describing'));
  }
});

test('scenario describing tiles count, with no accidental describing requirement for sentence goals', () => {
  for (const grade of [3, 4, 5]) {
    assert.equal(report('Hello!', { grade, goal: 'sentence' }).ready, true);
    for (const scenario of scenariosFor(grade)) {
      for (const tile of tilesFor(scenario, grade).describing) {
        const word = tile.replace(/[.!?]+$/, '');
        const result = report(`Hello! It is ${word}.`, { grade, vocabulary: [...scenario.vocabulary, word], goal: 'two-sentences-describing' });
        assert.ok(!kinds(result).includes('describing'), `${scenario.id}: ${word}`);
      }
    }
  }
});

test('Kindergarten never flags words, names, punctuation, spacing or advanced goals', () => {
  const cases = [
    ['Hello', false], ['', false], ['   ', false], ['Hello friend!', true], ['Welcome ♡', true],
    ['frend momo?', true], ['qzxv  qzxw', true], ['one\ntwo', true], ['... ?', true],
  ];
  for (const [text, ready] of cases) {
    const result = report(text, { grade: 0, goal: 'reason' });
    assert.deepEqual(result.issues, []); assert.equal(result.ready, ready, text);
    assert.ok(result.tokens.every(token => token.ok));
  }
});

test('grade dictionaries include cumulative Dolch and Fry groups', () => {
  const groups = [
    [0, 'away funny jump yellow ate brown pretty under white'],
    [1, 'again ask could every giving once round them were oil number people'],
    [2, 'always before both does pull sleep upon wish would through animal mother'],
    [3, 'better carry done eight laugh myself shall together thought example important Indian'],
  ];
  for (const [introduced, list] of groups) for (let grade = introduced; grade <= 5; grade++) {
    const dictionary = knownWords(grade);
    for (const word of list.split(' ')) assert.ok(dictionary.has(word.toLowerCase()), `${grade}: ${word}`);
  }
  for (const grade of [0, 1, 2, 3, 4, 5]) assert.ok([...knownWords(grade)].every(word => word === word.toLowerCase()));
});

test('festival words, number words and common apostrophe contractions are accepted', () => {
  const list = ['lantern', 'parade', 'festival', 'drum', 'banner', 'sign', 'stall', 'cart', 'crate', 'pizza',
    'stew', 'ice', 'map', 'square', 'bench', 'garden', 'bay', 'village', 'neighbor', 'welcome',
    'zero', 'nine', 'eleven', 'twelve', 'twenty', 'forty', 'hundred', "I'm", "you're", "don't", 'don’t', "can't", "we'll", "they've"];
  for (const grade of [0, 1, 2, 3, 4, 5]) for (const word of list) assert.equal(isKnown(word, grade), true, `${grade}: ${word}`);
  for (const word of ['wellcome', 'frend', 'fesival', 'qzxv']) assert.equal(isKnown(word, 3), false, word);
});

test('ordinary inflected words are not mistaken for neighboring dictionary entries', () => {
  for (const text of [
    'Momo likes hot stew.', 'Fumi hopes you visit.', 'Yuki shares bright colors.',
    'Pip carries a sign.', 'Hana closes the gate.', 'Nori brings the snacks.',
    'Kiko plays the drum.',
  ]) assert.deepEqual(report(text).issues, [], text);
});

test('capital fixes preserve full Unicode characters and the rest of the sentence', () => {
  const text = '𐐨𐐩!', result = report(text, { vocabulary: ['𐐨𐐩'] });
  const issue = result.issues.find(item => item.kind === 'capital');
  assert.deepEqual(issue.fix, { start: 0, end: 2, text: '𐐀' });
  assert.equal(applyFix(text, issue), '𐐀𐐩!');
  assert.equal(report(applyFix(text, issue), { vocabulary: ['𐐨𐐩'] }).ready, true);
});

test('every scenario tile word is known at each eligible grade', () => {
  for (let grade = 0; grade <= 5; grade++) for (const scenario of scenariosFor(grade)) {
    const groups = tilesFor(scenario, grade);
    for (const tile of [...groups.phrases, ...groups.describing]) {
      const tokens = report(tile, { grade }).tokens;
      for (const { word } of tokens) assert.equal(isKnown(word, grade), true, `${scenario.id}: ${word}`);
    }
  }
});

test('every supplied scenario example meets its own grade and goal', () => {
  for (let grade = 0; grade <= 5; grade++) for (const scenario of scenariosFor(grade)) {
    const result = report(scenario.example, { grade, vocabulary: scenario.vocabulary, goal: scenario.goal });
    assert.equal(result.ready, true, `${scenario.id}, grade ${grade}: ${result.issues.map(issue => issue.line).join(' ')}`);
  }
});

test('scenario vocabulary and kept words are case insensitive without mutating the caller', () => {
  const vocabulary = Object.freeze(['Amaya', 'ukulele', 'café']);
  const kept = Object.freeze(['qzxv']);
  for (const word of ['Amaya', 'AMAYA', 'ukulele', 'UKULELE', 'café', 'cafe\u0301']) assert.equal(isKnown(word, 1, vocabulary), true, word);
  assert.equal(isKnown('QZXV', 1, vocabulary, kept), true);
  assert.equal(isKnown(null, 1), false);
  report('Hello Amaya!', { vocabulary, kept });
  assert.deepEqual(vocabulary, ['Amaya', 'ukulele', 'café']); assert.deepEqual(kept, ['qzxv']);
  const dictionary = knownWords(1, vocabulary); dictionary.add('qzxy');
  assert.equal(knownWords(1, vocabulary).has('qzxy'), false);
});

test('reports expose every issue kind and put blocking feedback before optional feedback', () => {
  const results = [
    report('hello  frend, momo and Qzxv?'), report('Hello'),
    report('Hello!', { grade: 3, goal: 'reason' }),
  ];
  const found = new Set(results.flatMap(kinds));
  assert.deepEqual([...found].sort(), ['spelling', 'name', 'capital', 'end', 'question', 'space', 'sentence', 'describing', 'reason', 'unknown'].sort());
  for (const result of results) {
    const firstOptional = result.issues.findIndex(issue => !issue.blocking);
    if (firstOptional >= 0) assert.ok(result.issues.slice(firstOptional).every(issue => !issue.blocking));
    allLinesFit(result);
  }
});

test('applyFix changes only the chosen repeated word and leaves punctuation and other text intact', () => {
  const text = 'Hello frend, frend and Momo!';
  const issues = report(text).issues.filter(issue => issue.kind === 'spelling');
  assert.equal(applyFix(text, issues[1]), 'Hello frend, friend and Momo!');
  assert.equal(applyFix(text, issues[0]), 'Hello friend, frend and Momo!');
  assert.equal(text, 'Hello frend, frend and Momo!');
});

test('applyFix can correct sentence capitals, terminal marks and spaces independently', () => {
  for (const [text, kind, expected] of [
    ['hello!', 'capital', 'Hello!'], ['Hello', 'end', 'Hello.'],
    ['Hello?', 'question', 'Hello.'], ['Hello  friend!', 'space', 'Hello friend!'],
  ]) {
    const issue = report(text).issues.find(item => item.kind === kind);
    assert.equal(applyFix(text, issue), expected);
    assert.equal(report(expected).ready, true);
  }
});

test('applyFix refuses invalid ranges and stale word chips', () => {
  const text = 'Hello friend!';
  for (const item of [null, undefined, {}, { fix: null },
    { fix: { start: -1, end: 5, text: 'Hi' } }, { fix: { start: 6, end: 3, text: 'Hi' } },
    { fix: { start: 0, end: 100, text: 'Hi' } }, { fix: { start: 0.5, end: 5, text: 'Hi' } },
    { fix: { start: 0, end: 5, text: null } },
  ]) assert.equal(applyFix(text, item), text);
  const stale = wordIssue(report('Hello frend!'), 'frend');
  assert.equal(applyFix('Hello Momo!', stale), 'Hello Momo!');
  assert.equal(applyFix(null, stale), '');
});

test('every generated issue line and hint fits 56 characters, including long user words', () => {
  const long = 'qzxv'.repeat(27), longName = `Q${'zxv'.repeat(35)}`;
  const cases = [
    ['hello  frend, momo and Qzxv?', {}], ['Hello', {}], ['Hello!', { grade: 3, goal: 'reason' }],
    [`Hello ${long}!`, {}], [`Hello ${long.slice(0, -1)}z!`, { vocabulary: [long] }],
    [`Hello ${longName.toLowerCase()}!`, { vocabulary: [longName] }],
  ];
  for (const [text, options] of cases) allLinesFit(report(text, options));
  for (let grade = 0; grade <= 5; grade++) for (const scenario of scenariosFor(grade)) {
    allLinesFit(report(scenario.example, { grade, vocabulary: scenario.vocabulary, goal: scenario.goal }));
  }
});
