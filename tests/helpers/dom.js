// A tiny fake DOM: just enough tree, markup parsing, focus, events and selectors to mount the real
// scenes under node. Focus follows browser rules: hidden, inert, disabled or detached elements lose it.
const FOCUSABLE_TAGS = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function attrOf(el, name) {
  if (name.startsWith('data-')) return el.dataset[camel(name.slice(5))] ?? el.attrs.get(name) ?? null;
  if (name === 'tabindex') return el._tabIndex === undefined ? null : String(el._tabIndex);
  return el.attrs.get(name) ?? null;
}
function matchCompound(el, compound) {
  let rest = compound.startsWith('*') ? compound.slice(1) : compound;
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

const decodeText = text => text.replace(/&(amp|lt|gt|quot|#\d+|#x[\da-f]+);/gi, (_, name) =>
  name.startsWith('#') ? String.fromCodePoint(Number.parseInt(name.slice(name[1]?.toLowerCase() === 'x' ? 2 : 1), name[1]?.toLowerCase() === 'x' ? 16 : 10))
    : ({ amp: '&', lt: '<', gt: '>', quot: '"' })[name.toLowerCase()]);

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

export class Event {
  constructor(type, init = {}) { Object.assign(this, { type, bubbles: true, defaultPrevented: false, repeat: false }, init); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
export class Target {
  constructor() { this.listeners = {}; }
  addEventListener(type, fn, options) { (this.listeners[type] ??= []).push({ fn, once: options?.once, capture: options === true || Boolean(options?.capture) }); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(l => l.fn !== fn); }
  fire(event, capture = false) {
    for (const l of [...(this.listeners[event.type] ?? [])]) { if (l.capture !== capture) continue; if (l.once) this.removeEventListener(event.type, l.fn); l.fn(event); }
  }
}
export class El extends Target {
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
export class Doc extends Target {
  constructor() { super(); this.hidden = false; this._active = null; this.body = new El('body', this); this.animations = new AnimationDriver(); }
  createElement(tag) { return new El(tag, this); }
  // Like a browser: a removed, hidden or inert element can't hold focus, so it falls back to <body>.
  get activeElement() { return this._active?.focusable() ? this._active : this.body; }
  dispatchEvent(event) { event.target ??= this; this.fire(event, true); if (!event.stopped) this.fire(event); }
}

// Resolved by default; tests may hold each phase until they explicitly finish it.
export class AnimationDriver {
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

// Synthetic dispatchEvent has no browser default action. Use this explicit driver for
// physical button keys: Enter clicks on keydown; Space arms on keydown and clicks on keyup.
export function pressKey(target, type, key, init = {}) {
  const event = new Event(type, { key, ...init });
  target.dispatchEvent(event);
  if (target.tagName !== 'BUTTON' || target.disabled || target.ownerDocument.activeElement !== target) return event;
  if (type === 'keydown' && !event.defaultPrevented) {
    if (key === 'Enter') target.click();
    if (key === ' ') target._spaceArmed = true;
  }
  if (type === 'keyup' && key === ' ') {
    if (target._spaceArmed && !event.defaultPrevented) target.click();
    target._spaceArmed = false;
  }
  return event;
}
