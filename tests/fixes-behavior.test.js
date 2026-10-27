import test from 'node:test';
import assert from 'node:assert/strict';

import { Doc, El, Event, Target, pressKey } from './helpers/dom.js';

const doc = new Doc();
doc.fonts = new Target();
const speech = { cancels: 0, cancel() { this.cancels++; }, speak() {},
  getVoices: () => [{ name: 'Test narrator', lang: 'en-US', localService: true }] };
const resizeWindow = Object.assign(new Target(), { innerWidth: 1920, innerHeight: 1080 });
const observers = new Set();
Object.assign(globalThis, {
  document: doc,
  window: resizeWindow,
  MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() {}
    disconnect() { observers.delete(this); }
  },
  speechSynthesis: speech,
  SpeechSynthesisUtterance: class extends Target { constructor(text) { super(); this.text = text; } },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

const { createState, getCreations, loadState, STORAGE_KEY } = await import('../src/progress.js');
const { figureMarkup } = await import('../src/ui/figures/index.js');
const { createMusicScene } = await import('../src/ui/screens/music.js');
const { createEncounterScene } = await import('../src/ui/screens/encounter.js');
const { createVillageScene } = await import('../src/ui/screens/village.js');
const { openPauseWindow, openGradeWindow, openHelpWindow } = await import('../src/ui/screens/windows.js');
const { createApp } = await import('../src/ui/app.js');
const { createDialogue } = await import('../src/ui/dialogue.js');
const { showItemGet } = await import('../src/ui/screens/item-get.js');
const { reactionLine } = await import('../src/ui/activities/sign.js');

function fakeCtx(state = createState()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div');
  stage.className = 'stage';
  doc.body.append(stage);
  const ctx = {
    stage, gone: [], opened: [],
    getState: () => state,
    commit(next) { state = next; return state; },
    go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    speak() {}, announce() {},
    open: { help: () => ctx.opened.push('help') },
    scenes: { busy: false, pause() {} },
  };
  return ctx;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(b => b.dataset.id === id);
const grade2 = () => ({ ...createState(), chapter: 1, grade: 2 });

// ---- B1, B8: Music finishing ----
test('music: B during the item-get card does not leave, and the band still gets published', async () => {
  const ctx = fakeCtx();
  const scene = createMusicScene(ctx);
  scene.mount();
  slot(ctx.stage, 'quiet').click();          // Send band waits for an edit or a play; See beat counts as a play
  slot(ctx.stage, 'save').click();
  await tick();
  const card = ctx.stage.querySelector('.item-get');
  assert.ok(card, 'the item-get card is showing');
  scene.handleIntent('b');
  await tick();
  assert.deepEqual(ctx.gone, [], 'B is ignored while the card is up');
  card.firstElementChild.click();
  await tick();
  assert.ok(getCreations(ctx.getState()).music, 'the band was published');
  assert.deepEqual(ctx.gone, [['village', { focus: 'music', celebrate: 'music' }]]);
  scene.destroy();
});

test('music: the item-get figure is drawn at scale 2 like the encounter', async () => {
  const ctx = fakeCtx();
  const scene = createMusicScene(ctx);
  scene.mount();
  slot(ctx.stage, 'quiet').click();
  slot(ctx.stage, 'save').click();
  await tick();
  const html = ctx.stage.querySelector('.item-get').innerHTML;
  assert.ok(html.includes(figureMarkup('music', { pose: 'joy', scale: 2 })), 'scale 2 figure');
  assert.ok(!html.includes(figureMarkup('music', { pose: 'joy', scale: 3 })), 'not scale 3');
  scene.destroy();
});

// ---- B9: Music A outside the menu ----
test('music: A with focus outside the menu brings focus back to the menu', () => {
  const ctx = fakeCtx();
  const scene = createMusicScene(ctx);
  scene.mount();
  doc._active = null;   // focus went somewhere outside the menu
  assert.equal(scene.handleIntent('a'), true);
  assert.ok(ctx.stage.querySelector('.music-menu').contains(doc.activeElement), 'focus is in the menu');
  scene.destroy();
});

// ---- B2: Fumi's empty sign ----
test('sign: an empty sign opens with focus in the field, not on the Village button', t => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
  t.after(() => scene.destroy());
  scene.mount();
  assert.ok(ctx.stage.querySelector('.enc__field').contains(doc.activeElement), 'focus starts in the field');
  scene.destroy();
});

test('sign: B in the empty textarea moves to Village, and a second B leaves', async t => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
  t.after(() => scene.destroy());
  scene.mount();
  ctx.stage.querySelector('textarea').focus();
  assert.equal(scene.handleIntent('b'), true);
  assert.ok(doc.activeElement === ctx.stage.querySelector('.enc__back'), 'focus goes to Village');
  assert.deepEqual(ctx.gone, []);
  scene.handleIntent('b');
  await tick();
  assert.deepEqual(ctx.gone, [['village', { focus: 'writing' }]]);
  scene.destroy();
});

// ---- Frame: a readiness flip with no line from the activity still gets a line ----
test('encounter: typing the sign empty says the activity\'s not-ready line, and a sentence says the sign\'s own line', t => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
  t.after(() => scene.destroy());
  scene.mount();
  const face = ctx.stage.querySelector('textarea');
  const text = () => ctx.stage.querySelector('.enc__dialogue').querySelector('.dlg__text').textContent;
  face.value = 'Hello!';
  face.dispatchEvent(new Event('input'));          // a complete sentence enables the sign
  assert.equal(text(), 'You wrote it. Add more, or choose Put up sign.');
  assert.equal(slot(ctx.stage, 'finish').disabled, false, 'Put up sign is enabled');
  face.value = '';
  face.dispatchEvent(new Event('input'));          // the sign supplies its next sentence hint
  assert.equal(text(), 'Start with a capital letter.');
  assert.equal(slot(ctx.stage, 'finish').disabled, true, 'Put up sign is disabled again');
  scene.destroy();
});

// ---- B10: arrows out of the field ----
test('encounter: down from the field moves focus to the menu', t => {
  const ctx = fakeCtx();
  const scene = createEncounterScene(ctx, { id: 'writing' });
  t.after(() => scene.destroy());
  scene.mount();
  const tile = ctx.stage.querySelector('.sign-tile');
  tile.click();   // a word on the sign, so the menu has commands
  tile.focus();
  assert.equal(scene.handleIntent('down'), true);
  assert.ok(ctx.stage.querySelector('.enc__menu').contains(doc.activeElement), 'focus is in the menu');
  scene.destroy();
});

// ---- B4: hush never drops focus ----
test('village: hiding the dialogue while it holds focus moves focus to the village', () => {
  const ctx = fakeCtx();
  const scene = createVillageScene(ctx, { celebrate: 'math' });
  scene.mount();
  const hear = ctx.stage.querySelector('.village-dialogue').querySelector('.dlg__tab');
  hear.focus();
  assert.ok(doc.activeElement === hear);
  scene.handleIntent('up');
  assert.ok(doc.activeElement === ctx.stage.querySelector('.village'), 'focus is on the village, not <body>');
  scene.destroy();
});

// ---- B3, B5: windows ----
test('windows: opening a window stops speech', () => {
  const ctx = fakeCtx();
  const before = speech.cancels;
  assert.ok(openPauseWindow(ctx));
  assert.ok(speech.cancels > before, 'speech was stopped');
});

test('windows: no window opens during a scene transition', () => {
  const ctx = fakeCtx();
  ctx.scenes.busy = true;
  assert.equal(openPauseWindow(ctx), null);
  assert.ok(!ctx.stage.querySelector('.win-backdrop'), 'no window');
});

// ---- App-level: B3 visibility, B6 held keys, B7 reload ----
function fakeApp(storage = null) {
  doc.body.children = []; doc._active = null; doc.listeners = {};
  const host = doc.createElement('div');
  doc.body.append(host);
  const log = { params: [], pauses: 0, intents: [] };
  const scene = (name) => (ctx, params) => ({
    mount() { log.params.push([name, params]); const b = doc.createElement('button'); b.className = 'cmd'; ctx.stage.append(b); this.button = b; b.focus(); },
    pause() { log.pauses++; },
    handleIntent(intent) { log.intents.push(intent); return true; },
    destroy() { this.button?.remove(); },
  });
  const app = createApp(host, { scenes: { village: scene('village'), title: scene('title') }, storage });
  return { app, log };
}

test('app: hiding the tab stops speech and pauses the scene, until destroy', async () => {
  const { app, log } = fakeApp();
  await app.go('title');
  const before = speech.cancels;
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.ok(speech.cancels > before, 'speech stopped');
  assert.equal(log.pauses, 1, 'scene paused');
  app.destroy();
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(log.pauses, 1, 'listener removed on destroy');
  doc.hidden = false;
});

test('app: a held Enter or Space on a button acts once', async () => {
  const { app } = fakeApp();
  await app.go('title');
  const button = app.stage.querySelector('.cmd');
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  for (const key of ['Enter', ' ']) {
    clicks = 0;
    const first = pressKey(button, 'keydown', key);
    assert.equal(first.defaultPrevented, false, 'the first press is left to the browser');
    assert.equal(clicks, key === 'Enter' ? 1 : 0, 'Enter activates on down; Space waits for release');
    for (let repeat = 0; repeat < 3; repeat++) {
      const held = pressKey(button, 'keydown', key, { repeat: true });
      assert.equal(held.defaultPrevented, true, `a repeated ${JSON.stringify(key)} is swallowed`);
    }
    pressKey(button, 'keyup', key);
    assert.equal(clicks, 1, `one complete held ${JSON.stringify(key)} press activates exactly once`);
  }
  const area = doc.createElement('textarea');
  app.stage.append(area);
  const typing = new Event('keydown', { key: 'Enter', repeat: true });
  area.dispatchEvent(typing);
  assert.equal(typing.defaultPrevented, false, 'text fields keep held keys');
  app.destroy();
});

test('app: reload keeps only focus, not one-shot params', async () => {
  const { app, log } = fakeApp();
  await app.go('village', { focus: 'math', celebrate: 'math', guide: 'art' });
  await app.reload();
  assert.deepEqual(log.params.at(-1), ['village', { focus: 'math' }]);
  app.destroy();
});

// ---- QA: the portrait rotate card is modal ----
test('stage: in portrait the rotate card holds focus, and Play anyway hands it back to the game', async () => {
  Object.assign(window, { innerWidth: 375, innerHeight: 812 });
  try {
    const { app } = fakeApp();
    await app.go('title');
    const card = doc.body.querySelector('.rotate-card'), play = card.querySelector('button');
    assert.equal(card.hidden, false, 'the card shows in portrait');
    assert.ok(doc.activeElement === play, 'focus stays on Play anyway, not on the game behind the card');
    assert.equal(app.stage.inert, true, 'the game behind the card is inert');
    play.click();
    assert.equal(app.stage.inert, false);
    assert.ok(app.stage.contains(doc.activeElement), 'focus returns to the game');
    app.destroy();
  } finally {
    Object.assign(window, { innerWidth: 1920, innerHeight: 1080 });
  }
});

test('app: a failed Comfort save is announced outside the inert stage and clears on recovery', async () => {
  let fails = true;
  const { app } = fakeApp({ getItem() { return null; }, setItem() { if (fails) throw new Error('full'); } });
  try {
    await app.go('title');
    app.open.comfort();
    app.stage.querySelector('[data-setting="largeText"]').click();
    await new Promise(resolve => setTimeout(resolve, 40)); // Comfort also announces the toggle.
    assert.equal(app.saveOk, false);
    assert.equal(app.stage.querySelector('.save-off').hidden, false);
    const status = doc.body.querySelectorAll('[role="status"]').find(el => !app.stage.contains(el));
    assert.ok(status, 'a dedicated live status lives outside the stage');
    assert.equal(status.textContent, 'Saving is off. Keep this tab open.');
    for (let el = status; el; el = el.parentElement) assert.ok(!el.inert && !el.hidden);
    fails = false;
    app.stage.querySelector('[data-setting="largeText"]').click();
    assert.equal(app.saveOk, true);
    assert.equal(status.textContent, '');
    app.destroy();
    assert.equal(status.isConnected, false);
  } finally { app.destroy(); }
});

const resize = (width, height) => {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.fire(new Event('resize'));
};

test('app: portrait blocks scene B and arrows while Play anyway still accepts A', async () => {
  const { app, log } = fakeApp();
  try {
    await app.go('title');
    resize(375, 812);
    const play = doc.body.querySelector('.rotate-card button');
    assert.equal(app.stage.inert, true);
    for (const key of ['Escape', 'ArrowRight']) play.dispatchEvent(new Event('keydown', { key }));
    assert.deepEqual(log.intents, []);
    play.dispatchEvent(new Event('keydown', { key: 'z' }));
    assert.equal(app.stage.inert, false, 'A still activates the portrait card control');
  } finally { app.destroy(); resize(1920, 1080); }
});

test('stage: Bigger words reaches the portrait card through the shared viewport', async () => {
  const { app } = fakeApp();
  try {
    app.commit({ ...app.getState(), settings: { ...app.getState().settings, largeText: true } });
    resize(375, 812);
    const card = doc.body.querySelector('.rotate-card');
    assert.ok(card.closest('.large-text'), 'card and its button inherit the larger font variables');
    assert.ok(app.stage.classList.contains('large-text'), 'scene size checks still work');
    app.commit({ ...app.getState(), settings: { ...app.getState().settings, largeText: false } });
    assert.equal(card.closest('.large-text'), null);
  } finally { app.destroy(); resize(1920, 1080); }
});

test('stage: returning to landscape restores the focused Comfort control', async () => {
  const { app } = fakeApp();
  try {
    await app.go('title');
    app.open.comfort();
    const toggle = app.stage.querySelector('[data-setting="autoRead"]');
    toggle.focus();
    resize(375, 812);
    assert.ok(doc.body.querySelector('.rotate-card').contains(doc.activeElement));
    resize(1920, 1080);
    assert.ok(doc.activeElement === toggle, 'focus returns to the same Comfort control');
    resize(375, 812);
    toggle.disabled = true;
    resize(1920, 1080);
    assert.ok(app.stage.querySelector('.win-backdrop').contains(doc.activeElement), 'unusable opener falls back inside the open window');
  } finally { app.destroy(); resize(1920, 1080); }
});

test('stage: Tab and Shift+Tab stay on Play anyway in portrait', async () => {
  const { app } = fakeApp();
  try {
    await app.go('title');
    resize(375, 812);
    const play = doc.body.querySelector('.rotate-card button');
    for (const shiftKey of [false, true]) {
      const event = new Event('keydown', { key: 'Tab', shiftKey });
      play.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      assert.ok(doc.activeElement === play, 'focus remains on Play anyway');
    }
  } finally { app.destroy(); resize(1920, 1080); }
});

test('windows: grade Tab wraps only through Close and the roving tile', () => {
  const ctx = fakeCtx();
  const handle = openGradeWindow(ctx);
  try {
    const tiles = ctx.stage.querySelectorAll('.grade-tile');
    const close = ctx.stage.querySelector('.win__close');
    assert.deepEqual(tiles.map(tile => tile.tabIndex), [0, -1, -1, -1, -1, -1]);
    for (const selected of [0, 1]) {
      const tab = new Event('keydown', { key: 'Tab' });
      tiles[selected].dispatchEvent(tab);
      assert.equal(tab.defaultPrevented, true);
      assert.ok(doc.activeElement === close, 'Tab wraps to Close');
      const back = new Event('keydown', { key: 'Tab', shiftKey: true });
      close.dispatchEvent(back);
      assert.equal(back.defaultPrevented, true);
      assert.ok(doc.activeElement === tiles[selected], 'Shift+Tab wraps to the roving tile');
      tiles[selected].dispatchEvent(new Event('keydown', { key: 'ArrowRight' }));
    }
  } finally { handle.close(); }
});

test('windows: closing Help by Escape or Close stops its spoken step', () => {
  for (const escape of [true, false]) {
    const ctx = fakeCtx();
    const spoken = [];
    ctx.speak = words => spoken.push(words);
    const steps = ['Tap words to add them, or type your own.'];
    const handle = openHelpWindow(ctx, 'A sign from you', steps);
    const hear = ctx.stage.querySelector('[data-step="0"]');
    hear.click();
    assert.deepEqual(spoken, steps);
    const before = speech.cancels;
    if (escape) hear.dispatchEvent(new Event('keydown', { key: 'Escape' }));
    else ctx.stage.querySelector('.win__close').click();
    assert.equal(speech.cancels, before + 1);
    handle.close();
    assert.equal(speech.cancels, before + 1, 'closing twice does not repeat cleanup');
  }
});

test('item-get: dismissal restores the opener before its promise continues', async () => {
  const ctx = fakeCtx();
  const opener = doc.createElement('button');
  ctx.stage.append(opener);
  opener.focus();
  const done = showItemGet(ctx.stage, { name: 'Your sign' });
  assert.equal(opener.inert, true);
  ctx.stage.querySelector('.item-get__go').click();
  assert.ok(doc.activeElement === opener, 'focus is restored synchronously before the outgoing wipe');
  await done;
  assert.ok(doc.activeElement === opener);
});

test('dialogue: rendered overflow offers More and size changes preserve the unread long word', () => {
  const ctx = fakeCtx();
  let large = true;
  const dialogue = createDialogue(ctx.stage, { isLarge: () => large });
  // Simulate a 436px-wide, 110px-high box with the bundled Andika uppercase W advance.
  const measure = ctx.stage.querySelector('.dlg__measure');
  assert.ok(measure, 'measurement uses a separate node, outside the live text');
  assert.equal(measure.getAttribute('aria-hidden'), 'true');
  Object.defineProperties(measure, {
    clientHeight: { get: () => 110 },
    scrollHeight: { get: () => Math.max(110, Math.ceil(measure.textContent.length / (large ? 14 : 17)) * (large ? 35.4 : 30)) },
  });
  const words = reactionLine('Removed', 'W'.repeat(120));
  dialogue.say('Fumi', words);
  const pages = [dialogue.current()];
  assert.equal(dialogue.hasMore(), true);
  assert.equal(ctx.stage.querySelector('.dlg__more').hidden, false);
  assert.ok(pages[0].length <= 42);
  dialogue.next();
  large = false;
  for (const observer of observers) observer.callback();
  do { pages.push(dialogue.current()); } while (dialogue.next());
  let unread = words;
  for (const page of pages) {
    assert.ok(unread.startsWith(page), 'repagination adds no spaces inside a long word');
    unread = unread.slice(page.length).trimStart();
  }
  assert.equal(unread, '', 'all letters and punctuation survive repagination');
  assert.equal(ctx.stage.querySelector('.dlg__more').hidden, true);
  dialogue.destroy();
});

test('dialogue: a loaded font repaginates overflowing text without repeating read-aloud', () => {
  const ctx = fakeCtx();
  const spoken = [];
  const dialogue = createDialogue(ctx.stage, { isLarge: () => true, autoRead: () => true, speak: text => spoken.push(text) });
  let loaded = false;
  const measure = ctx.stage.querySelector('.dlg__measure');
  Object.defineProperties(measure, {
    clientHeight: { get: () => 110 },
    scrollHeight: { get: () => loaded ? Math.max(110, Math.ceil(measure.textContent.length / 14) * 35.4) : 110 },
  });
  const words = reactionLine('Removed', 'W'.repeat(120));
  dialogue.say('Fumi', words);
  assert.equal(dialogue.hasMore(), false, 'the fallback font fits');
  loaded = true;
  doc.fonts.fire(new Event('loadingdone'));
  assert.equal(dialogue.hasMore(), true, 'the loaded font needs another page');
  assert.deepEqual(spoken, [words], 'font loading does not repeat speech');
  delete globalThis.document;
  try { dialogue.destroy(); }
  finally { globalThis.document = doc; }
  assert.equal(doc.fonts.listeners.loadingdone.length, 0, 'the font listener is removed even after the document global is released');
});

const press = (key, target = doc.activeElement) => {
  const event = new Event('keydown', { key });
  target.dispatchEvent(event);
  if (!event.defaultPrevented && target.tagName === 'BUTTON' && ['Enter', ' '].includes(key)) target.click();
  return event;
};
const memoryStorage = (state = createState()) => {
  const values = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
function realApp(state = createState(), storage = memoryStorage(state)) {
  doc.body.children = []; doc._active = null; doc.listeners = {};
  const host = doc.createElement('div');
  doc.body.append(host);
  return createApp(host, { storage, scenes: { encounter: createEncounterScene, music: createMusicScene, village: createVillageScene } });
}
function deferredAnimations() {
  const original = El.prototype.animate;
  const pending = [];
  El.prototype.animate = () => ({ finished: new Promise(resolve => pending.push(resolve)) });
  return {
    async phase() { pending.splice(0).forEach(resolve => resolve()); await tick(); },
    async restore() { El.prototype.animate = () => ({ finished: Promise.resolve() }); pending.splice(0).forEach(resolve => resolve()); await tick(); El.prototype.animate = original; },
  };
}

test('app: Escape then A cannot activate Finish or its target handlers during either wipe phase', async () => {
  const app = realApp();
  let animation;
  try {
    await app.go('encounter', { id: 'writing' });
    app.stage.querySelector('.sign-tile').focus();
    press('Enter'); // Hello
    press('ArrowRight'); press('Enter'); // friend!
    const finish = slot(app.stage, 'finish');
    assert.equal(finish.disabled, false);
    finish.focus();
    animation = deferredAnimations();
    press('Escape');
    assert.equal(app.scenes.busy, true);
    let targetKeys = 0;
    finish.addEventListener('keydown', () => targetKeys++);
    for (const key of ['z', 'Z', 'Enter', ' ']) assert.equal(press(key, finish).defaultPrevented, true, key);
    assert.equal(targetKeys, 0, 'capture lock stops the target handler too');
    assert.equal(app.stage.querySelector('.item-get'), null);
    await animation.phase();
    assert.equal(app.scenes.current, 'village');
    const control = app.stage.querySelector('button:not(:disabled)');
    let clicks = 0;
    control.addEventListener('click', () => clicks++);
    for (const key of ['z', 'Enter', ' ']) assert.equal(press(key, control).defaultPrevented, true);
    assert.equal(clicks, 0, 'the incoming scene is locked through reveal');
    await animation.phase();
    assert.equal(app.scenes.busy, false);
    assert.equal(app.stage.querySelector('.item-get'), null);
    assert.deepEqual(getCreations(app.getState()), {});
  } finally { app.destroy(); await animation?.restore(); }
});

test('app: stale tabs refuse saves even after a storage event, preserving the newer sign and completion', async () => {
  const storage = memoryStorage();
  const appA = realApp(createState(), storage);
  const secondHost = doc.createElement('div'); doc.body.append(secondHost);
  const appB = createApp(secondHost, { storage });
  let reloaded;
  try {
    await appA.go('encounter', { id: 'writing' });
    const tiles = appA.stage.querySelectorAll('.sign-tile');
    const expected = `${tiles[0].textContent} ${tiles[1].textContent}`;
    tiles[0].focus();
    press('Enter');
    press('ArrowRight'); press('Enter');
    slot(appA.stage, 'finish').click();
    appA.stage.querySelector('.item-get__go').click();
    await tick();
    assert.equal(appA.saveOk, true);
    const saved = storage.getItem(STORAGE_KEY);
    assert.equal(getCreations(loadState(storage)).writing.text, expected);
    window.fire(new Event('storage', { key: STORAGE_KEY, newValue: saved, storageArea: storage }));
    appB.commit({ ...appB.getState(), settings: { ...appB.getState().settings, largeText: true } });
    assert.equal(appB.saveOk, false, 'the stale snapshot is not reported as saved');
    assert.equal(appB.stage.querySelector('.save-off').hidden, false);
    assert.equal(appB.getState().settings.largeText, true, 'local play remains usable');
    assert.equal(storage.getItem(STORAGE_KEY), saved, 'all newer saved progress is untouched');
    appB.commit({ ...appB.getState(), avatar: 'girl' });
    assert.equal(appB.saveOk, false, 'a retry cannot silently accept the stale baseline');
    assert.equal(storage.getItem(STORAGE_KEY), saved);
    const reloadHost = doc.createElement('div'); doc.body.append(reloadHost);
    reloaded = createApp(reloadHost, { storage });
    reloaded.commit({ ...reloaded.getState(), settings: { ...reloaded.getState().settings, largeText: true } });
    assert.equal(reloaded.saveOk, true);
    assert.deepEqual(getCreations(loadState(storage)), getCreations(appA.getState()));
    assert.deepEqual(loadState(storage).progress, appA.getState().progress);
  } finally { appA.destroy(); appB.destroy(); reloaded?.destroy(); }
});

test('app: clearing a save elsewhere cannot be undone by a stale tab', () => {
  const storage = memoryStorage();
  const app = realApp(createState(), storage);
  try {
    storage.removeItem(STORAGE_KEY);
    app.commit({ ...app.getState(), avatar: 'girl' });
    assert.equal(app.saveOk, false);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  } finally { app.destroy(); }
});

test('app: hidden Music pauses before speech cancellation and cannot restart narration', async () => {
  const state = createState(); state.settings.autoRead = true;
  const app = realApp(state);
  const events = [], oldSpeak = speech.speak, oldCancel = speech.cancel;
  speech.speak = utterance => events.push(['speak', utterance.text]);
  speech.cancel = () => events.push(['cancel']);
  try {
    await app.go('music');
    slot(app.stage, 'play').click();
    assert.ok(events.some(([type]) => type === 'speak'), 'Read to me is active');
    events.length = 0;
    const pause = app.scenes.scene.pause;
    app.scenes.scene.pause = () => { events.push(['pause']); pause(); };
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    app.speak('A late spoken line.');
    app.announce('A late announcement.');
    await tick();
    assert.equal(events[0][0], 'pause');
    assert.ok(events.some(([type]) => type === 'cancel'));
    assert.equal(events.some(([type]) => type === 'speak'), false, 'no narration while hidden');
    assert.equal(slot(app.stage, 'play').getAttribute('aria-pressed'), 'false');
  } finally { app.destroy(); doc.hidden = false; speech.speak = oldSpeak; speech.cancel = oldCancel; }
});

test('Sounds: X and Backspace close from a volume slider, while arrows stay native', async () => {
  const app = realApp({ ...createState(), chapter: 1, grade: 3 });
  try {
    await app.go('music');
    for (const key of ['x', 'X', 'Backspace']) {
      const sounds = slot(app.stage, 'tunes');
      sounds.focus(); press('z');
      const slider = app.stage.querySelector('[data-volume="melody"]');
      slider.focus();
      for (const arrow of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) assert.equal(press(arrow).defaultPrevented, false);
      assert.ok(doc.activeElement === slider);
      assert.equal(press(key).defaultPrevented, true, key);
      assert.equal(app.stage.querySelector('.win-backdrop'), null);
      assert.ok(doc.activeElement === sounds, 'focus returns to Sounds');
    }
  } finally { app.destroy(); }
});

test('Sounds: an edited La with Bigger words keeps a failed-save banner visible', async () => {
  const state = { ...createState(), chapter: 1, grade: 3, settings: { largeText: true } };
  const storage = memoryStorage(state); storage.setItem = () => { throw new Error('full'); };
  const app = realApp(state, storage);
  try {
    await app.go('music');
    slot(app.stage, 'tunes').click();
    app.stage.querySelector('[data-tab="voice"]').click();
    for (let i = 0; i < 6 && !app.stage.querySelector('.sounds-beat[data-beat="0"]').getAttribute('aria-label').includes('La'); i++) {
      app.stage.querySelector('.sounds-beat[data-beat="0"]').click();
    }
    assert.match(app.stage.querySelector('.sounds-beat[data-beat="0"]').getAttribute('aria-label'), /La/);
    assert.equal(app.saveOk, false);
    assert.equal(app.stage.querySelector('.save-off').hidden, false);
    assert.ok(app.stage.querySelector('.win-backdrop'));
    assert.ok(app.stage.classList.contains('large-text'));
  } finally { app.destroy(); }
});

test('sign: removing the last word returns focus to a usable field control', async () => {
  for (const state of [createState(), grade2()]) {
    const app = realApp(state);
    try {
      await app.go('encounter', { id: 'writing' });
      const tile = app.stage.querySelector('.sign-tile');
      tile.focus(); press('Enter');
      slot(app.stage, 'remove').focus();
      assert.ok(doc.activeElement === slot(app.stage, 'remove'));
      press('Enter');
      const field = app.stage.querySelector('.enc__field');
      assert.ok(field.contains(doc.activeElement), 'empty menu hands focus back to the field');
      assert.equal(slot(app.stage, 'finish').disabled, true);
      assert.ok(doc.activeElement === (field.querySelector('textarea') ?? field.querySelector('button:not(:disabled)')));
      if (state.chapter === 0) {
        press('z'); press('ArrowRight'); press('z');
        assert.equal(slot(app.stage, 'finish').disabled, false, 'the child can add another word without Tab');
      } else {
        doc.activeElement.value = 'Hello!'; doc.activeElement.dispatchEvent(new Event('input'));
        assert.equal(slot(app.stage, 'finish').disabled, false);
      }
    } finally { app.destroy(); }
  }
});

test('app: destruction during cover never mounts Music or leaves its global listeners', async () => {
  const app = realApp();
  let animation;
  try {
    await app.go('title');
    const counts = () => [doc.listeners.visibilitychange?.length ?? 0, window.listeners.pagehide?.length ?? 0, doc.fonts.listeners.loadingdone?.length ?? 0];
    const before = counts();
    animation = deferredAnimations();
    const changing = app.go('music');
    app.destroy();
    await animation.phase(); await animation.phase();
    assert.equal(await changing, false);
    assert.equal(app.stage.isConnected, false);
    assert.equal(app.stage.querySelector('.music'), null);
    assert.deepEqual(counts(), [before[0] - 1, before[1], before[2]]);
    assert.equal(await app.go('music'), false);
  } finally { app.destroy(); await animation?.restore(); }
});

const { createCommandMenu } = await import('../src/ui/menu.js');
const { wipe } = await import('../src/ui/scenes.js');

test('menu: focusing command two synchronizes the cursor and A chooses two', () => {
  const { stage } = fakeCtx(), chosen = [];
  const menu = createCommandMenu(stage, { onChoose: id => chosen.push(id) });
  menu.set([{ id: 'one', label: 'One', icon: 'play' }, { id: 'two', label: 'Two', icon: 'stop' }]);
  menu.focus();
  slot(stage, 'two').focus();
  assert.deepEqual(stage.querySelectorAll('.cmd-slot').map(b => b.tabIndex), [-1, 0, -1, -1]);
  assert.equal(menu.handleIntent('a'), true);
  assert.deepEqual(chosen, ['two']);
  menu.destroy();
});

test('shared focus emits focus/blur at the target and focusin/focusout on ancestors', () => {
  const { stage } = fakeCtx(), events = [];
  const one = doc.createElement('button'), two = doc.createElement('button');
  stage.append(one, two);
  for (const [name, el] of [['one', one], ['two', two], ['stage', stage]]) {
    for (const type of ['focus', 'blur', 'focusin', 'focusout']) el.addEventListener(type, e => events.push([name, e.type, e.relatedTarget]));
  }
  one.focus(); events.length = 0;
  two.focus(); two.focus(); // focusing the active element emits nothing
  assert.deepEqual(events, [
    ['one', 'blur', two], ['one', 'focusout', two], ['stage', 'focusout', two],
    ['two', 'focus', one], ['two', 'focusin', one], ['stage', 'focusin', one],
  ]);
  events.length = 0; two.blur();
  assert.deepEqual(events, [['two', 'blur', null], ['two', 'focusout', null], ['stage', 'focusout', null]]);
});

for (const mode of ['normal', 'setting', 'ancestor', 'device']) {
  test(`wipe: real ${mode} animation covers, swaps, uncovers and removes its curtain`, async () => {
    const { stage } = fakeCtx(), priorMedia = globalThis.matchMedia;
    doc.animations.calls = []; doc.animations.manual = true;
    let swaps = 0, releaseSwap;
    if (mode === 'ancestor') doc.body.classList.add('calm');
    globalThis.matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: mode === 'device' }; };
    try {
      const pending = wipe(stage, { calm: () => mode === 'setting' })(async () => {
        swaps++; assert.ok(stage.querySelector('.wipe'));
        await new Promise(resolve => { releaseSwap = resolve; });
      });
      const count = mode === 'normal' ? 10 : 1;
      const curtain = stage.querySelector('.wipe');
      assert.ok(curtain); assert.equal(swaps, 0);
      assert.equal(curtain.classList.contains('wipe--fade'), mode !== 'normal');
      assert.equal(doc.animations.calls.length, count);
      for (const [i, call] of doc.animations.calls.entries()) {
        assert.deepEqual(call.options, mode === 'normal'
          ? { fill: 'both', easing: 'linear', duration: 210, delay: i * 10 }
          : { fill: 'both', easing: 'linear', duration: 75 });
        assert.deepEqual(call.keyframes, mode === 'normal'
          ? [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }]
          : [{ opacity: 0 }, { opacity: 1 }]);
      }
      doc.animations.calls.slice(0, -1).forEach(c => c.resolve());
      await tick(); assert.equal(swaps, 0, 'all covering animations must finish');
      doc.animations.calls.at(-1).resolve(); await tick();
      assert.equal(swaps, 1); assert.equal(doc.animations.calls.length, count, 'uncover waits for async mount');
      releaseSwap(); await tick();
      assert.equal(doc.animations.calls.length, count * 2);
      for (const call of doc.animations.calls.slice(count)) {
        assert.deepEqual(call.keyframes, mode === 'normal'
          ? [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]
          : [{ opacity: 1 }, { opacity: 0 }]);
        call.resolve();
      }
      await pending;
      assert.equal(stage.querySelector('.wipe'), null);
      assert.equal(curtain.isConnected, false);
    } finally {
      doc.animations.manual = false; doc.body.classList.remove('calm');
      if (priorMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = priorMedia;
    }
  });
}

test('wipe: rejected animations settle and a rejected swap always removes the curtain', async () => {
  for (const failSwap of [false, true]) {
    const { stage } = fakeCtx(); doc.animations.calls = []; doc.animations.manual = true;
    let swaps = 0;
    try {
      const pending = wipe(stage, { calm: () => true })(() => { swaps++; if (failSwap) throw new Error('mount failed'); });
      const outcome = failSwap ? assert.rejects(pending, /mount failed/) : pending;
      doc.animations.calls[0].reject(new Error('cancelled cover'));
      await tick(); assert.equal(swaps, 1);
      if (!failSwap) { assert.equal(doc.animations.calls.length, 2); doc.animations.calls[1].reject(new Error('cancelled uncover')); }
      await outcome;
      assert.equal(stage.querySelector('.wipe'), null);
    } finally { doc.animations.manual = false; }
  }
});

test('app: real wipe blocks input and another scene change through both animation phases', async () => {
  const { app, log } = fakeApp(); await app.go('title');
  doc.animations.calls = []; doc.animations.manual = true;
  try {
    const pending = app.go('village');
    const checkBlocked = () => {
      const button = app.stage.querySelector('.cmd'); let clicks = 0;
      const click = () => clicks++; button.addEventListener('click', click);
      for (const key of ['Enter', ' ', 'z', 'Escape', 'ArrowRight']) {
        assert.equal(pressKey(button, 'keydown', key).defaultPrevented, true, key);
        pressKey(button, 'keyup', key);
      }
      assert.equal(clicks, 0); assert.deepEqual(log.intents, []);
      button.removeEventListener('click', click);
    };
    checkBlocked(); assert.equal(await app.go('title'), false);
    doc.animations.calls.forEach(c => c.resolve()); await tick();
    assert.equal(doc.animations.calls.length, 20); checkBlocked();
    assert.equal(await app.go('title'), false);
    doc.animations.calls.slice(10).forEach(c => c.resolve()); await pending;
    assert.equal(app.stage.querySelector('.wipe'), null);
    pressKey(app.stage.querySelector('.cmd'), 'keydown', 'ArrowRight');
    assert.deepEqual(log.intents, ['right']);
  } finally { doc.animations.manual = false; app.destroy(); }
});

test('wipe: hidden documents and unavailable animation swap directly without a curtain', async () => {
  for (const mode of ['hidden', 'unavailable']) {
    const { stage } = fakeCtx(); doc.animations.calls = [];
    if (mode === 'hidden') doc.hidden = true; else stage.animate = undefined;
    try {
      let swaps = 0;
      await wipe(stage)(() => { swaps++; });
      assert.equal(swaps, 1);
      assert.equal(doc.animations.calls.length, 0);
      assert.equal(stage.querySelector('.wipe'), null);
    } finally { doc.hidden = false; }
  }
});

test('wipe: the same transition reads the current Calm motion setting each time', async () => {
  const { stage } = fakeCtx(); let calm = false;
  const transition = wipe(stage, { calm: () => calm });
  doc.animations.calls = [];
  await transition(() => {});
  assert.equal(doc.animations.calls.length, 20);
  calm = true; doc.animations.calls = [];
  await transition(() => {});
  assert.equal(doc.animations.calls.length, 2);
  assert.ok(doc.animations.calls.every(call => call.options.duration === 75));
});
