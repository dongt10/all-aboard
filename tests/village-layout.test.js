import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/ui/village-layout.js';
import { readPNG } from './helpers/png.js';

const { BACKGROUND, ROAD_MASK, STAGE, HUD_ZONES, VILLAGE_SPOTS, STALLS, EASELS, SIDE_SPOTS, WANDER, PLAYER_START, NEAR_LAMPS } = layout;
const background = readPNG(new URL(`../${BACKGROUND}`, import.meta.url));
const road = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));
const subjects = ['community', 'reading', 'writing', 'math', 'art', 'science', 'music'];
const points = { ...VILLAGE_SPOTS, ...SIDE_SPOTS, player: PLAYER_START };
const furniture = [...Object.entries(STALLS).map(([id, r]) => [`${id} stall`, r]), ...Object.entries(EASELS).map(([id, r]) => [`${id} easel`, r])];
const junction = { x: 399, y: 246, w: 237, h: 225 };
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= STAGE.width && r.y + r.h <= STAGE.height;
const grown = r => ({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 });
const separation = (a, b) => Math.hypot(Math.max(a.x - b.x - b.w, b.x - a.x - a.w, 0), Math.max(a.y - b.y - b.h, b.y - a.y - a.h, 0));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const onRoad = (x, y) => x >= 0 && y >= 0 && x < STAGE.width && y < STAGE.height && road.rgba[(y * STAGE.width + x) * 4 + 3] === 255;
const figure = (p, player = false) => ({ x: p.x - 32, y: p.y - 57, w: player ? 102 : 64, h: 64 });
const footprint = (x, y) => {
  for (let dy = -3; dy <= 0; dy++) for (let dx = -6; dx <= 6; dx++) if (!onRoad(x + dx, y + dy)) return false;
  return true;
};
function flood(canWalk) {
  const seen = new Uint8Array(STAGE.width * STAGE.height), queue = new Int32Array(seen.length);
  const start = PLAYER_START.y * STAGE.width + PLAYER_START.x;
  assert.ok(canWalk(PLAYER_START.x, PLAYER_START.y));
  queue[0] = start; seen[start] = 1;
  let head = 0, tail = 1;
  while (head < tail) {
    const index = queue[head++], x = index % STAGE.width, y = Math.floor(index / STAGE.width);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= STAGE.width || ny >= STAGE.height) continue;
      const next = ny * STAGE.width + nx;
      if (!seen[next] && canWalk(nx, ny)) { seen[next] = 1; queue[tail++] = next; }
    }
  }
  return { seen, count: tail };
}

// Source-pixel traces of the four houses, including their roofs. The drawing is scaled 3×.
const houses = [
  [[10, 0], [74, 0], [74, 67], [10, 67]],
  [[265, 0], [319, 0], [319, 78], [271, 78], [271, 36], [265, 40]],
  [[48, 179], [71, 153], [77, 147], [87, 147], [121, 179]],
  [[228, 179], [246, 154], [251, 149], [266, 149], [302, 179]],
];
const gardenAndFence = [{ x: 9, y: 201, w: 231, h: 33 }, { x: 90, y: 480, w: 117, h: 60 }, { x: 0, y: 471, w: 132, h: 15 }];
function inPolygon(x, y, polygon) {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (cross === 0 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) within = !within;
  }
  return within;
}

test('layout exports the complete plain-data contract with integer coordinates', () => {
  assert.deepEqual(Object.keys(layout).sort(), ['BACKGROUND', 'ROAD_MASK', 'STAGE', 'HUD_ZONES', 'VILLAGE_SPOTS', 'STALLS', 'EASELS', 'SIDE_SPOTS', 'WANDER', 'PLAYER_START', 'NEAR_LAMPS'].sort());
  assert.equal(BACKGROUND, 'assets/village/background.png');
  assert.equal(ROAD_MASK, 'assets/village/road.png');
  assert.deepEqual(STAGE, { width: 960, height: 540 });
  assert.deepEqual(HUD_ZONES, [{ x: 0, y: 0, w: 960, h: 72 }, { x: 0, y: 452, w: 440, h: 88 }]);
  assert.deepEqual(WANDER, { x: 36, y: 4 });
  for (const collection of [VILLAGE_SPOTS, STALLS, EASELS]) assert.deepEqual(Object.keys(collection), subjects);
  assert.deepEqual(Object.keys(SIDE_SPOTS), ['pip', 'nori']);
  const check = value => {
    if (typeof value === 'number') assert.ok(Number.isInteger(value));
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(check);
    else assert.equal(typeof value, 'string');
  };
  Object.values(layout).forEach(check);
});

test('both assets match the stage and the detailed background is opaque', () => {
  for (const image of [background, road]) assert.deepEqual([image.width, image.height], [960, 540]);
  for (let i = 3; i < background.rgba.length; i += 4) assert.equal(background.rgba[i], 255);
});

test('at least 97 percent of road pixels sit on low-saturation gray background stone', () => {
  let total = 0, gray = 0;
  for (let i = 0; i < road.rgba.length; i += 4) {
    if (road.rgba[i + 3] !== 255) continue;
    total++;
    const [r, g, b] = background.rgba.subarray(i, i + 3);
    const high = Math.max(r, g, b), low = Math.min(r, g, b);
    const saturation = high ? (high - low) / high : 0;
    const value = high / 255;
    if (saturation < 0.25 && value >= 0.15 && value <= 0.75) gray++;
  }
  assert.ok(total > 0, 'road mask must not be empty');
  assert.ok(gray / total >= 0.97, `${gray}/${total} road pixels (${100 * gray / total}%) sit on gray stone`);
});

test('road mask is pure white-opaque or black-transparent and covers 15 to 55 percent', () => {
  let count = 0;
  for (let i = 0; i < road.rgba.length; i += 4) {
    const alpha = road.rgba[i + 3];
    assert.ok(alpha === 0 || alpha === 255);
    for (let c = 0; c < 3; c++) assert.equal(road.rgba[i + c], alpha);
    if (alpha) count++;
  }
  const share = count / (960 * 540);
  assert.ok(share >= 0.15 && share <= 0.55, `${share * 100}% road`);
});

test('every spot has four walkable corners and a fully walkable footprint', () => {
  for (const [id, p] of Object.entries(points)) {
    for (const dx of [-6, 6]) for (const dy of [-3, 0]) assert.ok(onRoad(p.x + dx, p.y + dy), id);
    assert.ok(footprint(p.x, p.y), id);
  }
});

test('all figures clear the stage and HUD, including the player Find chip', () => {
  for (const [id, p] of Object.entries(points)) {
    const r = figure(p, id === 'player');
    assert.ok(inside(r), id);
    for (const zone of HUD_ZONES) assert.ok(!overlaps(r, zone), `${id}: HUD`);
  }
});

test('all furniture and its two-pixel border are carved out of the road', () => {
  for (const [id, r] of furniture) {
    const g = grown(r);
    for (let y = Math.max(0, g.y); y < Math.min(540, g.y + g.h); y++) {
      for (let x = Math.max(0, g.x); x < Math.min(960, g.x + g.w); x++) assert.ok(!onRoad(x, y), `${id}: ${x},${y}`);
    }
  }
});

test('furniture stays inside the stage, outside HUD, and outside the junction', () => {
  for (const [id, r] of furniture) {
    assert.ok(inside(r), id);
    for (const zone of HUD_ZONES) assert.ok(!overlaps(r, zone), `${id}: HUD`);
    assert.ok(!overlaps(grown(r), junction), `${id}: junction`);
  }
});

test('furniture avoids the houses, gardens and fence in the drawing', () => {
  for (const [id, r] of furniture) {
    for (const feature of gardenAndFence) assert.ok(!overlaps(r, feature), `${id}: garden/fence`);
    for (let y = Math.floor(r.y / 3); y <= Math.floor((r.y + r.h - 1) / 3); y++) {
      for (let x = Math.floor(r.x / 3); x <= Math.floor((r.x + r.w - 1) / 3); x++) {
        assert.ok(houses.every(polygon => !inPolygon(x, y, polygon)), `${id}: house at source ${x},${y}`);
      }
    }
  }
});

test('furniture does not overlap and short gaps between facing edges are closed', () => {
  for (let i = 0; i < furniture.length; i++) for (let j = i + 1; j < furniture.length; j++) {
    const [aid, a] = furniture[i], [bid, b] = furniture[j];
    assert.ok(!overlaps(a, b), `${aid} overlaps ${bid}`);
    // A sealed gap is allowed. The whole-mask disk proof below checks open
    // passages, including diagonal gaps and gaps against background obstacles.
    const left = a.x <= b.x ? a : b, right = left === a ? b : a;
    const top = a.y <= b.y ? a : b, bottom = top === a ? b : a;
    const gaps = [
      { x: left.x + left.w, y: Math.max(a.y, b.y), w: right.x - left.x - left.w, h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) },
      { x: Math.max(a.x, b.x), y: top.y + top.h, w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h: bottom.y - top.y - top.h },
    ];
    for (const [axis, gap] of gaps.entries()) {
      if (gap.w <= 0 || gap.h <= 0 || (axis === 0 ? gap.w : gap.h) >= 28) continue;
      for (let y = gap.y; y < gap.y + gap.h; y++) for (let x = gap.x; x < gap.x + gap.w; x++) {
        assert.ok(!footprint(x, y), `${aid} / ${bid}: unsealed narrow gap at ${x},${y}`);
      }
    }
  }
});

test('stalls have the correct size, side and proximity to their neighbors', () => {
  for (const [id, r] of Object.entries(STALLS)) {
    assert.deepEqual([r.w, r.h], [128, 80]);
    assert.ok(['above', 'below', 'left', 'right'].includes(r.side));
    const p = VILLAGE_SPOTS[id];
    const correctSide = { above: r.y + r.h <= p.y, below: r.y >= p.y, left: r.x + r.w <= p.x, right: r.x >= p.x };
    assert.ok(correctSide[r.side], id);
    assert.ok(separation(r, { ...p, w: 0, h: 0 }) <= 24, id);
  }
});

test('easels are within 100 pixels of their stalls and clear every figure', () => {
  for (const [id, r] of Object.entries(EASELS)) {
    assert.deepEqual([r.w, r.h], [80, 56]);
    assert.ok(separation(r, STALLS[id]) <= 100, id);
    for (const [actor, p] of Object.entries(points)) assert.ok(!overlaps(r, figure(p, actor === 'player')), `${id} easel / ${actor}`);
  }
});

test('neighbors have separate figures and side characters have their own space', () => {
  const neighbors = Object.entries(VILLAGE_SPOTS);
  for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) {
    const [aid, a] = neighbors[i], [bid, b] = neighbors[j];
    // These two pairs now use the broad junction approaches instead of the
    // lamp-side pockets. Preserve the original spacing for every other pair.
    const approachPair = (aid === 'reading' && bid === 'art') || (aid === 'art' && bid === 'music');
    assert.ok(distance(a, b) >= (approachPair ? 87 : 150), `${aid} / ${bid}`);
    assert.ok(!overlaps(figure(a), figure(b)), `${aid} / ${bid}: figures overlap`);
  }
  assert.ok(distance(SIDE_SPOTS.pip, SIDE_SPOTS.nori) >= 100);
  for (const [id, p] of Object.entries(SIDE_SPOTS)) for (const [other, q] of neighbors) assert.ok(distance(p, q) >= 120, `${id} / ${other}`);
});

test('all road pixels and every spot belong to the same four-connected component', () => {
  const { seen, count } = flood(onRoad);
  for (const [id, p] of Object.entries(points)) assert.equal(seen[p.y * 960 + p.x], 1, id);
  let roadCount = 0;
  for (let i = 3; i < road.rgba.length; i += 4) if (road.rgba[i]) roadCount++;
  assert.equal(count, roadCount);
});

test('all spots are reachable with the complete walking footprint and HUD clearance', () => {
  const allowed = new Uint8Array(960 * 540);
  for (let y = 129; y <= 533; y++) for (let x = 32; x <= 928; x++) {
    const r = figure({ x, y });
    if (HUD_ZONES.every(zone => !overlaps(r, zone)) && footprint(x, y)) allowed[y * 960 + x] = 1;
  }
  const { seen } = flood((x, y) => allowed[y * 960 + x] === 1);
  for (const [id, p] of Object.entries(points)) assert.equal(seen[p.y * 960 + p.x], 1, id);
});

test('visible lamp bases remain non-walkable', () => {
  assert.equal(NEAR_LAMPS.length, 11);
  for (const p of NEAR_LAMPS) assert.ok(!onRoad(p.x, p.y), `${p.x},${p.y}`);
});

const fullFeet = Uint8Array.from({ length: 960 * 540 }, (_, i) => Number(footprint(i % 960, Math.floor(i / 960))));
const population = bits => bits.reduce((sum, bit) => sum + bit, 0);

// Exact integer disk, using per-row prefix sums rather than a square erosion.
// This oracle is independent of the runtime's footprint and path planner.
function diskTransform(bits, radius, erode) {
  const prefix = new Uint32Array(540 * 961), result = new Uint8Array(bits.length);
  for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) {
    prefix[y * 961 + x + 1] = prefix[y * 961 + x] + bits[y * 960 + x];
  }
  const rows = Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const dy = i - radius;
    return [dy, Math.floor(Math.sqrt(radius * radius - dy * dy))];
  });
  for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) {
    let value = erode;
    for (const [dy, half] of rows) {
      const yy = y + dy, left = x - half, right = x + half;
      const count = yy < 0 || yy >= 540 ? 0 : prefix[yy * 961 + Math.min(960, right + 1)] - prefix[yy * 961 + Math.max(0, left)];
      if (erode && count !== half * 2 + 1) { value = false; break; }
      if (!erode && count > 0) { value = true; break; }
    }
    result[y * 960 + x] = Number(value);
  }
  return result;
}

test('ALL full 13 by 4 footprint positions form one component containing every home', () => {
  const { count, seen } = flood((x, y) => fullFeet[y * 960 + x] === 1);
  assert.equal(count, population(fullFeet), 'no untested footprint pocket anywhere on the stage');
  for (const [id, p] of Object.entries(points)) assert.equal(seen[p.y * 960 + p.x], 1, id);
});

test('28px passage clearance preserves connectivity and leaves no thin road appendages', () => {
  const core = diskTransform(fullFeet, 14, true);
  const { count } = flood((x, y) => core[y * 960 + x] === 1);
  assert.ok(count > 0);
  assert.equal(count, population(core), '14px disk erosion must not split the feet component');

  // Stronger than component counting: all retained road must be backed by
  // a complete foot rectangle swept through this connected disk-clear area.
  // An arbitrarily thin dead-end tail would otherwise disappear in erosion
  // without changing the component count, and would escape that test alone.
  const sweptFeet = diskTransform(core, 14, false), supported = new Uint8Array(fullFeet.length);
  for (let y = 3; y < 540; y++) for (let x = 6; x < 954; x++) {
    if (!sweptFeet[y * 960 + x]) continue;
    for (let dy = -3; dy <= 0; dy++) for (let dx = -6; dx <= 6; dx++) supported[(y + dy) * 960 + x + dx] = 1;
  }
  for (let i = 0; i < supported.length; i++) {
    assert.equal(supported[i], Number(onRoad(i % 960, Math.floor(i / 960))), `unsupported road or obstacle intrusion at ${i % 960},${Math.floor(i / 960)}`);
  }
});

test('every wander envelope keeps the sprite, badge and status mark on stage below the HUD', () => {
  for (const [id, p] of Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS })) {
    assert.ok(p.x - WANDER.x - 32 >= 0, `${id}: left`);
    assert.ok(p.x + WANDER.x + 60 <= 960, `${id}: right badge/status`);
    assert.ok(p.y - WANDER.y - 96 >= 72, `${id}: top badge/status`);
    assert.ok(p.y + WANDER.y + 7 <= 540, `${id}: bottom`);
  }
});

test('furniture leaves every measured lamp base and its protected box uncovered', () => {
  for (const [id, r] of furniture) {
    for (const p of NEAR_LAMPS) assert.ok(!overlaps(r, { ...p, w: 1, h: 1 }), `${id}: lamp base ${p.x},${p.y}`);
    for (const p of NEAR_LAMPS) {
      const lamp = { x: p.x - 12, y: p.y - 64, w: 24, h: 68 };
      assert.ok(!overlaps(r, lamp), `${id}: lamp box at base ${p.x},${p.y}`);
    }
  }
});

test('road contains no saturated green vegetation, colored remnants or small components', () => {
  for (let i = 0; i < road.rgba.length; i += 4) {
    if (!road.rgba[i + 3]) continue;
    const [r, g, b] = background.rgba.subarray(i, i + 3);
    const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
    const saturation = high ? delta / high : 0;
    let hue = delta === 0 ? 0 : high === r ? ((g - b) / delta + 6) % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue *= 60;
    assert.ok(!(saturation > 0.25 && hue >= 60 && hue <= 180), `green road pixel at ${(i / 4) % 960},${Math.floor(i / 4 / 960)}`);
    assert.ok(saturation <= 0.16, 'only gray cobblestone, including tree-edge cleanup');
  }
  const { count } = flood(onRoad);
  assert.ok(count >= 200);
  let all = 0;
  for (let i = 3; i < road.rgba.length; i += 4) all += Number(road.rgba[i] !== 0);
  assert.equal(count, all, 'no separate component of any size, including <200px remnants');
});
