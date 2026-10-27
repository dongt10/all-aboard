import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import cart, { cartWeights, fixedCount, LINES } from '../src/ui/activities/cart.js';
import { encounterReady, encounterOpeningDialogue } from '../src/encounters.js';
import { Doc, Event } from './helpers/dom.js';
import { declarations } from './helpers/css.js';

const cmd = id => ({ type: 'command', id });
const pick = weight => ({ type: 'field', weight });
const run = (start, actions, grade) => actions.reduce((s, action) => cart.act(s.state, s.ui, action, grade), start);
const ids = (s, grade) => cart.commands(s.state, s.ui, grade).map(c => c.id);
const finishOf = (s, grade) => cart.commands(s.state, s.ui, grade).at(-1);

test('every line fits one Bigger words page (56 characters)', () => {
  const lines = [LINES.load, LINES.unload, LINES.fixed, LINES.equal, LINES.changed, LINES.full, LINES.empty, LINES.noCargo, LINES.smooth, LINES.wobble('right', 12), LINES.size(5), ...cart.help, cart.notReadyLine];
  for (const line of lines) assert.ok(line.length <= 56, `"${line}" is ${line.length} characters`);
  assert.equal(cart.help.at(-1), 'Choose Roll it!, then Send cart.');
  assert.equal(cart.help[1], 'Tap a crate you loaded to take it off.');
  assert.equal(cart.notReadyLine, 'The load changed. Roll it again.');
});

test('a new cart is pre-loaded on the left per grade band, and the opening tells the truth', () => {
  const cases = [[0, 0, [1, 1]], [1, 1, [2, 1]], [1, 2, [2, 1]], [1, 3, [5, 3]], [1, 4, [5, 3]], [1, 5, [5, 3]]];
  for (const [chapter, grade, left] of cases) {
    const { state, ui } = cart.start(null, { chapter, grade });
    assert.deepEqual([state.left, state.right, state.rolled], [left, [], false], `grade ${grade}`);
    assert.equal(encounterReady(state), false, `grade ${grade} starts unfinished`);
    assert.equal(ui.weight, cartWeights(grade)[0], `grade ${grade} starts on the smallest crate`);
    assert.equal(typeof cart.opening(state, ui, grade), 'string');
  }
  assert.equal(encounterOpeningDialogue(cart.start(null, { chapter: 1, grade: 3 }).state), 'The left side weighs 8. Find crates that add up to 8.');
  assert.equal(encounterOpeningDialogue(cart.start(null, { chapter: 1, grade: 1 }).state), 'The left side weighs 3. Load the right side to match.');
});

test('a saved draft is never re-seeded', () => {
  const draft = { kind: 'math', left: [], right: [2], rolled: false };
  const { state } = cart.start(draft, { chapter: 1, grade: 3 });
  assert.deepEqual([state.left, state.right], [[], [2]]);
  const ready = cart.start({ kind: 'math', left: [2], right: [2], rolled: true }, { chapter: 0, grade: 0 });
  assert.equal(encounterReady(ready.state), true);
  assert.equal(finishOf(ready, 0).disabled, false);
  // A snapshot of another kind counts as new and gets Taro's crates.
  assert.deepEqual(cart.start({ kind: 'art' }, { chapter: 1, grade: 3 }).state.left, [5, 3]);
});

test('Taro’s starting crates stay; the child’s crates come off', () => {
  const remove = (side, index) => ({ type: 'field', remove: { side, index } });
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const s = cart.start(null, { chapter: grade ? 1 : 0, grade });
    Object.freeze(s.state.left); Object.freeze(s.state.right); Object.freeze(s.state); Object.freeze(s.ui);
    assert.equal(fixedCount(s.state, grade), 2);
    assert.equal(fixedCount(s.state), 2);
    for (const index of [0, 1]) {
      const blocked = cart.act(s.state, s.ui, remove('left', index), grade);
      assert.equal(blocked.state, s.state); assert.equal(blocked.ui, s.ui);
      assert.equal(blocked.line, 'Those are Taro’s crates. Load the right side to match.');
      assert.equal(finishOf(blocked, grade).disabled, true);
    }
    const loaded = run(s, [cmd('load-left'), cmd('load-right'), cmd('roll')], grade);
    assert.equal(fixedCount(loaded.state, grade), 2);
    const blocked = cart.act(loaded.state, loaded.ui, remove('left', 0), grade);
    assert.equal(blocked.state, loaded.state); assert.equal(blocked.ui, loaded.ui);
    assert.equal(blocked.state.rolled, true, 'refusal does not reset the roll');
    const leftOff = cart.act(loaded.state, loaded.ui, remove('left', 2), grade);
    assert.deepEqual(leftOff.state.left, s.state.left);
    assert.equal(leftOff.state.rolled, false);
    const rightOff = cart.act(leftOff.state, leftOff.ui, remove('right', 0), grade);
    assert.deepEqual(rightOff.state.right, []);
    assert.equal(fixedCount(rightOff.state, grade), 2);
    const old = cart.start({ kind: 'math', left: [s.state.left[0]], right: [] }, { chapter: grade ? 1 : 0, grade });
    assert.equal(fixedCount(old.state, grade), 0, 'a partial legacy load is not the full starting prefix');
    assert.deepEqual(cart.act(old.state, old.ui, remove('left', 0), grade).state.left, []);
    assert.equal(fixedCount({ ...s.state, left: [3, ...s.state.left] }, grade), 0, 'the starting load must be the prefix');
    for (const action of [remove('middle', 0), remove('left', -1), remove('left', 2), remove('left', '0'), remove('left', 0.5)]) {
      assert.deepEqual(cart.act(s.state, s.ui, action, grade), { state: s.state, ui: s.ui });
    }
  }
  assert.equal(fixedCount(null, 0), 0);
  assert.equal(fixedCount({ left: [] }, 1), 0);
  assert.equal(fixedCount({ left: [1, 2] }, 1), 0);
});

test('four commands in a fixed order, the finish last and disabled until the cart rolled balanced', () => {
  for (const [chapter, grade] of [[0, 0], [1, 2], [1, 5]]) {
    const s = cart.start(null, { chapter, grade });
    assert.deepEqual(ids(s, grade), ['load-left', 'load-right', 'roll', 'finish'], `grade ${grade}`);
    const commands = cart.commands(s.state, s.ui, grade);
    assert.deepEqual(commands.map(c => c.label), ['Load left', 'Load right', 'Roll it!', 'Send cart']);
    assert.deepEqual(commands.map(c => c.icon), ['crate', 'crate', 'play', 'check']);
    assert.ok(commands.every(c => c.label.length <= 12));
    assert.deepEqual([commands[3].finish, commands[3].disabled], [true, true], `grade ${grade} finish starts disabled`);
  }
  // Grade 3: 5 + 3 on the right matches the left 8. The finish stays disabled until Roll it!.
  const s = cart.start(null, { chapter: 1, grade: 3 });
  const loaded = run(s, [pick(5), cmd('load-right'), pick(3), cmd('load-right')], 3);
  assert.deepEqual(loaded.state.right, [5, 3]);
  assert.equal(finishOf(loaded, 3).disabled, true);
  const rolled = cart.act(loaded.state, loaded.ui, cmd('roll'), 3);
  assert.equal(rolled.line, 'A smooth roll! Choose Send cart.');
  assert.deepEqual(ids(rolled, 3), ['load-left', 'load-right', 'roll', 'finish']);
  assert.equal(finishOf(rolled, 3).disabled, false);
  assert.equal(encounterReady(rolled.state), true);
});

test('the crate size rail: one size at K, 1 and 2 for grades 1-2, 1 2 3 5 for grades 3-5', () => {
  assert.deepEqual([cartWeights(0), cartWeights(1), cartWeights(2), cartWeights(3), cartWeights(5)], [[1], [1, 2], [1, 2], [1, 2, 3, 5], [1, 2, 3, 5]]);
  const s = cart.start(null, { chapter: 1, grade: 4 });
  const picked = cart.act(s.state, s.ui, pick(5), 4);
  assert.deepEqual([picked.ui.weight, picked.line, picked.state], [5, 'Next crate weighs 5.', s.state]);
  // Sizes the band does not have are ignored. Picking the same size again still answers, so the lone K crate is never a dead control.
  assert.equal(cart.act(s.state, s.ui, pick(3), 1).ui.weight, 1);
  const again = cart.act(picked.state, picked.ui, pick(5), 4);
  assert.deepEqual([again.ui, again.line], [picked.ui, 'Next crate weighs 5.']);
  const k = cart.start(null, { chapter: 0, grade: 0 });
  assert.equal(cart.act(k.state, k.ui, pick(1), 0).line, 'Next crate weighs 1.');
  const loaded = cart.act(picked.state, picked.ui, cmd('load-right'), 4);
  assert.deepEqual(loaded.state.right, [5]);
});

test('loading says "make the loads equal" until they match, then the equal line once', () => {
  const s = cart.start(null, { chapter: 1, grade: 1 });   // left 2 + 1
  const one = cart.act(s.state, s.ui, cmd('load-right'), 1);
  assert.equal(one.line, 'Make the two loads equal, then roll it.');
  const two = cart.act(one.state, one.ui, cmd('load-right'), 1);
  assert.equal(two.line, 'Make the two loads equal, then roll it.');
  const three = cart.act(two.state, two.ui, cmd('load-right'), 1);
  assert.deepEqual([three.state.right, three.line], [[1, 1, 1], 'Equal! Choose Roll it!']);
  // Taking a crate off breaks the match and says so; putting it back says Equal! again.
  const off = cart.act(three.state, three.ui, { type: 'field', remove: { side: 'right', index: 0 } }, 1);
  assert.equal(off.line, 'One crate off. Make the two loads equal.');
  assert.equal(cart.act(off.state, off.ui, cmd('load-right'), 1).line, 'Equal! Choose Roll it!');
});

test('a wobble names the side and the difference, and changing a rolled cart re-arms the roll', () => {
  const s = cart.start(null, { chapter: 1, grade: 3 });   // left 8
  const wobble = cart.act(s.state, s.ui, cmd('roll'), 3);
  assert.equal(wobble.line, 'Oop, a wobble! The left is heavier by 8.');
  assert.equal(wobble.state.rolled, true);
  assert.equal(finishOf(wobble, 3).disabled, true, 'a wobble never enables Send cart');
  const heavyRight = run(s, [pick(5), cmd('load-right'), cmd('load-right'), cmd('roll')], 3);
  assert.equal(heavyRight.line, 'Oop, a wobble! The right is heavier by 2.');
  // A balanced roll, then a change: the line says to roll again and the finish goes dark.
  const rolled = run(s, [pick(5), cmd('load-right'), pick(3), cmd('load-right'), cmd('roll')], 3);
  assert.equal(finishOf(rolled, 3).disabled, false);
  const changed = cart.act(rolled.state, rolled.ui, cmd('load-left'), 3);
  assert.deepEqual([changed.state.rolled, changed.line], [false, 'The load changed. Roll it again.']);
  assert.equal(finishOf(changed, 3).disabled, true);
});

test('a full side refuses a ninth crate, and an empty cart cannot roll', () => {
  const s = cart.start(null, { chapter: 0, grade: 0 });   // left [1, 1]
  const full = run(s, Array.from({ length: 7 }, () => cmd('load-left')), 0);
  assert.equal(full.state.left.length, 8);
  assert.equal(full.line, 'That side is full. Take a crate off.');
  const emptied = cart.start({ kind: 'math', left: [], right: [], rolled: false }, { chapter: 0, grade: 0 });
  assert.deepEqual(emptied.state.left, []);
  assert.equal(cart.act(emptied.state, emptied.ui, cmd('roll'), 0).line, 'Load some crates first, then roll it.');
  // Unknown actions change nothing.
  assert.equal(cart.act(s.state, s.ui, cmd('unload'), 0).state, s.state);
  assert.equal(cart.act(s.state, s.ui, { type: 'field' }, 0).state, s.state);
});

test('the opening never claims a weight for an emptied left bay', () => {
  const draft = cart.start({ kind: 'math', left: [], right: [2], rolled: false }, { chapter: 1, grade: 3 });
  assert.equal(cart.opening(draft.state, draft.ui, 3), 'The left side is empty. Load crates on both sides.');
  assert.doesNotMatch(cart.opening(draft.state, draft.ui, 3), /weighs 8/);
  const kDraft = cart.start({ kind: 'math', left: [], right: [], rolled: false }, { chapter: 0, grade: 0 });
  assert.doesNotMatch(cart.opening(kDraft.state, kDraft.ui, 0), /two crates/);
  // A loaded left side keeps the real opening, and a sent cart keeps the ready line.
  const fresh = cart.start(null, { chapter: 1, grade: 3 });
  assert.equal(cart.opening(fresh.state, fresh.ui, 3), 'The left side weighs 8. Find crates that add up to 8.');
  const ready = cart.start({ kind: 'math', left: [2], right: [2], rolled: true }, { chapter: 0, grade: 0 });
  assert.match(cart.opening(ready.state, ready.ui, 0), /Try another/);
});

test('both raised cart bays stay below the total badges at either text size', () => {
  const previous = globalThis.document;
  globalThis.document = new Doc();
  try {
    const css = readFileSync(new URL('../src/ui/activities/cart.css', import.meta.url), 'utf8');
    const box = css.match(/\.cart__move\s*\{([^}]+)\}/)[1];
    const px = property => Number(box.match(new RegExp(`${property}:\\s*([\\d.]+)px`))[1]);
    const x = px('left'), y = px('top'), width = px('width'), height = px('height');
    const pivot = { x: x + width / 2, y: y + height };
    const host = document.createElement('div');
    const view = cart.mountField(host, { grade: 1, dispatch() {} });
    for (const side of ['left', 'right']) {
      let s = cart.start({ kind: 'math', left: [], right: [] }, { grade: 1 });
      for (let i = 0; i < 8; i++) {
        s = cart.act(s.state, s.ui, { type: 'command', id: `load-${side}` }, 1);
        view.update(s.state, s.ui);
        const angle = Number(host.querySelector('.cart__body').style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]) * Math.PI / 180;
        const raisedY = Math.min(...[x, x + width].map(cornerX => pivot.y + (cornerX - pivot.x) * Math.sin(angle) - height * Math.cos(angle)));
        for (const badgeBottom of [44, 48.8]) assert.ok(raisedY > badgeBottom, `${side}: bay at ${raisedY} overlaps badge ending at ${badgeBottom}`);
      }
    }
    view.destroy();
  } finally { globalThis.document = previous; }
});

test('the selected crate outline stays inside the field', () => {
  const css = readFileSync(new URL('../src/ui/activities/cart.css', import.meta.url), 'utf8');
  const top = Number(css.match(/\.cart__sizes\s*\{[^}]*top:\s*([\d.]+)px/)[1]);
  const selected = css.match(/\.cart__size\[aria-checked="true"\]\s*\{([^}]+)\}/)[1];
  const lift = Number(selected.match(/translateY\(([-\d.]+)px\)/)[1]);
  const outline = Number(selected.match(/outline:\s*([\d.]+)px/)[1]);
  const offset = Number(selected.match(/outline-offset:\s*([\d.]+)px/)[1]);
  assert.ok(top + lift - outline - offset >= 0, 'selected outline protrudes above the field');
});

test('fixed crates have a flat tie mark at the edge and keep their readable weight', () => {
  const css = readFileSync(new URL('../src/ui/activities/cart.css', import.meta.url), 'utf8');
  const tied = declarations(css, '.cart__crate--fixed::after');
  assert.equal(tied.width, '4px');
  assert.equal(tied.left, '1px');
  assert.equal(tied.height, 'var(--crate-height)');
  assert.equal(tied.background, 'var(--paper-shade)');
  assert.equal(declarations(css, '.cart__crate--fixed').opacity, '1');
  assert.equal(declarations(css, '.cart__crate')['font-size'], 'var(--text-name)');
});

test('the field: a crate rail per band, loaded crates are buttons that take themselves off, arrows walk the rail', () => {
  const previous = globalThis.document;
  globalThis.document = new Doc();
  try {
    for (const [grade, count] of [[0, 1], [1, 2], [2, 2], [3, 4], [5, 4]]) {
      const host = document.createElement('section');
      cart.mountField(host, { grade, dispatch() {} });
      assert.equal(host.querySelectorAll('.cart__size').length, count, `grade ${grade} rail`);
    }
    const sent = [];
    const host = document.createElement('section');
    document.body.append(host);
    host.addEventListener('keydown', () => sent.push('leaked'));   // stands in for the app's arrow handler
    const field = cart.mountField(host, { grade: 3, dispatch: a => sent.push(a) });
    const root = host.children[0];
    const sizes = root.querySelectorAll('.cart__size');
    assert.deepEqual(sizes.map(b => b.dataset.weight), ['1', '2', '3', '5']);
    assert.equal(root.querySelector('.cart__sizes').getAttribute('role'), 'radiogroup');
    const s = cart.start(null, { chapter: 1, grade: 3 });   // left [5, 3]
    const picked = cart.act(s.state, s.ui, pick(3), 3);
    field.update(picked.state, picked.ui);
    assert.deepEqual(sizes.map(b => b.getAttribute('aria-checked')), ['false', 'false', 'true', 'false']);
    assert.deepEqual(sizes.map(b => b.tabIndex), [-1, -1, 0, -1], 'roving tabindex: only the picked size is in the tab order');
    assert.deepEqual(root.querySelectorAll('.cart__total-num').map(n => n.textContent), ['8', '0']);
    // Loaded crates show as buttons with their weight; the right bay is empty and shows its hint.
    const leftCrates = root.querySelectorAll('.cart__crate[data-side="left"]');
    assert.deepEqual(leftCrates.map(b => b.hidden), [false, false, true, true, true, true, true, true]);
    assert.deepEqual(leftCrates.slice(0, 2).map(b => [b.textContent, b.disabled, b.getAttribute('aria-label')]), [['5', true, 'Taro’s 5 crate. Load the right side to match.'], ['3', true, 'Taro’s 3 crate. Load the right side to match.']]);
    assert.ok(leftCrates.slice(0, 2).every(b => b.classList.contains('cart__crate--fixed')));
    assert.ok(leftCrates[0].classList.contains('cart__crate--w5'));
    assert.deepEqual(root.querySelectorAll('.cart__crate[data-side="right"]').map(b => b.hidden), Array(8).fill(true));
    assert.deepEqual(root.querySelectorAll('.cart__hint').map(h => h.hidden), [true, false]);
    assert.equal(root.querySelector('.cart__load[data-side="right"]').getAttribute('aria-label'), 'Load a 3 crate on the right');
    // Taro's crates stay disabled; the child's loaded crates can be taken off.
    leftCrates[1].click();
    leftCrates[1].dispatchEvent(new Event('click'));
    assert.deepEqual(sent, [], 'native and synthetic taps cannot remove fixed crates');
    const loaded = cart.act(picked.state, picked.ui, cmd('load-right'), 3);
    field.update(loaded.state, loaded.ui);
    const rightCrates = root.querySelectorAll('.cart__crate[data-side="right"]');
    assert.equal(rightCrates[0].disabled, false);
    assert.equal(rightCrates[0].getAttribute('aria-label'), 'Take off the 3 crate on the right');
    rightCrates[0].click();
    assert.deepEqual(sent.at(-1), { type: 'field', remove: { side: 'right', index: 0 } });
    root.querySelector('.cart__load[data-side="right"]').click();
    assert.deepEqual(sent.at(-1), { type: 'field', load: 'right' });
    sizes[0].click();
    assert.deepEqual(sent.at(-1), { type: 'field', weight: 1 });
    // Keyboard: ArrowRight on the last size wraps to the first, moves focus and picks it; the app never sees the key.
    sizes[3].focus();
    const arrow = new Event('keydown', { key: 'ArrowRight' });
    sizes[3].dispatchEvent(arrow);
    assert.equal(arrow.stopped, true);
    assert.equal(arrow.defaultPrevented, true);
    assert.equal(document.activeElement, sizes[0]);
    assert.deepEqual(sent.at(-1), { type: 'field', weight: 1 });
    sizes[0].dispatchEvent(new Event('keydown', { key: 'ArrowLeft' }));
    assert.deepEqual([document.activeElement, sent.at(-1)], [sizes[3], { type: 'field', weight: 5 }]);
    assert.ok(!sent.includes('leaked'), 'arrow keys on the rail never reach the app');
    // Other keys pass through untouched.
    sizes[0].dispatchEvent(new Event('keydown', { key: 'Enter' }));
    assert.ok(sent.includes('leaked'));
    // When the focused crate is taken off, focus moves to its bay.
    rightCrates[0].focus();
    const off = cart.act(loaded.state, loaded.ui, { type: 'field', remove: { side: 'right', index: 0 } }, 3);
    field.update(off.state, off.ui);
    assert.equal(document.activeElement, root.querySelector('.cart__load[data-side="right"]'));
    assert.equal(rightCrates[0].hidden, true);
    assert.deepEqual(root.querySelectorAll('.cart__crate[data-side="left"]'), leftCrates);
    assert.deepEqual(root.querySelectorAll('.cart__crate[data-side="right"]'), rightCrates);
    for (const crate of leftCrates.slice(0, 2)) {
      crate.focus();
      assert.notEqual(document.activeElement, crate, 'fixed crates are outside keyboard focus');
    }
    const legacy = cart.start({ kind: 'math', left: [5], right: [] }, { chapter: 1, grade: 3 });
    field.update(legacy.state, legacy.ui);
    assert.equal(leftCrates[0].disabled, false);
    assert.equal(leftCrates[0].classList.contains('cart__crate--fixed'), false);
    assert.equal(leftCrates[1].classList.contains('cart__crate--fixed'), false, 'hidden pool nodes clear the tie');
    leftCrates[0].focus();
    field.update(picked.state, picked.ui);
    assert.equal(leftCrates[0].disabled, true);
    assert.equal(document.activeElement, root.querySelector('.cart__load[data-side="left"]'), 'a newly fixed crate returns focus to its bay');
    // At K the single size is the one in the tab order.
    const kHost = document.createElement('section');
    const kField = cart.mountField(kHost, { grade: 0, dispatch() {} });
    const k = cart.start(null, { chapter: 0, grade: 0 });
    kField.update(k.state, k.ui);
    assert.deepEqual(kHost.querySelectorAll('.cart__size').map(b => [b.getAttribute('aria-checked'), b.tabIndex]), [['true', 0]]);
    field.destroy();
    assert.equal(host.children.length, 0, 'destroy removes the root');
    assert.ok(Object.values(root.listeners).every(list => list.length === 0));
    assert.ok(Object.values(root.querySelector('.cart__move').listeners).every(list => list.length === 0));
    kField.destroy();
  } finally {
    globalThis.document = previous;
  }
});

test('repeated cart rolls preserve saved-state identity while replaying the roll feedback', () => {
  for (const right of [[1], [2]]) {
    const { state, ui } = cart.start({ kind: 'math', left: [1], right, rolled: true }, { chapter: 1, grade: 1 });
    const before = structuredClone(state);
    const result = cart.act(state, ui, cmd('roll'), 1);
    assert.deepEqual(result.state, before, 'saved values are unchanged');
    assert.equal(result.state, state, 'a value-preserving action must return the original saved state');
    assert.equal(result.ui.rolls, ui.rolls + 1, 'the animation can still replay');
    assert.equal(result.ui.lastRoll, right[0] === 1 ? 'smooth' : 'wobble');
    assert.equal(result.line, right[0] === 1 ? LINES.smooth : LINES.wobble('right', 1));
  }
});
