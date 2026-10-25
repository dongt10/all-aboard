import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD_ZONES, VILLAGE_SPOTS, SIDE_SPOTS, WANDER, PLAYER_START, hotspotRect, roamRect, talkPoint, nearestNeighbor, stepPlayer, stallState, overlaps, wanderTarget, stepToward, guideArrow } from '../src/ui/village-map.js';
import { creationMarkup } from '../src/ui/creations.js';
import { STAGE } from '../src/ui/stage.js';
import { CHARACTERS } from '../src/data.js';

// A small seeded generator, so wander tests are repeatable.
const seeded = (seed = 7) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const CAST = [...CHARACTERS.map(c => c.id), 'pip', 'nori'];

test('every neighbor and side character has a roomy patch clear of the HUD and each other', () => {
  assert.deepEqual(Object.keys(VILLAGE_SPOTS).sort(), CHARACTERS.map(c => c.id).sort());
  assert.deepEqual(Object.keys(SIDE_SPOTS).sort(), ['nori', 'pip']);
  const rects = CAST.map(id => [id, roamRect(id)]);
  for (const [id, r] of rects) {
    const hot = hotspotRect(id);
    assert.ok(VILLAGE_SPOTS[id] ? hot.w >= 96 && hot.h >= 96 : hot.w >= 64 && hot.h >= 64, `${id} big enough`);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= STAGE.width && r.y + r.h <= STAGE.height, `${id} inside the stage`);
    for (const zone of HUD_ZONES) assert.equal(overlaps(r, zone), false, `${id} clear of the HUD`);
    for (const [other, o] of rects) if (other !== id) assert.equal(overlaps(r, o), false, `${id} vs ${other}`);
  }
});

test('hotspots follow the feet they are given', () => {
  assert.deepEqual(hotspotRect('math'), { x: 84, y: 220, w: 112, h: 112 });
  assert.deepEqual(hotspotRect('math', { x: 150, y: 302 }), { x: 94, y: 222, w: 112, h: 112 });
  assert.deepEqual(hotspotRect('pip', { x: 100, y: 200 }), { x: 64, y: 128, w: 72, h: 88 });
  assert.deepEqual(talkPoint('math', { x: 150, y: 302 }), { x: 150, y: 342 });
});

test('overlaps is strict: touching edges do not overlap', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 }), true);
});

test('wander targets stay inside the home patch', () => {
  const random = seeded();
  for (const id of CAST) {
    const home = VILLAGE_SPOTS[id] ?? SIDE_SPOTS[id];
    for (let i = 0; i < 200; i++) {
      const t = wanderTarget(id, random);
      assert.ok(Math.abs(t.x - home.x) <= WANDER.x && Math.abs(t.y - home.y) <= WANDER.y, `${id} target ${t.x},${t.y}`);
      const hot = hotspotRect(id, t), roam = roamRect(id);
      assert.ok(hot.x >= roam.x && hot.y >= roam.y && hot.x + hot.w <= roam.x + roam.w && hot.y + hot.h <= roam.y + roam.h, `${id} hotspot stays in its roam rect`);
    }
  }
  assert.deepEqual(wanderTarget('math', () => 0), { x: 104, y: 296 });
  assert.deepEqual(wanderTarget('math', () => 0.5), { x: 140, y: 300 });
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
  assert.equal(nearestNeighbor({ x: 330, y: 320 }, { ...VILLAGE_SPOTS, ...SIDE_SPOTS }), 'pip');
});

test('walking moves 24px and stops at the edges', () => {
  assert.deepEqual(stepPlayer({ x: 480, y: 500 }, 'up'), { x: 480, y: 476 });
  assert.deepEqual(stepPlayer({ x: 40, y: 300 }, 'left'), { x: 40, y: 300 });
  assert.deepEqual(stepPlayer({ x: 900, y: 510 }, 'right'), { x: 920, y: 510 });
  assert.deepEqual(stepPlayer({ x: 900, y: 510 }, 'down'), { x: 900, y: 510 });
  assert.deepEqual(stepPlayer({ x: 900, y: 510 }, 'a'), { x: 900, y: 510 });
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
  const stall = id => ({ x: VILLAGE_SPOTS[id].x - 64, y: VILLAGE_SPOTS[id].y - 96, w: 128, h: 80 });
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
    'Tap a neighbor, or walk to one and press Enter.',   // Enter is a real A key (input.js); the A key itself walks left
    'Make one thing and the Parade opens.',
    'Make all seven for the big finale.',
    'Open the Guide to find a neighbor or see your stamps.',
  ]);
  for (const step of HELP_STEPS) assert.ok(step.length <= 56, `${step} fits a Bigger-words page`);
});

test('while the Talk chip names a neighbor, A talks to them from any neighbor button, but the HUD and Parade keep their keys', async () => {
  const { talkKeyWins, aAction } = await import('../src/ui/screens/village.js');
  // `button` is what village.js passes: true only for an actor button (a neighbor, Pip, Nori) or the Talk chip itself.
  const onActorButton = { button: true, inVillage: true, inDialogue: false };
  const onHudButton = { button: false, inVillage: true, inDialogue: false };   // Guide, Comfort, Pause, the grade chip, Parade
  assert.equal(talkKeyWins('math', onActorButton), true, 'another neighbor\'s button has focus: the chip wins');
  assert.equal(talkKeyWins(null, onActorButton), false, 'no chip: the focused button keeps its click');
  assert.equal(talkKeyWins('math', onHudButton), false, 'Guide, Pause and Parade still open with Enter, Space or Z');
  assert.equal(talkKeyWins('math', { button: true, inVillage: false, inDialogue: false }), false, 'a button outside the village (a window) keeps its keys');
  assert.equal(talkKeyWins('math', { button: true, inVillage: true, inDialogue: true }), false, 'More and Hear keep their keys');
  assert.equal(talkKeyWins('pip', onActorButton), true, 'the side cast too');
  // A itself: the chip's neighbor comes before whoever is nearest, a page turn comes first, and nothing near closes the box.
  assert.deepEqual(aAction({ near: 'math', nearest: 'math' }), { act: 'talk', id: 'math' });
  assert.deepEqual(aAction({ near: 'science', nearest: 'math' }), { act: 'talk', id: 'science' });
  assert.deepEqual(aAction({ near: null, nearest: 'math' }), { act: 'talk', id: 'math' }, 'mid-walk the chip is hidden, so the nearest neighbor answers');
  assert.deepEqual(aAction({ near: 'math', dialogueOpen: true, hasMore: true }), { act: 'next' });
  assert.deepEqual(aAction({ near: 'math', dialogueOpen: true, hasMore: false }), { act: 'talk', id: 'math' });
  assert.deepEqual(aAction({ near: null, nearest: null, dialogueOpen: true }), { act: 'hush' });
  assert.deepEqual(aAction(), { act: 'hush' });
});

test('a saved draft in this grade marks its stall started, and switching grade clears it', async () => {
  const { createState, saveDraft, publishCreation, getDraft, getCreations, getCompleted } = await import('../src/progress.js');
  const draftsOf = state => Object.fromEntries(CHARACTERS.map(c => [c.id, getDraft(state, c.id)]).filter(([, d]) => d));   // as the village builds it
  const statusOf = (state, id) => stallState(id, getCreations(state), getCompleted(state), draftsOf(state));
  const grade3 = { ...createState(), chapter: 1, grade: 3 };
  assert.equal(statusOf(grade3, 'math'), 'new');
  const drafted = saveDraft(grade3, 'math', { kind: 'math', left: [2], right: [], rolled: false });
  assert.equal(statusOf(drafted, 'math'), 'started');
  assert.equal(statusOf(drafted, 'art'), 'new');
  assert.equal(statusOf({ ...drafted, grade: 1 }, 'math'), 'new', 'drafts are per grade');
  const made = publishCreation(drafted, 'math', { kind: 'math', left: [2], right: [2], rolled: true });
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
