import test from 'node:test';
import assert from 'node:assert/strict';
import cart, { cartWeights, LINES } from '../src/ui/activities/cart.js';
import { encounterReady, encounterOpeningDialogue } from '../src/encounters.js';

const cmd = id => ({ type: 'command', id });
const pick = weight => ({ type: 'field', weight });
const run = (start, actions, grade) => actions.reduce((s, action) => cart.act(s.state, s.ui, action, grade), start);
const ids = (s, grade) => cart.commands(s.state, s.ui, grade).map(c => c.id);
const finishOf = (s, grade) => cart.commands(s.state, s.ui, grade).at(-1);

test('every line fits one Bigger words page (56 characters)', () => {
  const lines = [LINES.load, LINES.unload, LINES.equal, LINES.changed, LINES.full, LINES.empty, LINES.noCargo, LINES.smooth, LINES.wobble('right', 12), LINES.size(5), ...cart.help, cart.notReadyLine];
  for (const line of lines) assert.ok(line.length <= 56, `"${line}" is ${line.length} characters`);
  assert.equal(cart.help.at(-1), 'Choose Roll it!, then Send cart.');
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
  const emptied = run(s, [{ type: 'field', remove: { side: 'left', index: 1 } }, { type: 'field', remove: { side: 'left', index: 0 } }], 0);
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
  assert.match(cart.opening(ready.state, ready.ui, 0), /ready to send/);
});

// A small DOM stand-in, enough for mountField: elements, classes, data and aria attributes, querySelector by the
// selectors cart.js uses, closest(), focus() and bubbling click/keydown events.
function fakeDocument() {
  const doc = { activeElement: null };
  const matches = (el, sel) => {
    const m = sel.trim().match(/^\.([\w-]+)(?:\[data-(\w+)="(\w+)"\])?$/);
    return Boolean(m) && el.classList.contains(m[1]) && (!m[2] || el.dataset[m[2]] === m[3]);
  };
  const make = tag => {
    const el = {
      tagName: tag.toUpperCase(), children: [], attrs: {}, dataset: {}, style: {}, textContent: '', parent: null, hidden: false, tabIndex: 0, listeners: {},
      classList: { set: new Set(), add(...c) { c.forEach(x => this.set.add(x)); }, remove(...c) { c.forEach(x => this.set.delete(x)); }, contains(c) { return this.set.has(c); } },
      set className(v) { el.classList.set = new Set(v.split(/\s+/).filter(Boolean)); }, get className() { return [...el.classList.set].join(' '); },
      set innerHTML(html) { el.children = parse(html, el); }, get innerHTML() { return ''; },
      setAttribute(k, v) { el.attrs[k] = String(v); }, getAttribute(k) { return el.attrs[k] ?? null; },
      addEventListener(type, fn) { (el.listeners[type] ??= []).push(fn); },
      append(...kids) { for (const k of kids) { k.parent = el; el.children.push(k); } },
      remove() { if (el.parent) el.parent.children = el.parent.children.filter(c => c !== el); el.parent = null; },
      focus() { doc.activeElement = el; },
      closest(sel) { for (let n = el; n; n = n.parent) if (n.classList && matches(n, sel)) return n; return null; },
      querySelectorAll(sel) {
        const [first, ...rest] = sel.trim().split(/\s+/);
        let found = [];
        const walk = n => { for (const c of n.children) { if (matches(c, first)) found.push(c); walk(c); } };
        walk(el);
        for (const part of rest) found = found.flatMap(f => f.querySelectorAll(part));
        return found;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] ?? null; },
      // Bubbles like the DOM: target first, then each parent, until stopPropagation.
      fire(type, props = {}) {
        let stopped = false;
        const event = { type, target: el, key: props.key, preventDefault() {}, stopPropagation() { stopped = true; } };
        for (let n = el; n && !stopped; n = n.parent) for (const fn of n.listeners?.[type] ?? []) fn(event);
        return stopped;
      },
    };
    return el;
  };
  function parse(html, parent) {
    const stack = [{ children: [] }];
    const re = /<(\/?)([a-z]+)([^>]*?)(\/?)>/gi;
    let m;
    while ((m = re.exec(html))) {
      const [, close, tag, attrText, selfClose] = m;
      if (close) { stack.pop(); continue; }
      const el = make(tag);
      for (const [, k, v] of attrText.matchAll(/([\w-]+)="([^"]*)"/g)) {
        if (k === 'class') el.className = v; else if (k.startsWith('data-')) el.dataset[k.slice(5)] = v; else el.attrs[k] = v;
      }
      if (/\shidden(?=\s|$)/.test(attrText)) el.hidden = true;
      el.parent = stack.at(-1); stack.at(-1).children.push(el);
      if (!selfClose) stack.push(el);
    }
    for (const c of stack[0].children) c.parent = parent;
    return stack[0].children;
  }
  doc.createElement = make;
  return doc;
}

test('the field: a crate rail per band, loaded crates are buttons that take themselves off, arrows walk the rail', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    for (const [grade, count] of [[0, 1], [1, 2], [2, 2], [3, 4], [5, 4]]) {
      const host = document.createElement('section');
      cart.mountField(host, { grade, dispatch() {} });
      assert.equal(host.querySelectorAll('.cart__size').length, count, `grade ${grade} rail`);
    }
    const sent = [];
    const host = document.createElement('section');
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
    assert.deepEqual(leftCrates.slice(0, 2).map(b => [b.textContent, b.getAttribute('aria-label')]), [['5', 'Take off the 5 crate on the left'], ['3', 'Take off the 3 crate on the left']]);
    assert.ok(leftCrates[0].classList.contains('cart__crate--w5'));
    assert.deepEqual(root.querySelectorAll('.cart__crate[data-side="right"]').map(b => b.hidden), Array(8).fill(true));
    assert.deepEqual(root.querySelectorAll('.cart__hint').map(h => h.hidden), [true, false]);
    assert.equal(root.querySelector('.cart__load[data-side="right"]').getAttribute('aria-label'), 'Load a 3 crate on the right');
    // Taps: a loaded crate asks to remove itself, a bay asks to load, a size asks for its weight.
    leftCrates[1].fire('click');
    assert.deepEqual(sent.at(-1), { type: 'field', remove: { side: 'left', index: 1 } });
    root.querySelector('.cart__load[data-side="right"]').fire('click');
    assert.deepEqual(sent.at(-1), { type: 'field', load: 'right' });
    sizes[0].fire('click');
    assert.deepEqual(sent.at(-1), { type: 'field', weight: 1 });
    // Keyboard: ArrowRight on the last size wraps to the first, moves focus and picks it; the app never sees the key.
    sizes[3].focus();
    const stopped = sizes[3].fire('keydown', { key: 'ArrowRight' });
    assert.equal(stopped, true);
    assert.equal(document.activeElement, sizes[0]);
    assert.deepEqual(sent.at(-1), { type: 'field', weight: 1 });
    sizes[0].fire('keydown', { key: 'ArrowLeft' });
    assert.deepEqual([document.activeElement, sent.at(-1)], [sizes[3], { type: 'field', weight: 5 }]);
    assert.ok(!sent.includes('leaked'), 'arrow keys on the rail never reach the app');
    // Other keys pass through untouched.
    sizes[0].fire('keydown', { key: 'Enter' });
    assert.ok(sent.includes('leaked'));
    // When the focused crate is taken off, focus moves to its bay.
    leftCrates[1].focus();
    const off = cart.act(picked.state, picked.ui, { type: 'field', remove: { side: 'left', index: 1 } }, 3);
    field.update(off.state, off.ui);
    assert.equal(document.activeElement, root.querySelector('.cart__load[data-side="left"]'));
    assert.equal(leftCrates[1].hidden, true);
    // At K the single size is the one in the tab order.
    const kHost = document.createElement('section');
    const kField = cart.mountField(kHost, { grade: 0, dispatch() {} });
    const k = cart.start(null, { chapter: 0, grade: 0 });
    kField.update(k.state, k.ui);
    assert.deepEqual(kHost.querySelectorAll('.cart__size').map(b => [b.getAttribute('aria-checked'), b.tabIndex]), [['true', 0]]);
    field.destroy();
    assert.equal(host.children.length, 0, 'destroy removes the root');
  } finally {
    globalThis.document = previous;
  }
});
