import test from 'node:test';
import assert from 'node:assert/strict';
import cart, { cartWeights } from '../src/ui/activities/cart.js';

const cmd = id => ({ type: 'command', id });
const run = (start, actions, grade) => actions.reduce((s, action) => cart.act(s.state, s.ui, action, grade), start);

test('kindergarten loads single crates and can unload', () => {
  const s = cart.start(null, { chapter: 0, grade: 0 });
  assert.deepEqual(cart.commands(s.state, s.ui, 0).map(c => c.id), ['load-left', 'load-right', 'unload', 'roll']);
  const loaded = run(s, [cmd('load-left'), cmd('load-left'), cmd('load-right')], 0);
  assert.deepEqual([loaded.state.left, loaded.state.right], [[1, 1], [1]]);
  const unloaded = cart.act(loaded.state, loaded.ui, cmd('unload'), 0);
  assert.deepEqual([unloaded.state.left, unloaded.state.right], [[1], [1]]);
});
test('older grades loop through their crate sizes', () => {
  assert.deepEqual([cartWeights(0), cartWeights(2), cartWeights(5)], [[1], [1, 2], [1, 2, 3, 5]]);
  const s = cart.start(null, { chapter: 1, grade: 4 });
  assert.equal(s.ui.weight, 2);
  assert.equal(cart.commands(s.state, s.ui, 4)[2].label, 'Crate: 2');
  const sizes = []; let ui = s.ui;
  for (let i = 0; i < 4; i++) { ui = cart.act(s.state, ui, cmd('weight'), 4).ui; sizes.push(ui.weight); }
  assert.deepEqual(sizes, [3, 5, 1, 2]);
  assert.equal(cart.start(null, { chapter: 1, grade: 2 }).ui.weight, 1);
});
test('a balanced roll swaps Roll it! for an enabled Send cart', () => {
  const rolled = run(cart.start(null, { chapter: 1, grade: 1 }), [cmd('load-left'), cmd('load-right'), cmd('roll')], 1);
  assert.equal(rolled.line, 'A smooth roll! Your cart is ready.');
  const last = cart.commands(rolled.state, rolled.ui, 1).at(-1);
  assert.deepEqual([last.id, last.label, last.finish, Boolean(last.disabled)], ['finish', 'Send cart', true, false]);
});
test('an uneven roll names the heavier side, and changing cargo re-arms the roll', () => {
  const wobble = run(cart.start(null, { chapter: 1, grade: 1 }), [cmd('load-left'), cmd('load-left'), cmd('load-right'), cmd('roll')], 1);
  assert.equal(wobble.line, 'Oop, a wobble! The left load is heavier. Let’s adjust it.');
  const changed = cart.act(wobble.state, wobble.ui, { type: 'field', remove: { side: 'left', index: 0 } }, 1);
  assert.deepEqual([changed.state.rolled, changed.line], [false, 'The load changed. Try the cart again.']);
});
test('a full side refuses a ninth crate', () => {
  const full = run(cart.start(null, { chapter: 0, grade: 0 }), Array.from({ length: 9 }, () => cmd('load-left')), 0);
  assert.equal(full.state.left.length, 8);
  assert.equal(full.line, 'That side is full. Try the other side.');
});
