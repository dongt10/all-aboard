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

  const from = rgb(reference.colorSwap.from), to = rgb(reference.colorSwap.to);
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
      const color = equal(rgba.slice(0, 3), from) ? to : rgba.slice(0, 3);
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
}
