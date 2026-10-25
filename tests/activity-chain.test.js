import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import activity, { CARDS, LINES, HELP, nextNeedLine, tenthWord, cardLine, energyLine } from '../src/ui/activities/chain.js';
import {
  GRADES_CHAIN, STAMP_CHAIN, CHAIN_CARDS, EATS, ENERGY_TILES, normalizeChain,
  chainReady, chainOpening, cleanChainCreation, chainCreationMarkup,
  sunEnergy, energyTiles, expectedEnergy, openCardSlot, openEnergySlot,
  placeCard, placeEnergy, chainComplete,
} from '../src/chain.js';
import { ICON_NAMES } from '../src/ui/icons.js';

const cmd = id => ({ type: 'command', id });

test('chart cards, tiles, plate labels and energy chips use the 20/24px field scale', () => {
  const css = readFileSync(new URL('../src/ui/activities/chain.css', import.meta.url), 'utf8');
  for (const selector of ['.chain-card', '.chain-tile', '.chain-word', '.chain-energy']) {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors.split(',').some(s => s.trim() === selector));
    const fonts = rules.flatMap(([, , declarations]) => [...declarations.matchAll(/font-size:\s*([^;]+);/g)].map(m => m[1]));
    assert.equal(fonts.at(-1), 'var(--text-field)', selector);
  }
});

test('chart rows and stacked cards leave room for Bigger words inside the field', () => {
  const css = readFileSync(new URL('../src/ui/activities/chain.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some(s => s.trim() === selector)).map(([, , declarations]) => declarations).join(' ');
  const px = (selector, property) => Number(rule(selector).match(new RegExp(`${property}:\\s*([\\d.]+)px`))[1]);
  const row = px('.chain-row', 'height'), cards = px('.chain-cards', 'height'), tiles = px('.chain-tiles', 'height');
  const height = px('.chain-field', 'height');
  const verticalPadding = Number(rule('.chain-field').match(/padding:\s*([\d.]+)px/)[1]) * 2;
  assert.ok(verticalPadding + row + cards + tiles + px('.chain-cards', 'margin-top') + px('.chain-tiles', 'margin-top') <= height);
  // A 24px label, 16px glyph, two 3px borders and two 2px paddings fit a card.
  assert.ok(px('.chain-card', 'height') >= 24 + 16 + 6 + 4);
  assert.match(rule('.chain-card'), /flex-direction:\s*column/);
  assert.ok(4 * px('.chain-card', 'width') + 3 * px('.chain-cards', 'gap') <= 520 - 28);
  // Plate: picture, label, chip (including its frame), gaps, padding and border.
  assert.ok(px('.chain-plate', 'height') >= 48 + 24 * 1.2 + (24 * 1.1 + 4 + 8) + 6 + 12 + 6);
});
const field = values => ({ type: 'field', ...values });
const start = grade => activity.start(null, { grade, chapter: 1 });
const full = (grade = 3, eater = 'otter') => normalizeChain({
  kind: 'science', activity: 'chain', chain: ['plant', 'fish', eater],
  energy: expectedEnergy(grade), shone: true,
}, grade, 1);
const shortSentences = line => {
  assert.equal(typeof line, 'string');
  for (const sentence of line.match(/[^.!?]+[.!?]?/g) ?? []) {
    assert.ok(sentence.trim().length <= 56, `${sentence.trim().length}: ${sentence}`);
  }
  assert.doesNotMatch(line, /Shine! [a-z]/);
};
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

for (const grade of GRADES_CHAIN) {
  test(`grade ${grade}: own snapshot, legacy migration, commands and complete play`, () => {
    let { state, ui } = start(grade);
    assert.deepEqual(state, { kind: 'science', activity: 'chain', grade, chapter: 1, chain: [null, null, null], energy: [null, null, null], shone: false });
    assert.deepEqual(ui, { shine: 0 });
    assert.equal(activity.opening(state), LINES.opening);
    const legacy = { ...full(grade), activity: undefined, canopy: 'left', time: 20 };
    assert.deepEqual(activity.start(legacy, { grade, chapter: 1 }).state, state);
    assert.equal(activity.commands(state)[2].disabled, true);
    for (const eater of ['otter', 'gull']) {
      ({ state, ui } = start(grade));
      for (let i = 0; i < 3; i++) {
        const card = ['plant', 'fish', eater][i];
        const before = structuredClone(state);
        const result = activity.act(deepFreeze(state), deepFreeze(ui), field({ card }), grade);
        assert.deepEqual(state, before);
        assert.notEqual(result.state, state);
        assert.equal(result.state.chain[i], card);
        assert.ok(result.line.startsWith(LINES.placed[card]));
        assert.equal(result.line, cardLine(card, state, grade));
        ({ state, ui } = result);
        assert.equal(nextNeedLine(state), LINES.needNumber(i + 1));
        const n = expectedEnergy(grade)[i];
        const placed = activity.act(state, ui, field({ energy: n }), grade);
        assert.equal(placed.state.energy[i], n);
        assert.equal(placed.line, energyLine(placeEnergy(state, n), grade));
        assert.match(placed.line, new RegExp(`Plate ${i + 1} gets ${n}\\.`));
        assert.match(placed.line, grade === 5 ? /10% of/ : /One tenth of/);
        shortSentences(placed.line);
        ({ state, ui } = placed);
      }
      assert.equal(chainComplete(state), true);
      assert.equal(chainReady(state), false);
      assert.equal(nextNeedLine(state), LINES.allSet);
      const lit = activity.act(state, ui, cmd('shine'), grade);
      assert.equal(chainReady(lit.state), true);
      assert.equal(lit.ui.shine, 1);
      assert.equal(lit.line, LINES.shine(tenthWord(grade)));
      assert.equal(activity.opening(lit.state), LINES.openingReady);
      const replay = activity.act(lit.state, lit.ui, cmd('shine'), grade);
      assert.equal(replay.state, lit.state);
      assert.equal(replay.ui.shine, 2);
      assert.equal(replay.line, LINES.ready);
      assert.equal(activity.commands(lit.state).at(-1).disabled, false);
      for (const action of [field({ card: 'gull' }), field({ card: 'plant' }), field({ energy: 500 }), cmd('needs'), cmd('finish'), cmd('unknown')]) {
        assert.equal(activity.act(lit.state, lit.ui, action).state, lit.state);
      }
      const reset = activity.act(lit.state, lit.ui, cmd('reset'));
      assert.deepEqual(reset.state, start(grade).state);
      assert.equal(reset.line, LINES.reset);
      assert.equal(chainReady(reset.state), false);
    }
    for (const s of [start(grade).state, { ...full(grade), shone: false }, full(grade)]) {
      const commands = activity.commands(s);
      assert.equal(commands.length, 4);
      assert.equal(new Set(commands.map(c => c.id)).size, 4);
      assert.equal(commands.filter(c => c.finish).length, 1);
      assert.equal(commands.at(-1).finish, true);
      assert.equal(commands.at(-1).disabled, !chainReady(s));
      for (const c of commands) {
        assert.ok(c.label.length <= 12);
        assert.ok(ICON_NAMES.includes(c.icon));
      }
    }
  });
}

test('ready requires the exact order, numbers, grade, discriminator and Shine', () => {
  assert.equal(chainReady(null), false);
  for (const grade of GRADES_CHAIN) {
    const ready = full(grade);
    for (const eater of ['otter', 'gull']) assert.equal(chainReady(full(grade, eater)), true);
    for (let i = 0; i < 3; i++) {
      for (const value of [null, 'junk', ...CHAIN_CARDS.filter(c => c !== ready.chain[i] && !(i === 2 && c === 'gull'))]) {
        const chain = [...ready.chain]; chain[i] = value;
        assert.equal(chainReady({ ...ready, chain }), false);
      }
      for (const value of [null, Infinity, -1, 1.5, ...ENERGY_TILES.filter(n => n !== ready.energy[i])]) {
        const energy = [...ready.energy]; energy[i] = value;
        assert.equal(chainReady({ ...ready, energy }), false);
      }
    }
    for (const patch of [{ shone: false }, { shone: 1 }, { grade: 2 }, { grade: '3' }, { kind: 'math' }, { activity: undefined }, { energy: [...ready.energy, 1] }, { chain: [...ready.chain, 'gull'] }, { energy: null }, { chain: null }]) {
      assert.equal(chainReady({ ...ready, ...patch }), false);
    }
  }
});

test('all wrong cards explain the food and preserve the same state', () => {
  for (const card of ['fish', 'otter', 'gull']) {
    const { state, ui } = start(3);
    const result = placeCard(state, card);
    assert.equal(result.status, 'wrong');
    assert.equal(result.food, 'sunlight');
    const tried = activity.act(state, ui, field({ card }));
    assert.equal(tried.state, state);
    assert.equal(tried.line, `${CARDS.find(c => c.id === card).plural} cannot use sunlight. Who makes food from sunlight?`);
  }
  const { ui } = start(3), state = placeCard(start(3).state, 'plant').state;
  for (const card of ['otter', 'gull']) {
    const result = activity.act(state, ui, field({ card }));
    assert.equal(result.state, state);
    assert.equal(result.line, `${CARDS.find(c => c.id === card).plural} do not eat sea plants. Who nibbles sea plants?`);
  }
  assert.equal(placeCard(state, 'plant').status, 'used');
  assert.equal(placeCard(full(), 'gull').status, 'full');
  assert.equal(placeCard(state, '<script>').status, 'unknown');
  assert.equal(openCardSlot(full().chain), 3);
});

test('number errors at grades 3 and 5 preserve work and explain amounts', () => {
  for (const grade of [3, 5]) {
    const { state: empty, ui } = start(grade);
    const state = placeCard(empty, 'plant').state;
    const cases = [[sunEnergy(grade), 'same'], [sunEnergy(grade) / 2, 'high'], [expectedEnergy(grade)[1], 'low']];
    for (const [energy, status] of cases) {
      const result = placeEnergy(state, energy);
      assert.equal(result.status, status);
      assert.equal(result.state, state);
      const tried = activity.act(state, ui, field({ energy }));
      assert.equal(tried.state, state);
      assert.equal(tried.line, status === 'same' ? LINES.same : LINES[status](tenthWord(grade)));
    }
    const nowhere = placeEnergy(empty, energyTiles(grade)[0]);
    assert.equal(nowhere.status, 'nowhere');
    assert.equal(energyLine(nowhere), LINES.nowhereEmpty);
    assert.equal(energyLine(placeEnergy({ ...full(grade), shone: false }, energyTiles(grade)[0])), 'Every number is in. Choose Shine!');
    assert.equal(placeEnergy(state, -3).status, 'unknown');
    // With a numbered prefix and another empty plate, the number rail asks for a creature.
    const partial = placeEnergy(state, expectedEnergy(grade)[0]).state;
    assert.equal(openEnergySlot(partial), -1);
    assert.equal(energyLine(placeEnergy(partial, energyTiles(grade)[0])), LINES.needCard2);
  }
});

test('Shine early, Next step, unknown and empty reset preserve state and ui', () => {
  const { state, ui } = start(3);
  for (const action of [cmd('shine'), cmd('needs'), cmd('reset'), cmd('finish'), {}, null, field({}), field({ energy: '<script>' }), field({ card: '__proto__' })]) {
    const result = activity.act(deepFreeze(state), deepFreeze(ui), action);
    assert.equal(result.state, state);
    assert.equal(result.ui, ui);
  }
  assert.equal(activity.act(state, ui, cmd('shine')).line, LINES.needCard1);
  assert.equal(activity.act(state, ui, cmd('reset')).line, undefined);
});

test('cleaning validates prefixes, whitelisted integers and bounded scope', () => {
  for (const junk of [null, false, [], 'science', {}, { kind: 'math', activity: 'chain' }, { kind: 'science' }]) assert.equal(cleanChainCreation(junk), null);
  for (const grade of GRADES_CHAIN) {
    const saved = full(grade);
    assert.deepEqual(cleanChainCreation(JSON.parse(JSON.stringify(saved))), saved);
    for (let i = 0; i < 3; i++) {
      const bad = structuredClone(saved); bad.chain[i] = '<script>';
      const cleaned = cleanChainCreation(bad);
      assert.deepEqual(cleaned.chain.slice(i), Array(3 - i).fill(null));
      assert.deepEqual(cleaned.energy.slice(i), Array(3 - i).fill(null));
      assert.equal(cleaned.shone, false);
    }
    const dirty = { ...saved, energy: [999, '10', -Infinity], payload: '<script>' };
    assert.deepEqual(cleanChainCreation(dirty).energy, [null, null, null]);
    assert.equal(cleanChainCreation(dirty).payload, undefined);
    const wrongTiles = cleanChainCreation({ ...saved, energy: [5000, 2500, 250] });
    assert.deepEqual(wrongTiles.energy, [5000, 2500, 250]);
    assert.equal(wrongTiles.shone, false);
    assert.equal(nextNeedLine(wrongTiles), LINES.repair);
  }
  assert.equal(cleanChainCreation({ ...full(), grade: 999, chapter: 999 }).grade, 5);
  assert.equal(cleanChainCreation({ ...full(), grade: -99, chapter: -99 }).grade, 3);
  assert.equal(cleanChainCreation({ ...full(), grade: NaN, chapter: NaN }).chapter, 1);
  assert.equal(normalizeChain({}, 3.5).grade, 4);
  assert.deepEqual(normalizeChain({ ...full(), chain: ['fish', 'plant'] }).chain, [null, null, null]);
  assert.deepEqual(normalizeChain({ ...full(), chain: ['plant'] }).energy, [100, null, null]);
});

test('creation markup never emits save text or unbounded numbers', () => {
  for (const input of [null, [], {}, { chain: ['<script>alert(1)</script>'], energy: [Infinity], grade: '<img>', shone: true }, { ...full(), chain: ['plant', 'fish', '\" onload=\"bad'], energy: [1e100, NaN, -1] }]) {
    const markup = chainCreationMarkup(input);
    assert.match(markup, /viewBox="0 0 96 64"/);
    assert.doesNotMatch(markup, /<script|<img|onload|Infinity|NaN|undefined|1e\+100/);
  }
  for (const grade of GRADES_CHAIN) {
    const markup = chainCreationMarkup(full(grade));
    assert.match(markup, /Your sunbeam chart: sun to sea plant to little fish to otter/);
    assert.equal((markup.match(/width="6" height="6"/g) ?? []).length, 10);
    assert.doesNotMatch(markup, /stroke-dasharray/);
    assert.match(chainCreationMarkup({ ...full(grade), shone: false }), /stroke-dasharray/);
  }
});

test('all reachable lines and templates fit the 56-character sentence rule', () => {
  const visit = v => {
    if (typeof v === 'string') shortSentences(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(LINES); visit(HELP); shortSentences(STAMP_CHAIN);
  assert.equal(HELP.length, 4);
  assert.equal(HELP.at(-1), 'Choose Pin chart.');
  for (const grade of GRADES_CHAIN) {
    const seen = new Set(), queue = [start(grade).state];
    while (queue.length) {
      const state = queue.shift(), key = JSON.stringify(state);
      if (seen.has(key)) continue;
      seen.add(key);
      shortSentences(chainOpening(state));
      shortSentences(nextNeedLine(state));
      for (const action of [...CHAIN_CARDS.map(card => field({ card })), ...energyTiles(grade).map(energy => field({ energy })), ...['shine', 'needs', 'reset'].map(cmd)]) {
        const result = activity.act(deepFreeze(state), { shine: 0 }, action);
        if (result.line) shortSentences(result.line);
        if (!seen.has(JSON.stringify(result.state))) queue.push(result.state);
      }
    }
    assert.equal(seen.size, 16);
  }
  for (const card of CARDS) for (let i = 0; i < 3; i++) {
    shortSentences(LINES.wrongSun(card.plural));
    shortSentences(LINES.wrongFood(card.plural, ['sunlight', 'sea plants', 'little fish'][i]));
    shortSentences(LINES.question(i));
    shortSentences(LINES.needNumber(i + 1));
  }
  assert.deepEqual(EATS, { plant: 'sun', fish: 'plant', otter: 'fish', gull: 'fish' });
});

// A focused fake DOM: tree, event delegation, focus and attributes, with SVG treated as leaf markup.
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = tag => {
    const el = {
      tagName: tag.toUpperCase(), children: [], parent: null, dataset: {}, attrs: {}, listeners: {}, classes: new Set(), hidden: false, disabled: false,
      get className() { return [...this.classes].join(' '); },
      set className(value) { this.classes = new Set(value.split(/\s+/)); },
      append(...nodes) { nodes.forEach(n => { n.parent = this; this.children.push(n); }); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      querySelectorAll(sel) { return this.children.flatMap(c => [...(c.classes.has(sel.slice(1)) ? [c] : []), ...c.querySelectorAll(sel)]); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
      closest(sel) { return this.classes.has(sel.slice(1)) ? this : this.parent?.closest(sel); },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      removeEventListener(type, fn) { if (this.listeners[type] === fn) delete this.listeners[type]; },
      focus() { doc.activeElement = this; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
    };
    el.classList = {
      toggle(c, on) { on ? el.classes.add(c) : el.classes.delete(c); },
      add(c) { el.classes.add(c); }, remove(c) { el.classes.delete(c); },
    };
    return el;
  };
  return doc;
}

test('field mounts once, updates in place, has two keyboard rails and recovers focus', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    for (const grade of GRADES_CHAIN) {
      const host = document.createElement('div'), dispatched = [];
      const fieldUI = activity.mountField(host, { grade, dispatch: a => dispatched.push(a) });
      const root = host.children[0], cards = root.querySelectorAll('.chain-card'), tiles = root.querySelectorAll('.chain-tile');
      const plates = root.querySelectorAll('.chain-plate');
      const initial = start(grade);
      fieldUI.update(initial.state, initial.ui);
      assert.equal(cards.length, 4); assert.equal(tiles.length, 6); assert.equal(plates.length, 3);
      assert.ok(plates.every(p => p.tagName === 'DIV' && p.tabIndex === undefined));
      assert.equal(root.querySelector('.chain-cards').attrs['aria-label'], 'Who eats what');
      assert.equal(root.querySelector('.chain-tiles').attrs['aria-label'], 'How much energy moves up');
      const tabs = list => list.filter(b => b.tabIndex === 0).length;
      assert.equal(tabs(cards), 1); assert.equal(tabs(tiles), 1);
      assert.deepEqual(tiles.map(t => Number(t.dataset.energy)), energyTiles(grade));
      assert.equal(root.querySelectorAll('.chain-block').filter(b => !b.hidden).length, 4);
      let prevented = 0, stopped = 0;
      const key = (target, key) => root.listeners.keydown({ target, key, preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
      cards[0].focus(); key(cards[0], 'ArrowRight');
      assert.equal(document.activeElement, cards[1]); assert.equal(cards[1].tabIndex, 0);
      assert.equal(dispatched.length, 0, 'arrows move focus; native Enter/Space choose');
      key(cards[1], 'ArrowDown'); key(cards[1], 'ArrowUp'); key(cards[1], 'Enter'); key(cards[1], ' ');
      assert.equal(prevented, 1); assert.equal(stopped, 1);
      key(tiles[0], 'ArrowRight'); assert.equal(document.activeElement, tiles[1]);
      root.listeners.click({ target: tiles[1] });
      assert.deepEqual(dispatched.at(-1), { type: 'field', energy: energyTiles(grade)[1] });
      cards[0].focus(); root.listeners.click({ target: cards[0] });
      assert.deepEqual(dispatched.at(-1), { type: 'field', card: 'plant' });
      const placed = activity.act(initial.state, initial.ui, field({ card: 'plant' }));
      fieldUI.update(placed.state, placed.ui);
      assert.equal(cards[0].disabled, true); assert.equal(cards[0].tabIndex, -1);
      assert.equal(document.activeElement, cards[1]);
      assert.equal(cards[0].attrs['aria-label'], 'Sea plant, placed');
      assert.equal(cards[0].querySelector('.chain-card-check').hidden, false);
      const count = dispatched.length; root.listeners.click({ target: cards[0] });
      assert.equal(dispatched.length, count);
      key(cards[1], 'ArrowLeft'); assert.equal(document.activeElement, cards[1]);
      fieldUI.update(full(grade), { shine: 1 });
      assert.ok(root.classes.has('chain-field--shine'));
      assert.equal(root.querySelectorAll('.chain-block').filter(b => !b.hidden).length, 10);
      assert.equal(tabs(cards), 1); assert.equal(tabs(tiles), 1);
      assert.ok(tiles.every(b => !b.disabled));
      assert.equal(root.querySelectorAll('.chain-plate')[0], plates[0]);
      assert.equal(root.querySelectorAll('.chain-card')[0], cards[0]);
      fieldUI.update(initial.state, { shine: 1 });
      assert.ok(!root.classes.has('chain-field--shine'));
      assert.ok(cards.every(b => !b.disabled));
      fieldUI.destroy(); assert.equal(host.children.length, 0);
      assert.deepEqual(root.listeners, {});
    }
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});
