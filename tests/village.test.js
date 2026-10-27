import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageScene, dialogueBox, frameFor, WELCOME_LINE } from '../src/ui/screens/village.js';
import { showItemGet } from '../src/ui/screens/item-get.js';
import { createParadeScene } from '../src/ui/screens/parade.js';
import { createEncounterScene } from '../src/ui/screens/encounter.js';
import { createState, publishCreation, loadState, STORAGE_KEY } from '../src/progress.js';
import { paradeStatus } from '../src/ui/parade-lineup.js';
import { createDefaultBand } from '../src/audio.js';
import { HUD_ZONES, WALK_SHAPE, setRoad, road, loadRoad, roadPath, talkGoal, VILLAGE_SPOTS, SIDE_SPOTS, WANDER, PLAYER_START, clampWalk, hotspotRect, roamRect, wanderBounds, talkPoint, nearestNeighbor, stepPlayer, stallState, overlaps, wanderTarget, stepToward, guideArrow } from '../src/ui/village-map.js';
import { creationMarkup, fitSignPreviews } from '../src/ui/creations.js';
import { STAGE } from '../src/ui/stage.js';
import { CHARACTERS } from '../src/data.js';
import { BACKGROUND, ROAD_MASK, STALLS, EASELS } from '../src/ui/village-layout.js';
import { readPNG } from './helpers/png.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
const realRoad = createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url))));
setRoad(realRoad);

// A small seeded generator, so wander tests are repeatable.
const seeded = (seed = 7) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const CAST = [...CHARACTERS.map(c => c.id), 'pip', 'nori'];

test('all neighbor, side character and player footprints stand on the real road', () => {
  assert.deepEqual(Object.keys(VILLAGE_SPOTS).sort(), CHARACTERS.map(c => c.id).sort());
  assert.deepEqual(Object.keys(SIDE_SPOTS).sort(), ['nori', 'pip']);
  for (const [id, feet] of Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS, player: PLAYER_START })) {
    assert.ok(realRoad.isWalkable(feet), id);
    const figure = { x: feet.x - 32, y: feet.y - 57, w: 64, h: 64 };
    for (const zone of HUD_ZONES) assert.equal(overlaps(figure, zone), false, id);
    if (id === 'player') continue;
    const hot = hotspotRect(id);
    assert.ok(VILLAGE_SPOTS[id] ? hot.w >= 96 && hot.h >= 96 : hot.w >= 64 && hot.h >= 64, id);
  }
});

test('complete live roam rectangles fit below the HUD and never overlap', () => {
  for (const [i, id] of CAST.entries()) {
    const roam = roamRect(id), bounds = wanderBounds(id);
    const low = hotspotRect(id, { x: bounds.minX, y: bounds.minY });
    const high = hotspotRect(id, { x: bounds.maxX, y: bounds.maxY });
    assert.deepEqual(roam, { x: low.x, y: low.y, w: high.x + high.w - low.x, h: high.y + high.h - low.y });
    assert.ok(roam.x >= 0 && roam.y >= 72 && roam.x + roam.w <= STAGE.width && roam.y + roam.h <= STAGE.height, id);
    for (const hud of HUD_ZONES) assert.equal(overlaps(roam, hud), false, `${id} HUD`);
    for (const other of CAST.slice(i + 1)) assert.equal(overlaps(roam, roamRect(other)), false, `${id}/${other}`);
    for (const random of [() => 0, () => 1, () => 0.5]) {
      const p = wanderTarget(id, random);
      assert.ok(p.x - 32 >= 0 && p.x + 60 <= STAGE.width && p.y - 57 >= 72 && p.y + 7 <= STAGE.height, id);
    }
  }
});

test('hotspots follow the feet they are given', () => {
  assert.deepEqual(hotspotRect('math'), hotspotRect('math', VILLAGE_SPOTS.math));
  assert.deepEqual(hotspotRect('math', { x: 150, y: 302 }), { x: 94, y: 222, w: 112, h: 112 });
  assert.deepEqual(hotspotRect('pip', { x: 100, y: 200 }), { x: 64, y: 128, w: 72, h: 88 });
  assert.deepEqual(talkPoint('math', { x: 150, y: 302 }), { x: 150, y: 342 });
});

test('overlaps is strict: touching edges do not overlap', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 }), true);
});

test('500 seeded wander targets per character stay on clear road segments inside the home patch', () => {
  const random = seeded();
  for (const id of CAST) {
    const home = VILLAGE_SPOTS[id] ?? SIDE_SPOTS[id];
    for (let i = 0; i < 500; i++) {
      const t = wanderTarget(id, random);
      assert.ok(Math.abs(t.x - home.x) <= WANDER.x && Math.abs(t.y - home.y) <= WANDER.y, `${id} target ${t.x},${t.y}`);
      assert.ok(realRoad.isWalkable(t), id);
      assert.ok(t.x - 32 >= 0 && t.x + 60 <= STAGE.width && t.y - 57 >= 72 && t.y + 7 <= STAGE.height, `${id} visible actor`);
      assert.ok(realRoad.straightClear(home, t), id);
      const hot = hotspotRect(id, t), roam = roamRect(id);
      assert.ok(hot.x >= roam.x && hot.y >= roam.y && hot.x + hot.w <= roam.x + roam.w && hot.y + hot.h <= roam.y + roam.h, `${id} hotspot stays in its roam rect`);
    }
  }
  assert.ok(realRoad.isWalkable(wanderTarget('math', () => 0)));
  assert.deepEqual(wanderTarget('math', () => 0.5), VILLAGE_SPOTS.math);
});

test('stepToward walks a capped step and faces the way it goes', () => {
  assert.deepEqual(stepToward({ x: 100, y: 100 }, { x: 130, y: 100 }, 12), { pos: { x: 112, y: 100 }, facing: 'right', arrived: false });
  assert.deepEqual(stepToward({ x: 100, y: 100 }, { x: 90, y: 100 }, 12), { pos: { x: 90, y: 100 }, facing: 'left', arrived: true });
  assert.deepEqual(stepToward({ x: 100, y: 100 }, { x: 100, y: 100 }, 12), { pos: { x: 100, y: 100 }, facing: 'front', arrived: true });
});

test('the Find arrow points the way in eight directions', () => {
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: 100, y: 0 }), 'right');
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: 0, y: -100 }), 'up');
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: -100, y: 100 }), 'down-left');
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: 100, y: -100 }), 'up-right');
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: -100, y: 0 }), 'left');
  assert.equal(guideArrow({ x: 0, y: 0 }, { x: 10, y: 100 }), 'down');
});

test('the player can talk only when standing near a neighbor', () => {
  assert.equal(nearestNeighbor(talkPoint('community')), 'community');
  assert.equal(nearestNeighbor({ x: talkPoint('math').x + 30, y: talkPoint('math').y }), 'math');
  assert.equal(nearestNeighbor(PLAYER_START), null);
  const moved = { ...VILLAGE_SPOTS, math: { x: 170, y: 300 } };
  assert.equal(nearestNeighbor({ x: 170, y: 340 }, moved), 'math');
  assert.equal(nearestNeighbor(talkPoint('pip'), { ...VILLAGE_SPOTS, ...SIDE_SPOTS }), 'pip');
});

test('walking moves 24px, respects HUD bounds and stops at the road edge', () => {
  assert.deepEqual(stepPlayer(PLAYER_START, 'up'), { x: PLAYER_START.x, y: PLAYER_START.y - 24 });
  assert.deepEqual(stepPlayer(PLAYER_START, 'down'), PLAYER_START);
  assert.deepEqual(stepPlayer(PLAYER_START, 'a'), PLAYER_START);
  const from = { x: 420, y: 196 };
  let edge = from;
  for (let i = 0; i < 10; i++) { edge = stepPlayer(edge, 'left'); assert.ok(realRoad.isWalkable(edge)); }
  assert.notDeepEqual(edge, from);
  assert.deepEqual(stepPlayer(edge, 'left'), edge, 'a step off the road is refused');
  assert.ok(realRoad.straightClear(from, edge));
});

test('player cadence alternates feet at 80ms, scales with speed and never exceeds 120ms', () => {
  for (const [speed, period] of [[240, 80], [360, 80 / 1.5], [480, 40], [120, 120], [1, 120]]) {
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => frameFor((i + 0.5) * period, speed)), [1, 0, 2, 0, 1, 0, 2, 0]);
    assert.equal(frameFor(period - 0.001, speed), 1);
    assert.equal(frameFor(period + 0.001, speed), 0);
  }
  assert.equal(frameFor(79), 1);
  assert.equal(frameFor(80), 0);
  assert.equal(frameFor(100, 0), 0, 'standing when stopped');
});

test('all nine talk goals are reachable, in range and joined by clear road segments', () => {
  for (const id of CAST) {
    const goal = talkGoal(id), point = talkPoint(id);
    assert.ok(goal, id);
    assert.ok(Math.hypot(goal.x - point.x, goal.y - point.y) <= 72, id);
    assert.equal(nearestNeighbor(goal, { ...VILLAGE_SPOTS, ...SIDE_SPOTS }), id);
    const path = roadPath(PLAYER_START, goal, 0);
    assert.ok(path, id);
    assert.deepEqual(path.at(-1), goal);
    path.forEach((p, i) => {
      assert.ok(realRoad.isWalkable(p), id);
      assertVisiblePlayer(p);
      if (i) assert.ok(realRoad.straightClear(path[i - 1], p), id);
    });
  }
});

test('road projections stay on the mask and all accepted paths preserve HUD clearance', () => {
  for (let x = 0; x <= 960; x += 40) for (let y = 80; y <= 540; y += 40) {
    const point = { x, y }, snapped = clampWalk(point);
    if (realRoad.nearest(point, 96)) assert.ok(snapped, `near-road projection ${x},${y}`);
    if (snapped) { assert.ok(realRoad.isWalkable(snapped)); assertVisiblePlayer(snapped); assert.deepEqual(clampWalk(snapped), snapped); }
    const path = roadPath(PLAYER_START, point);
    if (!path) continue;
    for (let i = 1; i < path.length; i++) {
      assert.ok(realRoad.straightClear(path[i - 1], path[i]));
      for (let n = 0; n <= 20; n++) assertVisiblePlayer({ x: path[i - 1].x + (path[i].x - path[i - 1].x) * n / 20, y: path[i - 1].y + (path[i].y - path[i - 1].y) * n / 20 });
    }
  }
});

test('stalls tell made, visited in an older save, and new apart', () => {
  assert.equal(stallState('art', { art: { kind: 'art' } }, ['art']), 'made');
  assert.equal(stallState('math', {}, ['math']), 'visited');
  assert.equal(stallState('music', {}, []), 'new');
});

test('saved creations render safely', () => {
  assert.match(creationMarkup('writing', { text: '<img src=x onerror=alert(1)>' }), /&lt;img src=x onerror=alert\(1\)&gt;/);
  const stamps = Array.from({ length: 30 }, (_, i) => ({ shape: 'star', color: i ? '#e96163' : 'url(javascript:alert(1))', x: i * 3, y: 50, rotation: 0 }));
  assert.doesNotMatch(creationMarkup('art', { background: 'javascript:alert(1)', stamps }), /javascript:/);
  assert.match(creationMarkup('music', { tracks: [] }), /aria-label="Your eight beat song on display"/);
  assert.match(creationMarkup('science', { canopy: '"><script>' }), /&quot;&gt;&lt;script&gt;/);
  assert.match(creationMarkup('reading', { title: '<b>' }), /&lt;b&gt;/);
  for (const { id } of CHARACTERS) assert.equal(typeof creationMarkup(id, {}), 'string');
});

test('creation easels stand beside their stalls, a few pixels clear of every stall and each other', async () => {
  const { easelRect } = await import('../src/ui/village-map.js');
  const stall = id => STALLS[id];
  const roomy = r => ({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 });   // at least 4px between any two
  const ids = Object.keys(VILLAGE_SPOTS);
  for (const id of ids) {
    const easel = easelRect(id);
    assert.deepEqual([easel.w, easel.h], [80, 56], `${id} easel size`);
    for (const other of ids) {
      assert.equal(overlaps(roomy(easel), roomy(stall(other))), false, `${id} easel vs ${other} stall`);
      if (other !== id) assert.equal(overlaps(roomy(easel), roomy(easelRect(other))), false, `${id} easel vs ${other} easel`);
    }
  }
});

test('a welcome map draws the square with each saved item where it was put', () => {
  const placements = [{ item: 'quiet', x: 30, y: 10 }, { item: 'bench', x: 70, y: 30 }, { item: 'sign', x: 50, y: 70 }];
  const html = creationMarkup('community', { placements });
  assert.match(html, /^<svg class="creation creation--community" viewBox="0 0 100 100"/);
  assert.match(html, /aria-label="Your welcoming village plan"/);
  for (const { item, x, y } of placements) assert.match(html, new RegExp(`class="map-item map-item--${item}" x="${x - 8}" y="${y - 8}"`), item);
  const junk = creationMarkup('community', { placements: [{ item: 'bench', x: 'x"><script>', y: 400 }] });
  assert.doesNotMatch(junk, /script|NaN/);
});

// ---- 1D: the village loop (board label, started stalls, the Talk chip and A) ----

test('the festival board says how many of the seven are made, and celebrates at seven', async () => {
  const { boardLabel, BOARD_TOTAL } = await import('../src/ui/village-map.js');
  assert.equal(BOARD_TOTAL, CHARACTERS.length);
  assert.equal(boardLabel(0), 'Festival board · 0 of 7');
  assert.equal(boardLabel(3), 'Festival board · 3 of 7');
  assert.equal(boardLabel(7), '7 of 7 · Festival complete!');
  assert.equal(boardLabel(9), '7 of 7 · Festival complete!', 'never counts past seven');
  assert.equal(boardLabel(-2), 'Festival board · 0 of 7');
  assert.equal(boardLabel(undefined), 'Festival board · 0 of 7');
  for (const n of [0, 4, 7]) assert.ok(boardLabel(n).length <= 56, `fits one Bigger-words page: ${boardLabel(n)}`);
});

test('a stall with a draft looks started: three dots and "Started. Tap to continue."', async () => {
  const { stallBadge, STALL_BADGE } = await import('../src/ui/village-map.js');
  const draft = { math: { leftLoad: [2] } };
  assert.equal(stallState('math', {}, [], draft), 'started');
  assert.equal(stallState('math', {}, [], {}), 'new', 'no draft: still new');
  assert.equal(stallState('math', {}, [], undefined), 'new', 'the old three-argument call still works');
  assert.equal(stallState('math', { math: { leftLoad: [2] } }, ['math'], draft), 'made', 'a creation beats a draft');
  assert.equal(stallState('math', {}, ['math'], draft), 'visited', 'an older finished save beats a draft');
  assert.equal(stallState('art', {}, [], draft), 'new', 'another stall is untouched');
  assert.deepEqual(stallBadge('started'), { mark: '...', said: 'Started. Tap to continue.' });
  assert.deepEqual(stallBadge('new'), { mark: '!', said: 'Something new to make.' });
  assert.deepEqual(stallBadge('visited'), { mark: 'Visited', said: 'Visited.' });
  assert.equal(stallBadge('made'), null, 'a made stall shows a check and names the creation instead');
  assert.deepEqual(Object.keys(STALL_BADGE).sort(), ['new', 'started', 'visited']);
});

test('Pip\'s welcome and the village Help use short sentences a page can hold', async () => {
  const { WELCOME_LINE, HELP_STEPS } = await import('../src/ui/screens/village.js');
  const { paginate, PAGE_CHARS } = await import('../src/ui/dialogue.js');
  assert.equal(WELCOME_LINE, 'Welcome to Willow Bay! Tap a neighbor to help them make something.');
  const sentences = WELCOME_LINE.split(/(?<=[.!?])\s+/);
  assert.equal(sentences.length, 2);
  for (const s of sentences) assert.ok(s.length <= 56, `${s} fits a Bigger-words page`);
  assert.deepEqual(paginate(WELCOME_LINE, PAGE_CHARS.large), sentences, 'Bigger words breaks between the two sentences');
  assert.equal(paginate(WELCOME_LINE, PAGE_CHARS.normal).length, 1, 'one page at the normal size');
  assert.deepEqual(HELP_STEPS, [
    'Tap a neighbor to walk over and talk.',
    'Tap the path, or use arrow keys to walk.',
    'Press Enter near a neighbor to talk.',
    'Make one thing and the Parade opens.',
    'Make all seven for the big finale.',
    'Open the Guide to find a neighbor or see your stamps.',
    'An exclamation mark means something new to make.',
    'Three dots mean you can keep working.',
    'A check mark means you made something.',
  ]);
  for (const step of HELP_STEPS) assert.ok(step.length <= 56, `${step} fits a Bigger-words page`);
});

test('A owns actor and root focus regardless of range, but leaves other controls alone', async () => {
  const { talkKeyWins, aAction } = await import('../src/ui/screens/village.js');
  // `button` is what village.js passes: true only for an actor button (a neighbor, Pip, Nori) or the Talk chip itself.
  const onActorButton = { button: true, inVillage: true, inDialogue: false };
  const onHudButton = { button: false, inVillage: true, inDialogue: false };   // Guide, Comfort, Pause, the grade chip, Parade
  for (const near of [null, 'math', 'pip']) {
    assert.equal(talkKeyWins(near, onActorButton), true, 'actor focus never permits an A-key click');
    assert.equal(talkKeyWins(near, { onRoot: true, inVillage: true }), true, 'root focus follows the same rule');
    assert.equal(talkKeyWins(near, onHudButton), false, 'Guide, Pause and Parade keep their keys');
  }
  assert.equal(talkKeyWins('math', { button: true, inVillage: false, inDialogue: false }), false, 'a button outside the village (a window) keeps its keys');
  assert.equal(talkKeyWins('math', { button: true, inVillage: true, inDialogue: true }), false, 'More and Hear keep their keys');
  assert.equal(talkKeyWins(null), false);
  // A turns unread pages first, then talks only to the chip's neighbor, else gives a walking hint.
  assert.deepEqual(aAction({ near: 'math', nearest: 'math' }), { act: 'talk', id: 'math' });
  assert.deepEqual(aAction({ near: 'science', nearest: 'math' }), { act: 'talk', id: 'science' });
  assert.deepEqual(aAction({ near: null, nearest: 'math' }), { act: 'hint' }, 'a hidden Talk chip never falls back to another neighbor');
  assert.deepEqual(aAction({ near: 'math', dialogueOpen: true, hasMore: true }), { act: 'next' });
  assert.deepEqual(aAction({ dialogueOpen: true, hasMore: true }), { act: 'next' }, 'unread pages win even when nobody is near');
  assert.deepEqual(aAction({ near: 'math', dialogueOpen: true, hasMore: false }), { act: 'talk', id: 'math' });
  assert.deepEqual(aAction({ dialogueOpen: true }), { act: 'hint' });
  assert.deepEqual(aAction({ dialogueOpen: false, hasMore: true }), { act: 'hint' }, 'hidden pages do not reopen');
  assert.deepEqual(aAction(), { act: 'hint' });
});

test('a saved draft in this grade marks its stall started, and switching grade clears it', async () => {
  const { createState, saveDraft, publishCreation, getDraft, getCreations, getCompleted } = await import('../src/progress.js');
  const draftsOf = state => Object.fromEntries(CHARACTERS.map(c => [c.id, getDraft(state, c.id)]).filter(([, d]) => d));   // as the village builds it
  const statusOf = (state, id) => stallState(id, getCreations(state), getCompleted(state), draftsOf(state));
  const grade3 = { ...createState(), chapter: 1, grade: 3 };
  assert.equal(statusOf(grade3, 'math'), 'new');
  const drafted = saveDraft(grade3, 'math', { kind: 'math', chapter: 1, grade: 3, left: [2], right: [], rolled: false });
  assert.equal(statusOf(drafted, 'math'), 'started');
  assert.equal(statusOf(drafted, 'art'), 'new');
  assert.equal(statusOf({ ...drafted, grade: 1 }, 'math'), 'new', 'drafts are per grade');
  const made = publishCreation(drafted, 'math', { kind: 'math', chapter: 1, grade: 3, left: [2], right: [2], rolled: true });
  assert.equal(statusOf(made, 'math'), 'made');
});

test('the village opens with the celebrated neighbor, else Pip\'s welcome until something is made, else quietly', async () => {
  const { openingLine, WELCOME_LINE, CELEBRATE_LINE } = await import('../src/ui/screens/village.js');
  assert.deepEqual(openingLine({ creations: {} }), { id: 'pip', words: WELCOME_LINE });
  assert.deepEqual(openingLine(), { id: 'pip', words: WELCOME_LINE }, 'no arguments: a fresh grade');
  assert.equal(openingLine({ creations: { math: { kind: 'math' } } }), null, 'once anything is made, Pip stays quiet');
  assert.deepEqual(openingLine({ creations: {}, celebrate: 'art' }), { id: 'art', words: CELEBRATE_LINE }, 'a fresh creation speaks first, not the welcome');
  assert.deepEqual(openingLine({ creations: { art: { kind: 'art' } }, celebrate: 'art' }), { id: 'art', words: CELEBRATE_LINE });
  assert.deepEqual(openingLine({ creations: {}, celebrate: 'nobody' }), { id: 'pip', words: WELCOME_LINE }, 'an unknown celebrate id falls back');
  assert.ok(CELEBRATE_LINE.length <= 56);
});

test('a started neighbor button shows three dots and says "Started. Tap to continue."', async () => {
  const { neighborMarkup } = await import('../src/ui/screens/village.js');
  const math = CHARACTERS.find(c => c.id === 'math');
  const started = neighborMarkup(math, { creations: {}, completed: [], drafts: { math: { leftLoad: [2] } } });
  assert.match(started, /class="village-actor village-npc village-npc--started" data-id="math"/);
  assert.match(started, /aria-label="Taro, Math\. Started\. Tap to continue\."/);
  assert.match(started, /village-badge__mark--started">\.\.\.</);
  const fresh = neighborMarkup(math, { creations: {}, completed: [], drafts: {} });
  assert.match(fresh, /village-npc--new/);
  assert.match(fresh, /Something new to make\./);
  assert.match(fresh, /village-badge__mark--new">!</);
  const made = neighborMarkup(math, { creations: { math: { kind: 'math' } }, completed: ['math'], drafts: { math: { leftLoad: [2] } } });
  assert.match(made, /village-npc--made/);
  assert.match(made, /village-badge__mark--made/);
  assert.doesNotMatch(made, /Started/);
  assert.equal(typeof neighborMarkup(math), 'string', 'no progress at all still renders');
});

test('banded creations use their own safe drawings and preserve legacy fallbacks', async () => {
  const { pizzaCreationMarkup } = await import('../src/pizza.js');
  const { chainCreationMarkup } = await import('../src/chain.js');
  const { helpdayCreationMarkup, HELP_FITS } = await import('../src/helpday.js');
  const { talesCreationMarkup } = await import('../src/tales.js');
  const cases = [
    ['math', { kind: 'math', activity: 'pizza', chapter: 1, grade: 3, slices: 8, halves: false, plates: [4, 4, 4, 4], tried: true }, pizzaCreationMarkup],
    ['science', { activity: 'chain', chain: ['plant', 'fish', 'gull'], energy: [1000, 100, 10] }, chainCreationMarkup],
    ['community', { activity: 'helpday', crew: Object.entries(HELP_FITS).map(([job, helper]) => ({ job, helper })) }, helpdayCreationMarkup],
    ['reading', { activity: 'tales', deck: 0, solved: ['momo-kitchen'] }, talesCreationMarkup],
  ];
  for (const [kind, snapshot, render] of cases) assert.equal(creationMarkup(kind, snapshot), render(snapshot));
  const pizza = creationMarkup(cases[0][0], cases[0][1]);
  assert.match(pizza, /aria-label="Your pizza party, 2 slices each"/);
  assert.equal((pizza.match(/A6 6/g) ?? []).length, 4);
  const chart = creationMarkup('science', { chain: ['<script>'], energy: [Infinity] });
  assert.match(chart, /creation--chain/);
  assert.doesNotMatch(chart, /<script|Infinity/);
  assert.match(creationMarkup('science', { canopy: 'left', time: 10 }), /world-ices/);
  assert.match(creationMarkup('reading', { activity: 'tales', solved: [] }), /world-book/);
  assert.match(creationMarkup('reading', { found: ['key'] }), /world-book/);
});


// Scene regressions use the same small fake DOM as fixes-behavior.test.js.
// It models the browser's focus loss when a focused control becomes hidden.
import { Doc, Event, Target, pressKey } from './helpers/dom.js';
import { speak } from '../src/ui/voice.js';


function villageFixture(t, { calm = false, large = false, state = createState(), voice = () => false, walkable = realRoad, ...options } = {}) {
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

test('the scene uses the fixed-size background and the supplied furniture geometry', t => {
  let state = createState();
  for (const id of Object.keys(EASELS)) state = publishCreation(state, id, { kind: id });
  const f = villageFixture(t, { state });
  const image = f.root.querySelector('.village-map');
  assert.equal(image.tagName, 'IMG');
  assert.equal(image.getAttribute('src'), BACKGROUND);
  assert.equal(image.getAttribute('width'), '960');
  assert.equal(image.getAttribute('height'), '540');
  assert.equal(image.getAttribute('draggable'), 'false');
  assert.match(cssBlock(readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8'), '.village-map'), /image-rendering:\s*auto/);
  for (const id of Object.keys(STALLS)) {
    for (const [selector, rect] of [['.village-stall', STALLS[id]], ['.village-easel', EASELS[id]]]) {
      const el = f.root.querySelector(`${selector}[data-id="${id}"]`);
      assert.match(el.getAttribute('style'), new RegExp(`left:${rect.x}px;top:${rect.y}px`));
    }
  }
});

function pendingRoad(t) {
  setRoad(null);
  const images = [], original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    constructor() { this.naturalWidth = 960; this.naturalHeight = 540; images.push(this); }
  } });
  t.after(() => {
    setRoad(realRoad);
    if (original) Object.defineProperty(globalThis, 'Image', original); else delete globalThis.Image;
  });
  return images;
}
function supplyRoadPixels(t, doc) {
  const create = doc.createElement.bind(doc), png = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));
  t.mock.method(doc, 'createElement', tag => tag === 'canvas' ? {
    getContext: () => ({ drawImage() {}, getImageData: () => ({ ...png, data: png.rgba }) }),
  } : create(tag));
}

test('player and wanderers wait for the mask, then reuse the cached browser road', async t => {
  const images = pendingRoad(t), f = villageFixture(t, { walkable: null });
  assert.equal(road(), null);
  const before = f.pos(), actors = f.root.querySelectorAll('.village-actor').map(el => [el.style.left, el.style.top]);
  f.scene.handleIntent('left');
  f.tap(500, 320);
  f.root.querySelector('.village-actor[data-id="writing"]').click();
  for (let i = 0; i < 50; i++) f.tick(100);
  assert.deepEqual(f.pos(), before);
  assert.deepEqual(f.root.querySelectorAll('.village-actor').map(el => [el.style.left, el.style.top]), actors);
  assert.equal(f.frames.size, 0);
  assert.deepEqual(stepPlayer(PLAYER_START, 'up'), PLAYER_START);
  assert.deepEqual(wanderTarget('math'), VILLAGE_SPOTS.math);
  assert.equal(roadPath(PLAYER_START, talkPoint('math')), null);
  assert.equal(images[0].src, ROAD_MASK);
  supplyRoadPixels(t, f.doc);
  images[0].onload();
  await f.mounted;
  assert.equal(f.frames.size, 1);
  assert.ok(road().isWalkable(PLAYER_START));
  assert.equal(await loadRoad(), road());
  assert.equal(images.length, 1);
  f.scene.handleIntent('up'); f.tick(100);
  assert.notDeepEqual(f.pos(), before);
  assertVisiblePlayer(f.pos());
});

test('a failed mask keeps the scene still; a destroyed loading scene never starts a tick', async t => {
  const images = pendingRoad(t), f = villageFixture(t, { walkable: null });
  images[0].onerror();
  await f.mounted;
  f.scene.handleIntent('up'); f.tick(100);
  assert.deepEqual(f.pos(), PLAYER_START);
  assert.equal(f.frames.size, 0);
  f.scene.destroy();
  const g = villageFixture(t, { walkable: null });
  assert.equal(images.length, 2, 'failed loads can be retried');
  g.scene.destroy();
  supplyRoadPixels(t, g.doc);
  images[1].onload();
  await g.mounted;
  assert.equal(g.frames.size, 0);
});

test('successive wandering frames keep every character on the real road', t => {
  const f = villageFixture(t);
  t.mock.method(Math, 'random', seeded(17));
  for (let i = 0; i < 2000; i++) {
    f.tick(100);
    for (const el of f.root.querySelectorAll('.village-actor')) {
      const side = Boolean(SIDE_SPOTS[el.dataset.id]);
      const pos = { x: parseFloat(el.style.left) + (side ? 36 : 56), y: parseFloat(el.style.top) + (side ? 72 : 80) };
      assert.ok(realRoad.isWalkable(pos), `${el.dataset.id}: ${JSON.stringify(pos)}`);
    }
  }
});

const A_KEY_CASES = [['Enter', 'Enter'], [' ', 'Space'], ['z', 'Z'], ['Z', 'Shift+Z']];
const WALK_HINT = 'Walk up to a neighbor, then press Enter.';
test('dialogueBox chooses the clear corner and preserves the preference on ties', () => {
  assert.equal(dialogueBox(PLAYER_START, WELCOME_LINE), 'top');
  assert.equal(dialogueBox(null, WALK_HINT), 'bottom');
  assert.equal(dialogueBox({ x: 100, y: 170 }, WELCOME_LINE), 'bottom');
  assert.equal(dialogueBox({ x: 820, y: 170 }, WALK_HINT), 'top');
});

test('hint placement minimizes overlap across the stage, including tabs and the More chip', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/interaction.css', import.meta.url), 'utf8');
  const top = cssBlock(css, '.village-dialogue--top'), bottom = cssBlock(css, '.village-dialogue');
  const w = cssPx(bottom, 'width'), h = cssPx(cssBlock(kit, '.dlg'), 'height');
  const above = -cssPx(cssBlock(kit, '.dlg__speaker, .dlg__tabs'), 'top');
  const below = -cssPx(cssBlock(kit, '.dlg__more'), 'bottom');
  const boxes = {
    top: { x: cssPx(top, 'left'), y: cssPx(top, 'top') - above },
    bottom: { x: 960 - cssPx(bottom, 'right') - w, y: 540 - cssPx(bottom, 'bottom') - h - above },
  };
  for (let x = 0; x <= 960; x += 4) for (let y = 0; y <= 540; y += 4) {
    const area = box => Math.max(0, Math.min(x + 32, box.x + w) - Math.max(x - 32, box.x))
      * Math.max(0, Math.min(y + 7, box.y + h + above + below) - Math.max(y - 57, box.y));
    const choice = dialogueBox({ x, y }, WALK_HINT);
    assert.equal(area(boxes[choice]), Math.min(area(boxes.top), area(boxes.bottom)), `${x},${y}`);
  }
});
const readAloudState = () => {
  const state = createState();
  return { ...state, settings: { ...state.settings, autoRead: true } };
};

function openingClock(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const schedule = globalThis.setTimeout, callbacks = [];
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    const callback = t.mock.fn(fn);
    callbacks.push(callback);
    return schedule(callback, delay);
  });
  return { advance: ms => t.mock.timers.tick(ms), callbacks };
}

function speechFixture(t) {
  const utterances = [];
  for (const [key, value] of Object.entries({
    SpeechSynthesisUtterance: class extends Target { constructor(text) { super(); this.text = text; } },
    speechSynthesis: { cancel() {}, speak: utterance => utterances.push(utterance),
      getVoices: () => [{ name: 'Test narrator', lang: 'en-US', localService: true }] },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  return utterances;
}

for (const calm of [false, true]) for (const large of [false, true]) {
  test(`welcome waits for dismissal through time and movement (calm=${calm}, large=${large})`, t => {
    const clock = openingClock(t), f = villageFixture(t, { calm, large });
    const box = f.root.querySelector('.village-dialogue');
    if (large) {
      clock.advance(60000);
      assert.equal(box.hidden, false);
      f.root.querySelector('.dlg__more').click();
    }
    clock.advance(60000);
    f.scene.handleIntent('up'); f.tick(100);
    assert.equal(box.hidden, false, 'walking does not dismiss directions');
    f.tap(500, 320); f.tick(100);
    assert.equal(box.hidden, false, 'ground taps do not dismiss directions');
    const done = f.root.querySelector('[data-act="dismiss-welcome"]');
    assert.equal(done.hidden, false);
    done.focus(); done.click();
    assert.equal(box.hidden, true);
    assert.equal(f.doc.activeElement, f.root);
    assert.equal(clock.callbacks.length, 0, 'welcome has no deadline');
  });
}

for (const via of ['more', 'text']) test(`turning the welcome via ${via} keeps the last page until dismissal`, t => {
  const clock = openingClock(t), f = villageFixture(t, { large: true });
  f.root.querySelector('.dlg__more').focus();
  f.root.querySelector(via === 'more' ? '.dlg__more' : '.dlg__text').click();
  clock.advance(60000);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  f.scene.handleIntent('b');
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  assert.equal(f.doc.activeElement, f.root);
});

for (const large of [false, true]) test(`a rebuilt village's creation celebration closes and leaves Kiko · Music visible (large=${large})`, t => {
  const clock = openingClock(t);
  const state = publishCreation(createState(), 'music', { kind: 'music' });
  const f = villageFixture(t, { state, celebrate: 'music', large });
  assert.equal(f.root.querySelector('.dlg__speaker').textContent, 'Kiko');
  assert.equal(f.root.querySelector('.dlg__text').textContent, 'That’s going straight into the festival!');
  clock.advance((large ? 6000 : 4000) - 1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  clock.advance(1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  f.tick();
  const kiko = f.root.querySelector('.village-actor[data-id="music"]');
  assert.equal(kiko.classList.contains('village-actor--near'), false);
  assert.equal(kiko.querySelector('.village-name').hidden, false);
  assert.equal(kiko.querySelector('.village-name').textContent, 'Kiko · Music');
});

test('a child-started neighbor conversation cancels the opening timeout and stays open', t => {
  const clock = openingClock(t), f = villageFixture(t, { calm: true });
  clock.advance(1000);
  f.root.querySelector('.village-actor[data-id="pip"]').click();
  f.tick();
  const line = f.root.querySelector('.dlg__text').textContent;
  assert.equal(line, WELCOME_LINE, 'Pip replays the directions');
  assert.equal(f.root.querySelector('.village-dialogue').classList.contains('village-dialogue--top'), dialogueBox(f.pos(), line) === 'top', 'Pip uses a corner clear of the player');
  clock.advance(60000);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  assert.equal(f.root.querySelector('.dlg__text').textContent, line);
  assert.ok(clock.callbacks.every(callback => callback.mock.callCount() === 0));
  assert.equal(f.root.querySelector('.village-talk').hidden, false, 'ordinary proximity still shows Talk');
  assert.equal(f.root.querySelector('.village-actor[data-id="pip"]').classList.contains('village-actor--near'), true);
});

for (const input of ['Escape', 'step', 'destroy', 'pause', 'guide', 'help', 'window']) {
  test(`${input} cancels the opening timer before it can fire`, t => {
    const clock = openingClock(t), f = villageFixture(t, { calm: true });
    const box = f.root.querySelector('.village-dialogue');
    clock.advance(1000);
    if (input === 'Escape') f.scene.handleIntent('b'); // app maps Escape to B
    if (input === 'step') f.scene.handleIntent('left');
    if (input === 'destroy') f.scene.destroy();
    if (input === 'pause') f.scene.pause();
    if (input === 'guide' || input === 'help') f.root.querySelector(`[data-act="${input}"]`).click();
    if (input === 'window') {
      const backdrop = f.doc.createElement('div');
      backdrop.className = 'win-backdrop';
      f.stage.append(backdrop); f.tick();
    }
    if (input === 'Escape') assert.equal(box.hidden, true, 'explicit dismissal closes immediately');
    if (input === 'step') assert.equal(box.hidden, false, 'movement leaves welcome visible');
    clock.advance(60000);
    assert.ok(clock.callbacks.every(callback => callback.mock.callCount() === 0), 'cancelled callback never runs');
  });
}

test('last-page A replaces directions with a three-second walking hint', t => {
  const clock = openingClock(t), f = villageFixture(t, { calm: true });
  clock.advance(2000);
  f.scene.handleIntent('a');
  assert.equal(f.root.querySelector('.dlg__text').textContent, WALK_HINT);
  clock.advance(2999);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  clock.advance(1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  assert.equal(clock.callbacks.at(-1).mock.callCount(), 1);
});

for (const large of [false, true]) test(`the Enter hint closes by itself after 3 s and uses a clear corner on the crossroads (large=${large})`, t => {
  const clock = openingClock(t), f = villageFixture(t, { calm: true, large });
  const box = f.root.querySelector('.village-dialogue');
  f.scene.handleIntent('b');
  for (const [feet, top] of [[PLAYER_START, true], [{ x: 500, y: 225 }, false], [{ x: 500, y: 510 }, true]]) {
    f.tap(feet.x, feet.y); f.tick();
    assert.deepEqual(f.pos(), feet);
    assert.equal(f.root.querySelector('.village-talk').hidden, true);
    pressKey(f.root, 'keydown', 'Enter');
    assert.equal(f.root.querySelector('.dlg__text').textContent, WALK_HINT);
    assert.equal(box.classList.contains('village-dialogue--top'), top);
    assert.equal(box.hidden, false);
    clock.advance(2999);
    assert.equal(box.hidden, false);
    clock.advance(1);
    assert.equal(box.hidden, true);
    assert.equal(f.doc.activeElement, f.root);
  }
});

for (const input of ['step', 'B']) test(`a ${input} cancels the hint timer`, t => {
  const clock = openingClock(t), f = villageFixture(t, { calm: true });
  f.scene.handleIntent('a');
  clock.advance(1000);
  f.scene.handleIntent(input === 'step' ? 'up' : 'b');
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  clock.advance(60000);
  assert.ok(clock.callbacks.every(callback => callback.mock.callCount() === 0));
});

test('the hint waits three seconds after speech; B cancels late speech and its timer', t => {
  const clock = openingClock(t), utterances = speechFixture(t);
  const f = villageFixture(t, { large: true, state: readAloudState(), voice: speak });
  f.scene.handleIntent('b');
  f.scene.handleIntent('a');
  clock.advance(3000);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false, 'still being read');
  utterances.at(-1).fire(new Event('end'));
  clock.advance(2999);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  clock.advance(1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  f.scene.handleIntent('a');
  const hintTimer = clock.callbacks.at(-1);
  f.scene.handleIntent('b');
  const scheduled = clock.callbacks.length;
  utterances.at(-1).fire(new Event('end'));
  assert.equal(clock.callbacks.length, scheduled);
  clock.advance(60000);
  assert.equal(hintTimer.mock.callCount(), 0);
});

for (const large of [false, true]) test(`welcome stays after speech ends (large=${large})`, t => {
  const clock = openingClock(t), utterances = speechFixture(t);
  const f = villageFixture(t, { large, state: readAloudState(), voice: speak });
  if (large) {
    utterances[0].fire(new Event('end'));
    clock.advance(60000);
    assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
    f.scene.handleIntent('a');
  }
  clock.advance(4000);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false, 'still being read');
  utterances.at(-1).fire(new Event('end'));
  clock.advance((large ? 6000 : 4000) - 1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  clock.advance(1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  assert.equal(clock.callbacks.length, 0);
});

for (const voiceKind of ['no end event', 'boolean success', 'unavailable']) test(`welcome stays without speech completion: ${voiceKind}`, t => {
  const clock = openingClock(t);
  speechFixture(t);
  const voice = voiceKind === 'no end event' ? speak : () => voiceKind === 'boolean success';
  const f = villageFixture(t, { state: readAloudState(), voice });
  const words = f.root.querySelector('.dlg__text').textContent.split(/\s+/).length;
  const delay = 4000 + (voiceKind === 'unavailable' ? 0 : words * 500 + 500);
  clock.advance(delay - 1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  clock.advance(1);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  assert.equal(clock.callbacks.length, 0);
});

test('Hear leaves the welcome open; Escape dismisses it even with late speech', t => {
  const clock = openingClock(t), utterances = speechFixture(t);
  const f = villageFixture(t, { state: readAloudState(), voice: speak });
  clock.advance(3000);
  f.root.querySelector('[data-act="hear"]').click();
  utterances[0].fire(new Event('end'));
  clock.advance(4000);
  assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
  f.scene.handleIntent('b');
  const scheduled = clock.callbacks.length;
  utterances.at(-1).fire(new Event('end'));
  assert.equal(clock.callbacks.length, scheduled);
  clock.advance(60000);
  assert.ok(clock.callbacks.every(callback => callback.mock.callCount() === 0));
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
});

for (const calm of [false, true]) for (const focus of ['root']) for (const [key, label] of A_KEY_CASES) {
  test(`${label} with ${focus} focus and nobody near gives one hint without clicking or walking (calm=${calm})`, t => {
    const f = villageFixture(t, { calm, focus: focus === 'actor' ? 'writing' : undefined, state: readAloudState() });
    const target = f.doc.activeElement, before = f.pos();
    assert.equal(target, focus === 'actor' ? f.root.querySelector('.village-actor[data-id="writing"]') : f.root);
    assert.equal(f.root.querySelector('.village-talk').hidden, true);
    f.scene.handleIntent('b');
    f.spoken.length = 0;
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    for (let press = 1; press <= 2; press++) {
      assert.equal(pressKey(target, 'keydown', key).defaultPrevented, true);
      for (let i = 0; i < 3; i++) assert.equal(pressKey(target, 'keydown', key, { repeat: true }).defaultPrevented, true);
      const up = pressKey(target, 'keyup', key);
      if (key === ' ') assert.equal(up.defaultPrevented, true, 'the claimed Space release cannot click');
      assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
      assert.equal(f.root.querySelector('.dlg__text').textContent, WALK_HINT);
      assert.ok(WALK_HINT.length < 56);
      assert.equal(f.root.querySelector('.dlg__more').hidden, true, 'the hint fits one page');
      assert.deepEqual(f.spoken, Array(press).fill(WALK_HINT), 'held keys never repeat the hint');
      for (let i = 0; i < 12; i++) f.tick(100);
      assert.deepEqual(f.pos(), before, 'no instant jump or delayed tap-walk');
      assert.deepEqual(f.gone, []);
      assert.equal(clicks, 0);
      assert.equal(f.doc.activeElement, target, 'the hint leaves focus where it was');
    }
  });
}

for (const focus of ['root', 'chip']) for (const [key, label] of A_KEY_CASES) {
  test(`${label} with ${focus} focus talks to the Talk-chip neighbor without a click or walk`, t => {
    const f = villageFixture(t, { calm: true });
    const goal = talkPoint('community');
    f.tap(goal.x, goal.y); f.tick();
    const chip = f.root.querySelector('.village-talk');
    assert.equal(chip.getAttribute('aria-label'), 'Talk to Hana');
    const target = focus === 'actor' ? f.root.querySelector('.village-actor[data-id="writing"]') : focus === 'chip' ? chip : f.root;
    target.focus();
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    assert.equal(pressKey(target, 'keydown', key).defaultPrevented, true);
    pressKey(target, 'keyup', key);
    assert.deepEqual(f.gone, [['encounter', { id: 'community' }]], 'Hana answers from the movement surface or Talk chip');
    assert.deepEqual(f.pos(), goal);
    assert.equal(clicks, 0);
  });
}

for (const focus of ['root']) for (const [key, label] of A_KEY_CASES) {
  test(`${label} with ${focus} focus reads the next page before showing the walking hint`, t => {
    const f = villageFixture(t, { calm: true, large: true, focus: focus === 'actor' ? 'writing' : undefined, state: readAloudState() });
    const target = f.doc.activeElement, text = f.root.querySelector('.dlg__text'), more = f.root.querySelector('.dlg__more');
    assert.equal(text.textContent, 'Welcome to Willow Bay!');
    assert.equal(more.hidden, false);
    pressKey(target, 'keydown', key);
    pressKey(target, 'keydown', key, { repeat: true });
    pressKey(target, 'keyup', key);
    assert.equal(text.textContent, 'Tap a neighbor to help them make something.', 'the current box advances instead of restarting');
    assert.equal(more.hidden, true);
    assert.equal(f.spoken.length, 2, 'one opening page and one page turn');
    pressKey(target, 'keydown', key); pressKey(target, 'keyup', key);
    assert.equal(text.textContent, WALK_HINT);
    assert.equal(f.spoken.length, 3);
    assert.deepEqual(f.gone, []);
    assert.deepEqual(f.pos(), PLAYER_START);
  });
}

test('direct A intents use the same hint, page and Talk-chip rules', t => {
  const f = villageFixture(t, { calm: true, large: true });
  const text = f.root.querySelector('.dlg__text');
  f.scene.handleIntent('a');
  assert.equal(text.textContent, 'Tap a neighbor to help them make something.');
  f.scene.handleIntent('a');
  assert.equal(text.textContent, WALK_HINT);
  assert.deepEqual(f.pos(), PLAYER_START);
  f.tap(...Object.values(talkPoint('community'))); f.tick();
  f.scene.handleIntent('a');
  assert.deepEqual(f.gone, [['encounter', { id: 'community' }]]);
});

test('A never falls back to a nearby neighbor while the Talk chip is hidden mid-walk', t => {
  const f = villageFixture(t, { calm: true });
  f.tap(...Object.values(talkPoint('community'))); f.tick();
  f.stage.classList.remove('calm');
  f.scene.handleIntent('right'); f.tick();
  assert.equal(nearestNeighbor(f.pos()), 'community', 'Hana is still within range');
  assert.equal(f.root.querySelector('.village-talk').hidden, true, 'walking hides the chip');
  f.scene.handleIntent('a');
  assert.equal(f.root.querySelector('.dlg__text').textContent, WALK_HINT);
  assert.deepEqual(f.gone, []);
});

test('a claimed Space release stays swallowed after focus or another A key changes', t => {
  const f = villageFixture(t, { calm: true, focus: 'writing' });
  const actor = f.doc.activeElement;
  pressKey(actor, 'keydown', ' ');
  pressKey(actor, 'keydown', 'Enter');
  const guide = f.root.querySelector('[data-act="guide"]');
  guide.focus();
  assert.equal(pressKey(guide, 'keyup', ' ').defaultPrevented, true);
  assert.deepEqual(f.opened, []);
  assert.equal(pressKey(guide, 'keyup', ' ').defaultPrevented, false, 'only the paired release is claimed');
});

for (const [key, label] of A_KEY_CASES.slice(0, 2)) for (const act of ['grade', 'guide', 'comfort', 'pause', 'parade', 'hear', 'help', 'more']) {
  test(`${act} keeps native ${label} activation`, t => {
    const state = publishCreation(readAloudState(), 'art', { kind: 'art' });
    const f = villageFixture(t, { calm: true, large: true, state });
    f.tap(...Object.values(talkPoint('pip'))); f.tick();
    f.scene.handleIntent('a');
    const text = f.root.querySelector('.dlg__text'), before = text.textContent;
    assert.equal(f.root.querySelector('.dlg__more').hidden, false);
    const target = f.root.querySelector(act === 'parade' ? '.village-parade' : act === 'more' ? '.dlg__more' : `[data-act="${act}"]`);
    target.focus();
    assert.equal(f.doc.activeElement, target);
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    assert.equal(pressKey(target, 'keydown', key).defaultPrevented, false);
    assert.equal(pressKey(target, 'keyup', key).defaultPrevented, false);
    assert.equal(clicks, 1);
    if (act === 'parade') assert.deepEqual(f.gone, [['parade']]);
    else if (act === 'hear') assert.equal(f.spoken.at(-1), before);
    else if (act === 'more') assert.notEqual(text.textContent, before);
    else if (act === 'help') assert.ok(f.stage.querySelector('.village-help'));
    else assert.deepEqual(f.opened, [act]);
  });
}

test('an open window leaves A keydowns and keyups untouched, even after a claimed Space', t => {
  const f = villageFixture(t, { calm: true });
  const actor = f.doc.activeElement;
  pressKey(actor, 'keydown', ' ');
  const before = f.root.querySelector('.dlg__text').textContent;
  const backdrop = f.doc.createElement('div');
  backdrop.className = 'win-backdrop';
  f.stage.append(backdrop);
  for (const target of [actor, f.root]) for (const [key] of A_KEY_CASES) for (const type of ['keydown', 'keyup']) {
    const event = new Event(type, { key });
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(Boolean(event.stopped), false);
  }
  assert.equal(f.root.querySelector('.dlg__text').textContent, before);
  assert.deepEqual(f.gone, []);
  assert.deepEqual(f.pos(), PLAYER_START);
});

test('clicking a far stall still moves there immediately in Calm motion', t => {
  const f = villageFixture(t, { calm: true });
  f.root.querySelector('.village-actor[data-id="writing"]').click();
  assert.deepEqual(f.pos(), talkPoint('writing'));
  assert.deepEqual(f.gone, [['encounter', { id: 'writing' }]]);
});

const cssBlock = (css, selector) => {
  const start = css.indexOf(`\n${selector} {`) + 1;
  assert.ok(start > 0, `${selector} exists`);
  return css.slice(start, css.indexOf('}', start));
};

const playerColumn = f => {
  const html = f.root.querySelector('.village-player').firstElementChild.innerHTML;
  return Math.abs(Number(html.match(/background-position:([\d-]+)px/)[1])) / 64;
};

test('keyboard strides alternate both feet across completed steps', t => {
  const f = villageFixture(t, { calm: true });
  f.tap(480, 320); f.tick(); f.stage.classList.remove('calm');
  const columns = new Set();
  for (let step = 0; step < 4; step++) {
    f.scene.handleIntent('right');
    for (let i = 0; i < 7; i++) { f.tick(16); columns.add(playerColumn(f)); }
    assert.equal(playerColumn(f), 1, 'stands at the end of a key step');
  }
  assert.deepEqual([...columns].sort(), [0, 1, 2], 'step A, standing and step B are all drawn');
});

test('ground tap strides use the faster 360px/s cadence', t => {
  const f = villageFixture(t, { calm: true });
  f.tap(480, 320); f.tick(); f.stage.classList.remove('calm');
  f.tap(800, 320);
  f.tick(50);
  assert.equal(playerColumn(f), 0, 'step A before the 53.33ms boundary');
  f.tick(10);
  assert.equal(playerColumn(f), 1, 'standing after the faster boundary');
  f.tick(50);
  assert.equal(playerColumn(f), 2, 'the other foot after two frame periods');
});

test('Calm motion keeps standing frames for keyboard and tap walks', t => {
  const f = villageFixture(t, { calm: true });
  f.scene.handleIntent('up');
  assert.equal(playerColumn(f), 1);
  f.tap(800, 320); f.tick();
  assert.equal(playerColumn(f), 1);
  assert.deepEqual(f.pos(), { x: 800, y: 320 });
});
const cssPx = (block, property) => {
  const match = block.match(new RegExp(`(?:[;{]\\s*)${property}:\\s*(-?[\\d.]+)px`));
  assert.ok(match, `${property} has a pixel value in ${block}`);
  return Number(match[1]);
};

test('bottom dialogue keeps More and its focus ring inside the stage at both text sizes', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const kit = readFileSync(new URL('../src/ui/kit.css', import.meta.url), 'utf8');
  const interaction = readFileSync(new URL('../src/ui/interaction.css', import.meta.url), 'utf8');
  const inset = cssPx(cssBlock(css, '.village-dialogue'), 'bottom');
  const moreBottom = cssPx(cssBlock(interaction, '.dlg__more'), 'bottom');
  const focus = cssBlock(kit, ':focus-visible');
  const outline = cssPx(focus, 'outline') + cssPx(focus, 'outline-offset');
  const frameBorder = cssPx(cssBlock(kit, '.px-frame, .px-button, .px-chip, .px-icon-button, .px-toggle'), 'border');
  assert.ok(STAGE.height - inset - frameBorder - moreBottom + outline <= STAGE.height, 'More and its full focus ring fit');
});

test('both dialogue corners clear all nine sprites, stalls and the player start', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const interaction = readFileSync(new URL('../src/ui/interaction.css', import.meta.url), 'utf8');
  const top = cssBlock(css, '.village-dialogue--top'), bottom = cssBlock(css, '.village-dialogue');
  const w = cssPx(bottom, 'width'), h = cssPx(cssBlock(interaction, '.dlg'), 'height');
  const boxes = [
    { x: cssPx(top, 'left'), y: cssPx(top, 'top') - 18, w, h: h + 36 },
    { x: 960 - cssPx(bottom, 'right') - w, y: 540 - cssPx(bottom, 'bottom') - h - 18, w, h: h + 36 },
  ];
  for (const box of boxes) {
    for (const [id, feet] of Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS, player: PLAYER_START })) {
      const figure = { x: feet.x - 32, y: feet.y - 57, w: 64, h: 64 };
      assert.equal(overlaps(box, figure), false, id);
    }
    for (const [id, stall] of Object.entries(STALLS)) assert.equal(overlaps(box, stall), false, id);
    for (const hud of HUD_ZONES) assert.equal(overlaps(box, hud), false);
  }
});

test('walking away from a focused Talk chip returns focus to the village', t => {
  const f = villageFixture(t, { calm: true });
  const goal = talkPoint('community');
  f.tap(goal.x, goal.y); f.tick();
  const chip = f.root.querySelector('.village-talk');
  assert.equal(chip.hidden, false); chip.focus();
  assert.ok(f.doc.activeElement === chip);
  for (let i = 0; i < 4; i++) f.scene.handleIntent('right');
  assert.equal(chip.hidden, true);
  assert.ok(f.doc.activeElement === f.root, 'focus must not fall back to the body');
});

for (const destination of ['neighbor', 'ground']) test(`arrow input immediately interrupts a ${destination} tap-walk`, t => {
  const f = villageFixture(t, { calm: true });
  f.tap(480, 320); f.tick(); f.stage.classList.remove('calm');
  if (destination === 'neighbor') f.root.querySelector('.village-actor[data-id="writing"]').click();
  else f.tap(820, 200);
  f.tick();
  const before = f.pos();
  f.scene.handleIntent('left'); f.tick(100);
  const after = f.pos();
  assert.equal(after.y, before.y, 'the new step starts at the current feet');
  assert.equal(after.x, before.x - 24, 'Left immediately moves one step left at keyboard speed');
  for (let i = 0; i < 10; i++) f.tick(100);
  assert.deepEqual(f.pos(), after, 'the old destination stays cancelled');
  assert.deepEqual(f.gone, [], 'the cancelled neighbor is never visited');
});

const playerRects = p => [
  { x: p.x - 32, y: p.y - 57, w: 64, h: 64 },
  { x: p.x + 26, y: p.y - 52, w: 44, h: 36 },
];
function assertVisiblePlayer(p) {
  assert.ok(realRoad.isWalkable(p), `feet stay on road at ${JSON.stringify(p)}`);
  assertHUDClear(p);
}
function assertHUDClear(p) {
  for (const rect of playerRects(p)) {
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= STAGE.width && rect.y + rect.h <= STAGE.height, `player and Find pointer fit at ${JSON.stringify(p)}`);
    for (const hud of HUD_ZONES) assert.equal(overlaps(rect, hud), false, `player and Find pointer clear the HUD at ${JSON.stringify(p)}`);
  }
}

test('keyboard movement keeps the full player and Find pointer clear of every HUD edge', () => {
  for (const route of [['left', 'up', 'right', 'down'], ['up', 'left', 'down', 'right']]) {
    let p = { ...PLAYER_START };
    for (const intent of route) for (let i = 0; i < 50; i++) {
      p = stepPlayer(p, intent); assertVisiblePlayer(p);
    }
  }
  assert.deepEqual(stepPlayer({ x: 460, y: 445 }, 'down'), { x: 460, y: 445 }, 'Down stops above the board without a sideways shift');
  assert.deepEqual(stepPlayer({ x: 472, y: 450 }, 'left'), { x: 472, y: 450 }, 'Left stops beside the board without a vertical shift');
});

for (const calm of [false, true]) test(`ground taps snap near houses or are ignored when unreachable (calm=${calm})`, t => {
  const f = villageFixture(t, { calm, large: true, guide: 'art' });
  for (const goal of [[225, 200], [100, 100], [850, 100], [800, 510], [490, 510], [400, 250]]) {
    const before = f.pos(), path = roadPath(before, { x: goal[0], y: goal[1] });
    f.tap(...goal);
    for (let i = 0; i < 100; i++) { f.tick(50); assertVisiblePlayer(f.pos()); }
    assert.equal(f.root.querySelector('.village-pointer').hidden, false);
    assert.deepEqual(f.pos(), path ? path.at(-1) : before);
  }
});

test('the Find chip has a fixed box that fits the movement clearance with Bigger words', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const pointer = cssBlock(css, '.village-pointer');
  assert.equal(cssPx(pointer, 'width'), 44);
  assert.equal(cssPx(pointer, 'height'), 36);
});

for (const frameMs of [16, 33, 100]) for (const id of CAST) test(`tap-walking to ${id} arrives at ${frameMs}ms per frame`, t => {
  const f = villageFixture(t, { guide: id });
  f.root.querySelector(`.village-actor[data-id="${id}"]`).click();
  for (let i = 0; i < Math.ceil(1200 / frameMs); i++) { f.tick(frameMs); assertVisiblePlayer(f.pos()); }
  assert.deepEqual(f.pos(), talkGoal(id));
  assert.equal(nearestNeighbor(f.pos(), { ...VILLAGE_SPOTS, ...SIDE_SPOTS }), id);
  if (SIDE_SPOTS[id]) {
    assert.deepEqual(f.gone, []);
    assert.equal(f.root.querySelector('.village-dialogue').hidden, false);
    assert.equal(f.root.querySelector('.village-talk').hidden, false);
  } else assert.deepEqual(f.gone, id === 'music' ? [['music']] : [['encounter', { id }]]);
});

for (const grade of [0, 1, 2, 3, 4, 5]) test(`village keyboard guidance uses short sentences in grade ${grade}`, t => {
  const f = villageFixture(t, { large: true, state: { ...createState(), chapter: grade ? 1 : 0, grade: grade || 1 } });
  const label = f.root.getAttribute('aria-label');
  assert.match(label, /Press Enter near a neighbor to talk\. Or choose a neighbor\./);
  for (const sentence of label.split(/(?<=[.!?…])\s+/)) assert.ok(sentence.length <= 56, sentence);
});

for (const grade of [0, 1, 2]) test(`a stored Help Day in grade ${grade} cannot crash Hana's mounted stall`, t => {
  const chapter = grade ? 1 : 0, scope = chapter ? `chapter-1-grade-${grade}` : 'chapter-0';
  const stored = { ...createState(), chapter, grade: grade || 1,
    drafts: { [scope]: { community: { kind: 'community', activity: 'helpday', chapter, grade, crew: [{ job: 'lanterns', helper: 'kiko' }] } } } };
  const state = loadState({ getItem: key => key === STORAGE_KEY ? JSON.stringify(stored) : null });
  const f = villageFixture(t, { state });
  f.scene.destroy();
  const scene = createEncounterScene({ stage: f.stage, getState: () => state, speak() {}, open: { help() {} } }, { id: 'community' });
  t.after(() => scene.destroy());
  assert.doesNotThrow(() => scene.mount());
  assert.equal(f.stage.querySelectorAll(grade === 2 ? '.compass-cell' : '.square-cell').length, 25);
});

const replacements = {
  2: { math: ['rows', 'Crate rows'], science: ['beans', 'Garden bed card'], reading: ['ribbon', 'Story ribbon'], community: ['compass', 'Delivery map'] },
  3: { math: ['pizza', 'Pizza party'], science: ['chain', 'Sunbeam chart'], reading: ['tales', 'Tale book'], community: ['helpday', 'Help Day team'] },
};
for (const grade of [2, 3, 4, 5]) for (const legacy of [false, true]) test(`village and parade name the published creations (grade ${grade}, legacy=${legacy})`, t => {
  const replacement = replacements[grade === 2 ? 2 : 3];
  let state = { ...createState(), chapter: 1, grade, settings: { ...createState().settings, reducedMotion: true } };
  for (const { id } of CHARACTERS) {
    const activity = !legacy && replacement[id] ? { activity: replacement[id][0] } : {};
    state = publishCreation(state, id, { kind: id, chapter: 1, grade, ...activity, text: 'Welcome, neighbors!' });
  }
  const f = villageFixture(t, { state, large: true });
  for (const c of CHARACTERS) {
    const name = !legacy && replacement[c.id] ? replacement[c.id][1] : c.reward.label;
    assert.ok(f.root.querySelector(`.village-actor[data-id="${c.id}"]`).getAttribute('aria-label').includes(`Made a ${name.toLowerCase()}.`), name);
  }
  f.scene.destroy();
  const scene = createParadeScene({ stage: f.stage, getState: () => state, speak() {}, open: { help() {} } });
  t.after(() => scene.destroy());
  scene.mount();
  const label = f.stage.querySelector('.parade-street').getAttribute('aria-label');
  const sentences = label.split(/(?<=[.!?…])\s+/);
  assert.equal(sentences.length, 8, 'leader plus one sentence per neighbor');
  assert.ok(sentences.every(sentence => sentence.length <= 56), label);
  for (const c of CHARACTERS) {
    const name = !legacy && replacement[c.id] ? replacement[c.id][1] : c.reward.label;
    assert.ok(sentences.includes(`${c.name} brings the ${name.toLowerCase()}.`), name);
  }
});

test('the stopped parade dialogue is a punctuated short sentence', () => {
  const line = paradeStatus('stopped', 'stopped', createDefaultBand());
  assert.equal(line, 'Music stopped.');
  assert.ok(line.length <= 56);
});

test('sign thumbnails scale the entire measured sign and refit for Bigger words and loaded fonts', async t => {
  const observers = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  globalThis.ResizeObserver = class {
    constructor(fit) { this.fit = fit; this.observed = []; observers.push(this); }
    observe(el) { this.observed.push(el); }
    disconnect() { this.disconnected = true; }
  };
  t.after(() => original ? Object.defineProperty(globalThis, 'ResizeObserver', original) : delete globalThis.ResizeObserver);
  for (const [width, height] of [[64, 40], [88, 60]]) {
    const sign = { offsetWidth: 240, offsetHeight: 80, style: { setProperty(key, value) { this[key] = value; } } };
    let loaded;
    const ready = new Promise(resolve => { loaded = resolve; });
    const host = { querySelectorAll: () => [sign], ownerDocument: { fonts: { ready } } };
    const cleanup = fitSignPreviews(host, width, height), observer = observers.at(-1);
    assert.deepEqual(observer.observed, [sign]);
    const fits = () => {
      const scale = Number(sign.style['--sign-scale']);
      assert.ok(scale > 0 && scale <= 1);
      assert.ok(sign.offsetWidth * scale <= width + 1e-6);
      assert.ok(sign.offsetHeight * scale <= height + 1e-6);
    };
    fits();
    sign.offsetHeight = 240; observer.fit(); fits(); // long sign in Bigger words
    sign.offsetHeight = 300; loaded(); await ready; fits(); // late font load
    const scale = sign.style['--sign-scale'];
    cleanup();
    assert.equal(observer.disconnected, true);
    sign.offsetHeight = 400; observer.fit();
    assert.equal(sign.style['--sign-scale'], scale, 'a destroyed preview never updates');
  }
});

test('village and parade thumbnail styles expose the full sign before fitting', () => {
  for (const [path, selector] of [['village', '.village-easel > .world-sign'], ['parade', '.parade-float__art > .world-sign']]) {
    const css = readFileSync(new URL(`../src/ui/screens/${path}.css`, import.meta.url), 'utf8');
    const block = cssBlock(css, selector);
    assert.match(block, /max-height:\s*none/);
    assert.match(block, /max-width:\s*none/);
    assert.match(block, /overflow:\s*visible/);
    assert.match(block, /scale\(var\(--sign-scale/);
    assert.equal(cssPx(block, 'width'), 240);
  }
});

for (const accept of [false, true]) test(`reward sign fits after insertion and disposes on ${accept ? 'accept' : 'cancel'}`, async t => {
  const doc = new Doc(), observers = [];
  let fontsLoaded;
  doc.fonts = { ready: new Promise(resolve => { fontsLoaded = resolve; }) };
  for (const [key, value] of Object.entries({
    document: doc,
    ResizeObserver: class {
      constructor(fit) { this.fit = fit; observers.push(this); }
      observe(sign) {
        assert.equal(sign.isConnected, true, 'measure only after stage insertion');
        this.sign = sign; sign.offsetWidth = 240; sign.offsetHeight = 123;
      }
      disconnect() { this.disconnected = true; }
    },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const stage = doc.createElement('div'); doc.body.append(stage);
  const text = 'Welcome, neighbors! The lanterns are bright.';
  const pending = showItemGet(stage, { name: 'Festival sign', artHTML: creationMarkup('writing', { text }) });
  const observer = observers.at(-1), sign = observer.sign;
  assert.equal(sign.textContent, text);
  assert.equal(Number(sign.style['--sign-scale']), 1);
  sign.offsetHeight = 246; observer.fit();
  assert.equal(Number(sign.style['--sign-scale']), 164 / 246);
  if (accept) stage.querySelector('.item-get__go').click(); else pending.cancel();
  assert.equal(await pending, accept);
  assert.equal(stage.querySelector('.item-get'), null);
  assert.equal(observer.disconnected, true);
  const scale = sign.style['--sign-scale'];
  sign.offsetHeight = 400; observer.fit(); fontsLoaded(); await doc.fonts.ready;
  assert.equal(sign.style['--sign-scale'], scale, 'late resize and font callbacks do nothing');
  pending.cancel();
});

test('reward sign exposes its natural wrapping board before measured scaling', () => {
  const css = readFileSync(new URL('../src/ui/screens/encounter.css', import.meta.url), 'utf8');
  const block = cssBlock(css, '.item-get__art > span.world-sign');
  for (const rule of [/max-width:\s*none/, /max-height:\s*none/, /height:\s*auto/, /overflow:\s*visible/, /overflow-wrap:\s*anywhere/, /zoom:\s*1/, /scale\(var\(--sign-scale/]) assert.match(block, rule);
  assert.equal(cssPx(block, 'width'), 240);
  assert.match(cssBlock(css, '.item-get__art'), /position:\s*relative/);
});


for (const failure of ['error', 'size', 'empty']) test(`map ${failure} shows a persistent explanation and Retry restores walking`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const images = pendingRoad(t), f = villageFixture(t, { walkable: null, calm: true });
  const lateLoad = images[0].onload;
  if (failure === 'error') images[0].onerror();
  if (failure === 'size') { images[0].naturalWidth = 1; images[0].onload(); }
  if (failure === 'empty') {
    const create = f.doc.createElement.bind(f.doc);
    t.mock.method(f.doc, 'createElement', tag => tag === 'canvas' ? {
      getContext: () => ({ drawImage() {}, getImageData: () => ({ width: STAGE.width, height: STAGE.height, data: new Uint8Array(STAGE.width * STAGE.height * 4) }) }),
    } : create(tag));
    images[0].onload();
  }
  await f.mounted;
  const host = f.root.querySelector('.village-dialogue');
  assert.equal(host.hidden, false);
  assert.equal(host.querySelector('.dlg__text').textContent, 'The village map did not load.');
  assert.match(host.textContent, /Check your connection/);
  assert.match(f.announced.at(-1), /The village map did not load.*Retry/);
  for (const key of ['up', 'a', 'b']) f.scene.handleIntent(key);
  f.tap(500, 320); t.mock.timers.tick(10000); f.tick(100);
  assert.equal(host.hidden, false, 'movement and old welcome timers cannot dismiss the error');
  assert.deepEqual(f.pos(), PLAYER_START);
  assert.equal(f.frames.size, 0);
  const retry = host.querySelector('[data-act="retry-road"]');
  retry.click();
  assert.equal(images.length, 2);
  assert.equal(retry.disabled, true);
  supplyRoadPixels(t, f.doc);
  lateLoad();
  assert.equal(road(), null, 'a late response to the old attempt cannot unlock movement');
  const loaded = loadRoad();
  images[1].onload();
  await loaded;
  await Promise.resolve();
  assert.ok(road().isWalkable(PLAYER_START));
  assert.equal(f.frames.size, 1);
  assert.equal(host.querySelector('[data-act="retry-road"]'), null);
  f.scene.handleIntent('up');
  assert.notDeepEqual(f.pos(), PLAYER_START);
});

test('empty easels have no markup or collision; a creation appears and blocks on remount without decoding again', async t => {
  const images = pendingRoad(t), f = villageFixture(t, { walkable: null });
  supplyRoadPixels(t, f.doc);
  images[0].onload();
  await f.mounted;
  for (const id of Object.keys(EASELS)) assert.equal(f.root.querySelector(`.village-easel[data-id="${id}"]`), null);
  const r = EASELS.writing, point = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  assert.ok(road().isWalkable(point), 'empty easel area is road');
  f.scene.destroy();
  const state = publishCreation(createState(), 'writing', { kind: 'writing' });
  const g = villageFixture(t, { walkable: null, state });
  await g.mounted;
  assert.equal(images.length, 1, 'remount uses the cached decoded bitset');
  const easel = g.root.querySelector('.village-easel[data-id="writing"]');
  assert.ok(easel);
  const sign = easel.querySelector('.creation--writing.world-sign');
  assert.ok(sign);
  assert.equal(sign.textContent, 'Hello, friend!');
  assert.equal(g.root.querySelectorAll('.village-easel').length, 1);
  assert.equal(road().isWalkable(point), false);
  g.scene.destroy();
  const h = villageFixture(t, { walkable: null, state: { ...state, chapter: 1, grade: 2 } });
  await h.mounted;
  assert.equal(h.root.querySelectorAll('.village-easel').length, 0, 'another grade has no creations');
  assert.ok(road().isWalkable(point), 'another grade restores the hidden easel area');
  assert.equal(images.length, 1);
});

for (const calm of [false, true]) test(`review tap, Left, Down still allows every neighbor route (calm=${calm})`, t => {
  const f = villageFixture(t, { calm, guide: 'science' });
  f.tap(870, 388);
  for (let i = 0; i < 100; i++) f.tick(50);
  for (const key of ['left', 'down']) {
    f.scene.handleIntent(key);
    for (let i = 0; i < 10; i++) f.tick(50);
  }
  assertVisiblePlayer(f.pos());
  for (const id of CAST) assert.ok(roadPath(f.pos(), talkGoal(id), 0), id);
  const path = roadPath(f.pos(), PLAYER_START, 0);
  assert.ok(path);
  f.tap(PLAYER_START.x, PLAYER_START.y);
  for (let i = 0; i < 100; i++) f.tick(50);
  assert.deepEqual(f.pos(), PLAYER_START);
});


test('high neighbors lower their badges so the full status mark clears the HUD', t => {
  const f = villageFixture(t), css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  assert.match(cssBlock(css, '.village-badge'), /top:\s*var\(--badge-drop/);
  assert.match(cssBlock(css, '.village-badge__mark--visited'), /right:\s*-10px/);
  for (let frame = 0; frame < 100; frame++) {
    f.tick(100);
    for (const id of Object.keys(VILLAGE_SPOTS)) {
      const el = f.root.querySelector(`.village-actor[data-id="${id}"]`);
      const feet = { x: parseFloat(el.style.left) + 56, y: parseFloat(el.style.top) + 80 };
      const drop = parseFloat(el.style['--badge-drop']);
      assert.ok(feet.y - 96 + drop >= 72, `${id} mark top`);
      assert.ok(feet.x + 60 <= STAGE.width, `${id} mark right`);
      assert.ok(feet.y - 80 + drop + 32 <= STAGE.height, `${id} badge bottom`);
    }
  }
});

// Keyboard focus chooses the same actor as tapping, even beside another neighbor.
for (const calm of [false, true]) for (const id of ['reading', 'writing', 'music', 'pip']) for (const [key, label] of A_KEY_CASES) {
  test(`${label} activates focused ${id} instead of nearby Hana (calm=${calm})`, t => {
    const f = villageFixture(t, { calm, large: true });
    f.tap(...Object.values(talkPoint('community')));
    for (let i = 0; i < 20; i++) f.tick(100);
    assert.equal(f.root.querySelector('.village-talk').getAttribute('aria-label'), 'Talk to Hana');
    const actor = f.root.querySelector(`.village-actor[data-id="${id}"]`);
    actor.focus();
    assert.equal(pressKey(actor, 'keydown', key).defaultPrevented, true);
    assert.equal(pressKey(actor, 'keydown', key, { repeat: true }).defaultPrevented, true);
    const release = pressKey(actor, 'keyup', key);
    if (key === ' ') assert.equal(release.defaultPrevented, true);
    for (let i = 0; i < 20; i++) f.tick(100);
    if (id === 'pip') {
      assert.deepEqual(f.gone, []);
      assert.equal(f.root.querySelector('.dlg__speaker').textContent, 'Pip');
      assert.equal(f.root.querySelector('.dlg__text').textContent, 'Welcome to Willow Bay!');
    } else assert.deepEqual(f.gone, id === 'music' ? [['music']] : [['encounter', { id }]]);
    assert.notDeepEqual(f.pos(), talkPoint('community'));
  });
}

for (const large of [false, true]) test(`persistent Help pictures, legend and Hear work after a creation (large=${large})`, async t => {
  const { HELP_STEPS } = await import('../src/ui/screens/village.js');
  const f = villageFixture(t, { large, state: publishCreation(createState(), 'art', { kind: 'art' }) });
  assert.equal(f.root.querySelector('.village-dialogue').hidden, true);
  const help = f.root.querySelector('[data-act="village-help"]');
  assert.equal(help.textContent, 'Help');
  help.focus(); pressKey(help, 'keydown', 'Enter');
  const panel = f.stage.querySelector('.village-help');
  assert.ok(panel, 'Help does not depend on an open dialogue');
  assert.equal(f.root.inert, true);
  const next = panel.querySelector('[data-help="next"]');
  assert.equal(f.doc.activeElement, next);
  assert.equal(f.stage.querySelector('.win').querySelectorAll('button').length, 4);
  for (let page = 0; page < HELP_STEPS.length; page++) {
    assert.equal(panel.querySelector('.village-help__text').textContent, HELP_STEPS[page]);
    assert.ok(HELP_STEPS[page].length <= 56);
    assert.ok(panel.querySelector('.village-help__picture').innerHTML.length > 0);
    panel.querySelector('[data-help="hear"]').click();
    assert.equal(f.spoken.at(-1), HELP_STEPS[page]);
    if (page === 1) assert.match(panel.querySelector('.village-help__picture').textContent, /↑.*← ↓ →/s);
    if (page === 6) assert.equal(panel.querySelector('.village-help__mark').textContent, '!');
    if (page === 7) assert.equal(panel.querySelector('.village-help__mark').textContent, '...');
    next.click();
  }
  assert.equal(f.stage.querySelector('.win-backdrop'), null);
  assert.equal(f.doc.activeElement, help);
  assert.equal(f.root.inert, false);
  help.click();
  const back = f.stage.querySelector('[data-help="back"]');
  assert.equal(back.disabled, true);
  f.stage.querySelector('[data-help="next"]').click();
  back.focus(); back.click();
  assert.equal(f.doc.activeElement, f.stage.querySelector('[data-help="next"]'));
  assert.equal(f.stage.querySelector('.village-help__text').textContent, HELP_STEPS[0]);
  pressKey(f.stage.querySelector('[data-help="next"]'), 'keydown', 'Escape');
  assert.equal(f.stage.querySelector('.win-backdrop'), null);
  assert.equal(f.doc.activeElement, help);
});

const mountedPosition = stage => {
  const el = stage.querySelector('.village-player');
  return { x: parseFloat(el.style.left) + 32, y: parseFloat(el.style.top) + 57 };
};

for (const params of [{ guide: 'reading' }, { focus: 'math' }, { focus: 'music', celebrate: 'music' }]) {
  test(`rebuilding the village preserves position for ${JSON.stringify(params)}`, t => {
    const f = villageFixture(t, { calm: true });
    f.tap(500, 320);
    const before = f.pos();
    assert.notDeepEqual(before, PLAYER_START);
    f.scene.destroy();
    const returned = createVillageScene(f.ctx, params);
    returned.mount();
    t.after(() => returned.destroy());
    assert.deepEqual(mountedPosition(f.stage), before);
    if (params.focus) assert.equal(f.doc.activeElement.dataset.id, params.focus);
    if (params.guide) assert.equal(f.stage.querySelector('.village-pointer').hidden, false);
  });
}

test('return position is rechecked against newly blocked road and stays separate by grade', t => {
  const f = villageFixture(t, { calm: true });
  f.tap(500, 320);
  f.scene.destroy();
  f.ctx.walkable = createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url))), {
    blocked: [{ x: 490, y: 310, w: 20, h: 20 }],
  });
  let scene = createVillageScene(f.ctx);
  scene.mount();
  const adjusted = mountedPosition(f.stage);
  assert.notDeepEqual(adjusted, { x: 500, y: 320 });
  assert.ok(road().isWalkable(adjusted));
  assert.ok(Math.hypot(adjusted.x - 500, adjusted.y - 320) < 96);
  f.ctx.commit({ ...f.ctx.getState(), chapter: 1, grade: 3 });
  scene.destroy();
  scene = createVillageScene(f.ctx);
  scene.mount();
  assert.deepEqual(mountedPosition(f.stage), PLAYER_START);
  scene.destroy();
  f.ctx.commit({ ...f.ctx.getState(), chapter: 0 });
  scene = createVillageScene(f.ctx);
  scene.mount();
  assert.deepEqual(mountedPosition(f.stage), adjusted);
  scene.destroy();
});

test('only mounting the village starts the save', t => {
  const f = villageFixture(t);
  assert.equal(f.ctx.getState().hasStarted, true);
  let commits = 0;
  f.scene.destroy();
  const scene = createVillageScene({ ...f.ctx, commit: () => commits++ });
  scene.mount();
  assert.equal(commits, 0, 'returning does not rewrite the started flag');
  scene.destroy();
});

test('slow loading leaves Help available and a late valid road unlocks walking', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const images = pendingRoad(t), f = villageFixture(t, { walkable: null, calm: true });
  assert.equal(f.mountResult, undefined, 'mount does not hold the scene manager busy');
  assert.equal(f.root.querySelector('.village-loading').hidden, false);
  t.mock.timers.tick(10000);
  f.scene.handleIntent('up');
  assert.deepEqual(f.pos(), PLAYER_START);
  f.root.querySelector('[data-act="village-help"]').click();
  assert.ok(f.stage.querySelector('.village-help'));
  f.stage.querySelector('.win__close').click();
  assert.equal(f.root.querySelector('.village-map-error'), null);
  supplyRoadPixels(t, f.doc);
  images[0].onload();
  await f.mounted;
  assert.equal(f.root.querySelector('.village-loading').hidden, true);
  f.scene.handleIntent('up');
  assert.notDeepEqual(f.pos(), PLAYER_START);
});
