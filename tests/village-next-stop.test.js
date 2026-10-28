import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageScene, WELCOME_LINE } from '../src/ui/screens/village.js';
import { nextStop, setRoad, road, talkGoal, PLAYER_START } from '../src/ui/village-map.js';
import { activityFor } from '../src/ui/registry.js';
import { createState, publishCreation, saveDraft, getCreations, getCompleted, getDraft } from '../src/progress.js';
import { CHARACTERS } from '../src/data.js';
import { ROAD_MASK, EASELS } from '../src/ui/village-layout.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { readPNG } from './helpers/png.js';
import { Doc, Event, Target, pressKey } from './helpers/dom.js';
const roadPixels = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));
const realMask = maskFromRGBA(roadPixels);
const realRoad = createWalkable(realMask);
setRoad(realRoad);

function villageFixture(t, { calm = false, large = false, state = createState(), voice = () => false,
  measure = false, walkable = createWalkable(realMask, { blocked: Object.keys(getCreations(state)).map(id => EASELS[id]) }), ...options } = {}) {
  const doc = new Doc(), frames = new Map(), restore = [];
  let frameId = 0, time = 0;
  for (const [key, value] of Object.entries({
    document: doc,
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    matchMedia: () => ({ matches: false }),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    restore.push(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const stage = doc.createElement('div'), gone = [], opened = [], spoken = [], announced = [];
  stage.className = `stage${calm ? ' calm' : ''}${large ? ' large-text' : ''}`;
  doc.body.append(stage);
  const ctx = {
    stage, walkable, getState: () => state, commit: next => { state = next; }, announce: text => announced.push(text),
    go: (...args) => { gone.push(args); return true; },
    speak: text => { spoken.push(text); return voice(text); },
    open: Object.fromEntries(['grade', 'guide', 'comfort', 'pause', 'help'].map(act => [act, () => opened.push(act)])),
  };
  const scene = createVillageScene(ctx, options);
  const mountResult = scene.mount();
  const mounted = new Promise(resolve => setImmediate(resolve));
  const root = stage.querySelector('.village');
  if (measure) {
    const el = root.querySelector('.dlg__measure');
    Object.defineProperties(el, {
      clientHeight: { get: () => 118 },
      scrollHeight: { get: () => wrappedLines(el.textContent, 204, large ? 30 : 24) * (large ? 35.4 : 30) },
    });
  }
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  const tick = (ms = 16) => {
    time += ms;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(time));
  };
  const pos = () => {
    const el = root.querySelector('.village-player');
    return { x: parseFloat(el.style.left) + 32, y: parseFloat(el.style.top) + 57 };
  };
  const tap = (x, y) => root.querySelector('.village-map').dispatchEvent(new Event('click', { clientX: x, clientY: y }));
  t.after(() => { scene.destroy(); restore.forEach(reset => reset()); });
  return { doc, scene, root, stage, ctx, mountResult, gone, opened, spoken, announced, tick, pos, tap, mounted, frames };
}

const ids = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];
const inputFor = state => ({ creations: getCreations(state), completed: getCompleted(state),
  drafts: Object.fromEntries(ids.map(id => [id, getDraft(state, id)])) });
const stateFor = grade => ({ ...createState(), chapter: grade ? 1 : 0, grade: grade || 1 });
const snapshot = (id, grade, request = 1) => id === 'music'
  ? { kind: id, chapter: grade ? 1 : 0, grade }
  : { ...activityFor(id, grade).start(null, { chapter: grade ? 1 : 0, grade }).state, request };
const made = (state, id, grade, request = 1) => publishCreation(state, id, snapshot(id, grade, request));
const allMade = (grade = 0, request = 1) => ids.reduce((state, id) => made(state, id, grade, request), stateFor(grade));
const chip = (f, id) => f.root.querySelector(`.village-chips [data-act="${id}"]`);
const pages = f => { while (!f.root.querySelector('.dlg__more').hidden) f.root.querySelector('.dlg__more').click(); };
const clock = t => { t.mock.timers.enable({ apis: ['setTimeout'] }); return ms => t.mock.timers.tick(ms); };

for (let grade = 0; grade <= 5; grade++) test(`next stop uses scoped saves and board priority in grade ${grade}`, () => {
  let state = stateFor(grade);
  assert.deepEqual(nextStop(inputFor(state)), { id: 'math', status: 'new' });
  state = made(state, 'math', grade);
  state = saveDraft(state, 'writing', snapshot('writing', grade));
  state = saveDraft(state, 'reading', snapshot('reading', grade));
  assert.deepEqual(nextStop(inputFor(state)), { id: 'reading', status: 'started' });
  state = made(state, 'reading', grade);
  assert.deepEqual(nextStop(inputFor(state)), { id: 'writing', status: 'started' });
  state = made(state, 'writing', grade);
  assert.deepEqual(nextStop(inputFor(state)), { id: 'science', status: 'new' });
  state = allMade(grade);
  assert.deepEqual(nextStop(inputFor(state)), { id: 'math', status: 'another' });
  const differentDraft = saveDraft(state, 'math', snapshot('math', grade, 2));
  assert.deepEqual(nextStop(inputFor(differentDraft)), { id: 'math', status: 'another' }, 'made still beats its draft');
  const moved = { ...state, chapter: grade === 0 ? 1 : 0, grade: 1 };
  assert.deepEqual(nextStop(inputFor(moved)), { id: 'math', status: 'new' }, 'another scope is untouched');
});

test('legacy visits, request discriminators, music and frozen inputs', () => {
  const visited = Object.freeze([...ids]);
  assert.equal(nextStop({ completed: visited }), null, 'legacy stamps do not invent creations');
  const creations = Object.freeze({ math: Object.freeze({ kind: 'math', chapter: 0 }), music: Object.freeze({ kind: 'music', chapter: 0 }) });
  const input = Object.freeze({ completed: visited, creations, drafts: Object.freeze({}) });
  assert.deepEqual(nextStop(input), { id: 'math', status: 'another' }, 'missing request is original');
  for (const request of [2, 3]) {
    const state = allMade(3, 2);
    const withMath = made(state, 'math', 3, request);
    assert.equal(nextStop(inputFor(withMath)), null);
  }
  const musicOnly = Object.freeze({ music: Object.freeze({ kind: 'music', chapter: 0, request: 1 }) });
  assert.equal(nextStop({ completed: visited, creations: musicOnly }), null, 'music has no another');
});

for (const calm of [false, true]) test(`reaction offers a real walking route once (calm=${calm})`, t => {
  const advance = clock(t), state = made(stateFor(0), 'art', 0);
  const f = villageFixture(t, { state, celebrate: 'art', calm });
  assert.equal(chip(f, 'visit'), null);
  pages(f); advance(3999); assert.equal(chip(f, 'visit'), null);
  advance(1);
  const visit = chip(f, 'visit');
  assert.ok(visit); assert.equal(visit.textContent, 'Visit Taro');
  assert.match(f.root.querySelector('.dlg__text').textContent, /Taro has something new to make/);
  visit.focus(); assert.equal(f.doc.activeElement, visit); visit.click();
  assert.equal(chip(f, 'visit'), null);
  assert.equal(f.gone.length, calm ? 1 : 0, 'only Calm motion arrives immediately');
  if (!calm) assert.deepEqual(f.pos(), PLAYER_START, 'the chip starts a walk');
  for (let i = 0; i < 100; i++) f.tick(50);
  assert.deepEqual(f.gone, [['encounter', { id: 'math' }]]);
  const e = EASELS.art, p = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  assert.equal(road().isWalkable(p), false, 'saved creation blocks the real road');
  advance(20000); assert.equal(chip(f, 'visit'), null);
});

test('plain mount stays quiet, manual Pip offers, and Not now leaves focus on the village', async t => {
  const advance = clock(t), state = made(stateFor(0), 'art', 0);
  const f = villageFixture(t, { state, calm: true });
  advance(30000); assert.equal(chip(f, 'visit'), null);
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  const notNow = chip(f, 'not-now'); assert.ok(notNow);
  notNow.focus(); notNow.click();
  assert.equal(chip(f, 'visit'), null); assert.equal(f.doc.activeElement, f.root);
  advance(30000); assert.equal(chip(f, 'visit'), null);
  await Promise.resolve(); await Promise.resolve();
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.ok(chip(f, 'visit'));
});

for (const action of ['b', 'ground', 'walk', 'help']) test(`${action} cancels the reaction offer`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  if (action === 'b') f.scene.handleIntent('b');
  if (action === 'ground') f.tap(500, 320);
  if (action === 'walk') f.scene.handleIntent('left');
  if (action === 'help') f.root.querySelector('[data-act="village-help"]').click();
  advance(30000); assert.equal(chip(f, 'visit'), null);
});

test('seventh automatic offer points to Nori\'s lantern night; manual Pip offers another request', t => {
  const advance = clock(t), f = villageFixture(t, { state: allMade(), celebrate: 'music', calm: true });
  pages(f); advance(4000); assert.ok(chip(f, 'visit-nori'));
  assert.equal(f.root.querySelector('.dlg__text').textContent, 'All seven made! Nori has a surprise. Visit Nori?');
  assert.equal(chip(f, 'parade'), null);
  chip(f, 'not-now').click();
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.equal(chip(f, 'visit').textContent, 'Visit Taro');
  assert.match(f.root.querySelector('.dlg__text').textContent, /one more request/);
});

test('Visit Nori walks to Nori, whose lantern offer opens on arrival', async t => {
  const advance = clock(t), f = villageFixture(t, { state: allMade(), celebrate: 'music', calm: true });
  pages(f); advance(4000); chip(f, 'visit-nori').click();
  for (let i = 0; i < 4; i++) { f.tick(); await Promise.resolve(); }
  assert.equal(f.root.querySelector('.dlg__text').textContent, 'All seven made! Shall I light the lanterns?');
  assert.ok(chip(f, 'light-lanterns'));
  assert.deepEqual(f.gone, []);
});

test('offer chip layout has wrapped 44px targets outside the dialogue', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const row = css.match(/\.village-chips\s*\{([^}]*)\}/)?.[1];
  const buttons = css.match(/\.village-chips\s*>\s*\.px-chip\s*\{([^}]*)\}/)?.[1];
  assert.match(row, /top:\s*calc\(100%\s*\+\s*24px\)/);
  assert.match(row, /display:\s*flex/);
  assert.match(buttons, /flex:\s*1/);
  assert.match(buttons, /min-height:\s*44px/);
  assert.match(buttons, /white-space:\s*normal/);
  assert.match(buttons, /overflow-wrap:\s*anywhere/);
});

for (const key of ['Enter', ' ']) test(`native ${JSON.stringify(key)} activates a focused offer`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  pages(f); advance(4000);
  const button = chip(f, 'visit'); button.focus();
  pressKey(button, 'keydown', key); if (key === ' ') pressKey(button, 'keyup', key);
  assert.deepEqual(f.gone, [['encounter', { id: 'math' }]]);
  assert.equal(chip(f, 'visit'), null);
});

for (const saveOk of [true, false, undefined]) test(`Saved prefix depends on successful automatic save (${saveOk})`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  f.ctx.saveOk = saveOk; pages(f); advance(4000);
  assert.equal(f.root.querySelector('.dlg__text').textContent.startsWith('Saved!'), saveOk === true);
});

test('started wording wins over new and manual Pip never claims a save', t => {
  const state = saveDraft(made(stateFor(0), 'art', 0), 'reading', snapshot('reading', 0));
  const f = villageFixture(t, { state, calm: true }); f.ctx.saveOk = true;
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.match(f.root.querySelector('.dlg__text').textContent, /something to finish/);
  assert.doesNotMatch(f.root.querySelector('.dlg__text').textContent, /Saved!/);
  assert.equal(chip(f, 'visit').textContent, 'Visit Sora');
});

test('speech end controls reaction delay before offering', t => {
  const advance = clock(t), utterances = [];
  const state = made(stateFor(0), 'art', 0); state.settings.autoRead = true;
  const f = villageFixture(t, { state, celebrate: 'art', calm: true, voice: text => {
    const speech = new Target(); speech.text = text; utterances.push(speech); return speech;
  } });
  pages(f); advance(1000); assert.equal(chip(f, 'visit'), null);
  utterances.at(-1).fire(new Event('end')); advance(3999); assert.equal(chip(f, 'visit'), null);
  advance(1); assert.ok(chip(f, 'visit'));
});

test('a window open when the reaction timer fires suppresses the offer', t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  const backdrop = f.doc.createElement('div'); backdrop.className = 'win-backdrop'; f.stage.append(backdrop);
  pages(f); advance(30000); assert.equal(chip(f, 'visit'), null);
  backdrop.remove(); advance(30000); assert.equal(chip(f, 'visit'), null);
});

test('all made with no further requests offers a parade on manual Pip talk', t => {
  const f = villageFixture(t, { state: allMade(3, 2), calm: true });
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.ok(chip(f, 'parade')); chip(f, 'parade').click();
  assert.deepEqual(f.gone, [['parade']]);
});

for (const action of ['b', 'ground', 'walk']) test(`${action} dismisses an open offer and it stays quiet`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  pages(f); advance(4000); assert.ok(chip(f, 'visit'));
  if (action === 'b') f.scene.handleIntent('b');
  if (action === 'ground') f.tap(500, 320);
  if (action === 'walk') f.scene.handleIntent('left');
  assert.equal(chip(f, 'visit'), null); advance(30000); assert.equal(chip(f, 'visit'), null);
});

for (const calm of [false, true]) test(`Pip keeps facing the offered stall through frames (calm=${calm})`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm });
  pages(f); advance(4000);
  const fig = f.root.querySelector('.village-actor[data-id="pip"] .village-actor__fig');
  const facing = fig.innerHTML;
  assert.ok(facing);
  for (let i = 0; i < 30; i++) f.tick(100);
  assert.equal(fig.innerHTML, facing);
});

test('an unreachable ground tap dismisses an open offer', t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  pages(f); advance(4000); assert.ok(chip(f, 'visit'));
  const position = f.pos(); f.tap(0, 0);
  assert.equal(chip(f, 'visit'), null); assert.deepEqual(f.pos(), position);
  advance(30000); assert.equal(chip(f, 'visit'), null);
});

test('a parade action can open a window without the chip handler closing it', t => {
  const f = villageFixture(t, { state: allMade(3, 2), calm: true });   // every second request done: Pip offers the parade when asked
  f.ctx.go = name => {
    assert.equal(name, 'parade');
    const win = f.doc.createElement('div'); win.className = 'win-backdrop'; f.stage.append(win);
    return true;
  };
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  chip(f, 'parade').click();
  assert.ok(f.stage.querySelector('.win-backdrop'));
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
});

test('board order is stable across every new, started and second request', () => {
  for (const status of ['new', 'started', 'another']) for (const [index, id] of ids.entries()) {
    if (status === 'another' && id === 'music') continue;
    const creations = status === 'another' ? Object.fromEntries([...ids].reverse().map(kind =>
      [kind, { kind, request: ids.indexOf(kind) < index ? 2 : 1 }])) : {};
    const completed = status === 'another' ? ids : ids.slice(0, index);
    const drafts = status === 'started' ? Object.fromEntries([...ids].reverse().filter(kind => !completed.includes(kind)).map(kind => [kind, { kind }])) : {};
    assert.deepEqual(nextStop({ creations, completed, drafts }), { id, status });
  }
});

for (const large of [false, true]) test(`offer does not take focus and its controls stay tabbable (large=${large})`, t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', focus: 'art', large });
  const focused = f.doc.activeElement;
  while (!f.root.querySelector('.dlg__more').hidden) f.scene.handleIntent('a');
  advance(large ? 6000 : 4000);
  assert.equal(f.doc.activeElement, focused);
  for (const button of f.root.querySelectorAll('.village-chips button')) {
    assert.equal(button.tabIndex, 0); assert.ok(button.focusable());
  }
  chip(f, 'not-now').focus(); f.scene.handleIntent('b');
  assert.equal(f.doc.activeElement, f.root);
});

test('Pip keeps the welcome and Got it when no creation exists', t => {
  const advance = clock(t), f = villageFixture(t, { calm: true });
  assert.equal(f.root.querySelector('.dlg__text').textContent, WELCOME_LINE);
  assert.equal(f.root.querySelector('[data-act="dismiss-welcome"]').hidden, false);
  assert.equal(f.root.querySelector('.village-chips'), null);
  advance(60000); f.root.querySelector('[data-act="dismiss-welcome"]').click();
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.equal(f.root.querySelector('.dlg__text').textContent, WELCOME_LINE);
  assert.equal(f.root.querySelector('.village-chips'), null);
});

test('Hear reads an offer and Help opens village help without navigating', t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art' });
  pages(f); advance(4000);
  const text = f.root.querySelector('.dlg__text').textContent;
  f.root.querySelector('[data-act="hear"]').click();
  assert.equal(f.spoken.at(-1), text);
  assert.ok(chip(f, 'visit'));
  f.root.querySelector('[data-act="help"]').click();
  assert.ok(f.stage.querySelector('.village-help'));
  assert.deepEqual(f.gone, []);
});

test('music Visit uses the music scene', async t => {
  const state = ids.filter(id => id !== 'music').reduce((s, id) => made(s, id, 0), stateFor(0));
  const f = villageFixture(t, { state, calm: true });
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.equal(chip(f, 'visit').textContent, 'Visit Kiko');
  await Promise.resolve();
  chip(f, 'visit').click();
  assert.deepEqual(f.gone, [['music']]);
});

test('opening another dialogue cancels the post-reaction offer', t => {
  const advance = clock(t), f = villageFixture(t, { state: made(stateFor(0), 'art', 0), celebrate: 'art', calm: true });
  f.root.querySelector('.village-actor[data-id="nori"]').click();
  const text = f.root.querySelector('.dlg__text').textContent;
  advance(60000);
  assert.equal(f.root.querySelector('.dlg__text').textContent, text);
  assert.equal(f.root.querySelector('.village-chips'), null);
});

test('a chip callback can replace the dialogue without closing the new line', t => {
  const f = villageFixture(t, { state: allMade(3, 2), calm: true });
  // The callback opens another line itself (an easel replay); the chip handler must leave that line open.
  f.ctx.go = () => { f.root.querySelector('[data-easel="math"]').click(); return false; };
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  chip(f, 'parade').click();
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  assert.equal(f.root.querySelector('.dlg__speaker').textContent, 'Taro');
  assert.equal(f.root.querySelector('.village-chips'), null);
});

function pendingMap(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image'), images = [];
  setRoad(null);
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    constructor() { this.naturalWidth = 960; this.naturalHeight = 540; images.push(this); }
  } });
  t.after(() => { setRoad(realRoad); if (original) Object.defineProperty(globalThis, 'Image', original); else delete globalThis.Image; });
  return { images, supply(doc) {
    const create = doc.createElement.bind(doc);
    t.mock.method(doc, 'createElement', tag => tag === 'canvas' ? {
      getContext: () => ({ drawImage() {}, getImageData: () => ({ ...roadPixels, data: roadPixels.rgba }) }),
    } : create(tag));
  } };
}

for (const interrupt of ['none', 'b', 'walk', 'help', 'failure']) test(`slow road preserves or cancels the pending offer: ${interrupt}`, async t => {
  const advance = clock(t), pending = pendingMap(t);
  const f = villageFixture(t, { walkable: null, state: made(stateFor(0), 'art', 0), celebrate: 'art' });
  pages(f); advance(4000);
  assert.equal(chip(f, 'visit'), null);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true, 'no prompt without actionable chips');
  if (interrupt === 'b') f.scene.handleIntent('b');
  if (interrupt === 'walk') f.scene.handleIntent('left');
  if (interrupt === 'help') f.root.querySelector('[data-act="village-help"]').click();
  if (interrupt === 'failure') pending.images[0].onerror();
  else { pending.supply(f.doc); pending.images[0].onload(); }
  await f.mounted; f.tick();
  assert.equal(Boolean(chip(f, 'visit')), interrupt === 'none');
  if (interrupt === 'failure') {
    assert.ok(f.root.querySelector('[data-act="retry-road"]'));
    assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
    f.scene.handleIntent('b');
    assert.equal(f.root.querySelector('.village-chips'), null);
  }
});

// Conservative font-width fixture, not a browser renderer: the real dialogue uses its
// hidden DOM probe. This exercises that probe with the 232px box's 204×118 text area.
function wrappedLines(text, width, size) {
  if (!text) return 0;
  let lines = 1, used = 0;
  const glyph = size * .65;
  for (const word of text.split(/\s+/)) {
    const wordWidth = word.length * glyph;
    if (used && used + glyph + wordWidth > width) { lines++; used = 0; }
    used += (used ? glyph : 0) + wordWidth;
    while (used > width) { lines++; used -= width; }
  }
  return lines;
}

for (const c of CHARACTERS) for (const status of ['new', 'started', 'another']) {
  if (status === 'another' && c.id === 'music') continue;
  test(`${c.name}'s ${status} offer fits page and chip limits with Bigger words`, t => {
    const advance = clock(t);
    let state = ids.filter(id => id !== c.id).reduce((s, id) => made(s, id, 0, 2), stateFor(0));
    if (status === 'started') state = saveDraft(state, c.id, snapshot(c.id, 0));
    if (status === 'another') state = made(state, c.id, 0);
    const f = villageFixture(t, { state, calm: true, large: true, measure: true,
      ...(status === 'another' ? {} : { celebrate: ids.find(id => id !== c.id) }) });
    f.ctx.saveOk = true;
    if (status === 'another') f.root.querySelector('.village-actor[data-id="pip"]').click();
    else { pages(f); advance(6000); }
    const lines = [];
    do {
      const text = f.root.querySelector('.dlg__text').textContent;
      lines.push(text);
      assert.ok(text.length <= 56);
      assert.ok(wrappedLines(text, 204, 30) * 35.4 <= 118, text);
      if (f.root.querySelector('.dlg__more').hidden) break;
      f.root.querySelector('.dlg__more').click();
    } while (lines.length < 10);
    const expected = status === 'another' ? `${c.name} has one more request. Want to go?`
      : status === 'started' ? `${c.name} has something to finish. Try ${c.name}?`
      : `Saved! ${c.name} has something new to make. Try ${c.name}?`;
    assert.equal(lines.join(' '), expected);
    assert.ok(expected.length <= 96);
    assert.ok(expected.split(/(?<=[.!?])\s+/).every(sentence => sentence.length <= 56));
    for (const button of f.root.querySelectorAll('.village-chips button')) {
      assert.ok(button.textContent.length <= 14);
      // 232px minus the 6px row gap, two equal chips, 6px padding on each side.
      assert.ok(wrappedLines(button.textContent, 101, 20) <= 2);
    }
  });
}

test('legacy stamps never produce an all-seven claim', t => {
  const state = allMade(0, 2), scope = 'chapter-0';
  state.progress[scope].science.creation = null;
  delete state.drafts[scope].science;
  const f = villageFixture(t, { state, calm: true });
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  assert.equal(f.root.querySelector('.dlg__text').textContent, 'You can choose a neighbor or watch the parade.');
  assert.ok(chip(f, 'parade'));
});
