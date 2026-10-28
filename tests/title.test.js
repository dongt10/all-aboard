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
  assert.deepEqual([next.chapter, next.grade, next.hasStarted], [0, 4, false]);
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

test('choosing any title grade keeps Start before play, including after reload', t => {
  const doc = installDocument(t);
  for (let tile = 0; tile < gradeChoices().length; tile++) {
    let state = createState();
    const visits = [];
    const ctx = { stage: doc.body, getState: () => state, commit: next => { state = normalizeState(next); }, go: name => visits.push(name), announce() {} };
    let scene = createTitleScene(ctx);
    scene.mount();
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Start');
    doc.body.querySelectorAll('.grade-tile')[tile].click();
    assert.equal(state.hasStarted, false);
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Start');
    assert.deepEqual(visits, [], 'choosing a grade does not navigate');
    scene.destroy();
    state = normalizeState(JSON.parse(JSON.stringify(state)));
    scene = createTitleScene(ctx);
    scene.mount();
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Start');
    scene.destroy();
  }
});

test('grade selection preserves Continue for a save that has entered the village', t => {
  const doc = installDocument(t);
  let state = { ...createState(), hasStarted: true };
  const ctx = { stage: doc.body, getState: () => state, commit: next => { state = normalizeState(next); }, announce() {} };
  const scene = createTitleScene(ctx);
  scene.mount();
  for (const tile of doc.body.querySelectorAll('.grade-tile')) {
    tile.click();
    assert.equal(state.hasStarted, true);
    assert.equal(doc.body.querySelector('.title-start span').textContent, 'Continue');
  }
  scene.destroy();
});

test('a refused village transition does not mark a title save as started', async t => {
  const doc = installDocument(t);
  let state = createState();
  const visits = [];
  const ctx = {
    stage: doc.body, getState: () => state, commit: next => { state = normalizeState(next); }, announce() {},
    go: async name => { visits.push(name); return false; },
  };
  const scene = createTitleScene(ctx);
  scene.mount();
  doc.body.querySelector('.title-start').click();
  await flush();
  assert.deepEqual(visits, ['village']);
  assert.equal(state.hasStarted, false);
  assert.equal(doc.body.querySelector('.title-start span').textContent, 'Start');
  scene.destroy();
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

function setGlobal(t, name, value) {
  const old = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => { if (old) Object.defineProperty(globalThis, name, old); else delete globalThis[name]; });
}
function titleContext(doc, spoken = []) {
  let state = createState();
  return { stage: doc.body, getState: () => state, commit: next => { state = next; }, go() {}, announce() {}, speak: text => spoken.push(text) };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('fullscreen control tracks entry, exit, external changes and removes listeners', async t => {
  const doc = installDocument(t);
  doc.documentElement = doc.body;
  doc.fullscreenEnabled = true;
  let locked = '';
  setGlobal(t, 'screen', { orientation: { lock: async value => { locked = value; } } });
  doc.body.requestFullscreen = async () => { doc.fullscreenElement = doc.body; doc.dispatchEvent(new Event('fullscreenchange')); };
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.dispatchEvent(new Event('fullscreenchange')); };
  const scene = createTitleScene(titleContext(doc)); scene.mount();
  const button = doc.body.querySelector('.title-fullscreen');
  assert.ok(button);
  button.click(); await flush();
  assert.equal(button.textContent, 'Exit full screen');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(locked, 'landscape');
  button.click(); await flush();
  assert.equal(button.textContent, 'Full screen');
  doc.fullscreenElement = doc.body; doc.dispatchEvent(new Event('webkitfullscreenchange'));
  assert.equal(button.textContent, 'Exit full screen');
  scene.destroy();
  assert.equal(doc.listeners.fullscreenchange.length, 0);
  assert.equal(doc.listeners.webkitfullscreenchange.length, 0);
});

test('fullscreen availability and refusal use a readable dialog', async t => {
  const doc = installDocument(t); doc.documentElement = doc.body;
  let scene = createTitleScene(titleContext(doc)); scene.mount();
  assert.equal(doc.body.querySelector('.title-fullscreen'), null); scene.destroy();
  doc.webkitFullscreenEnabled = false;
  doc.body.webkitRequestFullscreen = async () => {};
  doc.webkitExitFullscreen = async () => {};
  scene = createTitleScene(titleContext(doc)); scene.mount();
  assert.equal(doc.body.querySelector('.title-fullscreen'), null); scene.destroy();
  doc.webkitFullscreenEnabled = true;
  doc.body.webkitRequestFullscreen = async () => { throw new Error('denied'); };
  const spoken = [];
  scene = createTitleScene(titleContext(doc, spoken)); scene.mount();
  const button = doc.body.querySelector('.title-fullscreen'); button.focus(); button.click(); await flush();
  assert.match(doc.body.querySelector('.fullscreen-message p').textContent, /could not/);
  doc.body.querySelector('[data-action="hear"]').click();
  assert.match(spoken[0], /could not/);
  doc.body.querySelector('[data-action="done"]').click();
  assert.equal(doc.activeElement, button);
  scene.destroy();
});

test('iPhone Safari tip is dismissible, readable and remembered when storage throws', t => {
  const doc = installDocument(t);
  setGlobal(t, 'navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' });
  setGlobal(t, 'localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  const spoken = [];
  let scene = createTitleScene(titleContext(doc, spoken)); scene.mount();
  assert.equal(doc.body.querySelector('.fullscreen-message p').textContent, 'For full screen: Share, then Add to Home Screen.');
  doc.body.querySelector('[data-action="hear"]').click();
  assert.deepEqual(spoken, ['For full screen: Share, then Add to Home Screen.']);
  doc.body.querySelector('.win__close').click();
  assert.equal(doc.activeElement, doc.body.querySelector('.title-start'));
  scene.destroy();
  scene = createTitleScene(titleContext(doc)); scene.mount();
  assert.equal(doc.body.querySelector('.fullscreen-message'), null);
  scene.destroy();
});

test('legacy WebKit events report failures and lock once on asynchronous entry', async t => {
  const doc = installDocument(t); doc.documentElement = doc.body;
  let locks = 0, calls = 0;
  setGlobal(t, 'screen', { orientation: { lock: () => { locks++; return Promise.reject(Error('unsupported')); } } });
  doc.body.webkitRequestFullscreen = () => { calls++; };
  doc.webkitExitFullscreen = () => {};
  const scene = createTitleScene(titleContext(doc)); scene.mount();
  const button = doc.body.querySelector('.title-fullscreen');
  button.click(); button.click(); assert.equal(calls, 1);
  doc.dispatchEvent(new Event('webkitfullscreenerror'));
  assert.match(doc.body.querySelector('.fullscreen-message p').textContent, /could not/);
  doc.body.querySelector('[data-action="done"]').click();
  button.click(); assert.equal(calls, 2);
  doc.webkitFullscreenElement = doc.body;
  doc.dispatchEvent(new Event('webkitfullscreenchange'));
  doc.dispatchEvent(new Event('fullscreenchange'));
  await flush();
  assert.equal(locks, 1);
  assert.equal(button.textContent, 'Exit full screen');
  assert.equal(doc.body.querySelector('.fullscreen-message'), null);
  scene.destroy();
  assert.equal(doc.listeners.fullscreenerror.length, 0);
  assert.equal(doc.listeners.webkitfullscreenerror.length, 0);
});

test('iPhone browser exclusions and installed display modes skip the tip and full-screen control', async t => {
  const doc = installDocument(t); doc.documentElement = doc.body;
  doc.body.webkitRequestFullscreen = () => {}; doc.webkitExitFullscreen = () => {};
  const { createTitleScene: freshScene } = await import('../src/ui/screens/title.js?tip-exclusions');
  setGlobal(t, 'localStorage', { getItem: () => null, setItem() {} });
  const safari = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';
  for (const [ua, standalone, mode] of [
    [safari, true, ''], [safari, false, 'standalone'], [safari, false, 'fullscreen'],
    ...['CriOS', 'FxiOS', 'EdgiOS', 'OPiOS', 'DuckDuckGo'].map(name => [safari + ' ' + name, false, '']),
  ]) {
    setGlobal(t, 'navigator', { userAgent: ua, standalone });
    setGlobal(t, 'matchMedia', query => ({ matches: query === `(display-mode: ${mode})` }));
    const scene = freshScene(titleContext(doc)); scene.mount();
    assert.equal(doc.body.querySelector('.fullscreen-message'), null, `${ua} ${mode}`);
    assert.equal(doc.body.querySelector('.title-fullscreen'), null);
    scene.destroy();
  }
});

test('iPhone Safari tip dismissal survives a fresh module and remount through localStorage', async t => {
  const doc = installDocument(t);
  setGlobal(t, 'navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' });
  setGlobal(t, 'matchMedia', () => ({ matches: false }));
  const stored = new Map();
  setGlobal(t, 'localStorage', { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  const first = await import('../src/ui/screens/title.js?tip-storage-first');
  let scene = first.createTitleScene(titleContext(doc)); scene.mount();
  assert.ok(doc.body.querySelector('.fullscreen-message'));
  doc.body.querySelector('[data-action="done"]').click(); scene.destroy();
  assert.equal(stored.get('all-aboard-fullscreen-tip-dismissed'), '1');
  const second = await import('../src/ui/screens/title.js?tip-storage-second');
  scene = second.createTitleScene(titleContext(doc)); scene.mount();
  assert.equal(doc.body.querySelector('.fullscreen-message'), null);
  scene.destroy();
});

test('the evening parade uses all nine reference sprites and cheers only after a grade choice', t => {
  const doc = installDocument(t), ctx = titleContext(doc), scene = createTitleScene(ctx);
  scene.mount();
  const parade = doc.body.querySelector('.title__parade');
  assert.equal(parade.getAttribute('aria-hidden'), 'true');
  assert.equal(parade.querySelectorAll('button').length, 0, 'the lineup is decoration');
  const ids = ['pip', 'math', 'science', 'art', 'reading', 'writing', 'community', 'music', 'nori'];
  assert.equal(parade.querySelectorAll('.figure').length, ids.length);
  for (const id of ids) {
    const figure = parade.querySelector(`.figure--${id}`);
    assert.ok(figure);
    assert.match(figure.getAttribute('style'), new RegExp(`assets/figures/${id}\\.png`));
    assert.match(figure.getAttribute('style'), /background-position:-96px 0px/);
  }
  const girl = doc.body.querySelector('[data-avatar="girl"]');
  girl.click();
  assert.equal(ctx.getState().avatar, 'girl');
  assert.equal(girl.getAttribute('aria-pressed'), 'true');
  assert.match(girl.querySelector('.figure').getAttribute('style'), /background-position:-288px 0px/);
  assert.match(parade.querySelector('.figure').getAttribute('style'), /background-position:-96px 0px/);
  for (const tile of doc.body.querySelectorAll('.grade-tile')) {
    tile.click();
    for (const id of ids) assert.match(parade.querySelector(`.figure--${id}`).getAttribute('style'), /background-position:-288px 0px/);
    assert.equal(ctx.getState().hasStarted, false, 'cheering is not progress');
  }
  scene.destroy();
});

test('title arrows preserve roving choice groups and separate command and comfort Tab stops', t => {
  const doc = installDocument(t), ctx = titleContext(doc), scene = createTitleScene(ctx);
  scene.mount();
  const avatars = doc.body.querySelectorAll('.avatar-choice'), grades = doc.body.querySelectorAll('.grade-tile');
  assert.equal(doc.activeElement, doc.body.querySelector('.title-start'));
  avatars[0].focus();
  assert.equal(scene.handleIntent('right'), true);
  assert.equal(doc.activeElement, avatars[1]);
  assert.deepEqual(avatars.map(el => el.tabIndex), [-1, 0]);
  assert.equal(ctx.getState().avatar, 'boy', 'moving focus does not choose');
  avatars[1].click();
  scene.handleIntent('down');
  assert.equal(doc.activeElement, grades[0]);
  for (let i = 1; i < grades.length; i++) {
    scene.handleIntent('right');
    assert.equal(doc.activeElement, grades[i]);
    assert.equal(grades.filter(el => el.tabIndex === 0).length, 1);
  }
  grades[5].click();
  assert.equal(ctx.getState().grade, 5);
  scene.handleIntent('down');
  assert.equal(doc.activeElement, doc.body.querySelector('.title-start'));
  scene.handleIntent('right');
  assert.equal(doc.activeElement, doc.body.querySelector('.title-credits'));
  scene.handleIntent('down');
  const comfort = doc.body.querySelectorAll('.comfort-toggle');
  assert.equal(doc.activeElement, comfort[0]);
  for (const control of [...comfort, doc.body.querySelector('.title-start'), doc.body.querySelector('.title-credits')]) assert.equal(control.tabIndex, 0);
  assert.equal(scene.handleIntent('back'), false, 'B/Escape retain their existing handling');
  assert.equal(scene.handleIntent('confirm'), false, 'native button activation is unchanged');
  scene.destroy();
});

test('all three title comfort controls report the saved setting on toggle and remount', t => {
  const doc = installDocument(t), ctx = titleContext(doc);
  let scene = createTitleScene(ctx); scene.mount();
  for (const button of doc.body.querySelectorAll('.comfort-toggle')) {
    button.click();
    assert.equal(ctx.getState().settings[button.dataset.setting], true);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.querySelector('.px-toggle__state').textContent, 'On');
  }
  scene.destroy(); scene = createTitleScene(ctx); scene.mount();
  for (const button of doc.body.querySelectorAll('.comfort-toggle')) {
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    button.click();
    assert.equal(ctx.getState().settings[button.dataset.setting], false);
    assert.equal(button.querySelector('.px-toggle__state').textContent, 'Off');
  }
  scene.destroy();
});

import { readFileSync } from 'node:fs';
import { declarations, controlStyle, resolveVars } from './helpers/css.js';
import { contrastRatio } from '../src/ui/palette.js';
const titleCss = readFileSync(new URL('../src/ui/screens/title.css', import.meta.url), 'utf8');
const titleControlCss = ['tokens', 'kit', 'screens/title', 'phone'].map(name => readFileSync(new URL(`../src/ui/${name}.css`, import.meta.url), 'utf8')).join('\n');

test('title controls keep readable contrast, a 20px text floor and phone target sizes in both text modes', t => {
  const doc = installDocument(t); doc.documentElement = doc.body;
  doc.body.requestFullscreen = () => {}; doc.exitFullscreen = () => {};
  const scene = createTitleScene(titleContext(doc)); scene.mount();
  for (const phone of [false, true]) for (const large of [false, true]) {
    doc.body.classList.toggle('phone', phone); doc.body.classList.toggle('large-text', large);
    for (const control of doc.body.querySelectorAll('button')) {
      for (const hover of [null, control]) {
        const style = controlStyle(control, titleControlCss, { hover });
        assert.ok(contrastRatio(style.color, resolveVars('var(--fill)', style)) >= 4.5, control.className);
      }
      const style = controlStyle(control, titleControlCss);
      assert.ok(parseFloat(style['font-size']) >= 20, control.className);
      assert.ok(Math.max(parseFloat(style.height) || 0, parseFloat(style['min-height']) || 0) >= (phone ? 64 : 48), control.className);
    }
    for (const selector of ['.title__who-label', '.title__grade-label', '.title__welcome', '.avatar-choice__label', '.grade-tile__word', '.px-toggle__state']) {
      assert.ok(parseFloat(controlStyle(doc.body.querySelector(selector), titleControlCss)['font-size']) >= 20, selector);
    }
  }
  const palette = declarations(titleControlCss, ':root');
  assert.ok(contrastRatio(palette['--paper'], palette['--letterbox']) >= 4.5);
  assert.ok(contrastRatio(palette['--ink'], palette['--paper']) >= 4.5);
  scene.destroy();
});

test('title choice and footer boxes fit the 960 by 540 stage with room for focus rings', () => {
  const rule = selector => declarations(titleCss, selector);
  const grades = rule('.title__grades'), grade = rule('.title .grade-tile'), kinder = rule('.title .grade-tile[data-grade="0"]');
  assert.equal(parseFloat(kinder.width) + 5 * parseFloat(grade.width) + 5 * parseFloat(rule('.grade-tiles').gap), parseFloat(grades.width));
  assert.ok(parseFloat(grades.left) + parseFloat(grades.width) + 7 <= 960);
  const who = rule('.title__who'), avatar = rule('.title .avatar-choice');
  const choiceBottom = Math.max(parseFloat(who.top) + parseFloat(avatar.top) + parseFloat(avatar.height), parseFloat(grades.top) + parseFloat(grade.height));
  assert.ok(choiceBottom + 7 < parseFloat(rule('.title-start').top));
  const comfort = rule('.title__comfort'), toggle = rule('.title__comfort .px-toggle');
  assert.equal(3 * parseFloat(toggle.width) + 2 * parseFloat(comfort.gap), parseFloat(comfort.width));
  assert.ok(parseFloat(comfort.top) + parseFloat(toggle.height) + 7 <= 540);
  assert.match(rule('.calm .title__lantern b').animation, /^none$/);
  assert.match(titleCss, /@media \(prefers-reduced-motion: reduce\) \{ \.title__lantern b \{ animation: none;/);
});
