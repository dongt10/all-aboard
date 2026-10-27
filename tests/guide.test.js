import { STAMP_CHAIN } from '../src/chain.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { guideEntries, stampCount, learnedText, stampGrade, SIDE_BIOS, guideNarration } from '../src/ui/guide.js';
import { createState, publishCreation, saveDraft, normalizeState } from '../src/progress.js';
import { CHARACTERS } from '../src/data.js';
import { openGuideWindow } from '../src/ui/screens/windows.js';
import { Doc, Event } from './helpers/dom.js';
import { createDefaultBand } from '../src/audio.js';

const sign = { kind: 'writing', text: 'Welcome!', chapter: 0, grade: 0 };
const SUBJECTS = CHARACTERS.map(c => c.id);

function mountedGuide(t, { autoRead = false, state = createState(), id, busy = false } = {}) {
  const doc = new Doc(), calls = [], gone = [];
  for (const [key, value] of Object.entries({ document: doc, speechSynthesis: { cancel: () => calls.push(['stop']) } })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key]);
  }
  state = { ...state, settings: { ...state.settings, autoRead } };
  const stage = doc.createElement('div'); doc.body.append(stage);
  const handle = openGuideWindow({ stage, getState: () => state, speak: words => calls.push(['speak', words]),
    go: (...args) => gone.push(args), scenes: { busy, pause() {} } }, { id });
  t.after(() => handle?.close());
  return { stage, handle, calls, gone, state, spoken: () => calls.filter(([kind]) => kind === 'speak').map(([, words]) => words) };
}

for (const autoRead of [false, true]) test(`Guide entry, click and keyboard changes respect Read to me (${autoRead})`, t => {
  const f = mountedGuide(t, { autoRead, id: 'writing' });
  const entries = guideEntries(f.state), selected = entries.find(e => e.id === 'writing');
  assert.deepEqual(f.spoken(), autoRead ? [guideNarration(selected)] : []);
  if (autoRead) assert.equal(f.calls.at(-1)[0], 'speak', 'entry speaks after the window cancels previous speech');
  f.stage.querySelector('[data-action="hear"]').click();
  assert.equal(f.spoken().at(-1), guideNarration(selected));
  assert.ok(f.stage.querySelector('.win-backdrop'), 'Hear leaves the Guide open');
  assert.deepEqual(f.gone, []);
  const before = f.spoken().length;
  const tiles = f.stage.querySelectorAll('.guide-tile');
  tiles[0].click();
  assert.equal(f.spoken().length, before + Number(autoRead));
  tiles[0].focus();
  tiles[0].dispatchEvent(new Event('keydown', { key: 'ArrowRight' }));
  assert.equal(tiles[1].getAttribute('aria-pressed'), 'true');
  assert.equal(f.spoken().length, before + 2 * Number(autoRead));
  f.stage.querySelector('[data-action="hear"]').click();
  assert.equal(f.spoken().at(-1), guideNarration(entries[1]));
  f.handle.close();
  assert.equal(f.calls.at(-1)[0], 'stop', 'closing cancels narration');
});

test('Guide does not narrate when a scene transition prevents opening', t => {
  const f = mountedGuide(t, { autoRead: true, busy: true });
  assert.equal(f.handle, null);
  assert.deepEqual(f.spoken(), []);
});

test('every neighbor has Hear and short narration with only its available actions', t => {
  const f = mountedGuide(t);
  for (const [i, entry] of guideEntries(f.state).entries()) {
    f.stage.querySelectorAll('.guide-tile')[i].click();
    f.stage.querySelector('[data-action="hear"]').click();
    const text = f.spoken().at(-1);
    assert.ok(text.includes(entry.name) && text.includes(entry.bio));
    assert.equal(text.includes('Choose Find'), entry.canFind);
    assert.equal(text.includes('Choose Visit'), entry.canVisit);
    assert.equal(text.includes('Let’s explore.'), Boolean(entry.stamp));
    for (const line of text.split(/(?<=[.!?…])\s+/)) assert.ok(line.length <= 56, line);
    const actions = f.stage.querySelectorAll('.guide-page [data-action]');
    assert.ok(actions.length <= 4);
    for (const action of actions) assert.ok(action.querySelector('span').textContent.length <= 12);
  }
});

test('published stamps describe exploration in both the visible page and narration', t => {
  let state = publishCreation(createState(), 'writing', sign);
  state = publishCreation(state, 'music', { ...createDefaultBand(), kind: 'music', chapter: 0, grade: 0 });
  const f = mountedGuide(t, { state, id: 'writing' });
  assert.match(f.stage.querySelector('.guide-stamp').textContent, /^We explored:/);
  f.stage.querySelector('[data-action="hear"]').click();
  assert.match(f.spoken().at(-1), /We explored\./);
  assert.doesNotMatch(f.spoken().at(-1), /Learned|You’ll learn/);
  const index = guideEntries(state).findIndex(e => e.id === 'music');
  f.stage.querySelectorAll('.guide-tile')[index].click();
  assert.equal(f.stage.querySelectorAll('.guide-page [data-action]').length, 4, 'Hear, Find, Visit and Save song');
  f.stage.querySelector('[data-action="hear"]').click();
  assert.match(f.spoken().at(-1), /Save song keeps your band to listen to later\./);
});

test('a published grade-2 banner earns the coral-blue color-pattern stamp', () => {
  const state = publishCreation({ ...createState(), chapter: 1, grade: 2 }, 'art', {
    kind: 'art', chapter: 1, grade: 2, stamps: [],
  });
  assert.deepEqual(guideEntries(state).find(entry => entry.id === 'art').stamp, {
    earned: true, learned: 'A color pattern repeats: coral, blue, coral, blue.',
  });
});

test('earned statements follow the published activity, including legacy grade 2–5 work', () => {
  const old = {
    math: { left: [1], right: [1], rolled: true }, science: { canopy: 'left', time: 10 },
    reading: { found: ['key', 'umbrella', 'book'] },
    community: { placements: [{ item: 'bench', x: 10, y: 90 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 10 }], tried: true },
  };
  const activities = { math: 'pizza', science: 'chain', reading: 'tales', community: 'helpday' };
  const grade2 = { math: 'rows', science: 'beans', reading: 'ribbon', community: 'compass' };
  for (const grade of [2, 3, 4, 5]) for (const [kind, values] of Object.entries(old)) {
    const activity = (grade === 2 ? grade2 : activities)[kind];
    let state = publishCreation({ ...createState(), chapter: 1, grade }, kind, { kind, chapter: 1, grade, ...values });
    state = saveDraft(state, kind, { kind, chapter: 1, grade, activity });
    const stamp = guideEntries(normalizeState(state)).find(e => e.id === kind).stamp;
    assert.deepEqual(stamp, { earned: true, learned: kind === 'science' ? 'Shade makes ice melt slower.' : learnedText(kind, 1) }, `${kind} grade ${grade} legacy stamp ignores new draft`);
    state = publishCreation(state, kind, { kind, chapter: 1, grade, activity });
    assert.equal(guideEntries(state).find(e => e.id === kind).stamp.learned, learnedText(kind, grade));
  }
});

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
test('learnedText gives the planned sentence at every grade for every subject', () => {
  const expect = {
    math: ['Same number on both sides is equal.', 'Different crates can weigh the same.', 'Equal rows add up: 4 + 4 + 4 = 12.', 'Sharing equally is dividing: 8 ÷ 4 = 2 each.', 'Sharing equally is dividing: 12 ÷ 4 = 3 each.', 'A leftover can be split: 6 ÷ 4 = 1 and a half.'],
    science: ['Shade keeps the sun off the ice.', 'Shade keeps the sun off the ice.', 'Plants need sun and water. Change one thing to test.', STAMP_CHAIN, 'A pond chain keeps one tenth at each step too.', 'Only 10% of energy moves up each step of a chain.'],
    reading: ['Letters make a word you can read.', 'The story tells you what to pack.', 'A story has a beginning, middle, end, and a lesson.', 'Clues in the text prove who a tale is about.', 'Clues in the text prove who a tale is about.', 'Clues in the text prove who a tale is about.'],
    writing: ['Words make a message for a reader.', 'Check capitals and marks in a message.', 'Check words and marks for your reader.', 'A reason tells your reader why.', 'Details and reasons help your reader.', 'Choose words for different readers.'],
    art: ['Shapes and colors make a design.', 'A pattern repeats: star, circle, star, circle.', 'A color pattern repeats: coral, blue, coral, blue.', ...Array(3).fill('A mirror design is the same on both sides.')],
    community: ['A bench gives a tired neighbor a rest.', 'A good plan works for everyone.', 'A compass shows north, south, east and west.', 'Different strengths get every job done together.', 'Every job needs the strength that fits it.', 'Ask about a strength before you hand out a job.'],
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
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 2 }).math, 'Equal rows add up: 4 + 4 + 4 = 12.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 2 }).science, 'Plants need sun and water. Change one thing to test.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 1 }).science, 'Shade keeps the sun off the ice.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 3 }).music, 'A tune can go up, down, or stay the same.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 5 }).music, 'A steady part holds up a changing tune.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 4 }).science, 'A pond chain keeps one tenth at each step too.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 4 }).math, 'Sharing equally is dividing: 12 ÷ 4 = 3 each.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 4 }).community, 'Every job needs the strength that fits it.');
  assert.equal(learnedAt({ ...k, chapter: 1, grade: 5 }).community, 'Ask about a strength before you hand out a job.');
});
test('the music reward reads like the others on the item-get card', () => {
  const music = CHARACTERS.find(c => c.id === 'music');
  assert.equal(music.reward.label, 'Festival band');
  assert.ok(CHARACTERS.every(c => !/^your /i.test(c.reward.label)), 'no reward starts with "Your"');
  assert.deepEqual(CHARACTERS.map(c => c.id), SUBJECTS, 'ids unchanged');
});

test('every Guide biography fits 56 characters per sentence at every grade', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const entries = guideEntries({ ...createState(), chapter: grade ? 1 : 0, grade: grade || 1 });
    for (const entry of entries) for (const sentence of entry.bio.split(/(?<=[.!?…])\s+/)) {
      assert.ok(sentence.length <= 56, `${entry.name}: ${sentence.length} characters`);
    }
    assert.equal(entries.find(e => e.id === 'pip').bio, 'Pip brings notes to every home.');
    assert.equal(entries.find(e => e.id === 'music').bio, 'Kiko makes music you can see and hear.');
  }
});
