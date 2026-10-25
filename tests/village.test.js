import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageScene } from '../src/ui/screens/village.js';
import { createParadeScene } from '../src/ui/screens/parade.js';
import { createEncounterScene } from '../src/ui/screens/encounter.js';
import { createState, publishCreation, loadState, STORAGE_KEY } from '../src/progress.js';
import { paradeStatus } from '../src/ui/parade-lineup.js';
import { createDefaultBand } from '../src/audio.js';
import { HUD_ZONES, VILLAGE_SPOTS, SIDE_SPOTS, WANDER, PLAYER_START, clampWalk, hotspotRect, roamRect, talkPoint, nearestNeighbor, stepPlayer, stallState, overlaps, wanderTarget, stepToward, guideArrow } from '../src/ui/village-map.js';
import { creationMarkup, fitSignPreviews } from '../src/ui/creations.js';
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
  assert.deepEqual(stepPlayer({ x: 880, y: 510 }, 'right'), { x: 890, y: 510 });
  assert.deepEqual(stepPlayer({ x: 880, y: 510 }, 'down'), { x: 880, y: 510 });
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
    ['science', { activity: 'chain', chain: ['plant', 'fish', 'gull'], energy: [100, 10, 1] }, chainCreationMarkup],
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
import { Doc, Event } from './helpers/dom.js';


function villageFixture(t, { calm = false, large = false, state = createState(), ...options } = {}) {
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
  const stage = doc.createElement('div'), gone = [];
  stage.className = `stage${calm ? ' calm' : ''}${large ? ' large-text' : ''}`;
  doc.body.append(stage);
  const scene = createVillageScene({ stage, getState: () => state, go: (...args) => { gone.push(args); return true; } }, options);
  scene.mount();
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
  return { doc, scene, root, stage, gone, tick, pos, tap };
}

const cssBlock = (css, selector) => {
  const start = css.indexOf(`\n${selector} {`) + 1;
  assert.ok(start > 0, `${selector} exists`);
  return css.slice(start, css.indexOf('}', start));
};
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

test('the top dialogue sits over the square: its box, tabs and More button clear every neighbor and stall', () => {
  // The welcome and Kiko's cheer use the top placement. It may cover the torii and Sora's name chip, never a figure.
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const interaction = readFileSync(new URL('../src/ui/interaction.css', import.meta.url), 'utf8');
  const top = cssBlock(css, '.village-dialogue--top');
  const left = cssPx(top, 'left'), y = cssPx(top, 'top');
  const w = cssPx(cssBlock(css, '.village-dialogue'), 'width'), h = cssPx(cssBlock(interaction, '.dlg'), 'height');
  const parts = {
    box: { x: left, y, w, h },
    speakerTab: { x: left + 14, y: y - 18, w: 120, h: 24 },
    hearHelpTabs: { x: left + w - 12 - 160, y: y - 18, w: 160, h: 24 },   // "Hear" and "Help" tabs, 8px apart
    more: { x: left + w - 14 - 110, y: y + h - 6, w: 110, h: 24 },
  };
  for (const [id, feet] of Object.entries(VILLAGE_SPOTS)) {
    const figure = { x: feet.x - 48, y: feet.y - 84, w: 96, h: 84 };            // the drawn 1.5× figure above its feet
    const stall = { x: feet.x - 64, y: feet.y - 92, w: 128, h: 76 };            // the stall front, below the roof peak
    for (const [part, rect] of Object.entries(parts)) {
      assert.equal(overlaps(rect, figure), false, `${part} clears ${id}`);
      assert.equal(overlaps(rect, stall), false, `${part} clears ${id}'s stall`);
    }
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

for (const calm of [false, true]) test(`ground walks avoid the HUD throughout the route (calm=${calm})`, t => {
  const f = villageFixture(t, { calm, large: true, guide: 'art' });
  for (const goal of [[100, 510], [100, 96], [920, 96], [920, 510], [100, 160], [800, 510]]) {
    f.tap(...goal);
    for (let i = 0; i < 50; i++) { f.tick(100); assertVisiblePlayer(f.pos()); }
    assert.equal(f.root.querySelector('.village-pointer').hidden, false);
    assert.deepEqual(f.pos(), clampWalk({ x: goal[0], y: goal[1] }), 'the walk reaches its clear destination');
  }
});


test('the Find chip has a fixed box that fits the movement clearance with Bigger words', () => {
  const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
  const pointer = cssBlock(css, '.village-pointer');
  assert.equal(cssPx(pointer, 'width'), 44);
  assert.equal(cssPx(pointer, 'height'), 36);
});

for (const id of Object.keys(VILLAGE_SPOTS)) test(`tap-walking to ${id} still arrives and opens its activity`, t => {
  const f = villageFixture(t, { guide: id });
  f.root.querySelector(`.village-actor[data-id="${id}"]`).click();
  for (let i = 0; i < 40; i++) { f.tick(100); assertVisiblePlayer(f.pos()); }
  assert.deepEqual(f.gone, id === 'music' ? [['music']] : [['encounter', { id }]]);
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
  assert.equal(f.stage.querySelectorAll('.square-cell').length, 25);
});

const replacements = { math: ['pizza', 'Pizza party'], science: ['chain', 'Sunbeam chart'], reading: ['tales', 'Tale book'], community: ['helpday', 'Help Day team'] };
for (const grade of [3, 4, 5]) for (const legacy of [false, true]) test(`village and parade name the published creations (grade ${grade}, legacy=${legacy})`, t => {
  let state = { ...createState(), chapter: 1, grade, settings: { ...createState().settings, reducedMotion: true } };
  for (const { id } of CHARACTERS) {
    const activity = !legacy && replacements[id] ? { activity: replacements[id][0] } : {};
    state = publishCreation(state, id, { kind: id, chapter: 1, grade, ...activity, text: 'Welcome, neighbors!' });
  }
  const f = villageFixture(t, { state, large: true });
  for (const c of CHARACTERS) {
    const name = !legacy && replacements[c.id] ? replacements[c.id][1] : c.reward.label;
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
    const name = !legacy && replacements[c.id] ? replacements[c.id][1] : c.reward.label;
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
