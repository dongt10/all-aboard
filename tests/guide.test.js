import test from 'node:test';
import assert from 'node:assert/strict';
import { guideEntries, stampCount, learnedText, stampGrade, SIDE_BIOS } from '../src/ui/guide.js';
import { createState, publishCreation } from '../src/progress.js';
import { CHARACTERS } from '../src/data.js';

const sign = { kind: 'writing', text: 'Welcome!', chapter: 0, grade: 0 };
const SUBJECTS = CHARACTERS.map(c => c.id);

test('the guide lists the seven neighbors, then Pip, Nori and Cricket', () => {
  const entries = guideEntries(createState());
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map(e => e.id), [...SUBJECTS, 'pip', 'nori', 'cricket']);
  const taro = entries[0];
  assert.deepEqual(taro, { id: 'math', name: 'Taro', species: 'tanuki', role: 'Math · Workshop', bio: CHARACTERS[0].description, subject: 'math', stamp: { earned: false, learned: learnedText('math', 0) }, canFind: true, canVisit: true });
  assert.ok(entries.slice(0, 7).every(e => e.stamp && e.subject === e.id && e.canFind && e.canVisit && typeof e.stamp.learned === 'string'));
});
test('a published creation earns exactly its stamp, in its own grade only', () => {
  const state = publishCreation(createState(), 'writing', sign);
  const earned = guideEntries(state).filter(e => e.stamp?.earned).map(e => e.id);
  assert.deepEqual(earned, ['writing']);
  const other = { ...state, chapter: 1, grade: 2 };
  assert.deepEqual(guideEntries(other).filter(e => e.stamp?.earned), []);
});
test('side cast flags: Pip and Nori can be found, Cricket stays on the music stage', () => {
  const byId = Object.fromEntries(guideEntries(createState()).map(e => [e.id, e]));
  assert.deepEqual([byId.pip.species, byId.pip.role, byId.pip.canFind, byId.pip.canVisit, byId.pip.stamp, byId.pip.subject], ['duck', 'Courier', true, false, null, null]);
  assert.deepEqual([byId.nori.species, byId.nori.role, byId.nori.canFind, byId.nori.canVisit], ['turtle', 'Festival helper', true, false]);
  assert.deepEqual([byId.cricket.species, byId.cricket.role, byId.cricket.canFind, byId.cricket.canVisit], ['cricket', 'Band drummer', false, false]);
  assert.equal(byId.nori.bio, SIDE_BIOS.nori);
});
test('the stamp count covers the current grade', () => {
  assert.deepEqual(stampCount(createState()), { earned: 0, total: 7 });
  assert.deepEqual(stampCount(publishCreation(createState(), 'writing', sign)), { earned: 1, total: 7 });
});
test('an earned guide page shows what the child made there', async () => {
  const { guideCreation } = await import('../src/ui/screens/windows.js');
  const state = publishCreation(createState(), 'writing', sign);
  assert.match(guideCreation('writing', state), /creation--writing[^>]*>Welcome!</);
  assert.equal(guideCreation('math', state), '');
});

// --- Stamps per band (plan 1C and Part 2) ---
test('learnedText gives one sentence per band for every subject', () => {
  const expect = {
    math: ['Same number on both sides is equal.', 'Different crates can weigh the same.', 'Different crates can weigh the same.', 'Sums can match in more than one way.', 'Sums can match in more than one way.', 'Sums can match in more than one way.'],
    science: ['Shade keeps the sun off the ice.', 'Shade keeps the sun off the ice.', 'Shade makes ice melt slower.', 'Shade makes ice melt slower.', 'Shade makes ice melt slower.', 'Shade makes ice melt slower.'],
    reading: ['Letters make a word you can read.', 'The story tells you what to pack.', 'The story tells you what to pack.', 'Clues in a story tell you what is needed.', 'Clues in a story tell you what is needed.', 'Clues in a story tell you what is needed.'],
    writing: Array(6).fill('Words welcome your neighbors.'),
    art: Array(6).fill('Shapes and colors make a design.'),
    community: ['A bench gives a tired neighbor a rest.', 'A good plan works for everyone.', 'A good plan works for everyone.', 'A plan has room for every need.', 'A plan has room for every need.', 'A plan has room for every need.'],
    music: ['Music can be fast or slow, high or low.', 'Rests are part of a rhythm.', 'Rests are part of a rhythm.', 'A tune can go up, down, or stay the same.', 'A steady part holds up a changing tune.', 'A steady part holds up a changing tune.'],
  };
  for (const subject of SUBJECTS) assert.deepEqual([0, 1, 2, 3, 4, 5].map(grade => learnedText(subject, grade)), expect[subject], subject);
  assert.equal(learnedText('nope', 3), '');
  assert.equal(learnedText('math'), learnedText('math', 0), 'no grade reads as Kindergarten');
  assert.equal(learnedText('math', 'x'), learnedText('math', 0));
  for (const subject of SUBJECTS) for (const grade of [0, 1, 2, 3, 4, 5]) assert.ok(learnedText(subject, grade).length <= 56, `${subject} ${grade} fits one Bigger-words page`);
});
test('the guide reads stamps with the current grade: chapter 0 is Kindergarten even though the state keeps grade 1', () => {
  const k = createState();
  assert.equal(k.chapter, 0); assert.equal(k.grade, 1);
  assert.equal(stampGrade(k), 0);
  assert.equal(stampGrade({ ...k, chapter: 1, grade: 4 }), 4);
  const learnedAt = state => Object.fromEntries(guideEntries(state).filter(e => e.stamp).map(e => [e.id, e.stamp.learned]));
  assert.equal(learnedAt(k).math, 'Same number on both sides is equal.');
  assert.equal(learnedAt(k).music, 'Music can be fast or slow, high or low.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 2 }).math, 'Different crates can weigh the same.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 2 }).science, 'Shade makes ice melt slower.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 1 }).science, 'Shade keeps the sun off the ice.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 3 }).music, 'A tune can go up, down, or stay the same.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 5 }).music, 'A steady part holds up a changing tune.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 5 }).community, 'A plan has room for every need.');
});
test('the music reward reads like the others on the item-get card', () => {
  const music = CHARACTERS.find(c => c.id === 'music');
  assert.equal(music.reward.label, 'Festival band');
  assert.ok(CHARACTERS.every(c => !/^your /i.test(c.reward.label)), 'no reward starts with "Your"');
  assert.deepEqual(CHARACTERS.map(c => c.id), SUBJECTS, 'ids unchanged');
});
