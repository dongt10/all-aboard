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
  let cursor = 0;
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, selfClose] = match;
    stack.at(-1).textContent += html.slice(cursor, match.index);
    cursor = match.index + match[0].length;
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
