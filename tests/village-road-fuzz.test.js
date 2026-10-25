import test from 'node:test';
import assert from 'node:assert/strict';
import { readPNG } from './helpers/png.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { ROAD_MASK, STAGE } from '../src/ui/village-layout.js';
import {
  setRoad, road, clampWalk, stepPlayer, wanderTarget, roadPath, talkGoal,
  nearestNeighbor, stepToward, PLAYER_START, VILLAGE_SPOTS, SIDE_SPOTS,
  WANDER, WALK_SHAPE, HUD_ZONES,
} from '../src/ui/village-map.js';

// Fixed unsigned 32-bit arithmetic makes failures replayable on every platform.
const SEED = 0x7a11ab1e;
function seeded(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
}
setRoad(createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url)))));
const cast = { ...VILLAGE_SPOTS, ...SIDE_SPOTS };
const pointText = p => JSON.stringify(p);
function fail(reason, context, position, extra = {}) {
  assert.fail(`${reason}; seed=0x${SEED.toString(16)}; ${context}; position=${pointText(position)}; ${JSON.stringify(extra)}`);
}

// Only construct diagnostics on failure: hundreds of thousands of samples stay cheap.
function checkRoad(p, context, extra) {
  if (!road().isWalkable(p)) fail('Footprint left the road', context, p, extra);
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
