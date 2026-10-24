import test from 'node:test';
import assert from 'node:assert/strict';
import { NEIGHBORS } from '../src/ui/figures/neighbors.js';
import { CHARACTERS } from '../src/data.js';
import { SUBJECT_THEME } from '../src/ui/palette.js';
import { readPNG } from './helpers/png.js';

const frontColors = figure => {
  const png = readPNG(new URL(`../${figure.sheet}`, import.meta.url));
  const colors = new Set();
  for (let y = 0; y < 64; y++) for (let x = 64; x < 128; x++) {
    const i = (y * png.width + x) * 4;
    if (png.rgba[i + 3] === 255) colors.add('#' + [0, 1, 2].map(k => png.rgba[i + k].toString(16).padStart(2, '0')).join(''));
  }
  return colors;
};

test('all seven neighbors are drawn with their names, species, side walks and a joy face', () => {
  assert.deepEqual(NEIGHBORS.map(f => f.id), CHARACTERS.map(c => c.id));
  for (const figure of NEIGHBORS) {
    const character = CHARACTERS.find(c => c.id === figure.id);
    assert.deepEqual([figure.name, figure.species], [character.name, character.species]);
    assert.deepEqual([figure.views, figure.walks, figure.joy], [['front', 'left', 'right'], true, true], figure.id);
  }
});
test('each neighbor wears their subject color', () => {
  for (const figure of NEIGHBORS) assert.ok(frontColors(figure).has(SUBJECT_THEME[figure.id].color), `${figure.id} shows the garment`);
});
