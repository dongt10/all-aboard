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

const decodeText = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name]);

const VOID = new Set(['input', 'br', 'img', 'hr', 'meta']);
function parseInto(host, html) {
  const stack = [host];
  for (const [, close, tag, attrs, selfClose, text] of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (text !== undefined) { stack.at(-1).append(decodeText(text)); continue; }
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
  get children() { return this.childNodes.filter(n => n instanceof El); }
  set children(nodes) { this.childNodes = nodes; }
  get textContent() { return this.childNodes.map(n => typeof n === 'string' ? n : n.textContent).join(''); }
  set textContent(value) { this.children.forEach(n => { n.parentElement = null; }); this.childNodes = [String(value)]; }
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
  append(...nodes) { for (const n of nodes) { if (typeof n !== 'string') { n.remove(); n.parentElement = this; } this.childNodes.push(n); } }
  after(...nodes) {
    const p = this.parentElement; if (!p) return;
    nodes.forEach(n => n.remove());
    const at = p.childNodes.indexOf(this) + 1;
    nodes.forEach((n, i) => { n.parentElement = p; p.childNodes.splice(at + i, 0, n); });
  }
  replaceWith(node) { this.after(node); this.remove(); }
  remove() { const p = this.parentElement; if (p) p.childNodes = p.childNodes.filter(c => c !== this); this.parentElement = null; }
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
  focus() {
    if (!this.focusable() || this.ownerDocument.activeElement === this) return;
    const previous = this.ownerDocument.activeElement;
    this.ownerDocument._active = null;
    if (previous !== this.ownerDocument.body) {
      previous.dispatchEvent(new Event('blur', { bubbles: false, relatedTarget: this }));
      previous.dispatchEvent(new Event('focusout', { relatedTarget: this }));
    }
    this.ownerDocument._active = this;
    this.dispatchEvent(new Event('focus', { bubbles: false, relatedTarget: previous }));
    this.dispatchEvent(new Event('focusin', { relatedTarget: previous }));
  }
  blur() {
    if (this.ownerDocument._active !== this) return;
    this.ownerDocument._active = null;
    this.dispatchEvent(new Event('blur', { bubbles: false, relatedTarget: null }));
    this.dispatchEvent(new Event('focusout', { relatedTarget: null }));
  }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  dispatchEvent(event) {
    event.target ??= this;
    const path = [];
    for (let at = this; at; at = at.parentElement) path.push(at);
    if (this.isConnected) path.push(this.ownerDocument);
    for (const at of path.reverse()) { if (event.stopped) break; at.fire(event, true); }
    for (let at = this; at && !event.stopped; at = event.bubbles ? at.parentElement : null) at.fire(event);
    if (event.bubbles && !event.stopped && this.isConnected) this.ownerDocument.fire(event);
    return !event.defaultPrevented;
  }
  animate(keyframes, options) { return this.ownerDocument.animations.play(this, keyframes, options); }
  getClientRects() { return this.focusable() ? [{}] : []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
}
class Doc extends Target {
  constructor() { super(); this.hidden = false; this._active = null; this.body = new El('body', this); this.animations = new AnimationDriver(); }
  createElement(tag) { return new El(tag, this); }
  // Like a browser: a removed, hidden or inert element can't hold focus, so it falls back to <body>.
  get activeElement() { return this._active?.focusable() ? this._active : this.body; }
  dispatchEvent(event) { event.target ??= this; this.fire(event, true); if (!event.stopped) this.fire(event); }
}

// Resolved by default; tests may hold each phase until they explicitly finish it.
class AnimationDriver {
  calls = [];
  manual = false;
  play(element, keyframes, options) {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const call = { element, keyframes, options, finished, resolve, reject };
    this.calls.push(call);
    if (!this.manual) resolve();
    return call;
  }
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

const { createState, getCreations, getDraft } = await import('../src/progress.js');
const { createEncounterScene } = await import('../src/ui/screens/encounter.js');
const { createMusicScene } = await import('../src/ui/screens/music.js');
const { showItemGet } = await import('../src/ui/screens/item-get.js');

function fakeCtx(state = createState()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div');
  stage.className = 'stage';
  doc.body.append(stage);
  const ctx = {
    stage, gone: [], commits: [],
    getState: () => state,
    commit(next) { ctx.commits.push(next); state = next; return state; },
    go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    speak() {}, announce() {},
    open: { help() {} },
    scenes: { busy: false, pause() {} },
  };
  return ctx;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(button => button.dataset.id === id);
const grade2 = () => ({ ...createState(), chapter: 1, grade: 2 });

test('item-get: cancel resolves false once, removes the card, and restores focus and sibling inert states', async () => {
  const ctx = fakeCtx();
  const opener = doc.createElement('button'), alreadyInert = doc.createElement('div');
  alreadyInert.inert = true;
  ctx.stage.append(opener, alreadyInert);
  opener.focus();
  const reward = showItemGet(ctx.stage, { name: 'Your sign' });
  const card = ctx.stage.querySelector('.item-get');
  let resolutions = 0;
  reward.then(() => resolutions++);
  assert.equal(opener.inert, true);
  assert.ok(card.contains(doc.activeElement));

  reward.cancel();
  assert.equal(ctx.stage.querySelector('.item-get'), null, 'cancellation removes the card synchronously');
  assert.equal(opener.inert, false);
  assert.equal(alreadyInert.inert, true, 'pre-existing inert state is preserved');
  assert.equal(doc.activeElement, opener);
  reward.cancel();
  card.querySelector('.item-get__go').click();
  assert.equal(await reward, false, 'a stale click cannot turn cancellation into acceptance');
  assert.equal(resolutions, 1);
});

test('item-get: click and keyboard acceptance resolve true once and ignore later cancellation', async () => {
  for (const keyboard of [false, true]) {
    const ctx = fakeCtx();
    const reward = showItemGet(ctx.stage, { name: 'Your sign' });
    const button = ctx.stage.querySelector('.item-get__go');
    let resolutions = 0;
    reward.then(() => resolutions++);
    if (keyboard) button.dispatchEvent(new Event('keydown', { key: 'z' }));
    else button.click();
    button.click();
    reward.cancel();
    assert.equal(await reward, true);
    assert.equal(resolutions, 1);
    assert.equal(ctx.stage.querySelector('.item-get'), null);
  }
});

const flows = [
  {
    name: 'encounter', subjectId: 'writing', commandId: 'finish', rootSelector: '.enc',
    create: ctx => createEncounterScene(ctx, { id: 'writing' }),
    edit: stage => {
      const tiles = [...stage.querySelectorAll('.sign-tile')];
      tiles[0].click();
      const ending = tiles.find(tile => tile.textContent === 'festival!') ?? tiles.find(tile => tile.textContent === 'friend!');
      ending.click();
    },
  },
  {
    name: 'music', subjectId: 'music', commandId: 'save', rootSelector: '.music',
    state: { ...createState(), chapter: 0 },
    create: ctx => createMusicScene(ctx),
    edit: stage => stage.querySelector('[data-sign="speed"]').click(),
  },
];

function openReward(t, flow, state = flow.state ?? grade2()) {
  const ctx = fakeCtx(state), scene = flow.create(ctx);
  t.after(() => scene.destroy());
  scene.mount();
  flow.edit(ctx.stage);
  const finish = slot(ctx.stage, flow.commandId);
  assert.equal(finish.disabled, false);
  finish.click();
  finish.click();
  const cards = ctx.stage.querySelectorAll('.item-get');
  assert.equal(cards.length, 1, 'repeated Finish opens only one card');
  assert.deepEqual(ctx.getState().progress, {}, 'opening the card only saves a draft');
  return { ctx, scene, card: cards[0], finish };
}

for (const flow of flows) {
  test(`${flow.name}: destroying a scene with an open reward cancels it without publishing or navigating`, async t => {
    const { ctx, scene, card, finish } = openReward(t, flow);
    const root = ctx.stage.querySelector(flow.rootSelector);
    const before = ctx.getState(), commits = ctx.commits.length;
    assert.equal(root.inert, true);
    scene.destroy();
    assert.equal(ctx.stage.querySelector('.item-get'), null);
    assert.equal(ctx.stage.children.length, 0, 'scene and reward both leave the stage');
    assert.equal(root.inert, false, 'the reward releases its inert sibling');
    scene.destroy();
    card.querySelector('.item-get__go').click();
    finish.click();
    await tick();
    assert.equal(ctx.commits.length, commits, 'no late commit after destruction');
    assert.deepEqual(ctx.getState(), before);
    assert.deepEqual(ctx.getState().progress, {});
    assert.deepEqual(ctx.gone, []);
    assert.equal(ctx.stage.querySelector('.item-get'), null);
  });

  for (const change of [
    { name: 'grade', next: state => ({ ...state, grade: 3 }) },
    { name: 'chapter', next: state => ({ ...state, chapter: state.chapter === 0 ? 1 : 0 }) },
  ]) {
    test(`${flow.name}: changing ${change.name} while the reward is open prevents publication`, async t => {
      const { ctx, card } = openReward(t, flow);
      ctx.commit(change.next(ctx.getState()));
      const before = ctx.getState(), commits = ctx.commits.length;
      card.querySelector('.item-get__go').click();
      await tick();
      assert.equal(ctx.commits.length, commits, 'dismissing a stale reward does not commit');
      assert.deepEqual(ctx.getState(), before, 'the new scope and existing draft remain untouched');
      assert.deepEqual(ctx.getState().progress, {}, 'nothing published in either scope');
      assert.deepEqual(ctx.gone, [], 'no stale celebration or navigation');
      assert.equal(ctx.stage.querySelector('.item-get'), null);
      assert.equal(ctx.stage.querySelector(flow.rootSelector).inert, false);
    });
  }

  test(`${flow.name}: destruction after acceptance but before the promise continues prevents publication`, async t => {
    const { ctx, scene, card } = openReward(t, flow);
    const commits = ctx.commits.length;
    card.querySelector('.item-get__go').click();
    scene.destroy();
    await tick();
    assert.equal(ctx.commits.length, commits);
    assert.deepEqual(ctx.getState().progress, {});
    assert.deepEqual(ctx.gone, []);
    assert.equal(ctx.stage.children.length, 0);
  });

  test(`${flow.name}: normal acceptance publishes once in its original scope, preserving other state changes`, async t => {
    for (const state of flow.state ? [flow.state] : [createState(), grade2()]) {
      const { ctx, scene, card, finish } = openReward(t, flow, state);
      const creation = getDraft(ctx.getState(), flow.subjectId);
      ctx.commit({ ...ctx.getState(), settings: { ...ctx.getState().settings, largeText: true } });
      const commits = ctx.commits.length;
      const button = card.querySelector('.item-get__go');
      button.click();
      button.click();
      await tick();
      finish.click();
      await tick();
      assert.equal(ctx.commits.length, commits + 1, 'exactly one publication commit');
      assert.deepEqual(getCreations(ctx.getState()), { [flow.subjectId]: creation });
      assert.equal(ctx.getState().settings.largeText, true, 'unrelated changes are preserved');
      assert.deepEqual(ctx.gone, [['village', { focus: flow.subjectId, celebrate: flow.subjectId }]]);
      assert.equal(ctx.stage.querySelector('.item-get'), null);
      assert.equal(ctx.stage.querySelector(flow.rootSelector).inert, false);
      scene.destroy();
    }
  });
}

