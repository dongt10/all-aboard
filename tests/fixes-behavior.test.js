import test from 'node:test';
import assert from 'node:assert/strict';

// A tiny fake DOM: just enough tree, markup parsing, focus, events and selectors to mount the real
// scenes under node. Focus follows browser rules: hidden, inert, disabled or detached elements lose it.
const FOCUSABLE_TAGS = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function attrOf(el, name) {
  if (name.startsWith('data-')) return el.dataset[camel(name.slice(5))] ?? null;
  if (name === 'tabindex') return el._tabIndex === undefined ? null : String(el._tabIndex);
  return el.attrs.get(name) ?? null;
}
function matchCompound(el, compound) {
  let rest = compound;
  const tag = rest.match(/^[a-z]+/i)?.[0];
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  rest = rest.slice(tag?.length ?? 0);
  while (rest) {
    let m;
    if ((m = rest.match(/^\.([\w-]+)/))) { if (!el.classList.contains(m[1])) return false; }
    else if ((m = rest.match(/^\[([\w-]+)(?:="([^"]*)")?\]/))) { const v = attrOf(el, m[1]); if (v === null || (m[2] !== undefined && v !== m[2])) return false; }
    else if ((m = rest.match(/^:not\((.+?\]?)\)/))) { if (matchCompound(el, m[1])) return false; }
    else if ((m = rest.match(/^:disabled/))) { if (!el.disabled) return false; }
    else throw new Error(`fake DOM: unsupported selector ${compound}`);
    rest = rest.slice(m[0].length);
  }
  return true;
}
function matches(el, selector) {
  return selector.split(',').some(part => {
    const chain = part.trim().split(/\s+/);
    if (!matchCompound(el, chain.at(-1))) return false;
    let at = el.parentElement;
    for (let i = chain.length - 2; i >= 0; i--) {
      while (at && !matchCompound(at, chain[i])) at = at.parentElement;
      if (!at) return false;
      at = at.parentElement;
    }
    return true;
  });
}

const VOID = new Set(['input', 'br', 'img', 'hr', 'meta']);
function parseInto(host, html) {
  const stack = [host];
  for (const [, close, tag, attrs, selfClose] of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    if (close) { const i = stack.findLastIndex(el => el.tagName === tag.toUpperCase()); if (i > 0) stack.length = i; continue; }
    const el = new El(tag, host.ownerDocument);
    for (const [, k, v = ''] of attrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('data-')) el.dataset[camel(k.slice(5))] = v;
      else if (k === 'hidden' || k === 'disabled') el[k] = true;
      else el.setAttribute(k, v);
    }
    stack.at(-1).append(el);
    if (!selfClose && !VOID.has(tag.toLowerCase())) stack.push(el);
  }
}

class Event {
  constructor(type, init = {}) { Object.assign(this, { type, bubbles: true, defaultPrevented: false, repeat: false }, init); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
class Target {
  constructor() { this.listeners = {}; }
  addEventListener(type, fn, options) { (this.listeners[type] ??= []).push({ fn, once: options?.once, capture: options === true || Boolean(options?.capture) }); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(l => l.fn !== fn); }
  fire(event, capture = false) {
    for (const l of [...(this.listeners[event.type] ?? [])]) { if (l.capture !== capture) continue; if (l.once) this.removeEventListener(event.type, l.fn); l.fn(event); }
  }
}
class El extends Target {
  constructor(tag, doc) {
    super();
    Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentElement: null, dataset: {}, attrs: new Map(), hidden: false, inert: false, disabled: false, textContent: '', value: '', _html: '' });
    const set = this._classes = new Set();
    this.classList = { add: (...n) => n.forEach(c => set.add(c)), remove: (...n) => n.forEach(c => set.delete(c)), contains: c => set.has(c), toggle: (c, on = !set.has(c)) => { if (on) set.add(c); else set.delete(c); return on; } };
    this.style = { setProperty(k, v) { this[k] = v; } };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c)); }
  get tabIndex() { return this._tabIndex ?? (FOCUSABLE_TAGS.has(this.tagName) ? 0 : -1); }
  set tabIndex(v) { this._tabIndex = v; }
  get type() { return this.getAttribute('type'); }
  set type(v) { this.setAttribute('type', v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this.children.forEach(c => { c.parentElement = null; }); this.children = []; this._html = String(v); parseInto(this, this._html); }
  get firstElementChild() { return this.children[0] ?? null; }
  get isConnected() { let at = this; while (at.parentElement) at = at.parentElement; return at === this.ownerDocument.body; }
  setAttribute(k, v) { if (k === 'tabindex') this._tabIndex = Number(v); else this.attrs.set(k, String(v)); }
  getAttribute(k) { return attrOf(this, k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, on = !this.attrs.has(k)) { if (on) this.attrs.set(k, ''); else this.attrs.delete(k); return on; }
  append(...nodes) { for (const n of nodes) if (typeof n !== 'string') { n.remove(); n.parentElement = this; this.children.push(n); } }
  after(...nodes) { const p = this.parentElement; nodes.forEach(n => p?.append(n)); }
  remove() { const p = this.parentElement; if (p) p.children = p.children.filter(c => c !== this); this.parentElement = null; }
  contains(other) { for (let at = other; at; at = at.parentElement) if (at === this) return true; return false; }
  closest(selector) { for (let at = this; at; at = at.parentElement) if (matches(at, selector)) return at; return null; }
  matches(selector) { return matches(this, selector); }
  querySelectorAll(selector) {
    const out = [];
    const walk = el => el.children.forEach(c => { if (matches(c, selector)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focusable() {
    if (this.disabled || !(FOCUSABLE_TAGS.has(this.tagName) || this._tabIndex !== undefined)) return false;
    for (let at = this; at; at = at.parentElement) if (at.hidden || at.inert) return false;
    return this.isConnected;
  }
  focus() { if (this.focusable()) { this.ownerDocument._active = this; this.dispatchEvent(new Event('focusin')); } }
  blur() { if (this.ownerDocument._active === this) this.ownerDocument._active = null; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  dispatchEvent(event) {
    event.target ??= this;
    const path = [];
    for (let at = this; at; at = at.parentElement) path.push(at);
    if (this.isConnected) path.push(this.ownerDocument);
    for (const at of path.reverse()) { if (event.stopped) break; at.fire(event, true); }
    for (let at = this; at && !event.stopped; at = at.parentElement) at.fire(event);
    if (!event.stopped && this.isConnected) this.ownerDocument.fire(event);
    return !event.defaultPrevented;
  }
  getClientRects() { return this.focusable() ? [{}] : []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
}
class Doc extends Target {
  constructor() { super(); this.hidden = false; this._active = null; this.body = new El('body', this); }
  createElement(tag) { return new El(tag, this); }
  // Like a browser: a removed, hidden or inert element can't hold focus, so it falls back to <body>.
  get activeElement() { return this._active?.focusable() ? this._active : this.body; }
  dispatchEvent(event) { event.target ??= this; this.fire(event, true); if (!event.stopped) this.fire(event); }
}

const doc = new Doc();
doc.fonts = new Target();
const speech = { cancels: 0, cancel() { this.cancels++; }, speak() {} };
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
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
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
test('sign: an empty sign opens with focus in the field, not on the Village button', () => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
  scene.mount();
  assert.ok(ctx.stage.querySelector('.enc__field').contains(doc.activeElement), 'focus starts in the field');
  scene.destroy();
});

test('sign: B in the empty textarea moves to Village, and a second B leaves', async () => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
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
test('encounter: typing the sign empty says the activity\'s not-ready line, and a word says the sign\'s own line', () => {
  const ctx = fakeCtx(grade2());
  const scene = createEncounterScene(ctx, { id: 'writing' });
  scene.mount();
  const face = ctx.stage.querySelector('textarea');
  const text = () => ctx.stage.querySelector('.enc__dialogue').querySelector('.dlg__text').textContent;
  face.value = 'Hello';
  face.dispatchEvent(new Event('input'));          // the sign speaks for itself when a word lands
  assert.equal(text(), 'You wrote it. Add more, or choose Put up sign.');
  assert.equal(slot(ctx.stage, 'finish').disabled, false, 'Put up sign is enabled');
  face.value = '';
  face.dispatchEvent(new Event('input'));          // sign.js returns no line here; the frame says notReadyLine
  assert.equal(text(), 'The sign is empty.');
  assert.equal(slot(ctx.stage, 'finish').disabled, true, 'Put up sign is disabled again');
  scene.destroy();
});

// ---- B10: arrows out of the field ----
test('encounter: down from the field moves focus to the menu', () => {
  const ctx = fakeCtx();
  const scene = createEncounterScene(ctx, { id: 'writing' });
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
  const first = new Event('keydown', { key: 'Enter' });
  button.dispatchEvent(first);
  assert.equal(first.defaultPrevented, false, 'the first press is left to the browser');
  for (const key of ['Enter', ' ']) {
    const held = new Event('keydown', { key, repeat: true });
    button.dispatchEvent(held);
    assert.equal(held.defaultPrevented, true, `a repeated ${JSON.stringify(key)} is swallowed`);
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
  const pending = [];
  El.prototype.animate = () => ({ finished: new Promise(resolve => pending.push(resolve)) });
  return {
    async phase() { pending.splice(0).forEach(resolve => resolve()); await tick(); },
    async restore() { El.prototype.animate = () => ({ finished: Promise.resolve() }); pending.splice(0).forEach(resolve => resolve()); await tick(); delete El.prototype.animate; },
  };
}

test('app: Escape then A cannot activate Finish or its target handlers during either wipe phase', async () => {
  const app = realApp();
  let animation;
  try {
    await app.go('encounter', { id: 'writing' });
    press('Enter'); // Hello
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
    press('Enter');
    slot(appA.stage, 'finish').click();
    appA.stage.querySelector('.item-get__go').click();
    await tick();
    assert.equal(appA.saveOk, true);
    const saved = storage.getItem(STORAGE_KEY);
    assert.equal(getCreations(loadState(storage)).writing.text, 'Hello');
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
      tile.focus(); press('Enter'); press('ArrowDown');
      assert.ok(doc.activeElement === slot(app.stage, 'remove'));
      press('Enter');
      const field = app.stage.querySelector('.enc__field');
      assert.ok(field.contains(doc.activeElement), 'empty menu hands focus back to the field');
      assert.equal(slot(app.stage, 'finish').disabled, true);
      assert.ok(doc.activeElement === (field.querySelector('textarea') ?? field.querySelector('button:not(:disabled)')));
      if (state.chapter === 0) {
        press('ArrowRight'); press('z');
        assert.equal(slot(app.stage, 'finish').disabled, false, 'the child can add another word without Tab');
      } else {
        doc.activeElement.value = 'Hello'; doc.activeElement.dispatchEvent(new Event('input'));
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
