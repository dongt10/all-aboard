import test from 'node:test';
import assert from 'node:assert/strict';
import { readPNG } from './helpers/png.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { ROAD_MASK, STAGE } from '../src/ui/village-layout.js';
import {
  setRoad, road, clampWalk, stepPlayer, wanderTarget, roadPath, talkGoal,
  nearestNeighbor, stepToward, PLAYER_START, VILLAGE_SPOTS, SIDE_SPOTS,
  WANDER, WALK_SHAPE, WALK_BOUNDS, HUD_ZONES,
} from '../src/ui/village-map.js';

// Fixed unsigned 32-bit arithmetic makes failures replayable on every platform.
const SEED = 0x7a11ab1e;
function seeded(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
}
const png = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));
setRoad(createWalkable(maskFromRGBA(png)));
const cast = { ...VILLAGE_SPOTS, ...SIDE_SPOTS };
const pointText = p => JSON.stringify(p);
function fail(reason, context, position, extra = {}) {
  assert.fail(`${reason}; seed=0x${SEED.toString(16)}; ${context}; position=${pointText(position)}; ${JSON.stringify(extra)}`);
}

// Independent oracle: inspect the original PNG, never the runtime mask or clearance bits.
function footprintOracle(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  for (let py = y - 3; py <= y; py++) for (let px = x - 6; px <= x + 6; px++) {
    if (px < 0 || py < 0 || px >= png.width || py >= png.height) return false;
    const i = (py * png.width + px) * 4;
    if (png.rgba[i] !== 255 || png.rgba[i + 1] !== 255 || png.rgba[i + 2] !== 255 || png.rgba[i + 3] !== 255) return false;
  }
  return true;
}

// Partition a segment at every pixel boundary and check both boundaries and open intervals.
// This differs from the engine's grid traversal and catches fractional corner intrusions.
function sweptOracle(a, b) {
  const times = [0, 1];
  for (const axis of ['x', 'y']) {
    const delta = b[axis] - a[axis];
    if (!delta) continue;
    for (let line = Math.floor(Math.min(a[axis], b[axis])) + 1; line <= Math.ceil(Math.max(a[axis], b[axis])) - 1; line++) {
      times.push((line - a[axis]) / delta);
    }
  }
  times.sort((a, b) => a - b);
  const at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (let i = 0; i < times.length; i++) {
    if (!footprintOracle(at(times[i]))) return false;
    if (i && !footprintOracle(at((times[i - 1] + times[i]) / 2))) return false;
  }
  return true;
}

// Only construct diagnostics on failure: hundreds of thousands of samples stay cheap.
function checkRoad(p, context, extra) {
  if (!road().isWalkable(p)) fail('Footprint left the road', context, p, extra);
  if (!footprintOracle(p)) fail('PNG footprint contains a blocked pixel', context, p, extra);
}
function checkPlayer(p, context, extra) {
  checkRoad(p, context, extra);
  const left = p.x - WALK_SHAPE.left, right = p.x + WALK_SHAPE.right;
  const top = p.y - WALK_SHAPE.top, bottom = p.y + WALK_SHAPE.bottom;
  if (left < 0 || right > STAGE.width || top < 0 || bottom > STAGE.height) {
    fail('Figure and Find chip left the stage', context, p, extra);
  }
  for (let zone = 0; zone < HUD_ZONES.length; zone++) {
    const h = HUD_ZONES[zone];
    if (left < h.x + h.w && h.x < right && top < h.y + h.h && h.y < bottom) {
      fail('Figure and Find chip overlap HUD', context, p, { ...extra, zone, hud: h });
    }
  }
}

function walkPath(path, from, goal, context, playerClearance = false) {
  if (!path?.length) fail('No path to resolved road target', context, goal, { from });
  if (path[0].x !== from.x || path[0].y !== from.y) {
    fail('Path teleports its start', context, path[0], { from, goal });
  }
  const check = playerClearance ? checkPlayer : checkRoad;
  check(from, context);
  let samples = 1, current = from;
  for (let waypoint = 1; waypoint < path.length; waypoint++) {
    const a = path[waypoint - 1], b = path[waypoint];
    const segment = `${context}, waypoint=${waypoint}`;
    if (!road().straightClear(a, b)) fail('Waypoint pair crosses an obstacle', segment, b, { from: a });
    if (!sweptOracle(a, b)) fail('Swept PNG footprint crosses an obstacle', segment, b, { from: a });
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    // Include every 2px sample and the exact final endpoint, even for short segments.
    for (let distance = 2; distance < length + 2; distance += 2) {
      const expected = stepToward(a, b, Math.min(distance, length)).pos;
      check(expected, `${segment}, sample=${samples}`);
      const next = road().step(current, expected);
      if (next.x !== expected.x || next.y !== expected.y) {
        fail('Walking the path stopped before its sample', `${segment}, sample=${samples}`, next, { expected, from: current });
      }
      current = next;
      samples++;
      if (distance >= length) break;
    }
  }
  if (current.x !== goal.x || current.y !== goal.y) fail('Path missed its goal', context, current, { goal });
  return samples;
}

test('road fuzz: 60,000 keyboard steps with long repeated-key runs', t => {
  const random = seeded(SEED), keys = ['up', 'down', 'left', 'right'];
  let player = { ...PLAYER_START }, intent, remaining = 0, blocked = 0, runs = 0;
  checkPlayer(player, 'keyboard step=start');
  for (let step = 0; step < 60_000; step++) {
    if (!remaining) {
      intent = keys[Math.floor(random() * keys.length)];
      // Long runs keep pushing against houses, furniture, stage edges and HUD.
      remaining = 16 + Math.floor(random() * 113);
      runs++;
    }
    remaining--;
    const before = player;
    player = stepPlayer(before, intent);
    checkPlayer(player, `keyboard step=${step}`, { intent, from: before });
    const distance = Math.hypot(player.x - before.x, player.y - before.y);
    if (distance > Math.hypot(24, 12) + 0.01) fail('Keyboard step exceeds 24px plus a 12px corner nudge', `keyboard step=${step}`, player, { from: before, intent, distance });
    if (!sweptOracle(before, player)) fail('Keyboard sweep crosses a blocked PNG pixel', `keyboard step=${step}`, player, { from: before, intent });
    if (!road().straightClear(before, player)) fail('Keyboard step crosses an obstacle', `keyboard step=${step}`, player, { from: before, intent });
    if (!distance) blocked++;
  }
  assert.ok(blocked > 0, 'The run must exercise blocked movement');
  t.diagnostic(`60,000 steps; ${runs} key runs; ${blocked} blocked steps; seed=0x${SEED.toString(16)}`);
});

test('road fuzz: 3,000 stage taps resolve safely and walk clear paths at 2px intervals', t => {
  const random = seeded(SEED ^ 0x746170), counts = { resolved: 0, ignored: 0, samples: 0, sceneSamples: 0, offRoadInputs: 0, hudInputs: 0 };
  let player = { ...PLAYER_START };
  for (let tap = 0; tap < 3_000; tap++) {
    const point = { x: random() * STAGE.width, y: random() * STAGE.height };
    const context = `tap step=${tap}, input=${pointText(point)}`;
    if (!road().isWalkable(point)) counts.offRoadInputs++;
    if (HUD_ZONES.some(h => point.x >= h.x && point.x < h.x + h.w && point.y >= h.y && point.y < h.y + h.h)) counts.hudInputs++;
    // The scene's onClick handler accepts a tap only when roadPath succeeds.
    // A clamp result alone is not acceptance (even an on-road island can be unreachable).
    const scenePath = roadPath(player, point);
    if (!scenePath) {
      checkPlayer(player, context);
      counts.ignored++;
      continue;
    }
    const target = clampWalk(point);
    checkPlayer(target, context);
    // Disable implicit nearest-point snapping: reaching some other target is not enough.
    const path = road().findPath(player, target, { maxRadius: 0 });
    counts.samples += walkPath(path, player, target, context);
    const sceneGoal = scenePath.at(-1);
    counts.sceneSamples += walkPath(scenePath, player, sceneGoal, `${context}, scene`, true);
    player = { ...sceneGoal };
    counts.resolved++;
  }
  assert.equal(counts.resolved + counts.ignored, 3_000);
  assert.ok(counts.resolved > 0 && counts.offRoadInputs > 0 && counts.hudInputs > 0, 'Exercise road, off-road and HUD taps');
  t.diagnostic(`3,000 taps; ${JSON.stringify(counts)}; seed=0x${(SEED ^ 0x746170).toString(16)}`);
});

test('road fuzz: 5,000 wander draws for each neighbor and side character', t => {
  const random = seeded(SEED ^ 0x77616e64);
  for (const [id, home] of Object.entries(cast)) {
    for (let draw = 0; draw < 5_000; draw++) {
      const target = wanderTarget(id, random), context = `wander character=${id}, step=${draw}`;
      checkRoad(target, context, { home });
      if (Math.abs(target.x - home.x) > WANDER.x || Math.abs(target.y - home.y) > WANDER.y) {
        fail('Wander target left home range', context, target, { home, range: WANDER });
      }
      if (!road().straightClear(home, target)) fail('Wander segment crosses an obstacle', context, target, { home });
    }
  }
  t.diagnostic(`${Object.keys(cast).length * 5_000} draws across ${Object.keys(cast).length} characters; seed=0x${(SEED ^ 0x77616e64).toString(16)}`);
});

test('road fuzz: every scene talk goal is reachable from PLAYER_START and in talk range', t => {
  let samples = 0;
  for (const [step, [id, home]] of Object.entries(cast).entries()) {
    const goal = talkGoal(id, home), context = `talk character=${id}, step=${step}`;
    if (!goal) fail('No talk goal', context, home);
    checkPlayer(goal, context);
    // Match village.js walkTo exactly, including its zero-radius destination rule.
    const path = roadPath(PLAYER_START, goal, 0);
    samples += walkPath(path, PLAYER_START, goal, context, true);
    const nearest = nearestNeighbor(path.at(-1), cast);
    if (nearest !== id) fail('Reached goal is outside this neighbor\'s talk range', context, goal, { nearest, expected: id, home });
  }
  t.diagnostic(`${Object.keys(cast).length} talk goals; ${samples} path samples`);
});


test('road fuzz: every accepted integer position satisfies the full PNG footprint oracle', t => {
  let accepted = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const p = { x, y };
    if (!road().isWalkable(p)) continue;
    checkRoad(p, 'all accepted integer centers');
    checkRoad({ x: x + 0.999, y: y + 0.999 }, 'fractional accepted centers');
    accepted++;
  }
  t.diagnostic(`${accepted} accepted centers and their fractional interiors checked directly against PNG pixels`);
});

test('road fuzz: review tap (870,388), Left, Down reconnects to every talk goal', () => {
  const path = roadPath(PLAYER_START, { x: 870, y: 388 });
  assert.ok(path);
  walkPath(path, PLAYER_START, path.at(-1), 'review initial tap', true);
  let p = path.at(-1);
  for (const key of ['left', 'down']) {
    const next = stepPlayer(p, key);
    assert.ok(sweptOracle(p, next));
    checkPlayer(next, `review ${key}`);
    p = next;
  }
  for (const id of Object.keys(cast)) {
    const goal = talkGoal(id);
    walkPath(roadPath(p, goal, 0), p, goal, `review return to ${id}`, true);
  }
});

test('road fuzz: exhaustive keyboard flood has a graph route to every talk goal', t => {
  const safe = p => footprintOracle(p)
    && p.x >= WALK_BOUNDS.minX && p.x <= WALK_BOUNDS.maxX && p.y >= WALK_BOUNDS.minY && p.y <= WALK_BOUNDS.maxY
    && HUD_ZONES.every(h => p.x - WALK_SHAPE.left >= h.x + h.w || p.x + WALK_SHAPE.right <= h.x
      || p.y - WALK_SHAPE.top >= h.y + h.h || p.y + WALK_SHAPE.bottom <= h.y);
  // Prove all pairs by connected components, instead of repeating the same A* search
  // for each goal at each feet position. Every graph edge and connector is traversable.
  const cols = Math.ceil(png.width / 4), rows = Math.ceil(png.height / 4);
  const nodes = new Uint8Array(cols * rows), components = new Int32Array(nodes.length);
  const center = id => ({ x: (id % cols) * 4 + 2, y: Math.floor(id / cols) * 4 + 2 });
  for (let id = 0; id < nodes.length; id++) nodes[id] = Number(safe(center(id)));
  let component = 0;
  for (let seed = 0; seed < nodes.length; seed++) {
    if (!nodes[seed] || components[seed]) continue;
    const queue = [seed]; components[seed] = ++component;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i], x = id % cols, y = Math.floor(id / cols), a = center(id);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
        const next = id + dx + dy * cols;
        if (!nodes[next] || components[next]) continue;
        if (dx && dy && (!nodes[id + dx] || !nodes[id + dy * cols])) continue;
        const b = center(next);
        if (!sweptOracle(a, b) || !road().straightClear(a, b)) continue;
        components[next] = component; queue.push(next);
      }
    }
  }
  function connector(p) {
    let best = null, distance = Infinity;
    for (let y = Math.max(0, Math.ceil((p.y - 24) / 4 - 0.5)); y < rows && y * 4 + 2 <= p.y + 24; y++) {
      for (let x = Math.max(0, Math.ceil((p.x - 24) / 4 - 0.5)); x < cols && x * 4 + 2 <= p.x + 24; x++) {
        const id = y * cols + x;
        if (!nodes[id]) continue;
        const q = center(id), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d > 24 || d >= distance || !road().straightClear(p, q) || !sweptOracle(p, q)) continue;
        best = id; distance = d;
      }
    }
    return best;
  }
  const startNode = connector(PLAYER_START);
  assert.notEqual(startNode, null);
  const connected = components[startNode];
  for (const id of Object.keys(cast)) {
    const goal = talkGoal(id), link = connector(goal);
    assert.notEqual(link, null, `${id} goal connects to grid`);
    assert.equal(components[link], connected, `${id} shares the spawn component`);
    walkPath(roadPath(PLAYER_START, goal, 0), PLAYER_START, goal, `flood goal ${id}`, true);
  }
  const queue = [{ ...PLAYER_START }], seen = new Set([`${PLAYER_START.x},${PLAYER_START.y}`]);
  let slides = 0;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], link = connector(p);
    assert.notEqual(link, null, `No graph connector at ${pointText(p)}`);
    assert.equal(components[link], connected, `Disconnected keyboard endpoint ${pointText(p)}`);
    // Exercise the actual planner for every endpoint's connector, retaining the exact start.
    const path = roadPath(p, center(link), 0);
    assert.ok(path, `Planner cannot reconnect ${pointText(p)}`);
    assert.deepEqual(path[0], p);
    assert.deepEqual(path.at(-1), center(link));
    checkPlayer(p, `flood endpoint=${i}`);
    for (const key of ['up', 'down', 'left', 'right']) {
      const next = stepPlayer(p, key);
      assert.ok(sweptOracle(p, next), `flood ${key} from ${pointText(p)}`);
      if (p.x !== next.x && p.y !== next.y) slides++;
      const tag = `${next.x},${next.y}`;
      if (!seen.has(tag)) { seen.add(tag); queue.push(next); }
    }
  }
  assert.ok(slides > 0, 'Flood includes corner sliding');
  t.diagnostic(`${queue.length} keyboard-reachable positions × ${Object.keys(cast).length} talk goals proven connected; ${slides} slide edges`);
});
