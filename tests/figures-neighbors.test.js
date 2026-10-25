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

test('all seven neighbors have side walks and joy faces; only Yuki and Fumi also have back views', () => {
  assert.deepEqual(NEIGHBORS.map(f => f.id), CHARACTERS.map(c => c.id));
  for (const figure of NEIGHBORS) {
    const character = CHARACTERS.find(c => c.id === figure.id);
    assert.deepEqual([figure.name, figure.species], [character.name, character.species]);
    const views = ['art', 'writing'].includes(figure.id) ? ['front', 'left', 'right', 'back'] : ['front', 'left', 'right'];
    assert.deepEqual([figure.views, figure.walks, figure.joy], [views, true, true], figure.id);
  }
});
test('each neighbor wears their subject color', () => {
  for (const figure of NEIGHBORS) assert.ok(frontColors(figure).has(SUBJECT_THEME[figure.id].color), `${figure.id} shows the garment`);
});
