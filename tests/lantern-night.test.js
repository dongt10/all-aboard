import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data.js';
import { createState, publishCreation, saveDraft, getCreations, scopeKey } from '../src/progress.js';
import { createVillageScene, LANTERN_LINES, WELCOME_LINE, lampHidden } from '../src/ui/screens/village.js';
import { NEAR_LAMPS, ROAD_MASK } from '../src/ui/village-layout.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { keyIntent, routeIntent } from '../src/ui/input.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { readPNG } from './helpers/png.js';

const realRoad = createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url))));
const made = (count = 7, grade = 0, base = createState()) => {
  let state = { ...base, hasStarted: true, chapter: grade ? 1 : 0, grade: grade || 1 };
  for (const { id } of CHARACTERS.slice(0, count)) {
    state = publishCreation(state, id, { kind: id, chapter: state.chapter, grade });
  }
  return state;
};

function fixture(t, { state = made(), calm = true, large = false, reduced = false, ...options } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Math, 'random', () => 0.5);
  const doc = new Doc(), frames = new Map(), restore = [];
  let frameId = 0, time = 0, scene;
  for (const [key, value] of Object.entries({
    document: doc, MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id), matchMedia: () => ({ matches: reduced }),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    restore.push(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const stage = doc.createElement('div'), commits = [], spoken = [], gone = [];
  stage.className = `stage${calm ? ' calm' : ''}${large ? ' large-text' : ''}`;
  doc.body.append(stage);
  const ctx = {
    stage, walkable: realRoad, getState: () => state,
    commit: next => { commits.push(next); state = next; },
    speak: words => { spoken.push(words); return false; }, go: (...args) => { gone.push(args); return true; },
    open: {},
  };
  const f = { doc, stage, commits, spoken, gone, get state() { return state; }, get scene() { return scene; } };
  f.mount = (next = state) => {
    scene?.destroy(); state = next;
    scene = createVillageScene(ctx, options); scene.mount();
    f.root = stage.querySelector('.village');
    f.root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  };
  f.frame = (ms = 100) => {
    time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time));
  };
  f.wait = ms => t.mock.timers.tick(ms);
  f.text = () => f.root.querySelector('.dlg__text').textContent;
  f.host = () => f.root.querySelector('.village-dialogue');
  f.lit = () => f.root.querySelectorAll('.village-lamp--lit').length;
  f.chip = act => f.root.querySelector(`.village-chips [data-act="${act}"]`);
  f.tap = (x, y) => f.root.querySelector('.village-map').dispatchEvent(new Event('click', { clientX: x, clientY: y }));
  f.visit = async (id = 'nori') => {
    f.root.querySelector(`.village-actor[data-id="${id}"]`).click();
    for (let i = 0; i < 30; i++) f.frame();
    await Promise.resolve();
  };
  // The same document-level routing used by app.js; pressKey supplies native button defaults.
  doc.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    const route = routeIntent(event);
    if (route === 'click-target') { event.preventDefault(); event.target.click(); }
    else if (route === 'scene' && scene.handleIntent(keyIntent(event))) event.preventDefault();
  });
  f.mount();
  t.after(() => { scene.destroy(); restore.forEach(fn => fn()); });
  return f;
}

test('lantern words fit each page and every Bigger-words sentence', () => {
  for (const words of Object.values(LANTERN_LINES)) {
    assert.ok(words.length <= 96, words);
    for (const sentence of words.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 56, sentence);
  }
  assert.deepEqual(Object.values(LANTERN_LINES).map(words => words.length), [43, 28, 45]);
});

test('all eleven lamps derive their initial state from published creations on each mount', t => {
  const f = fixture(t, { state: made(6) });
  assert.equal(f.root.querySelectorAll('.village-lamp').length, NEAR_LAMPS.length);
  assert.equal(f.lit(), 0);
  f.mount(made());
  assert.equal(f.lit(), 11);
  assert.equal(f.host().hidden, true, 'no automatic finale');
  f.wait(20000);
  assert.equal(f.lit(), 11);
  assert.equal(f.host().hidden, true);
  f.mount(made(0));
  assert.equal(f.lit(), 0);
});

test('Kindergarten and all five grades keep their own lantern state', t => {
  let state = made(7, 0);
  state = made(7, 3, state);
  const f = fixture(t, { state });
  for (const grade of [0, 1, 2, 3, 4, 5, 0]) {
    f.mount({ ...state, chapter: grade ? 1 : 0, grade: grade || 1 });
    assert.equal(f.lit(), [0, 3].includes(grade) ? 11 : 0, `grade ${grade}`);
  }
});

test('drafts and legacy completion stamps do not earn lantern night', async t => {
  let state = made(0);
  for (const { id } of CHARACTERS) state = saveDraft(state, id, { kind: id });
  const f = fixture(t, { state });
  await f.visit();
  assert.equal(f.lit(), 0);
  assert.equal(f.chip('light-lanterns'), null);
  state = made();
  for (const record of Object.values(state.progress[scopeKey(0, 1)])) record.creation = null;
  f.mount(state);
  await f.visit();
  assert.equal(f.lit(), 0);
  assert.equal(f.chip('light-lanterns'), null);
});

test('Nori offers the two choices only with all seven made in the current grade', async t => {
  const f = fixture(t, { state: made(6) });
  await f.visit();
  assert.match(f.text(), /^You can go anywhere first\./);
  assert.equal(f.chip('light-lanterns'), null);
  f.mount(made());
  const focus = f.doc.activeElement;
  await f.visit();
  assert.equal(f.text(), LANTERN_LINES.offer);
  assert.equal(f.doc.activeElement, focus, 'offer does not take focus');
  const chips = f.root.querySelectorAll('.village-chips button');
  assert.deepEqual(chips.map(button => button.textContent), ['Light lanterns', 'Not now']);
  for (const button of chips) {
    assert.equal(button.type, 'button');
    assert.equal(button.tabIndex, 0);
    assert.ok(button.focusable());
    assert.ok(button.textContent.length <= 14);
  }
});

test('Enter beside Nori opens the offer and Not now closes without changing the lamps', async t => {
  const f = fixture(t);
  await f.visit();
  f.chip('lantern-not-now').focus();
  pressKey(f.doc.activeElement, 'keydown', 'Enter');
  assert.equal(f.host().hidden, true);
  assert.equal(f.root.querySelector('.village-chips'), null);
  assert.equal(f.doc.activeElement, f.root);
  pressKey(f.root, 'keydown', 'Enter');
  assert.equal(f.text(), LANTERN_LINES.offer);
  assert.equal(f.host().hidden, false);
  assert.equal(f.lit(), 11);
});

for (const key of ['Enter', ' ']) test(`${key === ' ' ? 'Space' : key} activates the lantern chip once and preserves the next page`, async t => {
  const f = fixture(t);
  await f.visit();
  const button = f.chip('light-lanterns');
  button.focus();
  pressKey(button, 'keydown', key);
  if (key === ' ') {
    assert.equal(f.text(), LANTERN_LINES.offer, 'Space waits for keyup');
    pressKey(button, 'keyup', key);
  }
  assert.equal(f.text(), LANTERN_LINES.lighting);
  assert.equal(f.host().hidden, false, 'old row must not hush a new line');
  assert.equal(f.chip('light-lanterns'), null);
  assert.ok(f.chip('lantern-more'));
  assert.equal(f.doc.activeElement, f.root, 'removed chip does not strand focus on body');
});

for (const mode of ['calm', 'system', 'large']) test(`${mode} lighting shows all lamps at once with two child-paced, hearable pages`, async t => {
  const f = fixture(t, { calm: mode !== 'system', reduced: mode === 'system', large: mode === 'large' });
  await f.visit();
  f.chip('light-lanterns').click();
  assert.equal(f.lit(), 11);
  assert.equal(f.text(), LANTERN_LINES.lighting);
  f.wait(20000);
  assert.equal(f.text(), LANTERN_LINES.lighting, 'no timer advances reading');
  f.root.querySelector('[data-act="hear"]').click();
  assert.equal(f.spoken.at(-1), LANTERN_LINES.lighting);
  f.chip('lantern-more').focus();
  pressKey(f.doc.activeElement, 'keydown', 'Enter');
  assert.equal(f.text(), LANTERN_LINES.done);
  f.root.querySelector('[data-act="hear"]').click();
  assert.equal(f.spoken.at(-1), LANTERN_LINES.done);
  f.chip('lantern-done').focus();
  pressKey(f.doc.activeElement, 'keydown', 'Enter');
  assert.equal(f.host().hidden, true);
  assert.equal(f.lit(), 11);
});

test('normal motion lights one whole lamp every 800ms, holds Nori, then stays finished', async t => {
  const f = fixture(t, { calm: false });
  await f.visit();
  const nori = f.root.querySelector('.village-actor[data-id="nori"]');
  const position = [nori.style.left, nori.style.top];
  f.chip('light-lanterns').click();
  assert.equal(f.lit(), 0);
  assert.equal(f.text(), LANTERN_LINES.lighting);
  // Two glass heads sit behind the top bar: those lamps light with the lamp before them, so no 800 ms step is silent.
  const steps = [];
  for (let lit = 0; lit < NEAR_LAMPS.length;) { lit++; while (lit < NEAR_LAMPS.length && lampHidden(lit)) lit++; steps.push(lit); }
  assert.deepEqual(steps, [1, 2, 5, 6, 7, 8, 9, 10, 11]);
  let before = 0;
  for (const count of steps) {
    f.wait(799);
    assert.equal(f.lit(), before);
    f.frame(100);
    assert.deepEqual([nori.style.left, nori.style.top], position);
    f.wait(1);
    assert.equal(f.lit(), count);
    assert.deepEqual(f.root.querySelectorAll('.village-lamp').map(lamp => lamp.classList.contains('village-lamp--lit')),
      NEAR_LAMPS.map((_, i) => i < count));
    before = count;
  }
  assert.equal(f.text(), LANTERN_LINES.done);
  assert.ok(f.chip('lantern-done'));
  f.wait(20000);
  assert.equal(f.text(), LANTERN_LINES.done);
  assert.equal(f.host().hidden, false);
  assert.deepEqual(f.spoken, [], 'no sound is started');
});

for (const stop of ['walk', 'escape', 'b', 'ground', 'off-road', 'got-it', 'pause', 'help', 'hidden']) {
  test(`${stop} interrupts lighting, restores all earned lamps, and cancels the late finale`, async t => {
    const f = fixture(t);
    await f.visit();
    f.stage.classList.remove('calm');
    f.chip('light-lanterns').click();
    f.wait(800);
    assert.equal(f.lit(), 1);
    if (stop === 'walk') f.scene.handleIntent('up');
    if (stop === 'escape') pressKey(f.root, 'keydown', 'Escape');
    if (stop === 'b') f.scene.handleIntent('b');
    if (stop === 'ground') f.tap(490, 510);
    if (stop === 'off-road') f.tap(12, 90);
    if (stop === 'got-it') f.chip('lantern-done').click();
    if (stop === 'pause') f.scene.pause();
    if (stop === 'help') f.root.querySelector('[data-act="village-help"]').click();
    if (stop === 'hidden') { f.doc.hidden = true; f.wait(800); }
    assert.equal(f.lit(), 11);
    assert.equal(f.host().hidden, true);
    assert.equal(f.root.querySelector('.village-chips'), null);
    f.wait(20000);
    assert.equal(f.host().hidden, true, 'stale timer cannot reopen words');
    assert.equal(f.lit(), 11);
  });
}

test('Calm enabled during lighting finishes the lamps without an ongoing sequence', async t => {
  const f = fixture(t);
  await f.visit();
  f.stage.classList.remove('calm');
  f.chip('light-lanterns').click();
  f.wait(800);
  assert.equal(f.lit(), 1);
  f.stage.classList.add('calm');
  f.wait(800);
  assert.equal(f.lit(), 11);
  assert.equal(f.text(), LANTERN_LINES.lighting);
  assert.ok(f.chip('lantern-more'));
  f.wait(20000);
  assert.equal(f.text(), LANTERN_LINES.lighting);
});

test('the sequence replays from Nori and never writes to or mutates the save', async t => {
  const state = made(), original = JSON.stringify(state), f = fixture(t, { state });
  for (let replay = 0; replay < 2; replay++) {
    await f.visit();
    f.stage.classList.remove('calm');
    f.chip('light-lanterns').click();
    assert.equal(f.lit(), 0);
    for (let i = 0; i < 11; i++) f.wait(800);
    f.chip('lantern-done').click();
  }
  f.mount();
  assert.equal(f.lit(), 11);
  assert.equal(JSON.stringify(state), original);
  assert.equal(JSON.stringify(f.state), original);
  assert.equal(Object.keys(getCreations(f.state)).length, 7);
  assert.deepEqual(f.commits, []);
  assert.deepEqual(f.gone, []);
});

test('destroy cancels lighting and old callbacks cannot touch the next grade', async t => {
  const f = fixture(t);
  await f.visit();
  f.stage.classList.remove('calm');
  f.chip('light-lanterns').click();
  f.wait(800);
  const oldRoot = f.root;
  f.mount(made(0, 2, f.state));
  f.wait(20000);
  assert.equal(oldRoot.isConnected, false);
  assert.equal(f.lit(), 0);
  assert.equal(f.text(), WELCOME_LINE);
  assert.equal(f.root.querySelector('.village-chips'), null);
});

test('another dialogue clears the lantern row, and Pip\'s own offer takes its place at seven of seven', async t => {
  const f = fixture(t);
  await f.visit();
  assert.ok(f.chip('light-lanterns'));
  await f.visit('pip');
  // With every stall made, Pip points at a second request instead of the welcome (Pip's next stop).
  assert.equal(f.text(), 'Taro has one more request. Want to go?');
  assert.equal(f.chip('light-lanterns'), null);
  assert.ok(f.root.querySelector('.village-chips [data-act="visit"]'));
  assert.equal(f.root.querySelector('[data-act="dismiss-welcome"]').hidden, true);
  f.scene.handleIntent('b');
  assert.equal(f.host().hidden, true);
  assert.equal(f.root.querySelector('.village-chips'), null);
});

test('lamp props sit before actors with no hit target, animation, background tint or dimming layer', t => {
  const f = fixture(t), overlay = f.root.querySelector('.village-lamps');
  assert.equal(overlay.getAttribute('aria-hidden'), 'true');
  assert.ok(f.root.children.indexOf(overlay) < f.root.children.indexOf(f.root.querySelector('.village-actors')));
  assert.equal(overlay.querySelector('button'), null);
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8').split('/* ---- lantern night ---- */')[1];
  assert.match(css, /\.village-lamps\s*\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(css, /filter:|mix-blend|@keyframes|animation:(?! none)|transition:(?! none)/);
  assert.match(css, /\.calm \.village-lamp__head/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
