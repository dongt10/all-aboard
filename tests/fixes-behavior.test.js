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
  addEventListener(type, fn, options) { (this.listeners[type] ??= []).push({ fn, once: options?.once }); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(l => l.fn !== fn); }
  fire(event) {
    for (const l of [...(this.listeners[event.type] ?? [])]) { if (l.once) this.removeEventListener(event.type, l.fn); l.fn(event); }
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
  focus() { if (this.focusable()) this.ownerDocument._active = this; }
  blur() { if (this.ownerDocument._active === this) this.ownerDocument._active = null; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  dispatchEvent(event) {
    event.target ??= this;
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
  dispatchEvent(event) { event.target ??= this; this.fire(event); }
}

const doc = new Doc();
const speech = { cancels: 0, cancel() { this.cancels++; }, speak() {} };
Object.assign(globalThis, {
  document: doc,
  window: { innerWidth: 1920, innerHeight: 1080, addEventListener() {}, removeEventListener() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  speechSynthesis: speech,
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

const { createState, getCreations } = await import('../src/progress.js');
const { figureMarkup } = await import('../src/ui/figures/index.js');
const { createMusicScene } = await import('../src/ui/screens/music.js');
const { createEncounterScene } = await import('../src/ui/screens/encounter.js');
const { createVillageScene } = await import('../src/ui/screens/village.js');
const { openPauseWindow } = await import('../src/ui/screens/windows.js');
const { createApp } = await import('../src/ui/app.js');

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
function fakeApp() {
  doc.body.children = []; doc._active = null; doc.listeners = {};
  const host = doc.createElement('div');
  doc.body.append(host);
  const log = { params: [], pauses: 0 };
  const scene = (name) => (ctx, params) => ({
    mount() { log.params.push([name, params]); const b = doc.createElement('button'); b.className = 'cmd'; ctx.stage.append(b); this.button = b; b.focus(); },
    pause() { log.pauses++; },
    destroy() { this.button?.remove(); },
  });
  const app = createApp(host, { scenes: { village: scene('village'), title: scene('title') }, storage: null });
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
