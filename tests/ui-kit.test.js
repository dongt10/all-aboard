import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE, fitStage } from '../src/ui/stage.js';
import { INK, INK_SOFT, PAPER, FINISH, SUBJECT_THEME, contrastRatio } from '../src/ui/palette.js';
import { CHARACTERS } from '../src/data.js';

test('the stage fits a Chromebook window by height and centers sideways', () => {
  const fit = fitStage(1366, 657);
  assert.deepEqual(STAGE, { width: 960, height: 540 });
  assert.ok(Math.abs(fit.scale - 657 / 540) < 1e-9);
  assert.ok(Math.abs(fit.left - (1366 - 960 * fit.scale) / 2) < 1e-9);
  assert.equal(fit.top, 0); assert.equal(fit.portrait, false);
});
test('the stage fits a tall window by width and flags portrait', () => {
  const fit = fitStage(390, 844);
  assert.ok(Math.abs(fit.scale - 390 / 960) < 1e-9);
  assert.equal(fit.left, 0); assert.equal(fit.portrait, true);
});
test('at native size the stage is unscaled', () => {
  assert.deepEqual(fitStage(960, 540), { scale: 1, width: 960, height: 540, left: 0, top: 0, portrait: false });
});
test('every subject color keeps ink text at 4.5:1 or better and the seven colors differ', () => {
  for (const { id } of CHARACTERS) assert.ok(contrastRatio(INK, SUBJECT_THEME[id].color) >= 4.5, id);
  assert.equal(new Set(CHARACTERS.map(({ id }) => SUBJECT_THEME[id].color)).size, 7);
});
test('core text pairs meet their contrast targets', () => {
  assert.ok(contrastRatio(INK, PAPER) >= 7);
  assert.ok(contrastRatio(INK_SOFT, PAPER) >= 4.5);
  assert.ok(contrastRatio(PAPER, FINISH) >= 4.5);
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
});
