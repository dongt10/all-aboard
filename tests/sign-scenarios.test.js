import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGN_SCENARIOS, scenariosFor, scenarioOrder, nextScenario, scenarioById, tilesFor, newSeed,
} from '../src/sign-scenarios.js';

const grades = [0, 1, 2, 3, 4, 5];
const idsFor = grade => scenariosFor(grade).map(scenario => scenario.id);

function assertDeepFrozen(value, path = 'SIGN_SCENARIOS') {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertDeepFrozen(child, `${path}.${key}`);
}

test('catalog is deeply frozen, has unique stable ids, and filters in canonical order', () => {
  assert.ok(Array.isArray(SIGN_SCENARIOS));
  assertDeepFrozen(SIGN_SCENARIOS);
  const ids = SIGN_SCENARIOS.map(scenario => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    'hello-momo', 'taro-cart', 'momo-menu', 'thank-pip', 'cheer-kiko', 'welcome-nori',
    'invite-momo', 'thank-pip-note', 'taro-pizza', 'parade-path', 'warm-stew', 'lost-hat', 'band-cheer', 'hello-sora',
    'invite-yuki', 'thank-nori', 'parade-guide', 'stew-warning', 'cricket-drum', 'band-invite', 'taro-crates', 'lantern-walk',
    'little-kids-map', 'grown-ups-menu',
  ]);
  for (const scenario of SIGN_SCENARIOS) {
    assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(scenario.id.length <= 40, scenario.id);
    assert.ok(Array.isArray(scenario.grades) && scenario.grades.length > 0, scenario.id);
    assert.equal(new Set(scenario.grades).size, scenario.grades.length, scenario.id);
    assert.ok(scenario.grades.every(grade => grades.includes(grade)), scenario.id);
  }
  for (const grade of grades) {
    const scenarios = scenariosFor(grade);
    assert.deepEqual(scenarios, SIGN_SCENARIOS.filter(scenario => scenario.grades.includes(grade)));
    assert.ok(scenarios.length >= (grade === 0 ? 6 : 8), `grade ${grade}`);
    assert.notStrictEqual(scenarios, scenariosFor(grade));
    for (const scenario of scenarios) assert.strictEqual(scenarioById(scenario.id, grade), scenario);
  }
});

test('invalid grades and unsupported lookups return empty results', () => {
  for (const grade of [-1, 6, 1.5, '1', null, undefined, NaN, {}, Infinity]) {
    assert.deepEqual(scenariosFor(grade), []);
    assert.deepEqual(scenarioOrder(grade, 123), []);
    assert.equal(nextScenario(grade, { seed: 123 }), null);
    assert.equal(scenarioById(SIGN_SCENARIOS[0].id, grade), null);
    assert.deepEqual(tilesFor(SIGN_SCENARIOS[0], grade), { phrases: [], describing: [] });
  }
  for (const grade of grades) {
    assert.equal(scenarioById('not-a-scenario', grade), null);
    assert.equal(scenarioById(null, grade), null);
    const unsupported = SIGN_SCENARIOS.find(s => !s.grades.includes(grade));
    if (unsupported) {
      assert.equal(scenarioById(unsupported.id, grade), null);
      assert.deepEqual(tilesFor(unsupported, grade), { phrases: [], describing: [] });
    }
    assert.deepEqual(tilesFor(null, grade), { phrases: [], describing: [] });
  }
});

test('seeded order follows mulberry32 Fisher-Yates and never mutates the catalog', () => {
  const before = JSON.stringify(SIGN_SCENARIOS);
  assert.deepEqual(scenarioOrder(0, 42), ['taro-cart', 'hello-momo', 'cheer-kiko', 'welcome-nori', 'momo-menu', 'thank-pip']);
  for (const grade of grades) {
    const ids = idsFor(grade);
    for (const seed of [0, 1, 42, 123456789, 0xffffffff]) {
      const order = scenarioOrder(grade, seed);
      assert.deepEqual(order, scenarioOrder(grade, seed));
      assert.deepEqual([...order].sort(), [...ids].sort());
      const originalOrder = [...order];
      order.pop();
      assert.deepEqual(scenarioOrder(grade, seed), originalOrder);
    }
    assert.notDeepEqual(scenarioOrder(grade, 1), scenarioOrder(grade, 42), `grade ${grade}`);
  }
  assert.equal(JSON.stringify(SIGN_SCENARIOS), before);
});

test('nextScenario walks and wraps the seeded cycle, skips seen ids, and restarts when exhausted', () => {
  for (const grade of grades) for (const seed of [0, 1, 42, 0xffffffff]) {
    const order = scenarioOrder(grade, seed);
    let current;
    for (const id of order) {
      const next = nextScenario(grade, { seed, current });
      assert.strictEqual(next, scenarioById(id, grade));
      current = next.id;
    }
    assert.strictEqual(nextScenario(grade, { seed, current }), scenarioById(order[0], grade));
    const seen = [];
    current = undefined;
    for (const id of order) {
      const next = nextScenario(grade, { seed, current, seen });
      assert.strictEqual(next, scenarioById(id, grade), `grade ${grade}, seed ${seed}`);
      seen.push(next.id);
      current = next.id;
    }
    assert.equal(new Set(seen).size, order.length);
    assert.strictEqual(nextScenario(grade, { seed, current, seen }), scenarioById(order[0], grade));
    assert.strictEqual(nextScenario(grade, { seed, seen }), scenarioById(order[0], grade));
    assert.strictEqual(nextScenario(grade, { seed, current: 'unknown', seen: [order[0]] }), scenarioById(order[1], grade));
    assert.strictEqual(nextScenario(grade, { seed, current: order.at(-1), seen: [order[0], order[0], 'unknown'] }), scenarioById(order[1], grade));
    assert.strictEqual(nextScenario(grade, { seed, current: order[1], seen: order.filter(id => id !== order[0]) }), scenarioById(order[0], grade));
    assert.strictEqual(nextScenario(grade, { seed, current: order[1], seen }), scenarioById(order[2], grade));
    assert.deepEqual(seen, order, 'navigation must not mutate seen ids');
  }
});

test('newSeed returns the full unsigned 32-bit range derived from Math.random', () => {
  const original = Math.random;
  try {
    for (const [random, expected] of [[0, 0], [0.5, 0x80000000], [1 - 2 ** -32, 0xffffffff]]) {
      Math.random = () => random;
      assert.equal(newSeed(), expected);
    }
  } finally {
    Math.random = original;
  }
});

const words = text => text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
const endsInCompleteSentences = text => {
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [];
  return sentences.length > 0 && sentences.every(part => /^[A-Z]/.test(part.trim()) && /[.!]$/.test(part.trim()) && !part.includes('?'));
};
// Check exact reconstruction, including punctuation and spaces, allowing tiles to repeat.
function canConstruct(text, tiles) {
  const reachable = new Set([0]);
  for (let offset = 0; offset <= text.length; offset++) {
    if (!reachable.has(offset)) continue;
    for (const tile of tiles) {
      const part = offset === 0 ? tile : ` ${tile}`;
      if (text.startsWith(part, offset)) reachable.add(offset + part.length);
    }
  }
  return reachable.has(text.length);
}

test('each scenario has usable, age-appropriate content and a buildable example', () => {
  const validGoals = new Set(['words', 'sentence', 'two-sentences-describing', 'reason']);
  const cast = ['Taro', 'Momo', 'Yuki', 'Sora', 'Fumi', 'Hana', 'Kiko', 'Pip', 'Nori', 'Cricket'];
  for (const scenario of SIGN_SCENARIOS) {
    const label = scenario.id;
    for (const [field, limit] of [['title', 20], ['prompt', 56], ['example', 120]]) {
      assert.equal(typeof scenario[field], 'string', `${label} ${field}`);
      assert.ok(scenario[field].trim() && scenario[field].length <= limit, `${label} ${field}`);
    }
    assert.equal(typeof scenario.reader, 'string', label);
    assert.ok(scenario.reader.trim(), label);
    assert.ok(validGoals.has(scenario.goal), `${label} goal`);
    assert.ok(Array.isArray(scenario.vocabulary) && scenario.vocabulary.length > 0, label);
    assert.ok(scenario.vocabulary.every(word => typeof word === 'string' && word.trim()), label);
    const vocabulary = new Set(scenario.vocabulary.flatMap(word => words(word.toLowerCase())));
    const { phrases, describing } = scenario.tiles;
    assert.ok(Array.isArray(phrases) && Array.isArray(describing), label);
    const tiles = [...phrases, ...describing];
    assert.ok(tiles.every(tile => typeof tile === 'string' && tile.trim() === tile && tile.length > 0), label);
    assert.ok(canConstruct(scenario.example, tiles), `${label}: ${scenario.example}`);
    for (const word of words([...tiles, scenario.example].join(' '))) {
      assert.ok(vocabulary.has(word.toLowerCase()), `${label}: vocabulary missing ${word}`);
    }
    const content = [scenario.title, scenario.prompt, scenario.reader, scenario.example, ...tiles].join(' ');
    assert.doesNotMatch(content, /\p{Extended_Pictographic}/u, label);
    for (const name of cast) {
      for (const match of content.matchAll(new RegExp(`\\b${name}\\b`, 'gi'))) {
        assert.equal(match[0], name, `${label}: capitalize ${name}`);
      }
    }
    for (const grade of scenario.grades) {
      if (grade === 0) {
        assert.equal(scenario.goal, 'words', label);
        assert.equal(phrases.length, 4, label);
        assert.deepEqual(describing, [], label);
        assert.ok(phrases.every(tile => tile.length <= 12 && words(tile).length === 1 && !/\s/.test(tile)), label);
        for (const a of phrases) for (const b of phrases) assert.equal(`${a} ${b}`.trim().split(/\s+/).length, 2, label);
      } else if (grade <= 2) {
        assert.equal(scenario.goal, 'sentence', label);
        assert.equal(phrases.length, 8, label);
        assert.deepEqual(describing, [], label);
        assert.ok(phrases.every(tile => tile.length <= 12 && words(tile).length === 1 && !/\s/.test(tile)), label);
      } else {
        assert.ok(['reason', 'two-sentences-describing'].includes(scenario.goal), label);
        assert.equal(phrases.length, 4, label);
        assert.ok(phrases.every(tile => tile.length <= 26), label);
        assert.equal(describing.length, 6, label);
        assert.ok(describing.every(tile => /^[A-Za-z]+\.?$/.test(tile)), label);
      }
    }
    const example = scenario.example;
    if (scenario.goal === 'words') assert.ok(words(example).length >= 2, label);
    else {
      assert.ok(endsInCompleteSentences(example), `${label}: ${example}`);
      if (['two-sentences-describing', 'reason'].includes(scenario.goal)) {
        assert.ok((example.match(/[.!]/g) ?? []).length >= 2, label);
        const adjectives = new Set([...describing, 'bright', 'warm', 'kind', 'happy', 'big', 'loud'].flatMap(item => words(item.toLowerCase())));
        assert.ok(words(example.toLowerCase()).some(word => adjectives.has(word)), label);
      }
      if (scenario.goal === 'reason') assert.match(example, /\b(?:because|so)\b/i, label);
    }
  }
});

test('tile groups are fresh mutable copies, isolated from the catalog and other calls', () => {
  for (const grade of grades) for (const scenario of scenariosFor(grade)) {
    const first = tilesFor(scenario, grade);
    const second = tilesFor(scenario, grade);
    assert.deepEqual(first, scenario.tiles);
    assert.deepEqual(second, scenario.tiles);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.phrases, second.phrases);
    assert.notStrictEqual(first.describing, second.describing);
    first.phrases.push('changed');
    first.describing.push('changed');
    assert.deepEqual(second, scenario.tiles);
    assert.deepEqual(tilesFor(scenario, grade), scenario.tiles);
  }
});
