import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeChoices, chooseGrade, createTitleScene } from '../src/ui/screens/title.js';
import { withScope, toggleSetting, chooseAvatar } from '../src/ui/save.js';
import { createState, normalizeState } from '../src/progress.js';

test('grade tiles are Kindergarten then grades 1–5', () => {
  assert.deepEqual(gradeChoices().map(c => c.label), ['K', '1', '2', '3', '4', '5']);
  assert.deepEqual(gradeChoices()[0], { chapter: 0, grade: 0, label: 'K', name: 'Kindergarten' });
  assert.deepEqual(gradeChoices()[3], { chapter: 1, grade: 3, label: '3', name: 'Grade 3' });
});
test('choosing Kindergarten keeps the last elementary grade for later', () => {
  const state = { ...createState(), chapter: 1, grade: 4 };
  const next = chooseGrade(state, gradeChoices()[0]);
  assert.deepEqual([next.chapter, next.grade, next.hasStarted], [0, 4, true]);
  assert.equal(state.chapter, 1);
  const two = chooseGrade(createState(), gradeChoices()[2]);
  assert.deepEqual([two.chapter, two.grade], [1, 2]);
});
test('comfort toggles return a new state and reject unknown settings', () => {
  const state = createState();
  assert.equal(toggleSetting(state, 'autoRead').settings.autoRead, true);
  assert.equal(state.settings.autoRead, false);
  assert.throws(() => toggleSetting(state, 'volume'), RangeError);
});
test('saved snapshots carry their chapter and grade', () => {
  assert.deepEqual(withScope({ kind: 'art' }, { ...createState(), chapter: 0, grade: 4 }), { kind: 'art', chapter: 0, grade: 0 });
  assert.deepEqual(withScope({ kind: 'art' }, { ...createState(), chapter: 1, grade: 4 }), { kind: 'art', chapter: 1, grade: 4 });
});
test('choosing who you are returns a new state and rejects anything else', () => {
  const state = createState();
  assert.equal(chooseAvatar(state, 'girl').avatar, 'girl');
  assert.equal(chooseAvatar(state, 'boy').avatar, 'boy');
  assert.equal(state.avatar, 'boy');
  assert.throws(() => chooseAvatar(state, 'player'), RangeError);
});

// The scene-test fake DOM also exercises the live guide Help window.
import { Doc, Event } from './helpers/dom.js';


function installDocument(t) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new Doc();
  doc.querySelector = selector => selector === '#guide' ? doc.body : doc.body.querySelector(selector);
  globalThis.document = doc;
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'document', prior); else delete globalThis.document; });
  return doc;
}

test('choosing a title grade immediately shows the label saved for reload', t => {
  const doc = installDocument(t);
  for (let tile = 0; tile < gradeChoices().length; tile++) {
    let state = createState();
    const visits = [];
    const ctx = { stage: doc.body, getState: () => state, commit: next => { state = normalizeState(next); }, go: name => visits.push(name), announce() {} };
    let scene = createTitleScene(ctx);
    scene.mount();
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Start');
    doc.body.querySelectorAll('.grade-tile')[tile].click();
    assert.equal(state.hasStarted, true);
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Continue');
    assert.deepEqual(visits, [], 'choosing a grade does not navigate');
    scene.destroy();
    state = normalizeState(JSON.parse(JSON.stringify(state)));
    scene = createTitleScene(ctx);
    scene.mount();
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Continue');
    scene.destroy();
  }
});

test('the live style guide Help action closes with Got it and restores focus', async t => {
  const doc = installDocument(t);
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'MutationObserver', prior); else delete globalThis.MutationObserver; });
  await import('../src/styleguide-kit.js');
  const help = doc.body.querySelector('[data-act="help"]');
  for (const key of [null, 'Enter', 'z']) {
    help.focus();
    help.click();
    const gotIt = doc.body.querySelector('[data-help-done]');
    assert.ok(gotIt);
    assert.equal(doc.activeElement, gotIt, 'the first presented action has focus');
    if (key) {
      const event = new Event('keydown', { key });
      gotIt.dispatchEvent(event);
      // The browser's native Enter action clicks a focused button.
      if (key === 'Enter' && !event.defaultPrevented) gotIt.click();
    } else gotIt.click();
    assert.equal(Boolean(doc.body.querySelector('.win-backdrop')), false);
    assert.equal(doc.activeElement, help);
    assert.equal(help.closest('.kit-demo__dlg').inert, false);
  }
});
