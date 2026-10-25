import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { maskFromRGBA, createWalkable } from '../src/ui/walkable.js';

// Rectangles use the same half-open pixel bounds as canvas ImageData.
function roads(width, height, rectangles) {
  const rgba = new Uint8Array(width * height * 4);
  for (const [left, top, w, h] of rectangles) {
    for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) {
      rgba.set([255, 255, 255, 255], (y * width + x) * 4);
    }
  }
  return maskFromRGBA({ width, height, rgba });
}
const horizontal = () => createWalkable(roads(180, 100, [[10, 40, 160, 20]]));
const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
function clearPath(walk, path, start, end) {
  assert.ok(path);
  assert.deepEqual(path[0], start);
  assert.deepEqual(path.at(-1), end);
  for (let i = 0; i < path.length; i++) {
    assert.ok(walk.isWalkable(path[i]));
    if (i) assert.ok(walk.straightClear(path[i - 1], path[i]), `Blocked segment ${i}`);
  }
}

test('RGBA output from the PNG decoder packs one bit per pixel with inclusive thresholds', () => {
  // Mimic readPNG's { width, height, rgba } without adding an encoded fixture.
  const rgba = new Uint8Array(16 * 8 * 4);
  const pixels = [[0, 255, 255], [7, 128, 128], [8, 127, 255], [9, 255, 127], [10, 128, 255], [127, 255, 255]];
  for (const [i, red, alpha] of pixels) rgba.set([red, 0, 0, alpha], i * 4);
  const mask = maskFromRGBA({ width: 16, height: 8, rgba });
  assert.equal(mask.width, 16); assert.equal(mask.height, 8);
  assert.ok(mask.bits instanceof Uint8Array);
  assert.equal(mask.bits.length, 16);
  assert.deepEqual([...mask.bits], [129, 4, ...Array(13).fill(0), 128]);
  assert.deepEqual(maskFromRGBA({ width: 3, height: 1, rgba: new Uint8ClampedArray(12).fill(255) }).bits, new Uint8Array([7]));
  assert.throws(() => maskFromRGBA({ width: 2, height: 2, rgba }), RangeError);
});

test('horizontal road accepts keyboard steps and stops at the last clear sample', () => {
  const walk = horizontal(), from = { x: 50, y: 50 };
  assert.deepEqual(walk.step(from, { x: 74, y: 50 }), { x: 74, y: 50 });
  assert.deepEqual(walk.step(from, { x: 50, y: 26 }), { x: 50, y: 44 });
  assert.deepEqual(walk.step({ x: 50, y: 44 }, { x: 50, y: 20 }), { x: 50, y: 44 });
  assert.deepEqual(walk.step(from, { x: 50, y: 74 }), { x: 50, y: 58 });
  assert.deepEqual(walk.step(from, { x: 51, y: 50 }), { x: 51, y: 50 });
  assert.deepEqual(walk.step(from, from), from);
});

test('straightClear checks the start, endpoint, and intermediate 2px samples', () => {
  const walk = createWalkable(roads(100, 60, [[0, 20, 40, 20], [44, 20, 56, 20]]));
  assert.equal(walk.straightClear({ x: 20, y: 30 }, { x: 70, y: 30 }), false);
  assert.equal(walk.straightClear({ x: 20, y: 30 }, { x: 20, y: 40.5 }), false);
  assert.equal(walk.straightClear({ x: 20, y: 20 }, { x: 20, y: 30 }), false);
  assert.deepEqual(walk.step({ x: 20, y: 30 }, { x: 70, y: 30 }), { x: 32, y: 30 });
});

test('only immediately blocked diagonal moves slide along a clear axis', () => {
  const walk = horizontal();
  assert.deepEqual(walk.step({ x: 50, y: 59 }, { x: 74, y: 83 }), { x: 74, y: 59 });
  const partial = walk.step({ x: 50, y: 55 }, { x: 74, y: 79 });
  assert.ok(partial.x > 50 && partial.x < 74);
  assert.ok(Math.abs(partial.x - 50 - (partial.y - 55)) < 1e-10);
  assert.ok(walk.straightClear({ x: 50, y: 55 }, partial));
});

test('a straight road simplifies to the two exact feet points', () => {
  const walk = horizontal(), from = { x: 25.5, y: 49.25 }, to = { x: 150.5, y: 49.25 };
  assert.deepEqual(walk.findPath(from, to), [from, to]);
  assert.deepEqual(walk.findPath(from, from), [from]);
});

test('an L-shaped road keeps one corner and never cuts across the house', () => {
  const walk = createWalkable(roads(180, 180, [[10, 20, 140, 24], [126, 20, 24, 140]]));
  const from = { x: 26, y: 34 }, to = { x: 138, y: 146 };
  const path = walk.findPath(from, to);
  clearPath(walk, path, from, to);
  assert.equal(path.length, 3);
  assert.ok(path[1].x >= 132 && path[1].y < 44);
  assert.equal(walk.straightClear(from, to), false);
  assert.deepEqual(walk.findPath(from, to), path);
});

test('grid diagonals cannot connect roads touching only at a corner', () => {
  const walk = createWalkable(roads(100, 100, [[4, 4, 40, 40], [44, 44, 40, 40]]));
  assert.equal(walk.findPath({ x: 20, y: 20 }, { x: 64, y: 64 }, { maxRadius: 0 }), null);
});

test('the path goes around a square block and each shortcut remains clear', () => {
  const walk = createWalkable(roads(200, 160, [[10, 10, 180, 30], [10, 120, 180, 30], [10, 10, 30, 140], [160, 10, 30, 140]]));
  const from = { x: 26, y: 80 }, to = { x: 174, y: 80 };
  const path = walk.findPath(from, to);
  clearPath(walk, path, from, to);
  assert.ok(path.length >= 4);
  for (let i = 1; i < path.length - 1; i++) assert.equal(walk.straightClear(path[i - 1], path[i + 1]), false);
});

test('a dead end cannot reach a separate road island', () => {
  const walk = createWalkable(roads(200, 100, [[10, 30, 70, 30], [130, 30, 60, 30]]));
  assert.equal(walk.findPath({ x: 30, y: 46 }, { x: 150, y: 46 }), null);
  assert.equal(walk.findPath({ x: 30, y: 46 }, { x: 105, y: 90 }, { maxRadius: 2 }), null);
});

test('nearest snaps a house point onto the road, respects radius, and breaks ties by y then x', () => {
  const walk = horizontal();
  assert.deepEqual(walk.nearest({ x: 60, y: 20 }), { x: 60, y: 43 });
  assert.equal(walk.nearest({ x: 60, y: 20 }, 22), null);
  assert.deepEqual(walk.nearest({ x: 60, y: 20 }, 23), { x: 60, y: 43 });
  assert.equal(walk.nearest({ x: 60, y: -100 }), null);
  assert.deepEqual(walk.nearest({ x: 60.5, y: 50.25 }, 0), { x: 60.5, y: 50.25 });
  const tie = createWalkable(roads(20, 20, [[10, 8, 1, 1], [8, 10, 1, 1], [12, 10, 1, 1]]), { footprint: [{ x: 0, y: 0 }] });
  assert.deepEqual(tie.nearest({ x: 10, y: 10 }), { x: 10, y: 8 });
  assert.deepEqual(tie.nearest({ x: 10, y: 11 }), { x: 8, y: 10 });
});

test('findPath snaps both endpoints and honors cell and maxRadius overrides', () => {
  const walk = createWalkable(roads(180, 180, [[10, 20, 140, 24], [126, 20, 24, 140]]));
  const from = { x: 26, y: 10 }, to = { x: 160, y: 146 };
  clearPath(walk, walk.findPath(from, to, { cell: 2, maxRadius: 24 }), walk.nearest(from), walk.nearest(to));
  assert.equal(walk.findPath(from, to, { maxRadius: 1 }), null);
  assert.throws(() => walk.findPath(from, to, { cell: 0 }), RangeError);
});

test('the whole feet footprint must fit, including fractional points and mask edges', () => {
  const walk = horizontal();
  assert.equal(walk.isWalkable({ x: 15, y: 50 }), false);
  assert.equal(walk.isWalkable({ x: 16, y: 50 }), true);
  assert.equal(walk.isWalkable({ x: 164, y: 50 }), false);
  assert.equal(walk.isWalkable({ x: 50, y: 42.99 }), false);
  assert.equal(walk.isWalkable({ x: 50, y: 43 }), true);
  assert.equal(walk.isWalkable({ x: 50, y: 59.99 }), true);
  assert.equal(walk.isWalkable({ x: 50, y: 60 }), false);
  const full = createWalkable(roads(20, 20, [[0, 0, 20, 20]]));
  for (const point of [{ x: -0.1, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: NaN, y: 10 }, { x: 10, y: Infinity }]) {
    assert.equal(full.isWalkable(point), false);
  }
  const small = createWalkable(roads(20, 20, [[0, 0, 20, 20]]), { footprint: [{ x: 0, y: 0 }] });
  assert.equal(full.isWalkable({ x: 0, y: 0 }), false);
  assert.equal(small.isWalkable({ x: 0, y: 0 }), true);
  const tuples = createWalkable(roads(20, 20, [[0, 0, 20, 20]]), { footprint: [[0, 0], [-2, 0]] });
  assert.equal(tuples.isWalkable({ x: 1, y: 10 }), false);
  assert.equal(tuples.isWalkable({ x: 2, y: 10 }), true);
});

test('seeded wandering stays inside the box and reaches each point along the road', () => {
  const walk = horizontal(), home = { x: 90, y: 50 }, range = { x: 36, y: 14 };
  const a = seeded(123), b = seeded(123);
  for (let i = 0; i < 100; i++) {
    const p = walk.randomWalkableNear(home, range, a);
    assert.deepEqual(p, walk.randomWalkableNear(home, range, b));
    assert.ok(Math.abs(p.x - home.x) <= range.x && Math.abs(p.y - home.y) <= range.y);
    assert.ok(walk.straightClear(home, p));
  }
});

test('wandering refuses a disconnected island and falls back after the exact retry limit', () => {
  const walk = createWalkable(roads(200, 100, [[10, 30, 70, 30], [130, 30, 60, 30]]));
  const home = { x: 30, y: 46 };
  let calls = 0;
  const random = () => (++calls % 2 ? 1 : 0.5);
  assert.deepEqual(walk.randomWalkableNear(home, { x: 120, y: 0 }, random, 3), home);
  assert.equal(calls, 6);
  assert.deepEqual(walk.randomWalkableNear(home, { x: 120, y: 0 }, random, 0), home);
  assert.equal(calls, 6);
});

test('empty masks and invalid endpoints fail without changing inputs', () => {
  const mask = roads(30, 30, []), before = mask.bits.slice(), walk = createWalkable(mask);
  const from = { x: 15, y: 15 }, to = { x: 20, y: 15 };
  assert.equal(walk.nearest(from), null);
  assert.equal(walk.findPath(from, to), null);
  assert.equal(walk.straightClear(from, to), false);
  assert.deepEqual(walk.step(from, to), from);
  assert.equal(walk.nearest({ x: Infinity, y: 0 }), null);
  assert.equal(walk.nearest(from, -1), null);
  assert.deepEqual(mask.bits, before);
  assert.deepEqual(from, { x: 15, y: 15 });
});

test('fractional endpoint connectors remain clear in the direction of travel', () => {
  const random = seeded(3829);
  for (let run = 0; run < 64; run++) {
    const rgba = new Uint8Array(24 * 24 * 4);
    for (let i = 0; i < 24 * 24; i++) if (random() < 0.85) rgba.set([255, 255, 255, 255], i * 4);
    const walk = createWalkable(maskFromRGBA({ width: 24, height: 24, rgba }), { footprint: [[0, 0]] });
    const from = { x: random() * 24, y: random() * 24 }, to = { x: random() * 24, y: random() * 24 };
    const path = walk.findPath(from, to, { maxRadius: 0 });
    if (path) clearPath(walk, path, from, to);
  }
});

test('a 900px trip across a 960×540 maze computes in under 30ms', t => {
  const rectangles = [];
  for (let i = 0; i < 9; i++) {
    rectangles.push([10 + i * 112, 20, 44, 500]);
    if (i < 8) rectangles.push([10 + i * 112, i % 2 ? 20 : 488, 156, 32]);
  }
  const walk = createWalkable(roads(960, 540, rectangles));
  const from = { x: 30, y: 270 }, to = { x: 930, y: 270 };
  const before = performance.now(), path = walk.findPath(from, to), elapsed = performance.now() - before;
  clearPath(walk, path, from, to);
  assert.ok(path.length >= 16, 'The route must traverse the alternating corridors.');
  t.diagnostic(`Maze: ${elapsed.toFixed(3)}ms; ${path.length} waypoints; 900px endpoint separation.`);
  assert.ok(elapsed < 30, `Maze took ${elapsed.toFixed(3)}ms (budget: 30ms)`);
});
