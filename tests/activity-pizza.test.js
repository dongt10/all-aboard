import test from 'node:test';
import assert from 'node:assert/strict';
import pizza, { LINES, PIZZA_GLYPH } from '../src/ui/activities/pizza.js';
import {
  FRIENDS, PIZZA_PLATES, GRADES_PIZZA, STAMP_PIZZA, STAMP_PIZZA_HALVES,
  PIZZA_CUTS, startingSlices, normalizePizza, cleanPizzaCreation, pizzaReady, pizzaOpening,
  pizzaReport, remainingUnits, pieceUnits, shareText, shareWords, tryLine, giveLine, takeLine,
  newLine, cutLine, nudgeLine, pizzaCreationMarkup, sectorPath,
} from '../src/pizza.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';

const cmd = id => ({ type: 'command', id });
const field = data => ({ type: 'field', ...data });
const fresh = grade => pizza.start(null, { grade, chapter: 1 });
const step = (s, action) => pizza.act(s.state, s.ui, action, s.state.grade);
const snapshot = (parts = {}, grade = 3) => normalizePizza(parts, grade, 1);
function fair(grade) {
  let s = fresh(grade);
  if (grade === 5) s = step(s, field({ pizza: true }));
  let i = 0;
  while (remainingUnits(s.state) > 0) s = step(s, field({ give: i++ % 4 }));
  return step(s, cmd('try'));
}
const short = line => {
  assert.equal(typeof line, 'string');
  assert.ok(line.length <= 56, `${line.length} characters: ${line}`);
  assert.ok(!line.includes('½'), `Dialogue spells out halves: ${line}`);
};

test('starts and cycles at raw grades 3, 4, 5; legacy snapshots start fresh', () => {
  assert.equal(PIZZA_PLATES, 4);
  assert.deepEqual(GRADES_PIZZA, [3, 4, 5]);
  const expected = [[8, 12, 4], [12, 8, 4], [6, 10, 8, 12, 4]];
  for (const [i, grade] of GRADES_PIZZA.entries()) {
    assert.deepEqual(PIZZA_CUTS(grade), expected[i]);
    assert.equal(startingSlices(grade), expected[i][0]);
    let s = fresh(grade);
    assert.equal(s.state.activity, 'pizza'); assert.equal(s.state.kind, 'math');
    assert.equal(s.state.grade, grade); assert.equal(s.state.chapter, 1);
    assert.equal(s.state.slices, expected[i][0]);
    for (const legacy of [{ kind: 'math', left: [5, 3], right: [], rolled: true },
      { kind: 'math', game: 'pizza', slices: 4, plates: [2, 2, 2, 2], tried: true },
      { kind: 'science', activity: 'pizza', slices: 4 }]) {
      assert.deepEqual(pizza.start(legacy, { grade, chapter: 1 }), s);
    }
    for (let n = 1; n <= expected[i].length; n++) {
      s = step(s, field({ give: 0 }));
      s = step(s, cmd('try'));
      s = step(s, cmd('new'));
      assert.equal(s.state.slices, expected[i][n % expected[i].length]);
      assert.deepEqual(s.state.plates, [0, 0, 0, 0]);
      assert.equal(s.state.halves, false); assert.equal(s.state.tried, false);
    }
    const done = fair(grade);
    assert.deepEqual(pizza.start(done.state, { grade, chapter: 1 }).state, done.state);
    assert.equal(pizza.opening(done.state), LINES.readyOpening);
    assert.match(pizza.opening(fresh(grade).state), new RegExp(String(startingSlices(grade))));
  }
  assert.equal(step({ state: { ...fresh(3).state, slices: 7 }, ui: {} }, cmd('new')).state.slices, 8);
});

test('four valid commands at every grade; finish last from the start and gated by readiness', () => {
  for (const grade of GRADES_PIZZA) {
    for (const s of [fresh(grade), fair(grade)]) {
      const commands = pizza.commands(s.state, s.ui, grade);
      assert.equal(commands.length, 4);
      assert.deepEqual(commands.map(c => c.id), ['new', 'take', 'try', 'finish']);
      assert.ok(commands.every(c => c.label.length <= 12 && (ICON_NAMES.includes(c.icon) || c.art === PIZZA_GLYPH)));
      assert.equal(commands.filter(c => c.finish).length, 1);
      assert.equal(commands[3].finish, true);
      assert.equal(commands[3].disabled, !pizzaReady(s.state));
      assert.equal(commands[1].disabled, s.state.plates.every(n => n === 0));
      assert.equal(arrangeCommands(commands)[3].id, 'finish');
    }
  }
  assert.match(PIZZA_GLYPH, /viewBox="0 0 24 24"/);
  assert.match(PIZZA_GLYPH, /currentColor/);
  assert.equal(pizza.help.length, 4); assert.match(pizza.help.at(-1), /Serve pizza/);
});

test('normalization repairs junk, bounds numbers and is idempotent without mutating its input', () => {
  for (const grade of GRADES_PIZZA) {
    for (const value of [null, undefined, [], 'pizza', 42, { slices: '8' },
      { slices: 7, plates: [99, -1, 'x', 3, 3], halves: 'yes', tried: 'yes' },
      { plates: [1, 0, 0, 0], halves: false, tried: true },
      { plates: [24, 24, 24, 24], halves: true, tried: true },
      { plates: [2.5, 0, 0, 0] }, { plates: Array(4), tried: true }]) {
      const s = normalizePizza(value, grade, 1);
      assert.deepEqual(s.plates, [0, 0, 0, 0]);
      assert.equal(s.tried, false);
      assert.deepEqual(normalizePizza(s, grade, 1), s);
      assert.deepEqual(cleanPizzaCreation(s), s);
    }
  }
  const input = Object.freeze({ slices: 12, plates: Object.freeze([99, -4, 0, 0]), tried: true });
  assert.deepEqual(normalizePizza(input, 4, 1).plates, [24, 0, 0, 0]);
  for (const grade of [Infinity, -Infinity, NaN, {}, Symbol('bad'), -4, 99, 3.7, '5']) {
    const s = normalizePizza({}, grade, 99);
    assert.ok(Number.isInteger(s.grade) && s.grade >= 0 && s.grade <= 5);
    assert.equal(s.chapter, 0);
  }
  for (const bad of [null, [], 'pizza', 42, {}, { kind: 'math' }, { kind: 'math', activity: 'cart' }, { kind: 'science', activity: 'pizza' }]) {
    assert.equal(cleanPizzaCreation(bad), null);
  }
  const cleaned = cleanPizzaCreation({ kind: 'math', activity: 'pizza', chapter: 1, grade: 99, slices: 10, halves: true, plates: [5, 5, 5, 5], tried: true });
  assert.equal(cleaned.grade, 5); assert.equal(pizzaReady(cleaned), true);
  assert.deepEqual(cleanPizzaCreation(cleaned), cleaned);
  assert.equal(cleanPizzaCreation({ ...cleaned, chapter: 99 }).grade, 0);
});

test('readiness rejects every missing condition and malformed plate arrays', () => {
  const s = fair(3).state;
  assert.equal(pizzaReady(s), true);
  for (const bad of [null, {}, { ...s, activity: undefined }, { ...s, kind: 'science' },
    { ...s, tried: false }, { ...s, tried: 1 }, { ...s, slices: 12 },
    { ...s, plates: [2, 4, 4, 6] }, { ...s, plates: [0, 0, 0, 0] },
    { ...s, plates: [4, 4, 4] }, { ...s, plates: [16] }, { ...s, plates: Array(4) },
    { ...s, plates: ['4', 4, 4, 4] }, { ...s, slices: 0 },
    { ...s, slices: 6, plates: [3, 3, 3, 3], halves: false }]) assert.equal(pizzaReady(bad), false);
  assert.equal(pizzaReady({ ...s, slices: 6, plates: [3, 3, 3, 3], halves: true }), true);
  assert.deepEqual(pizzaReport(snapshot({ plates: [0, 2, 2, 4] })), {
    remaining: 8, remainingWhole: 4, equal: false, share: 0,
    fewest: { name: 'Sora', units: 0 }, most: { name: 'Pip', units: 4 }, allEmpty: false,
  });
  assert.equal(shareText(3), '1½'); assert.equal(shareText(1), '½');
  assert.equal(shareWords(3), '1 and a half'); assert.equal(shareWords(1), 'a half');
});

test('wrong tries keep the work and explain empty, unequal and leftover shares', () => {
  let s = fresh(3);
  assert.equal(step(s, cmd('take')).line, LINES.platesEmpty);
  let tried = step(s, cmd('try'));
  assert.equal(tried.line, LINES.tryEmpty);
  s = step(s, field({ give: 1 }));
  tried = step(s, cmd('try'));
  assert.match(tried.line, /Sora: 0.*Nori: 1.*equal/);
  assert.deepEqual(tried.state.plates, s.state.plates);
  const repeat = step(tried, cmd('try'));
  assert.equal(repeat.state, tried.state); assert.equal(repeat.line, tried.line);
  s = { state: snapshot({ plates: [2, 2, 2, 2] }), ui: {} };
  assert.equal(step(s, cmd('try')).line, 'Each has 1. 4 slices left. Keep going!');
  assert.equal(step(fair(3), field({ give: 0 })).line, LINES.pizzaEmpty);
  assert.equal(step(fair(3), field({ give: 0 })).state.tried, true);
});

test('give/take is pure, undo chooses the last fullest, and every change re-arms Dig in!', () => {
  let s = fresh(3);
  Object.freeze(s.state.plates); Object.freeze(s.state); Object.freeze(s.ui);
  let next = step(s, field({ give: 0 }));
  assert.deepEqual(s.state.plates, [0, 0, 0, 0]); assert.deepEqual(next.state.plates, [2, 0, 0, 0]);
  assert.equal(next.line, 'Sora gets a slice. 7 left on the pizza.');
  next = step(next, field({ take: 0 })); assert.deepEqual(next.state.plates, s.state.plates);
  assert.equal(next.line, LINES.takeSlice);
  next = step({ state: snapshot({ plates: [2, 2, 2, 2] }), ui: {} }, cmd('take'));
  assert.deepEqual(next.state.plates, [2, 2, 2, 0]);
  for (const grade of GRADES_PIZZA) {
    const done = fair(grade);
    assert.equal(pizzaReady(done.state), true);
    const undone = step(done, cmd('take'));
    assert.equal(pizzaReady(undone.state), false); assert.equal(undone.state.tried, false);
    assert.equal(undone.line, LINES.changed);
    const restored = step(undone, field({ give: 3 }));
    assert.equal(pizzaReady(restored.state), false);
    assert.equal(pizzaReady(step(restored, cmd('try')).state), true);
    assert.equal(step(done, cmd('new')).state.tried, false);
  }
  const checked = step(fresh(3), cmd('try'));
  assert.equal(step(checked, field({ give: 0 })).line, LINES.changed);
  for (const action of [null, {}, cmd('unknown'), cmd('finish'), field({}), field({ pizza: false }),
    field({ give: -1 }), field({ give: 4 }), field({ give: 1.5 }), field({ give: '1' }),
    field({ take: null }), field({ give: 0, take: 0 }), field({ take: 0 })]) {
    assert.equal(step(s, action).state, s.state);
  }
});

test('grade 5: leftover nudge, cut once, return halves, then 6/4 and 10/4 mixed shares', () => {
  let s = fresh(5);
  for (let i = 0; i < 4; i++) s = step(s, field({ give: i }));
  assert.equal(s.line, '2 left for 4 friends. Tap the pizza to cut halves.');
  assert.equal(step(s, cmd('try')).line, s.line);
  s = step(step(s, cmd('try')), field({ pizza: true }));
  assert.equal(s.state.tried, false); assert.equal(s.state.halves, true);
  assert.equal(pieceUnits(s.state), 1);
  assert.equal(s.line, 'Every slice is cut in half. Now there are 4 halves.');
  assert.equal(step(s, field({ pizza: true })).state, s.state);
  assert.equal(step(s, field({ pizza: true })).line, LINES.cutAlready);
  for (let i = 0; i < 4; i++) s = step(s, field({ give: i }));
  s = step(s, cmd('try'));
  assert.deepEqual(s.state.plates, [3, 3, 3, 3]);
  assert.equal(s.line, '6 ÷ 4 = 1 and a half each! Choose Serve pizza.');
  assert.equal(step(s, field({ pizza: true })).line, LINES.cutEmpty);
  s = step(s, cmd('new')); assert.equal(s.state.slices, 10);
  s = step(s, field({ pizza: true }));
  for (let i = 0; i < 20; i++) s = step(s, field({ give: i % 4 }));
  assert.equal(step(s, cmd('try')).line, '10 ÷ 4 = 2 and a half each! Choose Serve pizza.');
  assert.equal(step(s, field({ take: 0 })).line, LINES.takeHalf);
  for (const grade of [3, 4]) {
    const start = fresh(grade), tapped = step(start, field({ pizza: true }));
    assert.equal(tapped.state, start.state); assert.equal(tapped.line, LINES.tapHint);
  }
});

test('every possible saved distribution has dialogue lines <=56, including both kinds of halves', () => {
  for (const line of [...Object.values(LINES).filter(v => typeof v === 'string'), ...pizza.help, pizza.notReadyLine, STAMP_PIZZA, STAMP_PIZZA_HALVES]) short(line);
  for (const grade of GRADES_PIZZA) for (const slices of PIZZA_CUTS(grade)) for (const halves of [false, true]) {
    const unit = halves ? 1 : 2, total = slices * 2;
    for (let a = 0; a <= total; a += unit) for (let b = 0; b <= total - a; b += unit)
      for (let c = 0; c <= total - a - b; c += unit) for (let d = 0; d <= total - a - b - c; d += unit) {
        const s = { kind: 'math', activity: 'pizza', grade, chapter: 1, slices, halves, plates: [a, b, c, d], tried: true };
        for (const line of [tryLine(s), pizzaOpening(s), takeLine(s), takeLine(s, true), newLine(s), cutLine(s), nudgeLine(s)]) if (line) short(line);
        for (let i = 0; i < 4; i++) { short(giveLine(s, i, false)); short(giveLine(s, i, true)); }
      }
  }
});

test('small creation is a safe quarter-share picture and rejects injected text/numbers', () => {
  const markup = pizzaCreationMarkup(fair(3).state);
  assert.match(markup, /viewBox="0 0 90 45"/);
  assert.match(markup, /aria-label="Your pizza party, 2 slices each"/);
  assert.equal((markup.match(/r="8"/g) ?? []).length, 4);
  assert.equal((markup.match(/A6 6/g) ?? []).length, 4);
  assert.match(pizzaCreationMarkup(fresh(3).state), /r="13"/);
  assert.match(pizzaCreationMarkup(fair(5).state), /1½ slices each/);
  const attack = '"><script>alert(1)</script><svg onload="evil"';
  for (const value of [null, attack, { kind: attack, name: attack, grade: attack, slices: attack, plates: [attack, Infinity, NaN, {}] },
    { ...fair(3).state, title: attack, text: attack, plates: [Symbol('x'), {}, null, attack] }]) {
    const html = pizzaCreationMarkup(value);
    assert.doesNotMatch(html, /<script|onload|NaN|Infinity|undefined|alert\(/);
    assert.match(html, /^<svg.*<\/svg>$/);
  }
  assert.doesNotMatch(sectorPath(attack, Infinity, NaN, attack), /script|NaN|Infinity/);
  assert.equal(sectorPath(0, 0, 6, 0), '');
  assert.match(sectorPath(0, 0, 6, 360), /a6 6/);
});

// Small DOM double: models persistent nodes, focus and delegated events without a dependency.
function fakeDoc() {
  const doc = { activeElement: null };
  const matches = (el, sel) => sel.startsWith('.') ? el.classList.contains(sel.slice(1)) : el.tagName === sel.toUpperCase();
  const make = tag => {
    const el = { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], attrs: {}, dataset: {}, style: {}, parent: null, hidden: false, listeners: {}, textContent: '',
      classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); }, toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); } },
      set className(v) { this.classList.set = new Set(v.split(/\s+/)); }, get className() { return [...this.classList.set].join(' '); },
      set innerHTML(html) { this.children = parse(html, this); },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
      append(...kids) { for (const kid of kids) { kid.parent = this; this.children.push(kid); } },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
      addEventListener(k, fn) { this.listeners[k] = fn; }, removeEventListener(k) { delete this.listeners[k]; },
      focus() { doc.activeElement = this; }, closest(sel) { return matches(this, sel) ? this : this.parent?.closest(sel) ?? null; },
      contains(other) { return other === this || this.children.some(c => c.contains(other)); },
      querySelectorAll(sel) { return this.children.flatMap(c => [...(matches(c, sel) ? [c] : []), ...c.querySelectorAll(sel)]); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
    };
    return el;
  };
  function parse(html, parent) {
    const top = make('div'), stack = [top];
    for (const [, closing, tag, attrs, selfClose] of html.matchAll(/<(\/?)([a-z]+)([^>]*?)(\/?)>/gi)) {
      if (closing) { stack.pop(); continue; }
      const node = make(tag);
      for (const [, key, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) {
        if (key === 'class') node.className = value;
        else if (key.startsWith('data-')) node.dataset[key.slice(5)] = value;
        else node.setAttribute(key, value);
      }
      node.hidden = /\bhidden\b/.test(attrs);
      stack.at(-1).append(node);
      if (!selfClose && !['path', 'circle', 'rect', 'line'].includes(tag)) stack.push(node);
    }
    top.children.forEach(c => { c.parent = parent; });
    return top.children;
  }
  doc.createElement = make;
  return doc;
}

test('field pools buttons, shows reactions, has sibling give/pieces and recovers focus', () => {
  const doc = fakeDoc(), host = doc.createElement('section'), actions = [];
  const fieldView = pizza.mountField(host, { grade: 5, dispatch: a => actions.push(a) });
  const root = host.children[0], board = root.querySelector('.pizza-board');
  const gives = root.querySelectorAll('.pizza-give'), pieces = root.querySelectorAll('.pizza-piece');
  assert.equal(root.querySelectorAll('.pizza-board').length, 1); assert.equal(gives.length, 4); assert.equal(pieces.length, 48);
  assert.equal(pieces[0].parent.parent, gives[0].parent);
  assert.equal(gives[0].contains(pieces[0]), false);
  assert.equal(gives[0].parent.children[4], pieces[0].parent);
  let s = fresh(5); fieldView.update(s.state, s.ui);
  assert.equal(pieces.filter(b => !b.hidden).length, 0);
  root.listeners.click({ target: gives[0].querySelector('.pizza-count') });
  assert.deepEqual(actions.pop(), field({ give: 0 }));
  s = step(s, field({ give: 0 })); fieldView.update(s.state);
  assert.equal(root.querySelectorAll('.pizza-give')[0], gives[0]);
  assert.equal(pieces.filter(b => !b.hidden).length, 1);
  assert.equal(gives[0].classList.contains('pizza-give--got'), true);
  assert.match(gives[0].getAttribute('aria-label'), /Sora has 1/);
  fieldView.update(step(s, cmd('try')).state);
  assert.equal(gives[1].querySelector('.pizza-worry').hidden, false);
  root.listeners.click({ target: pieces[0] }); assert.deepEqual(actions.pop(), field({ take: 0 }));
  pieces[0].focus(); s = step(s, field({ take: 0 })); fieldView.update(s.state);
  assert.equal(doc.activeElement, gives[0]);
  root.listeners.click({ target: board }); assert.deepEqual(actions.pop(), field({ pizza: true }));
  fieldView.update(fair(5).state);
  assert.equal(root.querySelector('.pizza-equation').textContent, '6 ÷ 4 = 1½');
  assert.ok(gives.every(b => !b.querySelector('.pizza-joy').hidden));
  assert.equal(pieces.filter(b => !b.hidden).length, 8);
  assert.equal(pieces.filter(b => !b.hidden && b.classList.contains('pizza-piece--half')).length, 4);
  assert.equal(root.querySelectorAll('.pizza-wedge').filter(n => n.getAttribute('visibility') === 'visible').length, 0);
  fieldView.update(snapshot({ slices: 12, plates: [24, 0, 0, 0] }, 4));
  assert.equal(pieces.filter(b => !b.hidden).length, 12);
  fieldView.destroy(); assert.equal(host.children.length, 0); assert.deepEqual(root.listeners, {});
});

test('keyboard rail focuses only; Down and native Enter/Space are left for frame/browser', () => {
  const doc = fakeDoc(), host = doc.createElement('section'), actions = [];
  const view = pizza.mountField(host, { dispatch: a => actions.push(a) });
  const root = host.children[0], gives = root.querySelectorAll('.pizza-give');
  view.update(fresh(3).state);
  let prevented = false;
  root.listeners.keydown({ key: 'ArrowRight', target: gives[0], preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(doc.activeElement, gives[1]);
  assert.deepEqual(gives.map(b => b.tabIndex), [-1, 0, -1, -1]); assert.deepEqual(actions, []);
  for (const target of [gives[1], root.querySelector('.pizza-board'), root.querySelector('.pizza-piece')]) {
    for (const key of ['ArrowDown', 'Enter', ' ']) root.listeners.keydown({ key, target, preventDefault() { assert.fail(`${key} was consumed`); } });
  }
  root.listeners.focusin({ target: gives[3] });
  assert.deepEqual(gives.map(b => b.tabIndex), [-1, -1, -1, 0]);
  root.listeners.keydown({ key: 'ArrowRight', target: gives[3], preventDefault() {} });
  assert.equal(doc.activeElement, gives[3]);
  view.destroy();
});
