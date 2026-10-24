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

test('a welcome map draws the square with each saved item where it was put', () => {
  const placements = [{ item: 'quiet', x: 30, y: 10 }, { item: 'bench', x: 70, y: 30 }, { item: 'sign', x: 50, y: 70 }];
  const html = creationMarkup('community', { placements });
  assert.match(html, /^<svg class="creation creation--community" viewBox="0 0 100 100"/);
  assert.match(html, /aria-label="Your welcoming village plan"/);
  for (const { item, x, y } of placements) assert.match(html, new RegExp(`class="map-item map-item--${item}" x="${x - 8}" y="${y - 8}"`), item);
  const junk = creationMarkup('community', { placements: [{ item: 'bench', x: 'x"><script>', y: 400 }] });
  assert.doesNotMatch(junk, /script|NaN/);
});
