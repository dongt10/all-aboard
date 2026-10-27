import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionLine } from '../src/reactions.js';
import { cleanCreation } from '../src/progress.js';
import { encounterReady } from '../src/encounters.js';
import { expectedAt, stampPosition } from '../src/banner-rules.js';
import { TALE_DECKS } from '../src/tales.js';
import { helpSetFor } from '../src/helpday.js';
import { SIGN_SCENARIOS } from '../src/sign-scenarios.js';
import { defaultBandFor, lessonDone } from '../src/ui/band.js';

const base = (kind, grade, fields = {}) => ({ kind, grade, chapter: grade ? 1 : 0, ...fields });
const clean = (kind, grade, fields) => cleanCreation(kind, base(kind, grade, fields));
const stamp = (cell, shape = 'star', color = '#e96163') => ({ shape, color, ...stampPosition(cell), rotation: 0, flipped: false });
function banner(grade) {
  if (grade === 0) return [stamp(0)];
  if (grade <= 2) return [3, 4, 5].map(cell => ({ ...stamp(cell), ...expectedAt(grade, cell) }));
  return [0, 5, 1, 4, ...(grade >= 4 ? [2, 3] : [])].map((cell, i) => stamp(cell, 'circle', i >= 4 ? '#559fc7' : '#e96163'));
}
function creation(kind, grade) {
  if (kind === 'math') {
    if (grade < 2) return clean(kind, grade, { left: [2, 1], right: [2, 1], rolled: true });
    if (grade === 2) return clean(kind, grade, { activity: 'rows', target: 6, crates: [0, 1, 2, 5, 6, 7] });
    return clean(kind, grade, { activity: 'pizza', slices: grade === 5 ? 6 : 8, halves: grade === 5, plates: Array(4).fill(grade === 5 ? 3 : 4), tried: true });
  }
  if (kind === 'science') {
    if (grade < 2) return clean(kind, grade, { canopy: 'right', time: 10 });
    if (grade === 2) return clean(kind, grade, { activity: 'beans', change: 'dark', weeks: 2, bed: ['seed', 'sun', 'water', 'bee'] });
    return clean(kind, grade, { activity: 'chain', chain: grade === 4 ? ['pondweed', 'snail', 'koi'] : ['plant', 'fish', 'otter'], energy: grade === 4 ? [2000, 200, 20] : grade === 5 ? [5000, 500, 50] : [1000, 100, 10], shone: true });
  }
  if (kind === 'reading') {
    if (grade < 2) return clean(kind, grade, { found: ['key', 'umbrella', 'book'] });
    if (grade === 2) return clean(kind, grade, { activity: 'ribbon', story: 1, why: true, steps: 3, lesson: true });
    const deck = grade - 3;
    return clean(kind, grade, { activity: 'tales', deck, solved: TALE_DECKS[deck].map(t => t.id) });
  }
  if (kind === 'art') return clean(kind, grade, { stamps: banner(grade) });
  if (kind === 'writing') {
    const scenario = SIGN_SCENARIOS.find(s => s.grades.includes(grade));
    return clean(kind, grade, { scenario: scenario.id, text: scenario.example });
  }
  if (kind === 'community') {
    if (grade < 2) return clean(kind, grade, { placements: [{ item: 'bench', x: 10, y: 70 }, ...(grade ? [{ item: 'quiet', x: 10, y: 10 }] : [])], tried: true });
    if (grade === 2) return clean(kind, grade, { activity: 'compass', done: ['north', 'west', 'lantern'] });
    return clean(kind, grade, { activity: 'helpday', crew: Object.entries(helpSetFor(grade).fits).map(([job, helper]) => ({ job, helper })) });
  }
  const band = defaultBandFor(grade);
  band.tracks = band.tracks.map(track => track.id === (grade === 1 ? 'percussion' : 'melody') ? { ...track, notes: [4, 3, 2, 1, 0, null, null, null] } : track);
  return clean(kind, grade, { ...band, tempo: 120, form: grade >= 4 ? 'ABA' : 'A', lesson: { played: true, echoed: true } });
}
const ids = ['math', 'science', 'reading', 'art', 'writing', 'community', 'music'];
function check(result) {
  assert.ok(result && typeof result.id === 'string' && result.id);
  assert.equal(typeof result.words, 'string');
  assert.ok(result.words.trim());
  assert.ok(result.words.length <= 96, result.words);
  for (const sentence of result.words.match(/[^.!?]+[.!?]?/g) ?? []) assert.ok(sentence.trim().length <= 56, result.words);
  assert.doesNotMatch(result.words, /\{\{|\}\}|\$\{|undefined|null|placeholder/i);
}
for (const id of ids) for (let grade = 0; grade <= 5; grade++) {
  test(`${id} grade ${grade}: cleaned completed creation yields a concise reaction`, () => {
    const saved = creation(id, grade);
    assert.ok(saved);
    if (id !== 'music') assert.ok(encounterReady(saved), JSON.stringify(saved));
    else assert.ok(lessonDone(saved, saved.lesson, grade));
    check(reactionLine(id, saved, grade));
  });
}
test('saved details change reactions, independently of transient UI', () => {
  const cases = [
    ['math', 0, { left: [1, 1], right: [1, 1], rolled: true }, { left: [2, 1], right: [2, 1], rolled: true }],
    ['science', 1, { canopy: 'left', time: 10 }, { canopy: 'right', time: 10 }],
    ['science', 2, { activity: 'beans', change: 'water', weeks: 2, bed: ['seed', 'sun', 'water'] }, { activity: 'beans', change: 'dark', weeks: 2, bed: ['seed', 'sun', 'water'] }],
    ['reading', 2, { activity: 'ribbon', story: 0, why: true, steps: 3, lesson: true }, { activity: 'ribbon', story: 1, why: true, steps: 3, lesson: true }],
  ];
  for (const [id, grade, a, b] of cases) {
    const first = clean(id, grade, a), second = clean(id, grade, b);
    assert.notEqual(reactionLine(id, first, grade).words, reactionLine(id, second, grade).words, id);
    assert.deepEqual(reactionLine(id, { ...first, ui: { nonsense: true }, request: 'ignored' }, grade), reactionLine(id, first, grade));
  }
});
test('missing and malformed creations fall back without throwing', () => {
  for (const id of ids) for (const value of [undefined, null, {}, [], { kind: id, activity: 'bad', tracks: [null], stamps: [null], placements: [null] }]) {
    assert.doesNotThrow(() => check(reactionLine(id, value, 2)), `${id}: ${JSON.stringify(value)}`);
  }
});

test('unknown subjects have no celebration reaction', () => {
  for (const id of ['unknown', null, undefined]) assert.equal(reactionLine(id, {}, 2), null);
});

test('reactions describe facts in each saved activity', () => {
  for (let grade = 0; grade <= 5; grade++) {
    const say = id => reactionLine(id, creation(id, grade), grade).words;
    const math = say('math');
    if (grade < 2) assert.match(math, /3\D+3/);
    else if (grade === 2) { assert.match(math, /2 rows of 3/i); assert.match(math, /3 \+ 3 = 6/); }
    else { assert.match(math, /4 plates/i); assert.match(math, grade === 5 ? /half/i : /2 slices/i); }
    const science = say('science');
    if (grade < 2) assert.match(science, /tray B/i);
    else if (grade === 2) for (const word of ['dark', 'seed', 'sun', 'water', 'bee']) assert.match(science, new RegExp(word, 'i'));
    else {
      for (const n of creation('science', grade).energy) assert.ok(science.includes(String(n)));
      assert.match(science, grade === 4 ? /koi/i : /otter/i);
    }
    const reading = say('reading');
    if (grade < 2) for (const word of ['key', 'umbrella', 'book']) assert.match(reading, new RegExp(word, 'i'));
    else if (grade === 2) assert.match(reading, /steady/i);
    else for (const name of [['Momo', 'Taro', 'Kiko'], ['Hana', 'Pip', 'Yuki'], ['Fumi', 'Nori', 'Sora']][grade - 3]) assert.ok(reading.includes(name));
    const art = say('art');
    assert.match(art, new RegExp(`\\b${creation('art', grade).stamps.length} stamps?\\b`, 'i'));
    assert.match(art, /coral/i);
    if (grade === 1) assert.match(art, /shape pattern/i);
    if (grade === 2) assert.match(art, /color pattern/i);
    if (grade >= 3) assert.match(art, /mirror/i);
    const writing = creation('writing', grade), reply = reactionLine('writing', writing, grade);
    const signText = writing.text.replace(/\s+/g, ' ').trim();
    if (signText.length <= 40) assert.ok(reply.words.includes(`It says: ${signText}`), reply.words);
    else assert.match(reply.words, new RegExp(`\\b${signText.split(' ').length} words?\\b`));
    assert.equal(reply.id, grade <= 2 ? 'science' : 'art');
    const community = say('community');
    if (grade < 2) { assert.match(community, /bench/i); if (grade) assert.match(community, /garden/i); }
    else if (grade === 2) for (const word of ['flour', 'drum', 'lantern']) assert.match(community, new RegExp(word, 'i'));
    else for (const name of grade === 4 ? ['Momo', 'Sora', 'Yuki', 'Fumi'] : ['Kiko', 'Taro', 'Nori', 'Pip']) assert.ok(community.includes(name));
    const music = say('music');
    assert.match(music, /Sora/i);
    assert.match(music, /fast/i);
    assert.match(music, /Tune A goes down/i);
    assert.match(music, grade >= 4 ? /Form A B A/i : /Form A\./i);
  }
});

test('sign readers and music silence follow saved details', () => {
  const sign = clean('writing', 0, { scenario: 'momo-menu', text: 'Warm stew' });
  assert.equal(reactionLine('writing', sign, 0).id, 'writing');
  const band = creation('music', 5);
  const silent = { ...band, masterVolume: 0 };
  const words = reactionLine('music', silent, 5).words;
  assert.match(words, /sound off/i);
  assert.doesNotMatch(words, /join in/i);
  const noWater = clean('science', 2, { activity: 'beans', change: 'water', weeks: 2, bed: ['seed', 'sun', 'water'] });
  assert.match(reactionLine('science', noWater, 2).words, /no water/i);
});

test('each sign scenario addresses its saved reader and reads a short sign back', () => {
  const readers = { Momo: 'science', Taro: 'math', Sora: 'reading', Yuki: 'art', Fumi: 'writing', Hana: 'community', Kiko: 'music', 'Kiko and the band': 'music', Pip: 'pip', Nori: 'nori' };
  for (const scenario of SIGN_SCENARIOS) for (const grade of scenario.grades) {
    const saved = clean('writing', grade, { scenario: scenario.id, text: scenario.example });
    const reaction = reactionLine('writing', saved, grade);
    check(reaction);
    assert.equal(reaction.id, readers[scenario.reader] ?? 'writing', scenario.id);
    const signText = saved.text.replace(/\s+/g, ' ').trim();
    if (signText.length <= 40) assert.ok(reaction.words.includes(`It says: ${signText}`), scenario.id);
    else assert.match(reaction.words, new RegExp(`\\b${signText.split(' ').length} words?\\b`), scenario.id);
  }
});

test('music reflects each tempo, form and melody shape', () => {
  const shapes = [
    [[0, 1, 2], /goes up/i], [[4, 3, 2], /goes down/i], [[0, 2, 1], /up and down/i],
    [[2, 2], /one note/i], [[2], /one sound/i], [[], /only rests/i],
  ];
  for (const [notes, pattern] of shapes) for (const [tempo, word] of [[60, 'Slow'], [90, 'Steady'], [120, 'Fast']]) for (const form of ['A', 'AB', 'ABA']) {
    const band = creation('music', 5);
    band.tempo = tempo; band.form = form;
    band.tracks = band.tracks.map(track => track.id === 'melody' ? { ...track, notes: Array.from({ length: 8 }, (_, i) => notes[i] ?? null) } : track);
    const result = reactionLine('music', band, 5);
    check(result);
    assert.match(result.words, new RegExp(word, 'i'));
    assert.match(result.words, pattern);
    assert.ok(result.words.includes(`Form ${form.split('').join(' ')}`));
  }
});

test('malformed snapshots never invent completion facts', () => {
  for (const id of ids) {
    const fallback = reactionLine(id, null, 0);
    for (const value of [{}, { kind: id, activity: 'invalid' }]) assert.deepEqual(reactionLine(id, value, 0), fallback);
  }
});

test('a full mirrored banner reports its saved count and all six colors', () => {
  const colors = ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf'];
  const stamps = Array.from({ length: 30 }, (_, cell) => stamp(cell, 'circle', colors[(Math.floor(cell / 6) * 3 + Math.min(cell % 6, 5 - cell % 6)) % colors.length]));
  const saved = clean('art', 5, { stamps });
  assert.ok(encounterReady(saved));
  const result = reactionLine('art', saved, 5);
  check(result);
  assert.match(result.words, /30 stamps/i);
  for (const name of ['coral', 'gold', 'mint', 'blue', 'lavender', 'cream']) assert.match(result.words, new RegExp(name, 'i'));
  assert.match(result.words, /mirror/i);
});

test('music distinguishes resting, muted and missing playback data', () => {
  const band = creation('music', 5);
  for (const missing of ['masterVolume', 'preset', 'form']) {
    const partial = { ...band };
    delete partial[missing];
    const result = reactionLine('music', partial, 5);
    check(result);
    assert.doesNotMatch(result.words, /quiet|sound off|join in/i, missing);
  }
  for (const change of [{ enabled: false }, { volume: 0 }, { notes: Array(8).fill(null) }]) {
    const quiet = { ...band, form: 'A', tracks: band.tracks.map(track => ({ ...track, ...change })) };
    const result = reactionLine('music', quiet, 5);
    check(result);
    assert.match(result.words, /quiet/i);
    assert.doesNotMatch(result.words, /join in/i);
  }
  const rests = { ...band, tracks: band.tracks.map(track => ({ ...track, notes: Array(8).fill(null) })) };
  const result = reactionLine('music', rests, 5);
  check(result);
  for (const name of ['Sora', 'Nori', 'Kiko']) assert.ok(result.words.includes(name), 'phrase B still sounds');
  assert.doesNotMatch(result.words, /Cricket|quiet/i, 'Cricket keeps the rests in A and B');
  assert.match(result.words, /Tune A has only rests/i);
});

test('unknown nested fields cannot crash or produce made-up details', () => {
  for (const id of ids) {
    const saved = creation(id, 5);
    for (const key of Object.keys(saved).filter(key => !['kind', 'chapter', 'activity'].includes(key))) {
      for (const value of [undefined, null, 'unexpected', {}, [null], { toString: null, valueOf: null }]) {
        check(reactionLine(id, { ...saved, [key]: value }, 5));
      }
    }
    const original = structuredClone(saved);
    assert.deepEqual(reactionLine(id, { ...saved, ui: { ready: true }, request: { id: 2 } }, 5), reactionLine(id, saved, 5));
    assert.deepEqual(saved, original, 'reactions do not mutate saved work');
  }
});
