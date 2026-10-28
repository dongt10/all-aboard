import test from 'node:test';
import assert from 'node:assert/strict';
import { createVillageScene } from '../src/ui/screens/village.js';
import { createState } from '../src/progress.js';
import { SIDE_SPOTS, VILLAGE_SPOTS, PLAYER_START, talkPoint, wanderBounds, setRoad } from '../src/ui/village-map.js';
import { ROAD_MASK } from '../src/ui/village-layout.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { readPNG } from './helpers/png.js';
import { Doc, Event } from './helpers/dom.js';

function fixture(t, { calm = '', celebrate = null, focus = null, loading = false } = {}) {
  const doc = new Doc(), frames = new Map();
  let time = 0, sequence = 0, state = createState();
  const road = createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url))));
  const originals = new Map();
  for (const [key, value] of Object.entries({ document: doc, performance: { now: () => time }, MutationObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: cb => { frames.set(++sequence, cb); return sequence; }, cancelAnimationFrame: id => frames.delete(id), matchMedia: () => ({ matches: calm === 'media' }) })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.mock.method(Math, 'random', () => 0);
  const stage = doc.createElement('div'), parent = doc.createElement('div');
  if (calm === 'stage') stage.classList.add('calm');
  if (calm === 'ancestor') parent.classList.add('calm');
  parent.append(stage); doc.body.append(parent);
  if (loading) setRoad(null);
  const ctx = { stage, walkable: loading ? null : road, getState: () => state, commit: next => { state = next; }, announce() {}, speak() {}, go() {}, open: {} };
  const scene = createVillageScene(ctx, { celebrate, focus });
  scene.mount();
  const root = stage.querySelector('.village');
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  const tick = (ms = 100) => { time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(time)); };
  const actor = id => root.querySelector(`.village-actor[data-id="${id}"]`);
  const pos = id => { const el = actor(id); const side = id in SIDE_SPOTS; return { x: parseFloat(el.style.left) + (side ? 36 : 56), y: parseFloat(el.style.top) + (side ? 72 : 80) }; };
  const image = id => actor(id).querySelector('.village-actor__fig').innerHTML;
  const tap = p => root.querySelector('.village-map').dispatchEvent(new Event('click', { clientX: p.x, clientY: p.y }));
  t.after(() => { scene.destroy(); for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  return { road, stage, parent, root, doc, tick, actor, pos, image, tap, scene };
}
const frame = (f, id) => f.image(id).match(/background-position:([^";]+)/)?.[1];
const advance = (f, n, ms = 100) => { for (let i = 0; i < n; i++) f.tick(ms); };

for (const id of ['pip', 'nori', 'math']) test(`${id} walks at its own speed and stride on the road`, t => {
  const f = fixture(t, { calm: id === 'nori' ? 'stage' : '' }), home = SIDE_SPOTS[id] ?? VILLAGE_SPOTS[id];
  if (id === 'nori') { f.tap({ x: 420, y: 400 }); f.stage.classList.remove('calm'); }
  const bounds = wanderBounds(id);
  const target = [1, -1].map(sign => ({ x: home.x + sign * 36, y: home.y })).find(p => p.x >= bounds.minX && p.x <= bounds.maxX && f.road.isWalkable(p) && f.road.straightClear(home, p));
  assert.ok(target, `${id} has a clear 36px excursion`);
  const original = f.road.randomWalkableNear.bind(f.road);
  t.mock.method(f.road, 'randomWalkableNear', (point, ...args) => point.x === home.x && point.y === home.y ? target : original(point, ...args));
  advance(f, 4);
  const start = f.pos(id);
  advance(f, 1);
  const after = f.pos(id), speed = id === 'pip' ? 48 : id === 'nori' ? 12 : 24;
  assert.ok(Math.abs(Math.hypot(after.x - start.x, after.y - start.y) - speed / 10) < 0.01);
  assert.ok(f.road.isWalkable(after));
  const stride = id === 'pip' ? 150 : id === 'nori' ? 500 : 300;
  const row = target.x < home.x ? '-64px' : '-128px';
  assert.equal(frame(f, id), `0px ${row}`);
  let elapsed = 100;
  while (elapsed + 100 < stride) { f.tick(100); elapsed += 100; }
  if (elapsed < stride) f.tick(stride - elapsed - 1);
  assert.equal(frame(f, id), `0px ${row}`, 'step A holds until the stride boundary');
  f.tick(1);
  assert.equal(frame(f, id), `-64px ${row}`, 'standing frame begins at the stride boundary');
  advance(f, Math.floor((stride - 1) / 100));
  const remainder = (stride - 1) % 100;
  if (remainder) f.tick(remainder);
  assert.equal(frame(f, id), `-64px ${row}`);
  f.tick(1);
  assert.equal(frame(f, id), `-128px ${row}`, 'step B begins at twice the stride');
  if (id === 'nori') {
    advance(f, 20);
    assert.ok(Math.hypot(f.pos(id).x - target.x, f.pos(id).y - target.y) < 0.01, `full outbound leg: ${JSON.stringify(f.pos(id))} target ${JSON.stringify(target)}`);
    advance(f, 46);
    assert.ok(Math.hypot(f.pos(id).x - home.x, f.pos(id).y - home.y) < 0.01, 'returns home');
  }
});

for (const id of ['pip', 'nori']) test(`${id} faces the player while held and shows joy for Talk`, t => {
  const f = fixture(t, { calm: 'stage' }), home = SIDE_SPOTS[id];
  for (const [dx, expected] of [[-80, '-64px -64px'], [80, '-64px -128px'], [0, '-64px 0px']]) {
    const p = { x: home.x + dx, y: home.y - (dx ? 40 : 85) };
    assert.ok(f.road.isWalkable(p)); f.tap(p); f.tick(); f.tick();
    assert.equal(frame(f, id), expected);
  }
  f.tap(talkPoint(id)); f.tick(); f.tick();
  assert.equal(f.root.querySelector('.village-talk').getAttribute('aria-label'), `Talk to ${id === 'pip' ? 'Pip' : 'Nori'}`);
  assert.equal(frame(f, id), '-192px 0px');
  const point = talkPoint(id), offAxis = { x: point.x + 20, y: point.y };
  assert.ok(f.road.isWalkable(offAxis)); f.tap(offAxis); f.tick(); f.tick();
  assert.equal(f.root.querySelector('.village-talk').getAttribute('aria-label'), `Talk to ${id === 'pip' ? 'Pip' : 'Nori'}`);
  assert.equal(frame(f, id), '-192px 0px', 'off-axis Talk uses the front joy artwork');
  f.tap(PLAYER_START); f.tick(); f.tick();
  assert.notEqual(frame(f, id), '-192px 0px');
});

for (const calm of ['stage', 'ancestor', 'media']) test(`Calm via ${calm} keeps actors at home but allows joy`, t => {
  const f = fixture(t, { calm });
  advance(f, 40);
  for (const [id, home] of Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS })) assert.deepEqual(f.pos(id), home, id);
  f.tap(talkPoint('pip')); f.tick(); f.tick();
  assert.equal(frame(f, 'pip'), '-192px 0px');
  assert.deepEqual(f.pos('pip'), SIDE_SPOTS.pip);
});

test('celebration displays both side joy frames for 1500ms without changing focus or other figures', t => {
  const f = fixture(t, { calm: 'stage', celebrate: 'math', focus: 'math' });
  assert.equal(f.doc.activeElement, f.actor('math'));
  assert.equal(frame(f, 'pip'), '-192px 0px');
  assert.equal(frame(f, 'nori'), '-192px 0px');
  assert.notEqual(frame(f, 'math'), '-192px 0px');
  assert.doesNotMatch(f.root.querySelector('.village-player').firstElementChild.innerHTML, /background-position:-192px 0px/);
  advance(f, 14);
  assert.equal(frame(f, 'pip'), '-192px 0px');
  f.tick(100);
  assert.equal(frame(f, 'pip'), '-64px 0px');
  assert.equal(frame(f, 'nori'), '-64px 0px');
  assert.equal(f.doc.activeElement, f.actor('math'));
});


test('switching Calm on mid-walk returns every actor home', t => {
  const f = fixture(t);
  const original = f.road.randomWalkableNear.bind(f.road), home = SIDE_SPOTS.pip, target = { x: home.x + 36, y: home.y };
  assert.ok(f.road.isWalkable(target) && f.road.straightClear(home, target));
  t.mock.method(f.road, 'randomWalkableNear', (point, ...args) => point.x === home.x && point.y === home.y ? target : original(point, ...args));
  advance(f, 7);
  assert.notDeepEqual(f.pos('pip'), home);
  f.stage.classList.add('calm'); f.tick();
  for (const [id, home] of Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS })) assert.deepEqual(f.pos(id), home, id);
});

test('normal-motion celebration expires while a nearby Talk chip retains focus', t => {
  const f = fixture(t, { celebrate: 'math' });
  assert.equal(frame(f, 'pip'), '-192px 0px');
  assert.equal(frame(f, 'nori'), '-192px 0px');
  f.tap(talkPoint('pip')); advance(f, 7);
  const chip = f.root.querySelector('.village-talk');
  assert.equal(chip.getAttribute('aria-label'), 'Talk to Pip');
  chip.focus(); advance(f, 9);
  assert.equal(f.doc.activeElement, chip);
  assert.equal(frame(f, 'pip'), '-192px 0px', 'nearby Talk keeps joy after celebration');
  assert.notEqual(frame(f, 'nori'), '-192px 0px');
});


for (const status of ['delayed', 'failed', 'destroyed']) test(`celebration expires safely with ${status} road loading`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image'), images = [];
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class { constructor() { this.naturalWidth = 960; this.naturalHeight = 540; images.push(this); } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'Image', original) : delete globalThis.Image);
  const f = fixture(t, { loading: true, celebrate: 'math' });
  assert.equal(frame(f, 'pip'), '-192px 0px');
  assert.equal(frame(f, 'nori'), '-192px 0px');
  if (status === 'failed') { images[0].onerror(); await Promise.resolve(); await Promise.resolve(); }
  if (status === 'destroyed') f.scene.destroy();
  t.mock.timers.tick(1499);
  assert.equal(frame(f, 'pip'), '-192px 0px');
  t.mock.timers.tick(1);
  if (status === 'destroyed') {
    assert.equal(frame(f, 'pip'), '-192px 0px', 'timer does not redraw detached actors');
    assert.equal(frame(f, 'nori'), '-192px 0px');
  } else {
    assert.equal(frame(f, 'pip'), '-64px 0px');
    assert.equal(frame(f, 'nori'), '-64px 0px');
  }
  if (status !== 'failed') { images[0].onerror(); await Promise.resolve(); await Promise.resolve(); }
});

test('celebration holds a distant wanderer until it expires, then movement resumes', t => {
  const f = fixture(t, { celebrate: 'math' });
  const home = SIDE_SPOTS.pip, target = { x: home.x + 36, y: home.y };
  assert.ok(f.road.isWalkable(target) && f.road.straightClear(home, target));
  const original = f.road.randomWalkableNear.bind(f.road);
  t.mock.method(f.road, 'randomWalkableNear', (point, ...args) => point.x === home.x && point.y === home.y ? target : original(point, ...args));
  advance(f, 14);
  assert.deepEqual(f.pos('pip'), home);
  assert.equal(frame(f, 'pip'), '-192px 0px');
  f.tick(100);
  assert.notDeepEqual(f.pos('pip'), home);
});
