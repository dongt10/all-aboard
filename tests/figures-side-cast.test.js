import test from 'node:test';
import assert from 'node:assert/strict';
import { SIDE_CAST } from '../src/ui/figures/side-cast.js';

test('Pip and Nori wander with side views; Cricket stands on the music stage', () => {
  assert.deepEqual(SIDE_CAST.map(f => [f.id, f.name, f.species]), [['pip', 'Pip', 'duck'], ['nori', 'Nori', 'turtle'], ['cricket', 'Cricket', 'cricket']]);
  assert.ok(SIDE_CAST.every(f => f.joy));
  assert.deepEqual(SIDE_CAST.map(f => [f.views, f.walks]), [[['front', 'left', 'right'], true], [['front', 'left', 'right'], true], [['front'], false]]);
});
