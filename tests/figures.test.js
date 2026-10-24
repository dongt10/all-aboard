import test from 'node:test';
import assert from 'node:assert/strict';
import { FEET_ROW, allFigures, getFigure, frameFor, figureMarkup, playerFigureId } from '../src/ui/figures/index.js';
import { readPNG } from './helpers/png.js';

test('views map to sheet rows and walk steps to columns', () => {
  const boy = getFigure('player-boy');
  assert.deepEqual(frameFor(boy), { row: 0, col: 1 });
  assert.deepEqual(frameFor(boy, { pose: 'joy' }), { row: 0, col: 3 });
  assert.deepEqual(frameFor(boy, { facing: 'left', step: 1 }), { row: 1, col: 0 });
  assert.deepEqual(frameFor(boy, { facing: 'back', step: 2 }), { row: 3, col: 2 });
  assert.deepEqual(frameFor(boy, { facing: 'right', pose: 'joy' }), { row: 2, col: 1 });
});
test('missing views and non-walkers fall back to the front standing frame', () => {
  const statue = { views: ['front'], walks: false, joy: false };
  assert.deepEqual(frameFor(statue, { facing: 'back', step: 2, pose: 'joy' }), { row: 0, col: 1 });
});
test('markup crops one frame of the sheet at the requested scale', () => {
  assert.equal(figureMarkup('player-boy'),
    '<span class="figure figure--player-boy" style="width:64px;height:64px;background-image:url(assets/figures/player-boy.png);background-size:256px 256px;background-position:-64px 0px" aria-hidden="true"></span>');
  assert.match(figureMarkup('player-girl', { facing: 'back', step: 2, scale: 2 }), /width:128px;height:128px;.*background-size:512px 512px;background-position:-256px -384px/);
  assert.match(figureMarkup('nobody'), /figure--missing/);
});
test('the player figure follows the saved avatar', () => {
  assert.equal(playerFigureId({ avatar: 'girl' }), 'player-girl');
  assert.equal(playerFigureId({ avatar: 'boy' }), 'player-boy');
  assert.equal(playerFigureId(undefined), 'player-boy');
});

const sheetOf = figure => readPNG(new URL(`../${figure.sheet}`, import.meta.url));
const alpha = (png, x, y) => png.rgba[(y * png.width + x) * 4 + 3];
const lum = (png, x, y) => { const i = (y * png.width + x) * 4; return (0.2126 * png.rgba[i] + 0.7152 * png.rgba[i + 1] + 0.0722 * png.rgba[i + 2]) / 255; };
function declaredFrames(figure) {
  const frames = [];
  figure.views.forEach(view => {
    const row = ['front', 'left', 'right', 'back'].indexOf(view);
    frames.push({ row, col: 1, label: `${view} stand` });
    if (figure.walks) frames.push({ row, col: 0, label: `${view} step A` }, { row, col: 2, label: `${view} step B` });
  });
  if (figure.joy) frames.push({ row: 0, col: 3, label: 'joy' });
  return frames;
}
function frameStats(png, row, col) {
  let bottom = -1, edges = 0, darkEdges = 0;
  const mask = [];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const sx = col * 64 + x, sy = row * 64 + y, solid = alpha(png, sx, sy) === 255;
    mask.push(solid ? '#' : '.');
    if (!solid) continue;
    bottom = y;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx < 0 || x + dx > 63 || y + dy < 0 || y + dy > 63 || alpha(png, sx + dx, sy + dy) !== 255);
    if (open) { edges++; if (lum(png, sx, sy) <= 0.25) darkEdges++; }
  }
  return { bottom, darkShare: edges ? darkEdges / edges : 0, mask: mask.join('') };
}

test('every sheet is a crisp 256×256 grid with no half-transparent pixels', () => {
  for (const figure of allFigures()) {
    const png = sheetOf(figure);
    assert.deepEqual([png.width, png.height], [256, 256], figure.id);
    for (let i = 3; i < png.rgba.length; i += 4) assert.ok(png.rgba[i] === 0 || png.rgba[i] === 255, `${figure.id} soft pixel`);
  }
});
test('every declared frame stands on row 56 with a dark outline', () => {
  for (const figure of allFigures()) {
    const png = sheetOf(figure);
    for (const { row, col, label } of declaredFrames(figure)) {
      const stats = frameStats(png, row, col);
      assert.equal(stats.bottom, FEET_ROW, `${figure.id} ${label} feet`);
      assert.ok(stats.darkShare >= 0.9, `${figure.id} ${label} outline ${stats.darkShare.toFixed(2)}`);
    }
  }
});
test('no two figures share a front silhouette', () => {
  const masks = allFigures().map(figure => frameStats(sheetOf(figure), 0, 1).mask);
  assert.equal(new Set(masks).size, masks.length);
});
test('both kids walk in all four directions and have a joy face', () => {
  for (const id of ['player-boy', 'player-girl']) {
    const kid = getFigure(id);
    assert.deepEqual([kid.views, kid.walks, kid.joy], [['front', 'left', 'right', 'back'], true, true]);
  }
});
