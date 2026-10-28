import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageScene } from '../src/ui/screens/village.js';
import { createState, publishCreation, getCreations } from '../src/progress.js';
import { reactionLine, signReader } from '../src/reactions.js';
import { SIGN_SCENARIOS } from '../src/sign-scenarios.js';
import { figureMarkup } from '../src/ui/figures/index.js';
import { setRoad, road, talkGoal, nearestNeighbor, SIDE_SPOTS, VILLAGE_SPOTS } from '../src/ui/village-map.js';
import { ROAD_MASK, EASELS } from '../src/ui/village-layout.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { readPNG } from './helpers/png.js';

const pixels = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));
const realRoad = createWalkable(maskFromRGBA(pixels), { blocked: Object.values(EASELS) });

function fixture(t, { scenario = 'hello-momo', grade = 0, calm = false, reduced = false, large = false, pending = false, autoRead = false, voice = () => false, text = 'Hello Momo!', celebrate = 'writing', ...options } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = new Doc(), frames = new Map(), images = [], restores = [];
  let time = 0, frameId = 0;
  const sign = { kind: 'writing', chapter: grade ? 1 : 0, grade, scenario, text };
  let state = publishCreation({ ...createState(), chapter: grade ? 1 : 0, grade: grade || 1, settings: { autoRead } }, 'writing', sign);
  const initialSave = JSON.stringify(state.progress);
  for (const [key, value] of Object.entries({
    document: doc,
    performance: { now: () => time },
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    matchMedia: () => ({ matches: reduced }),
    Image: class { constructor() { this.naturalWidth = 960; this.naturalHeight = 540; images.push(this); } },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    restores.push(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  t.mock.method(Math, 'random', () => 0.25);
  const create = doc.createElement.bind(doc);
  t.mock.method(doc, 'createElement', tag => tag === 'canvas' ? {
    getContext: () => ({ drawImage() {}, getImageData: () => ({ ...pixels, data: pixels.rgba }) }),
  } : create(tag));
  setRoad(null);
  const stage = doc.createElement('div'), spoken = [], gone = [], opened = [];
  stage.className = `stage${calm ? ' calm' : ''}${large ? ' large-text' : ''}`;
  doc.body.append(stage);
  const scene = createVillageScene({ stage, walkable: pending ? null : realRoad, getState: () => state,
    commit: next => { state = next; }, speak: words => { spoken.push(words); return voice(words); },
    go: (...args) => { gone.push(args); return true; },
    open: Object.fromEntries(['grade', 'guide', 'comfort', 'pause'].map(act => [act, () => opened.push(act)])),
  }, { celebrate, ...options });
  scene.mount();
  const root = stage.querySelector('.village');
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  const actor = id => root.querySelector(`.village-actor[data-id="${id}"]`);
  const pos = id => {
    const el = id ? actor(id) : root.querySelector('.village-player');
    const side = id === 'pip' || id === 'nori';
    return { x: parseFloat(el.style.left) + (id ? side ? 36 : 56 : 32), y: parseFloat(el.style.top) + (id ? side ? 72 : 80 : 57) };
  };
  const tick = (ms = 16) => {
    time += ms;
    t.mock.timers.tick(ms);
    const queued = [...frames.values()]; frames.clear();
    queued.forEach(fn => fn(time));
  };
  const advance = ms => { for (let elapsed = 0; elapsed < ms; elapsed += 20) tick(Math.min(20, ms - elapsed)); };
  const wait = ms => { time += ms; t.mock.timers.tick(ms); };
  const box = root.querySelector('.village-dialogue');
  const words = () => box.querySelector('.dlg__text').textContent;
  const token = () => actor('pip').querySelector('.village-delivery-sign');
  const tap = (x, y) => root.querySelector('.village-map').dispatchEvent(new Event('click', { clientX: x, clientY: y }));
  const reaction = reactionLine('writing', getCreations(state).writing, grade);
  t.after(() => { scene.destroy(); restores.forEach(restore => restore()); setRoad(null); });
  return { scene, root, stage, doc, images, frames, actor, pos, tick, advance, wait, box, words, token, tap,
    spoken, gone, opened, reaction, initialSave, state: () => state };
}

function arrive(f) {
  for (let ticks = 0; f.box.hidden && ticks < 150; ticks++) f.tick(20);
  assert.equal(f.box.hidden, false, 'reader speaks within three seconds');
  assert.equal(f.words(), f.reaction.words);
}

test('Pip carries a copy along the road, the reader speaks on arrival, and Pip walks home', t => {
  const f = fixture(t);
  const easel = f.root.querySelector('.village-easel[data-id="writing"]');
  assert.equal(f.box.hidden, true);
  assert.equal(f.doc.activeElement, f.root, 'opening does not steal focus');
  f.tick();
  assert.ok(f.token());
  assert.equal(f.token().getAttribute('aria-hidden'), 'true');
  assert.equal(f.token().querySelector('.world-sign').textContent, 'Hello Momo!');
  assert.notDeepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  const reader = f.pos('science'), goal = talkGoal('science', reader);
  while (f.box.hidden) {
    f.tick(20);
    assert.ok(realRoad.isWalkable(f.pos('pip')), 'feet stay on the real road');
    assert.deepEqual(f.pos('science'), reader, 'reader stays at the destination');
  }
  assert.deepEqual(f.pos('pip'), goal);
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, 'Momo');
  assert.equal(f.token(), null);
  assert.equal(f.actor('pip').querySelector('.village-actor__fig').innerHTML, figureMarkup('pip', { pose: 'joy' }));
  assert.equal(f.doc.activeElement, f.root);
  assert.equal(f.root.querySelector('.village-easel[data-id="writing"]'), easel);
  assert.equal(JSON.stringify(f.state().progress), f.initialSave, 'delivery writes no save fields');
  f.advance(400);
  assert.notDeepEqual(f.pos('pip'), goal, 'Pip leaves the reader after the joy frame');
  f.advance(30000);
  assert.ok(realRoad.isWalkable(f.pos('pip')));
  assert.ok(Math.hypot(f.pos('pip').x - SIDE_SPOTS.pip.x, f.pos('pip').y - SIDE_SPOTS.pip.y) <= 36, 'Pip resumes wandering at home');
});

test('a reader already starting to wander is held at live feet and turned toward Pip', t => {
  const f = fixture(t);
  f.tick(1300); // The reader takes a first wander step before Pip starts this frame.
  const reader = f.pos('science');
  assert.notDeepEqual(reader, VILLAGE_SPOTS.science);
  const goal = talkGoal('science', reader);
  f.advance(300);
  assert.deepEqual(f.pos('science'), reader);
  assert.equal(f.actor('science').querySelector('.village-actor__fig').innerHTML, figureMarkup('science', { facing: 'left' }));
  arrive(f);
  assert.deepEqual(f.pos('pip'), goal, 'destination uses held live feet, not the home spot');
  f.advance(100);
  assert.notDeepEqual(f.pos('science'), reader, 'reader is released after arrival');
});

for (const input of ['Enter', ' ', 'Escape', 'Backspace', 'ArrowUp', 'w', 'Tab', 'q']) test(`${input} skips the delivery and keeps the arrival line`, t => {
  const f = fixture(t);
  f.tick();
  pressKey(f.root, 'keydown', input);
  pressKey(f.root, 'keyup', input);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  assert.equal(f.token(), null);
  if (input === 'ArrowUp' || input === 'w') {
    const before = f.pos(); f.advance(120);
    assert.ok(f.pos().y < before.y, 'the skipping walking key also moves the player');
  }
});

for (const intent of ['up', 'a', 'b']) test(`direct ${intent} intent skips once without hiding the line`, t => {
  const f = fixture(t);
  f.tick();
  assert.equal(f.scene.handleIntent(intent), true);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  assert.equal(f.box.hidden, false);
  assert.equal(f.words(), f.reaction.words);
});

test('tapping the ground skips while still starting the player walk', t => {
  const f = fixture(t);
  f.tick();
  const before = f.pos();
  f.tap(490, 460);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  f.advance(200);
  assert.notDeepEqual(f.pos(), before);
  assert.equal(f.box.hidden, false);
});

test('a tap or key while Pip walks home from a delivery no longer snaps him home', t => {
  const f = fixture(t);
  arrive(f);
  const goal = talkGoal('science', f.pos('science'));
  f.advance(400);
  const mid = f.pos('pip');
  assert.notDeepEqual(mid, goal, 'Pip has left the reader');
  assert.ok(Math.hypot(mid.x - SIDE_SPOTS.pip.x, mid.y - SIDE_SPOTS.pip.y) > 36, 'and is still on his way home');
  f.tap(490, 460);
  assert.deepEqual(f.pos('pip'), mid, 'a ground tap leaves him where he was');
  pressKey(f.root, 'keydown', 'Enter');
  pressKey(f.root, 'keyup', 'Enter');
  assert.deepEqual(f.pos('pip'), mid, 'so does a key');
  f.scene.handleIntent('b');
  assert.deepEqual(f.pos('pip'), mid, 'and so does Back');
  f.advance(30000);
  assert.ok(realRoad.isWalkable(f.pos('pip')));
  assert.ok(Math.hypot(f.pos('pip').x - SIDE_SPOTS.pip.x, f.pos('pip').y - SIDE_SPOTS.pip.y) <= 36, 'and he still finishes the walk home on his own');
});

for (const settings of [{ calm: true }, { reduced: true }]) test(`Calm ${JSON.stringify(settings)} reads at once without any delivery motion`, t => {
  const f = fixture(t, settings);
  assert.equal(f.box.hidden, false);
  assert.equal(f.words(), f.reaction.words);
  f.advance(2000);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  assert.equal(f.token(), null);
});

test('turning Calm on during a delivery completes at once and releases the reader', t => {
  const f = fixture(t);
  f.tick();
  f.stage.classList.add('calm');
  f.tick();
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  assert.equal(f.token(), null);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  f.advance(200);
  assert.deepEqual(f.pos('science'), VILLAGE_SPOTS.science);
});

test('group and Cricket readers keep the existing immediate fallback with no delivery', t => {
  const scenarios = SIGN_SCENARIOS.filter(s => !signReader({ kind: 'writing', scenario: s.id, grade: s.grades[0] }));
  assert.ok(scenarios.some(s => s.reader === 'Cricket'));
  // Exercise all group names via the exported lookup; the scene fallback is the same for each.
  for (const s of scenarios) assert.equal(reactionLine('writing', { kind: 'writing', scenario: s.id, text: s.example, grade: s.grades[0] }, s.grades[0]).id, 'writing');
  const f = fixture(t, { scenario: 'momo-menu', text: 'Warm stew' });
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, 'Fumi');
  assert.equal(f.token(), null);
});

for (const [scenario, name] of [['thank-pip', 'Pip'], ['welcome-nori', 'Nori'], ['cheer-kiko', 'Kiko']]) test(`${name} can receive a sign, including Pip's own mail`, t => {
  const f = fixture(t, { scenario });
  arrive(f);
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, name);
  if (name === 'Pip') assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
});

test('delivering Pip never becomes the Talk target while passing the player', t => {
  const f = fixture(t, { scenario: 'welcome-nori' });
  let passedInRange = false;
  while (f.box.hidden) {
    f.tick(20);
    if (nearestNeighbor(f.pos(), { pip: f.pos('pip') }) === 'pip') passedInRange = true;
    const talk = f.root.querySelector('.village-talk');
    if (!talk.hidden) assert.doesNotMatch(talk.textContent, /Pip/);
    assert.equal(f.actor('pip').classList.contains('village-actor--near'), false);
  }
  assert.equal(passedInRange, true, 'the route really did pass in talk range');
});

test('a null delivery path immediately reads the sign and never holds the reader', t => {
  const f = fixture(t);
  // Disconnect the source from every destination while preserving real, safe start pixels.
  const disconnected = createWalkable(maskFromRGBA(pixels), { blocked: [{ x: 480, y: 0, w: 20, h: 540 }] });
  setRoad(disconnected);
  f.tick();
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  assert.equal(f.token(), null);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
  setRoad(realRoad);
  f.advance(1600);
  assert.notDeepEqual(f.pos('science'), VILLAGE_SPOTS.science, 'reader was not left held');
});

test('the opening close timer starts on arrival, with Hear and More still using the existing path', t => {
  const f = fixture(t, { autoRead: true, voice: words => ({ text: words }) });
  f.tick();
  f.wait(1000); // No delivery frames: the line and speech have not started.
  assert.equal(f.box.hidden, true);
  assert.deepEqual(f.spoken, []);
  arrive(f);
  assert.deepEqual(f.spoken, [f.reaction.words]);
  // Auto-read without an end event has a speech estimate added to the normal reading delay.
  const readingDelay = 4000 + f.reaction.words.split(/\s+/).length * 500 + 500;
  f.wait(readingDelay - 1);
  assert.equal(f.box.hidden, false);
  assert.equal(f.box.querySelector('.village-chips'), null);
  f.wait(1);
  // The reaction closed on time; Pip's next-stop offer takes its place (lane 2 hooks the reaction's close).
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, 'Pip');
  assert.ok(f.box.querySelector('.village-chips [data-act="visit"]'));
});

test('the normal four-second close timer is measured from arrival, not mount', t => {
  const f = fixture(t);
  arrive(f);
  f.wait(3999);
  assert.equal(f.box.hidden, false);
  assert.equal(f.box.querySelector('.village-chips'), null);
  f.wait(1);
  // Closed on time, then Pip's next-stop offer (lane 2) opens in its place.
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, 'Pip');
  assert.ok(f.box.querySelector('.village-chips [data-act="visit"]'));
});

test('Bigger words, Hear and A retain the reader pages after arrival', t => {
  const f = fixture(t, { large: true, text: 'Hello, Momo! Come to our festival.' });
  for (let i = 0; f.box.hidden && i < 150; i++) f.tick(20);
  assert.equal(f.box.hidden, false);
  const firstPage = f.words();
  assert.ok(firstPage.length <= 56);
  assert.equal(f.box.querySelector('.dlg__more').hidden, false);
  f.box.querySelector('[data-act="hear"]').click();
  assert.deepEqual(f.spoken, [`${firstPage} More. Tap to continue.`]);
  f.scene.handleIntent('a');
  assert.notEqual(f.words(), firstPage);
  assert.equal(f.box.querySelector('.dlg__more').hidden, true);
  f.scene.handleIntent('b');
  assert.equal(f.box.hidden, true);
});

test('delivery waits briefly for the road, then falls back without replaying on a late load', async t => {
  const f = fixture(t, { pending: true });
  assert.equal(f.frames.size, 0);
  f.wait(1499);
  assert.equal(f.box.hidden, true);
  f.wait(1);
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  f.images[0].onload();
  await new Promise(resolve => setImmediate(resolve));
  f.advance(100);
  assert.equal(f.token(), null);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
});

test('a road ready within the grace period starts the delivery', async t => {
  const f = fixture(t, { pending: true });
  f.wait(500);
  f.images[0].onload();
  await new Promise(resolve => setImmediate(resolve));
  f.tick();
  assert.ok(f.token());
  assert.equal(f.box.hidden, true);
  arrive(f);
});

test('the total pre-line delay is capped at three seconds even without animation frames', t => {
  const f = fixture(t);
  f.tick();
  f.wait(2983);
  assert.equal(f.box.hidden, true);
  f.wait(1);
  assert.equal(f.words(), f.reaction.words);
  assert.equal(f.box.hidden, false);
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
});

test('an actual failed road retains the retry UI and never queues a delivery after recovery', async t => {
  const f = fixture(t, { pending: true });
  f.images[0].onerror();
  await new Promise(resolve => setImmediate(resolve));
  f.wait(1600);
  assert.equal(f.words(), 'The village map did not load.');
  assert.ok(f.root.querySelector('[data-act="retry-road"]'));
  f.root.querySelector('[data-act="retry-road"]').click();
  f.images[1].onload();
  await new Promise(resolve => setImmediate(resolve));
  f.advance(100);
  assert.equal(f.token(), null);
  assert.equal(f.box.hidden, true, 'read-back is not queued behind the map error');
});

test('opening a different dialogue cancels the pending read-back instead of queuing it', t => {
  const f = fixture(t, { autoRead: true });
  f.tick();
  f.actor('nori').click();
  f.advance(2000);
  assert.equal(f.box.querySelector('.dlg__speaker').textContent, 'Nori');
  assert.doesNotMatch(f.words(), /A sign for me/);
  assert.ok(f.spoken.every(words => !words.includes('A sign for me')), 'the dropped line is not spoken before the other dialogue');
  f.advance(4000);
  assert.doesNotMatch(f.words(), /A sign for me/);
  assert.equal(f.token(), null);
});

test('a window opened before delivery arrival drops the line and releases the reader', t => {
  const f = fixture(t);
  f.tick();
  const backdrop = f.doc.createElement('div'); backdrop.className = 'win-backdrop'; f.stage.append(backdrop);
  f.tick();
  assert.equal(f.box.hidden, true);
  assert.equal(f.token(), null);
  backdrop.remove();
  f.advance(4000);
  assert.equal(f.box.hidden, true);
  assert.notDeepEqual(f.pos('science'), VILLAGE_SPOTS.science);
});

test('destroy removes all pending delivery callbacks and frames', t => {
  const f = fixture(t);
  f.tick();
  f.scene.destroy();
  f.wait(10000);
  assert.equal(f.frames.size, 0);
  assert.equal(f.stage.querySelector('.village'), null);
});

test('delivery token uses easel sizing and adds no animation or new sprite drawing', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8').split('/* ---- lane 7: Pip delivers your sign ---- */')[1];
  assert.match(css, /width: 64px; height: 40px/);
  assert.match(css, /scale\(var\(--sign-scale, \.1\)\)/);
  assert.match(css, /pointer-events: none/);
  assert.doesNotMatch(css, /animation|transition|background-image/);
});
