import test from 'node:test';
import assert from 'node:assert/strict';
import tales, { HELP, LINES, phaseOf, fieldView } from '../src/ui/activities/tales.js';
import {
  KIND, ACTIVITY, GRADES_TALES, DECK_COUNT, STAMP_TALES, TALE_CAST, TALE_WORDS, TALE_DECKS,
  normalizeTales, cleanTalesCreation, freshDeck, talesReady, talesOpening, currentTale,
  taleIndex, deckOf, findTale, solvedCount, solveTale, nextDeck, talePick, taleProof,
  lineBadgeSVG, taleBookSVG, talesCreationMarkup,
} from '../src/tales.js';
import { CHARACTERS } from '../src/data.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { routeIntent } from '../src/ui/input.js';

const cmd = id => ({ type: 'command', id });
const field = line => ({ type: 'field', line });
const snapshot = (deck = 0, solved = []) => ({ kind: KIND, activity: ACTIVITY, chapter: 1, grade: 3, deck, solved });
const sentences = text => text.split(/(?<=[.!?])\s+/).filter(Boolean);
function fits(text) {
  assert.equal(typeof text, 'string');
  for (const sentence of sentences(text)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
}
function contract(state, ui) {
  const commands = tales.commands(state, ui);
  assert.ok(commands.length > 0 && commands.length <= 4);
  assert.equal(new Set(commands.map(c => c.id)).size, commands.length);
  assert.equal(commands.filter(c => c.finish).length, 1);
  assert.deepEqual(commands.at(-1), { id: 'finish', label: 'Share tales', icon: 'check', finish: true, disabled: !talesReady(state) });
  assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  for (const c of commands) {
    assert.ok(c.label.length <= 12);
    assert.ok(c.art || ICON_NAMES.includes(c.icon));
    if (c.id.startsWith('pick-')) assert.match(c.art, /^<span class="figure /);
    if (c.id.startsWith('line-')) assert.match(c.art, /viewBox="0 0 24 24".*currentColor/);
  }
  fits(tales.opening(state, ui));
  return commands;
}

// These rules and UI modules are imported directly: no registry or shared save wiring is needed.
test('three decks contain nine unique, clue-only tales with valid cast choices', () => {
  assert.equal(DECK_COUNT, 3);
  assert.deepEqual(GRADES_TALES, [3, 4, 5]);
  assert.equal(TALE_DECKS.length, 3);
  const ids = new Set();
  for (const deck of TALE_DECKS) {
    assert.equal(deck.length, 3);
    assert.ok(new Set(deck.map(t => t.proof)).size > 1);
    for (const t of deck) {
      assert.ok(!ids.has(t.id)); ids.add(t.id);
      assert.equal(new Set(t.choices).size, 3);
      assert.ok(t.choices.includes(t.who));
      assert.deepEqual(Object.keys(t.wrong).sort(), t.choices.filter(id => id !== t.who).sort());
      assert.ok([0, 1, 2].includes(t.proof));
      assert.equal(t.lines.length, 3);
      for (const [i, line] of t.lines.entries()) {
        assert.ok(line.length <= 44, line);
        for (const word of [...Object.values(TALE_CAST).map(c => c.name), ...TALE_WORDS, 'he', 'she']) {
          assert.doesNotMatch(line, new RegExp(`\\b${word}\\b`, 'i'));
        }
        if (i !== t.proof) assert.equal(typeof t.about[i], 'string');
      }
      for (const id of t.choices) assert.ok(TALE_CAST[id]);
    }
  }
  assert.equal(ids.size, 9);
  for (const c of CHARACTERS) assert.deepEqual(TALE_CAST[c.id], { name: c.name, color: c.color });
});

test('start owns its normalization, starts fresh from legacy saves, and preserves a saved deck', () => {
  for (const grade of GRADES_TALES) {
    const fresh = tales.start(null, { chapter: 1, grade });
    assert.equal(fresh.state.deck, grade - 3);
    assert.equal(freshDeck(grade), grade - 3);
    assert.deepEqual(fresh.state.found, []);
    assert.deepEqual(fresh.ui, { phase: 'read', pick: null, review: null });
    assert.equal(talesReady(fresh.state), false);
    assert.equal(fresh.state.activity, 'tales');
    contract(fresh.state, fresh.ui);
    for (const legacy of [{ kind: 'reading', found: ['key', 'book', 'umbrella'] }, { kind: 'reading', deck: 0, solved: TALE_DECKS[0].map(t => t.id) }]) {
      assert.deepEqual(tales.start(legacy, { chapter: 1, grade }), fresh);
    }
    const saved = tales.start(snapshot(0, ['momo-kitchen']), { chapter: 1, grade });
    assert.equal(saved.state.deck, 0);
    assert.deepEqual(saved.state.solved, ['momo-kitchen']);
    assert.match(tales.opening(saved.state), /^Tale 2 of 3/);
    assert.equal(tales.opening(saved.state), talesOpening(saved.state));
  }
  assert.equal(tales.kind, 'reading');
  assert.equal(tales.title, 'Whose tale is this?');
  for (const key of ['start', 'opening', 'commands', 'act', 'mountField']) assert.equal(typeof tales[key], 'function');
  assert.equal(tales.start().state.grade, 3);
});

test('cleaning rejects unrelated junk, bounds numbers, filters foreign ids, and round-trips', () => {
  for (const junk of [null, undefined, 7, 'tales', [], {}, { kind: 'reading' }, { kind: 'math', activity: 'tales' }, { kind: 'reading', activity: 'story' }]) {
    assert.equal(cleanTalesCreation(junk), null);
    assert.deepEqual(normalizeTales(junk, 5, 1).solved, []);
  }
  for (const bad of [-1, 3, 7, Infinity, NaN, 1.5, '1', 'x', {}, Symbol('deck')]) {
    assert.equal(normalizeTales({ ...snapshot(), deck: bad }, 5, 1).deck, 0);
  }
  const input = { ...snapshot(1), solved: ['yuki-studio', 'hana-path', 'momo-kitchen', 'hana-path', null, {}, 'pip-letters'], phase: 'prove', pick: 'community', title: '<script>' };
  const safe = normalizeTales(input, 5, 1);
  assert.deepEqual(safe.solved, ['hana-path', 'pip-letters', 'yuki-studio']);
  assert.deepEqual(Object.keys(safe).sort(), ['activity', 'chapter', 'deck', 'found', 'grade', 'kind', 'solved']);
  assert.deepEqual(cleanTalesCreation(safe), safe);
  assert.deepEqual(normalizeTales(safe, safe.grade, safe.chapter), safe);
  for (const chapter of [-99, 2, 99, NaN, Infinity, '1', null]) {
    const clean = cleanTalesCreation({ ...snapshot(), chapter, grade: 999 });
    assert.equal(clean.chapter, 0);
    assert.equal(clean.grade, 0);
    assert.deepEqual(normalizeTales(clean, clean.grade, clean.chapter), clean);
  }
  for (const [grade, expected] of [[-99, 1], [999, 5], [3.6, 4], [NaN, 3], [Infinity, 3], ['5', 3], [Symbol('grade'), 3]]) {
    assert.equal(cleanTalesCreation({ ...snapshot(), grade }).grade, expected);
  }
  for (const solved of [null, 'momo-kitchen', {}, 3]) assert.deepEqual(normalizeTales({ ...snapshot(), solved }).solved, []);
  assert.deepEqual(normalizeTales({ kind: KIND, activity: ACTIVITY, solved: ['fumi-booth'] }, 5, 1).solved, []);
});

test('ready requires a tales reading snapshot, grade 3–5, a real deck, and all three proofs', () => {
  for (let deck = 0; deck < DECK_COUNT; deck++) {
    const ids = TALE_DECKS[deck].map(t => t.id);
    for (const grade of GRADES_TALES) {
      const ready = { ...snapshot(deck, ids), grade };
      assert.equal(talesReady(ready), true);
      for (const missing of ids) assert.equal(talesReady({ ...ready, solved: ids.filter(id => id !== missing) }), false);
      for (const solved of [[], [ids[0], ids[0], ids[0]], TALE_DECKS[(deck + 1) % 3].map(t => t.id), null, {}, 'anything']) {
        assert.equal(talesReady({ ...ready, solved }), false);
      }
      for (const extra of [{ kind: 'math' }, { activity: undefined }, { activity: 'story' }, { deck: -1 }, { deck: 3 }, { deck: '0' }, ...[0, 1, 2, 6, 3.5, undefined].map(grade => ({ grade }))]) {
        assert.equal(talesReady({ ...ready, ...extra }), false);
      }
    }
  }
  assert.equal(talesReady(null), false);
});

for (const grade of GRADES_TALES) for (let deck = 0; deck < DECK_COUNT; deck++) {
  test(`grade ${grade}, deck ${deck}: infer, prove, review, finish, replay; all dialogue fits`, () => {
    let { state, ui } = tales.start(snapshot(deck), { chapter: 1, grade });
    for (const [n, tale] of TALE_DECKS[deck].entries()) {
      Object.freeze(state.solved); Object.freeze(state); Object.freeze(ui);
      const before = contract(state, ui);
      assert.deepEqual(before.slice(0, 3).map(c => c.id), tale.choices.map(id => `pick-${id}`));
      assert.equal(currentTale(state), tale);
      for (const id of Object.keys(tale.wrong)) {
        const wrong = tales.act(state, ui, cmd(`pick-${id}`));
        assert.equal(wrong.state, state); assert.equal(wrong.ui, ui);
        assert.equal(wrong.line, `${tale.wrong[id]} Does any line say that?`);
        fits(wrong.line); assert.deepEqual(tales.commands(wrong.state, wrong.ui), before);
      }
      for (let i = 0; i < 3; i++) {
        const read = tales.act(state, ui, field(i));
        assert.equal(read.state, state); assert.equal(read.ui, ui);
        assert.equal(read.line, `Line ${i + 1}: ${tale.lines[i]}`); fits(read.line);
      }
      const picked = tales.act(state, ui, cmd(`pick-${tale.who}`));
      assert.equal(picked.state, state); assert.equal(picked.ui.phase, 'prove'); fits(picked.line);
      ui = Object.freeze(picked.ui);
      const proofCommands = contract(state, ui);
      assert.deepEqual(proofCommands.map(c => c.id), ['line-0', 'line-1', 'line-2', 'finish']);
      assert.deepEqual(tales.act(state, ui, cmd(`pick-${tale.who}`)), { state, ui });
      for (let i = 0; i < 3; i++) if (i !== tale.proof) {
        for (const action of [field(i), cmd(`line-${i}`)]) {
          const wrong = tales.act(state, ui, action);
          assert.equal(wrong.state, state); assert.equal(wrong.ui, ui);
          assert.equal(wrong.line, `That line tells ${tale.about[i]}. Which line shows who it is?`);
          fits(wrong.line); assert.deepEqual(tales.commands(wrong.state, wrong.ui), proofCommands);
        }
      }
      const tapped = tales.act(state, ui, field(tale.proof));
      const keyed = tales.act(state, ui, cmd(`line-${tale.proof}`));
      assert.deepEqual(tapped, keyed);
      assert.deepEqual(tapped.state.solved, TALE_DECKS[deck].slice(0, n + 1).map(t => t.id));
      assert.equal(state.solved.length, n); fits(tapped.line);
      ({ state, ui } = tapped); contract(state, ui);
      assert.deepEqual(cleanTalesCreation(state), state);
      if (n < 2) {
        assert.equal(phaseOf(state, ui), 'done');
        assert.match(tapped.line, /Choose Next tale\.$/);
        assert.equal(fieldView(state, ui).lines.filter(l => l.proof).length, 1);
        for (let i = 0; i < 3; i++) {
          assert.equal(fieldView(state, ui).lines[i].hidden, false);
          const reread = tales.act(state, ui, field(i));
          assert.equal(reread.line, `Line ${i + 1}: ${tale.lines[i]}`); fits(reread.line);
          assert.equal(reread.state, state);
          assert.deepEqual(tales.act(state, ui, cmd(`line-${i}`)), { state, ui });
        }
        assert.deepEqual(tales.act(state, ui, cmd(`pick-${tale.who}`)), { state, ui });
        const next = tales.act(state, ui, cmd('next'));
        assert.equal(next.state, state); fits(next.line);
        assert.equal(next.line, `Tale ${n + 2}. Who is this one about?`);
        ({ state, ui } = next);
      } else assert.match(tapped.line, /Choose Share tales\.$/);
    }
    assert.equal(talesReady(state), true);
    assert.equal(currentTale(state), null);
    assert.equal(phaseOf(state, ui), 'ready');
    for (let i = 0; i < 3; i++) fits(tales.act(state, ui, field(i)).line);
    const again = tales.act(state, ui, cmd('again'));
    assert.equal(again.state.deck, (deck + 1) % DECK_COUNT);
    assert.deepEqual(again.state.solved, []); fits(again.line);
    contract(again.state, again.ui);
  });
}

test('stale UI and malformed actions cannot skip proof or change a saved object', () => {
  const { state, ui } = tales.start();
  for (const action of [null, {}, cmd('finish'), cmd('next'), cmd('again'), cmd('pick-__proto__'), cmd('line-'), cmd('line-0'), field(-1), field(3), field(0.5), field('0'), field(NaN)]) {
    assert.deepEqual(tales.act(state, ui, action), { state, ui });
  }
  assert.equal(phaseOf(state, { phase: 'prove', pick: 'math' }), 'read');
  assert.equal(phaseOf(state, { phase: 'done', review: 'momo-kitchen' }), 'read');
  assert.equal(solveTale(state, 'foreign'), state);
  const solved = solveTale(state, 'momo-kitchen');
  assert.equal(solveTale(solved, 'momo-kitchen'), solved);
  assert.equal(deckOf(state), TALE_DECKS[0]);
  assert.equal(findTale(state, 'momo-kitchen'), TALE_DECKS[0][0]);
  assert.equal(findTale(state, 'foreign'), null);
  assert.equal(taleIndex(state, 'momo-kitchen'), 0);
  assert.equal(taleIndex(state, 'foreign'), -1);
  assert.equal(solvedCount(solved), 1);
  assert.equal(nextDeck(snapshot(2)).deck, 0);
  assert.equal(talePick(null, 'math'), null);
  assert.equal(talePick(TALE_DECKS[0][0], 'foreign'), null);
  for (const i of [-1, 3, NaN, '1', null]) assert.equal(taleProof(TALE_DECKS[0][0], i), null);
  assert.equal(taleProof(null, 0), null);
});

test('an out-of-order saved subset opens and advances to the first unnamed tale', () => {
  let { state, ui } = tales.start(snapshot(0, ['kiko-stage']));
  assert.equal(tales.opening(state), 'Tale 1 of 3. Who is it about?');
  assert.equal(fieldView(state, ui).head, 'Tale 1 of 3');
  ({ state, ui } = tales.act(state, ui, cmd('pick-science')));
  ({ state, ui } = tales.act(state, ui, field(1)));
  const next = tales.act(state, ui, cmd('next'));
  assert.equal(next.line, 'Tale 2. Who is this one about?');
  assert.equal(fieldView(next.state, next.ui).head, 'Tale 2 of 3');
});

test('help, field text, static and generated lines all fit a dialogue page per sentence', () => {
  assert.deepEqual(HELP, ['Read the three lines of the tale.', 'Choose who the tale is about.', 'Tap the line that proves it.', 'Name three tales, then choose Share tales.']);
  assert.equal(tales.help, HELP);
  assert.equal(tales.notReadyLine, LINES.notReady);
  assert.equal(STAMP_TALES, 'Clues in the text prove who a tale is about.');
  for (const line of [...HELP, STAMP_TALES, ...Object.values(LINES).filter(v => typeof v === 'string')]) fits(line);
  for (let deck = 0; deck < 3; deck++) for (let count = 0; count <= 3; count++) {
    const state = normalizeTales(snapshot(deck, TALE_DECKS[deck].slice(0, count).map(t => t.id)));
    for (const ui of [{ phase: 'read' }, { phase: 'done', review: state.solved.at(-1) }, { phase: 'prove', pick: currentTale(state)?.who }]) {
      const view = fieldView(state, ui);
      for (const line of [view.head, view.label, view.book.title, ...(view.named ? [view.named.name] : []), ...view.lines.flatMap(l => [l.text, l.label])]) fits(line);
    }
  }
});

test('creation SVG filters junk, draws deck-order stamps, and escapes text and attributes', () => {
  assert.equal(talesCreationMarkup, taleBookSVG);
  const valid = normalizeTales(snapshot(0, TALE_DECKS[0].map(t => t.id)));
  const markup = talesCreationMarkup(valid);
  assert.match(markup, /viewBox="0 0 100 65"/);
  assert.match(markup, /Your book of three tales: Momo, Taro and Kiko/);
  assert.equal((markup.match(/<circle /g) ?? []).length, 3);
  assert.doesNotMatch(markup, /stroke-dasharray/);
  const attack = '<img src=x onerror="boom">&\'';
  const malicious = { ...valid, title: attack, name: attack, deck: attack, solved: [attack, 'hana-path'] };
  assert.doesNotMatch(talesCreationMarkup(malicious), /<img|onerror|NaN|Infinity|undefined|hana-path/);
  assert.equal((talesCreationMarkup(malicious).match(/stroke-dasharray/g) ?? []).length, 3);
  for (const junk of [null, {}, [], NaN, Infinity, 'bad']) assert.doesNotMatch(talesCreationMarkup(junk), /NaN|Infinity|undefined/);
  // Even trusted display names are escaped, rather than interpolated as HTML.
  const original = TALE_CAST.science.name;
  try {
    TALE_CAST.science.name = attack;
    const escaped = talesCreationMarkup(valid);
    assert.ok(escaped.includes('&lt;img src=x onerror=&quot;boom&quot;&gt;&amp;&#39;'));
    assert.doesNotMatch(escaped, /<img|aria-label="[^"]*"boom/);
  } finally { TALE_CAST.science.name = original; }
  for (const junk of [attack, null, Infinity, NaN, {}, Symbol('badge')]) {
    assert.doesNotMatch(lineBadgeSVG(junk), /<img|NaN|Infinity|undefined/);
    assert.match(lineBadgeSVG(junk), />[1-3]<\/text>/);
  }
});

// Minimal fake DOM, based on activity-story.test.js, with event/focus support for the roving line buttons.
function fakeDocument() {
  const doc = { activeElement: null };
  const all = el => [el, ...el.children.flatMap(all)];
  const make = tag => {
    const el = {
      tagName: tag.toUpperCase(), children: [], parentElement: null, attrs: {}, classes: new Set(), listeners: new Map(), _text: '', _html: '', hidden: false,
      get className() { return [...el.classes].join(' '); }, set className(v) { el.classes = new Set(v.split(/\s+/).filter(Boolean)); },
      classList: { toggle: (c, on) => { on ? el.classes.add(c) : el.classes.delete(c); } },
      get textContent() { return el._text; }, set textContent(v) { el._text = String(v); el.children = []; },
      get innerHTML() { return el._html; }, set innerHTML(v) { el._html = String(v); el.children = parse(String(v)); el.children.forEach(c => { c.parentElement = el; }); },
      setAttribute: (k, v) => { el.attrs[k] = String(v); }, getAttribute: k => el.attrs[k] ?? null,
      append: (...kids) => { kids.forEach(k => { k.parentElement = el; }); el.children.push(...kids); },
      remove() { if (el.parentElement) el.parentElement.children = el.parentElement.children.filter(c => c !== el); },
      querySelector: sel => el.querySelectorAll(sel)[0] ?? null,
      querySelectorAll: sel => all(el).filter(n => n !== el && n.classes.has(sel.slice(1))),
      closest: sel => el.classes.has(sel.slice(1)) ? el : el.parentElement?.closest(sel),
      addEventListener: (name, fn) => el.listeners.set(name, fn),
      removeEventListener: (name, fn) => { if (el.listeners.get(name) === fn) el.listeners.delete(name); },
      focus: () => { doc.activeElement = el; },
    };
    return el;
  };
  function parse(html) {
    const stack = [{ children: [] }];
    for (const m of html.matchAll(/<(\/?)([a-z]+)([^>]*)>([^<]*)/g)) {
      const [, close, tag, attrs, text] = m;
      if (close) { if (stack.length > 1) stack.pop(); continue; }
      const el = make(tag), cls = /class="([^"]*)"/.exec(attrs);
      if (cls) el.className = cls[1];
      el._text = text; el.parentElement = stack.at(-1);
      stack.at(-1).children.push(el); stack.push(el);
    }
    return stack[0].children;
  }
  return Object.assign(doc, { createElement: make });
}

test('mounted field updates in place; all lines remain reachable and arrows yield to the menu', () => {
  const before = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const host = document.createElement('div'), actions = [];
    const mounted = tales.mountField(host, { dispatch: a => actions.push(a) });
    const root = host.children[0];
    const lines = root.querySelectorAll('.tales-line');
    const text = cls => root.querySelector(cls).textContent;
    let { state, ui } = tales.start();
    mounted.update(state, ui);
    assert.equal(text('.tales-head'), 'Tale 1 of 3');
    assert.equal(text('.tales-book__title'), 'Tales 0/3');
    assert.deepEqual(lines.map(l => l.tabIndex), [0, -1, -1]);
    const key = (i, key) => {
      const event = { target: lines[i], key, prevented: false, preventDefault() { this.prevented = true; } };
      root.listeners.get('keydown')(event); return event;
    };
    lines[0].focus();
    assert.equal(key(0, 'ArrowDown').prevented, true); assert.equal(document.activeElement, lines[1]);
    assert.equal(key(1, 'ArrowDown').prevented, true); assert.equal(document.activeElement, lines[2]);
    assert.equal(key(2, 'ArrowDown').prevented, false);
    assert.equal(key(2, 'ArrowUp').prevented, true); assert.equal(document.activeElement, lines[1]);
    for (const k of ['Enter', ' ']) {
      assert.equal(key(1, k).prevented, false);
      assert.equal(routeIntent({ target: lines[1], key: k }), 'native');
    }
    assert.equal(key(1, 'Tab').prevented, false);
    root.listeners.get('click')({ target: lines[1].querySelector('.tales-line__text') });
    assert.deepEqual(actions, [field(1)]);
    ({ state, ui } = tales.act(state, ui, cmd('pick-science')));
    mounted.update(state, ui);
    assert.ok(root.querySelector('.tales-card').classes.has('tales-card--prove'));
    ({ state, ui } = tales.act(state, ui, field(1)));
    mounted.update(state, ui);
    assert.equal(text('.tales-head'), 'Tale 1 of 3 · ✓ Named');
    assert.equal(text('.tales-named__name'), 'Momo’s tale');
    assert.equal(text('.tales-book__title'), 'Tales 1/3');
    assert.equal(root.querySelectorAll('.tales-slot--filled').length, 1);
    assert.equal(root.querySelectorAll('.tales-line--proof').length, 1);
    assert.ok(lines.every(l => !l.hidden));
    assert.equal(document.activeElement, lines[1]);
    assert.deepEqual(lines.map(l => l.tabIndex), [-1, 0, -1]);
    assert.match(root.querySelector('.tales-named__pic').innerHTML, /figure--science/);
    assert.deepEqual(root.querySelectorAll('.tales-line'), lines);
    const ready = tales.start(snapshot(0, TALE_DECKS[0].map(t => t.id)));
    mounted.update(ready.state, ready.ui);
    assert.equal(text('.tales-head'), 'Three tales, three names!');
    assert.equal(text('.tales-book__title'), 'Tales 3/3');
    assert.equal(root.querySelectorAll('.tales-slot--filled').length, 3);
    assert.deepEqual(root.querySelectorAll('.tales-line'), lines);
    mounted.destroy();
    assert.equal(host.children.length, 0); assert.equal(root.listeners.size, 0);
  } finally { if (before === undefined) delete globalThis.document; else globalThis.document = before; }
});
