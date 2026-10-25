import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readPNG } from './helpers/png.js';

const source = new URL('../docs/art/source/neighbors/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', source), 'utf8'));
const size = manifest.frameSize;
const rule = `Rule: "${manifest.rule}"`;
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const equal = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const inside = (x, y, [left, top, right, bottom]) => x >= left && x <= right && y >= top && y <= bottom;
const pixel = (png, x, y) => png.rgba.slice((y * png.width + x) * 4, (y * png.width + x + 1) * 4);

test("the team's reference drawings match their pinned PNG file hashes", () => {
  const message = `the team's reference drawing is the source of truth and is never replaced; to change the art, change the reference and update the pinned hash deliberately. ${rule}`;
  assert.ok(manifest.referenceSha256, message);
  for (const reference of Object.values(manifest.characters)) {
    assert.ok(Object.hasOwn(manifest.referenceSha256, reference.composite), `${reference.composite}: ${message}`);
  }
  for (const [file, hash] of Object.entries(manifest.referenceSha256)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, source))).digest('hex'), hash,
      `${file}: ${message}`);
  }
});

function expectPixel(actual, expected, label, x, y) {
  assert.ok(equal(actual, expected),
    `${label}: pixel (${x}, ${y}) RGBA [${actual}] differs from expected [${expected}]. ${rule}`);
}

function deriveStand(reference) {
  const png = readPNG(new URL(reference.composite, source));
  const { blockSize, offset: [ox, oy] } = reference.grid;
  assert.deepEqual([png.width, png.height], [size * blockSize, size * blockSize], rule);
  const sampled = Array.from({ length: size * size }, (_, i) =>
    pixel(png, (i % size) * blockSize + ox, Math.floor(i / size) * blockSize + oy));
  const background = rgb(reference.background.color);
  const removed = new Set();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inside(x, y, reference.swatchBox)) removed.add(y * size + x);
  }
  const isBackground = i => equal(sampled[i].slice(0, 3), background);
  if (reference.background.removal === 'all') {
    sampled.forEach((_, i) => { if (isBackground(i)) removed.add(i); });
  } else {
    assert.equal(reference.background.removal, 'exterior', rule);
    // Momo's enclosed fur is the same color as the exterior background.
    // Flood only from the canvas border, using four-connected neighbors.
    const visited = new Set();
    const pending = [];
    for (let i = 0; i < size; i++) pending.push([i, 0], [i, size - 1], [0, i], [size - 1, i]);
    while (pending.length) {
      const [x, y] = pending.pop();
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const i = y * size + x;
      if (visited.has(i) || (!removed.has(i) && !isBackground(i))) continue;
      visited.add(i);
      removed.add(i);
      pending.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
  }

  // colorSwap is optional: a reference whose colors already fit the game keeps every color.
  const swap = reference.colorSwap ? { from: rgb(reference.colorSwap.from), to: rgb(reference.colorSwap.to) } : null;
  const expected = { width: size, height: size, rgba: new Uint8Array(size * size * 4) };
  const [dx, dy] = reference.shift;
  let keptRow = 0;
  for (let y = 0; y < size; y++) {
    if (reference.dropRows.includes(y)) continue;
    const ty = keptRow++ + dy;
    for (let x = 0; x < size; x++) {
      const i = y * size + x, tx = x + dx, rgba = sampled[i];
      // Snap alpha to 0/255 and keep transparent pixels at RGBA [0,0,0,0].
      if (removed.has(i) || rgba[3] < manifest.alphaThreshold) continue;
      assert.ok(tx >= 0 && tx < size && ty >= 0 && ty < size,
        `${reference.name}: source pixel (${x}, ${y}) would be clipped. ${rule}`);
      const color = swap && equal(rgba.slice(0, 3), swap.from) ? swap.to : rgba.slice(0, 3);
      expected.rgba.set([...color, 255], (ty * size + tx) * 4);
    }
  }
  return expected;
}

for (const [id, reference] of Object.entries(manifest.characters)) {
  const sheet = readPNG(new URL(`../assets/figures/${id}.png`, import.meta.url));
  const framePixel = (row, col, x, y) => pixel(sheet, col * size + x, row * size + y);

  test(`${reference.name}: front stand is derived exactly from the reference`, () => {
    assert.deepEqual([sheet.width, sheet.height], [size * 4, size * 4], rule);
    const expected = deriveStand(reference);
    let bottom = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const rgba = pixel(expected, x, y);
      expectPixel(framePixel(0, 1, x, y), rgba, `${id} front stand (row 0, column 1)`, x, y);
      if (rgba[3]) bottom = y;
    }
    assert.equal(bottom, reference.feetRow, `${id} feet row. ${rule}`);
  });

  test(`${reference.name}: hand-drawn side stands match the pinned RGBA hashes`, () => {
    for (const [side, row] of [['left', 1], ['right', 2]]) {
      const rgba = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        rgba.set(framePixel(row, 1, x, y), (y * size + x) * 4);
      }
      assert.equal(createHash('sha256').update(rgba).digest('hex'), reference.sideStandSha256[side],
        `${id} ${side} stand (row ${row}, column 1) changed. Update the manifest deliberately to accept new profiles. ${rule}`);
    }
  });

  test(`${reference.name}: joy changes only the eye box`, () => {
    let changes = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const stand = framePixel(0, 1, x, y), joy = framePixel(0, 3, x, y);
      if (!inside(x, y, reference.joyEyeBox)) expectPixel(joy, stand, `${id} joy outside eye box`, x, y);
      if (!equal(joy, stand)) changes++;
    }
    assert.ok(changes > 0, `${id} joy must change the eyes. ${rule}`);
  });

  test(`${reference.name}: walking changes only leg rows 48–56`, () => {
    for (let row = 0; row < 3; row++) for (const col of [0, 2]) {
      let changes = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const stand = framePixel(row, 1, x, y), step = framePixel(row, col, x, y);
        const [left, right] = row === 0 ? reference.frontStepColumns[col / 2] : [0, size - 1];
        if (y < 48 || y > 56 || x < left || x > right) {
          expectPixel(step, stand, `${id} step (row ${row}, column ${col}) outside leg region`, x, y);
        }
        if (!equal(step, stand)) changes++;
      }
      assert.ok(changes > 0, `${id} step (row ${row}, column ${col}) must move the legs. ${rule}`);
    }
  });

  test(`${reference.name}: right frames mirror the left frames`, () => {
    for (let col = 0; col < 3; col++) {
      const leftCol = reference.rightMirrorColumns[col];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        expectPixel(framePixel(2, col, x, y), framePixel(1, leftCol, size - 1 - x, y),
          `${id} right column ${col} mirrors left column ${leftCol}`, x, y);
      }
    }
  });

  if (Object.hasOwn(reference, 'backStandSha256')) {
    test(`${reference.name}: back stand matches the pinned RGBA hash`, () => {
      const rgba = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        rgba.set(framePixel(3, 1, x, y), (y * size + x) * 4);
      }
      assert.equal(createHash('sha256').update(rgba).digest('hex'), reference.backStandSha256,
        `${id} back stand (row 3, column 1) changed. Update the manifest deliberately to accept a new back view. ${rule}`);
    });

    test(`${reference.name}: back walking changes only leg rows 48–56`, () => {
      for (const col of [0, 2]) {
        let changes = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const stand = framePixel(3, 1, x, y), step = framePixel(3, col, x, y);
          if (y < 48 || y > 56) expectPixel(step, stand, `${id} back step (row 3, column ${col}) outside leg region`, x, y);
          if (!equal(step, stand)) changes++;
        }
        assert.ok(changes > 0, `${id} back step (row 3, column ${col}) must move the legs. ${rule}`);
      }
    });

    test(`${reference.name}: unused back joy frame is fully transparent`, () => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        assert.equal(framePixel(3, 3, x, y)[3], 0,
          `${id} back row column 3 must be transparent at (${x}, ${y}). ${rule}`);
      }
    });
  }
}

// Frozen side and back geometry names source-reference pixels, never colors read from the output sheet.
// Runs are [count, reference pixel index]; -1 is transparent. Step patches are
// [destination pixel index, reference pixel index]. Right frames derive only from these expectations.
const referenceGeometry = JSON.parse(readFileSync(new URL('./fixtures/neighbor-side-geometry.json', import.meta.url), 'utf8'));
function referenceRows(reference, geometry, view = 'left') {
  const front = deriveStand(reference);
  const stand = geometry[`${view}StandRuns`].flatMap(([count, source]) => Array(count).fill(source));
  assert.equal(stand.length, size * size, `${view} recipe covers the whole frame`);
  const frames = [0, 1, 2].map(col => {
    const indices = [...stand];
    if (col !== 1) for (const [destination, source] of geometry[`${view}Steps`][col / 2]) indices[destination] = source;
    return indices.map(index => {
      assert.ok(Number.isInteger(index) && index >= -1 && index < size * size, 'valid reference coordinate');
      return index === -1 ? [0, 0, 0, 0] : pixel(front, index % size, Math.floor(index / size));
    });
  });
  if (view === 'back') return [[3, frames]];
  return [[1, frames], [2, reference.rightMirrorColumns.map(col => Array.from({ length: size * size }, (_, i) =>
    frames[col][Math.floor(i / size) * size + size - 1 - i % size]))]];
}
function assertReferenceRows(sheet, reference, geometry, view = 'left') {
  const expected = referenceRows(reference, geometry, view);
  for (const [row, frames] of expected) for (let col = 0; col < 3; col++) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      expectPixel(pixel(sheet, col * size + x, row * size + y), frames[col][y * size + x],
        `${reference.name} reference-derived ${row === 3 ? 'back' : `side ${row - 1}`} frame ${col}`, x, y);
    }
  }
}
for (const [id, reference] of Object.entries(manifest.characters)) {
  test(`${reference.name}: every side stand, step and mirror matches independent reference pixel recipes`, () => {
    const sheet = readPNG(new URL(`../assets/figures/${id}.png`, import.meta.url));
    assertReferenceRows(sheet, reference, referenceGeometry[id]);
  });
  const geometry = referenceGeometry[id];
  if (Object.hasOwn(reference, 'backStandSha256') && geometry?.backStandRuns && geometry.backSteps) {
    test(`${reference.name}: every back stand and step matches independent reference pixel recipes`, () => {
      const sheet = readPNG(new URL(`../assets/figures/${id}.png`, import.meta.url));
      assertReferenceRows(sheet, reference, geometry, 'back');
    });
  }
}
test('side reference checks reject a mirrored recolor even when all side frames agree', () => {
  const sheet = readPNG(new URL('../assets/figures/math.png', import.meta.url));
  let changed = 0;
  for (let y = 64; y < 192; y++) for (let x = 0; x < 192; x++) {
    const at = (y * sheet.width + x) * 4;
    if (equal(sheet.rgba.slice(at, at + 3), [255, 154, 60]) && sheet.rgba[at + 3]) {
      sheet.rgba.set([255, 0, 255], at); changed++;
    }
  }
  assert.ok(changed > 0, 'the isolated mutation changes orange side pixels');
  assert.throws(() => assertReferenceRows(sheet, manifest.characters.math, referenceGeometry.math), /differs from expected/);
});
