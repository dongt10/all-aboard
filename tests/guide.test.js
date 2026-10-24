import test from 'node:test';
import assert from 'node:assert/strict';
import { guideEntries, stampCount, LEARNED, SIDE_BIOS } from '../src/ui/guide.js';
import { createState, publishCreation } from '../src/progress.js';
import { CHARACTERS } from '../src/data.js';

const sign = { kind: 'writing', text: 'Welcome!', chapter: 0, grade: 0 };

test('the guide lists the seven neighbors, then Pip, Nori and Cricket', () => {
  const entries = guideEntries(createState());
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map(e => e.id), [...CHARACTERS.map(c => c.id), 'pip', 'nori', 'cricket']);
  const taro = entries[0];
  assert.deepEqual(taro, { id: 'math', name: 'Taro', species: 'tanuki', role: 'Math · Workshop', bio: CHARACTERS[0].description, subject: 'math', stamp: { earned: false, learned: LEARNED.math }, canFind: true, canVisit: true });
  assert.ok(entries.slice(0, 7).every(e => e.stamp && e.subject === e.id && e.canFind && e.canVisit));
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
