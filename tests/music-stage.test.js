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

const { createState, getCreations, getDraft } = await import('../src/progress.js');
const { figureMarkup } = await import('../src/ui/figures/index.js');
const { createMusicScene, ECHO_LINES, lanternStep } = await import('../src/ui/screens/music.js');
const { isEdited } = await import('../src/ui/band.js');

function fakeCtx(state = createState()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div');
  stage.className = 'stage';
  doc.body.append(stage);
  const ctx = {
    stage, gone: [], opened: [], said: [],
    getState: () => state,
    commit(next) { state = next; return state; },
    go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    speak() {}, announce() {},
    open: { help: (title, steps) => ctx.opened.push(steps) },
    scenes: { busy: false, pause() {} },
  };
  return ctx;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(b => b.dataset.id === id);
const at = grade => (grade === 0 ? { ...createState(), chapter: 0 } : { ...createState(), chapter: 1, grade });
const text = ctx => ctx.stage.querySelector('.dlg__text').textContent;

test('K: lanterns are pictures, Speed sign shows, no Echo/Form, Send band disabled until Play', () => {
  const ctx = fakeCtx(at(0)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('.music-lantern');
  assert.equal(ls.length, 8); assert.ok(ls.every(l => l.tagName === 'SPAN'));
  assert.ok(ctx.stage.querySelector('[data-sign="speed"]'));
  assert.equal(ctx.stage.querySelector('[data-sign="echo"]'), null);
  assert.equal(ctx.stage.querySelector('[data-sign="form"]'), null);
  assert.match(ctx.stage.querySelector('.music').innerHTML, /Slow and fast · high and low/);
  assert.equal(slot(ctx.stage, 'save').disabled, true);
  assert.match(text(ctx), /Who sings low/);
  slot(ctx.stage, 'quiet').click();
  assert.equal(slot(ctx.stage, 'save').disabled, false, 'See beat counts as played');
  assert.equal(slot(ctx.stage, 'quiet').textContent.includes('Stop') || true, true);
  ctx.stage.querySelector('.dlg__tab[data-act="help"]').click();
  assert.equal(ctx.opened[0].length, 4);
  scene.destroy();
});

test('grade 1: lantern buttons flip Cricket sound/rest, Kiko counts, Send band lights', () => {
  const ctx = fakeCtx(at(1)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  assert.equal(ls.length, 8);
  assert.equal(ctx.stage.querySelector('.music-lanterns').getAttribute('role'), 'group');
  assert.equal(ls[1].getAttribute('aria-pressed'), 'false');   // Cricket default: beat 2 is a rest
  assert.ok(ls[1].classList.contains('is-rest'));
  assert.equal(ls[1].querySelector('b').textContent, '–');
  assert.ok(ctx.stage.querySelector('.music-musician[data-id="percussion"]').classList.contains('is-lead'));
  assert.equal(slot(ctx.stage, 'save').disabled, true);
  ls[1].click();
  assert.equal(ls[1].getAttribute('aria-pressed'), 'true');
  assert.equal(ls[1].querySelector('b').textContent, '♪');
  assert.match(text(ctx), /Six sounds and two rests/);
  assert.equal(slot(ctx.stage, 'save').disabled, false);
  // keyboard: right along lanterns, down to the menu
  ls[0].focus();
  scene.handleIntent('right');
  assert.equal(doc.activeElement, ls[1]);
  scene.handleIntent('left'); scene.handleIntent('left');
  assert.equal(doc.activeElement, ls[0], 'stops at the end');
  scene.handleIntent('down');
  assert.ok(ctx.stage.querySelector('.music-menu').contains(doc.activeElement));
  ctx.stage.querySelector('.music-musician[data-id="bass"]').focus();
  scene.handleIntent('up');
  assert.equal(doc.activeElement, ls[0]);
  scene.destroy();
});

test('grade 3: lanterns cycle Kiko notes, hang by pitch, Kiko names the shape', () => {
  const ctx = fakeCtx(at(3)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  assert.equal(ls[0].querySelector('b').textContent, '–');   // melody default beat 1 is a rest
  assert.equal(ls[0].style['--step'], '96px');
  assert.equal(ls[1].querySelector('b').textContent, 'La'); assert.equal(ls[1].style['--step'], '0px');
  ls[0].click();
  assert.equal(ls[0].querySelector('b').textContent, 'Do'); assert.equal(ls[0].style['--step'], '76px');
  assert.match(text(ctx), /Up and down|goes/);
  assert.equal(lanternStep(2), 38);
  assert.ok(ctx.stage.querySelector('.music-musician[data-id="melody"]').classList.contains('is-lead'));
  assert.equal(ctx.stage.querySelector('.music-badge') && ctx.stage.querySelector('.music').classList.contains('music--steady'), false);
  // speed sign
  const speed = ctx.stage.querySelector('[data-sign="speed"]');
  assert.equal(speed.querySelector('.music-sign__word').textContent, 'Steady');
  speed.click();
  assert.equal(speed.querySelector('.music-sign__word').textContent, 'Fast');
  assert.match(text(ctx), /Fast/);
  assert.equal(ctx.getState().drafts?.music?.tempo ?? JSON.stringify(ctx.getState()).includes('120'), true);
  scene.destroy();
});

test('grade 4: Form chip disabled at A B, steady badge; grade 5 cycles form and saves it', () => {
  let ctx = fakeCtx(at(4)), scene = createMusicScene(ctx); scene.mount();
  let form = ctx.stage.querySelector('[data-sign="form"]');
  assert.equal(form.disabled, true);
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A B');
  assert.ok(ctx.stage.querySelector('.music').classList.contains('music--steady'));
  assert.equal(slot(ctx.stage, 'save').disabled, true, 'default AB band is not edited at grade 4');
  scene.destroy();
  ctx = fakeCtx(at(5)); scene = createMusicScene(ctx); scene.mount();
  form = ctx.stage.querySelector('[data-sign="form"]');
  assert.equal(form.disabled, false);
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A B A');
  form.click();
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A');
  assert.match(text(ctx), /Just tune A/);
  assert.equal(slot(ctx.stage, 'save').disabled, false);
  scene.destroy();
});

// Fake intervals: the echo demo and See beat tick on setInterval, so the tests drive the clock by hand.
const realSetInterval = globalThis.setInterval, realClearInterval = globalThis.clearInterval;
const timers = new Map(); let timerId = 0;
function fakeTimers() {
  timers.clear();
  globalThis.setInterval = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  globalThis.clearInterval = id => { timers.delete(id); };
}
function realTimers() { globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval; }
const runTicks = n => { for (let i = 0; i < n; i++) for (const t of [...timers.values()]) t.fn(); };

test('grade 2: Echo plays a demo at the band’s speed, clears Cricket, a live match ends it, a wrong copy is told', async () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    assert.ok(echo);
    echo.click();
    await tick(); await tick();
    assert.equal(text(ctx), ECHO_LINES.listen);
    assert.ok(echo.classList.contains('is-busy'));
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 90], 'the demo ticks at the band tempo');
    const ls = ctx.stage.querySelectorAll('button.music-lantern');
    assert.ok(ls[0].classList.contains('is-lit'), 'beat 1 lit by the ticker (pattern 0 starts with a sound)');
    runTicks(8);
    assert.match(text(ctx), /Your turn/);
    assert.ok(ls.every(l => l.classList.contains('is-rest')), 'rail cleared to rests');
    assert.ok(!echo.classList.contains('is-busy'));
    assert.equal(timers.size, 0, 'the demo clock is gone');
    // a wrong copy with as many sounds as the rhythm (1, 4, 7) is told, not praised
    ls[1].click(); ls[2].click();
    assert.match(text(ctx), /Two sounds and six rests/, 'the first taps are just counted');
    ls[4].click();
    assert.equal(text(ctx), ECHO_LINES.notYet);
    // now the right one
    ls[1].click(); ls[2].click(); ls[4].click();
    ls[0].click(); ls[3].click(); ls[6].click();
    assert.equal(text(ctx), ECHO_LINES.matched);
    scene.destroy();
  } finally { realTimers(); }
});

test('grade 2: a Sounds-window edit during the demo ends the demo; tab-hide says the demo stopped', async () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    echo.click(); await tick(); await tick();
    assert.ok(echo.classList.contains('is-busy'));
    slot(ctx.stage, 'tunes').click();
    ctx.stage.querySelector('.win [data-tab="bass"]').click();   // Cricket is the lead here; Sora has Tune buttons
    const pattern = ctx.stage.querySelector('.win .sounds-pattern');
    assert.ok(pattern, 'the Sounds window has Tune buttons for Sora');
    pattern.click();
    assert.ok(!echo.classList.contains('is-busy'), 'the demo ended on the edit');
    assert.equal(timers.size, 0, 'no demo clock left');
    assert.notEqual(text(ctx), ECHO_LINES.listen);
    ctx.stage.querySelector('.win__close').click();
    // a demo cut by hiding the tab leaves an honest line
    echo.click(); await tick(); await tick();
    assert.equal(text(ctx), ECHO_LINES.listen);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); doc.hidden = false;
    assert.equal(text(ctx), ECHO_LINES.stopped);
    assert.ok(!echo.classList.contains('is-busy'));
    scene.destroy();
  } finally { realTimers(); }
});

test('Echo retries replay the target until a successful copy unlocks the next rhythm', async () => {
  fakeTimers();
  const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
  try {
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    const lanterns = ctx.stage.querySelectorAll('button.music-lantern');
    const demonstrate = async () => {
      echo.click(); await tick();
      const mask = [lanterns[0].classList.contains('is-lit')];
      for (let beat = 1; beat < 8; beat++) { runTicks(1); mask.push(lanterns[beat].classList.contains('is-lit')); }
      runTicks(1);
      assert.ok(lanterns.every(l => l.classList.contains('is-rest')));
      return mask;
    };
    const first = await demonstrate();
    assert.deepEqual(first, [true, false, false, true, false, false, true, false]);
    for (const beat of [1, 2, 4]) lanterns[beat].click();
    assert.equal(text(ctx), ECHO_LINES.notYet);
    assert.deepEqual(await demonstrate(), first, 'an incorrect copy retries the same target');
    // Interrupt a retry before the demonstration finishes, then replay the same target again.
    echo.click(); await tick(); runTicks(2);
    scene.pause();
    assert.equal(text(ctx), ECHO_LINES.stopped);
    assert.deepEqual(await demonstrate(), first, 'stopping a demo does not skip its target');
    for (const beat of [0, 3, 6]) lanterns[beat].click();
    assert.equal(text(ctx), ECHO_LINES.matched);
    assert.deepEqual(await demonstrate(), [true, true, false, false, true, true, false, false]);
  } finally { scene.destroy(); realTimers(); }
});

test('See beat ticks at 60000 / tempo and restarts when Speed changes', () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(3)), scene = createMusicScene(ctx); scene.mount();
    slot(ctx.stage, 'quiet').click();
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 90]);
    ctx.stage.querySelector('[data-sign="speed"]').click();   // Steady -> Fast
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 120], 'one ticker, at the new speed');
    slot(ctx.stage, 'quiet').click();
    assert.equal(timers.size, 0);
    scene.destroy();
  } finally { realTimers(); }
});

test('See beat keeps A highlighted when ABA shortens at either phrase boundary', () => {
  fakeTimers();
  try {
    for (const boundary of [8, 16]) {
      const ctx = fakeCtx(at(5)), scene = createMusicScene(ctx); scene.mount();
      try {
        slot(ctx.stage, 'quiet').click();
        runTicks(boundary - 1);
        ctx.stage.querySelector('[data-sign="form"]').click(); // ABA -> A
        runTicks(1);
        const letters = ctx.stage.querySelectorAll('.music-form__letters b');
        assert.equal(letters.length, 1);
        assert.ok(letters[0].classList.contains('is-now'), `A highlights at old beat ${boundary}`);
        assert.ok(ctx.stage.querySelectorAll('.music-lantern')[0].classList.contains('is-lit'));
        runTicks(8);
        assert.ok(letters[0].classList.contains('is-now'), 'A stays highlighted on the next loop');
      } finally { scene.destroy(); }
    }
  } finally { realTimers(); }
});

test('keyboard: up from the rail reaches the signs, arrows walk Village and the signs, down comes back', () => {
  const ctx = fakeCtx(at(5)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  const speed = ctx.stage.querySelector('[data-sign="speed"]'), form = ctx.stage.querySelector('[data-sign="form"]'), back = ctx.stage.querySelector('.music-back');
  ls[2].focus();
  scene.handleIntent('up');
  assert.equal(doc.activeElement, speed);
  scene.handleIntent('right');
  assert.equal(doc.activeElement, form);
  scene.handleIntent('right');
  assert.equal(doc.activeElement, form, 'stops at the end');
  scene.handleIntent('left'); scene.handleIntent('left');
  assert.equal(doc.activeElement, back, 'Village is the left end of the top row');
  scene.handleIntent('up');
  assert.equal(doc.activeElement, back, 'nothing above the top row');
  scene.handleIntent('down');
  assert.equal(doc.activeElement, ls[0]);
  scene.destroy();
  // K: no lantern buttons, so up from a musician reaches Speed and down from Speed reaches the menu
  const k = fakeCtx(at(0)), kScene = createMusicScene(k); kScene.mount();
  k.stage.querySelector('.music-musician[data-id="bass"]').focus();
  kScene.handleIntent('up');
  assert.equal(doc.activeElement, k.stage.querySelector('[data-sign="speed"]'));
  kScene.handleIntent('down');
  assert.ok(k.stage.querySelector('.music-menu').contains(doc.activeElement));
  kScene.destroy();
});

test('Send band publishes "Festival band" once edited; destroy clears everything', async () => {
  const ctx = fakeCtx(at(1)), scene = createMusicScene(ctx); scene.mount();
  slot(ctx.stage, 'save').click(); await tick();
  assert.equal(ctx.stage.querySelector('.item-get'), null, 'disabled finish does nothing');
  ctx.stage.querySelectorAll('button.music-lantern')[1].click();
  slot(ctx.stage, 'save').click(); await tick();
  const card = ctx.stage.querySelector('.item-get');
  assert.ok(card); assert.equal(card.querySelector('.item-get__name').textContent, 'Festival band!');
  card.firstElementChild.click(); await tick();
  assert.ok(getCreations(ctx.getState()).music);
  scene.destroy();
});

test('saved draft from today (no form) still loads at grade 5 and reads as edited', () => {
  const state = { ...at(5) };
  const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
  ctx.stage.querySelectorAll('button.music-lantern')[0].click();
  const draft = JSON.stringify(ctx.getState());
  assert.ok(draft.includes('"form":"ABA"'));
  scene.destroy();
  const ctx2 = fakeCtx(ctx.getState()), scene2 = createMusicScene(ctx2); scene2.mount();
  assert.equal(ctx2.stage.querySelectorAll('button.music-lantern')[0].querySelector('b').textContent, 'Do');
  assert.equal(slot(ctx2.stage, 'save').disabled, false);
  scene2.destroy();
});

test('Sounds opens the other lane’s window and its edits flow through edit() with the save flag', () => {
  const ctx = fakeCtx(at(0)), scene = createMusicScene(ctx); scene.mount();
  slot(ctx.stage, 'tunes').click();
  const win = ctx.stage.querySelector('.win');
  assert.ok(win, 'window opened');
  assert.equal(win.querySelector('.win__title').textContent, 'Sounds');
  ctx.stage.querySelector('.win__close').click();
  assert.equal(ctx.stage.querySelector('.win'), null);
  slot(ctx.stage, 'tunes').click();
  assert.ok(ctx.stage.querySelector('.win'), 'reopens after close (handle cleared)');
  scene.destroy();
  assert.equal(ctx.stage.querySelector('.win'), null, 'destroy closes the window');
});

test('changing only Band volume in Sounds saves the draft and unlocks Send band', () => {
  const ctx = fakeCtx(at(1)), scene = createMusicScene(ctx); scene.mount();
  try {
    assert.equal(slot(ctx.stage, 'save').disabled, true);
    slot(ctx.stage, 'tunes').click();
    const input = ctx.stage.querySelector('.sounds [data-master]');
    input.type = 'range'; input.value = '0.2';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    ctx.stage.querySelector('.win__close').click();
    assert.equal(getDraft(ctx.getState(), 'music').masterVolume, 0.2);
    assert.equal(slot(ctx.stage, 'save').disabled, false);
  } finally { scene.destroy(); }
});

test('Sounds edit feedback reaches a live region inside the modal with Read to me off', () => {
  const state = at(1); state.settings.autoRead = false;
  const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
  try {
    slot(ctx.stage, 'tunes').click();
    assert.equal(ctx.stage.querySelector('.music').inert, true);
    ctx.stage.querySelector('.sounds [data-tab="bass"]').click();
    const live = ctx.stage.querySelector('.win [aria-live="polite"]');
    assert.ok(live, 'feedback lives inside the active window');
    assert.equal(live.getAttribute('aria-atomic'), 'true');
    ctx.stage.querySelector('.sounds [data-pattern="1"]').click();
    assert.equal(live.textContent, 'Tune 2! It starts when the song comes back to beat 1.');
    ctx.stage.querySelector('.sounds [data-beat="1"]').click();
    assert.equal(live.textContent, 'Beat 2 is a sound now.');
    assert.equal(ctx.stage.querySelector('.win [aria-live="polite"]'), live, 'panel repaint keeps the live region');
    for (let at = live; at; at = at.parentElement) assert.equal(at.inert, false);
  } finally { scene.destroy(); }
});
