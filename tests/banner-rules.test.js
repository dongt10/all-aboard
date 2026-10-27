import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNS, ROWS, PATTERN_CELLS, YUKI_CELLS, PATTERNS, patternFor, yukiStamps, expectedAt,
  stampPosition, stampAt, mirrorCell, patternReport, symmetryReport, bannerReady, bannerOpening, bannerHelp, BANNER_RULE_LINES,
} from '../src/banner-rules.js';
import { normalizeEncounterSnapshot, encounterReady, encounterOpeningDialogue } from '../src/encounters.js';
import { cleanCreation } from '../src/progress.js';
import { creationMarkup } from '../src/ui/creations.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';

const stamp = (cell, shape = 'star', color = '#e96163', rotation = 0) => ({ ...stampPosition(cell), shape, color, rotation });
const state = (grade, stamps = []) => ({ kind: 'art', chapter: grade ? 1 : 0, grade, background: '#fff1cf', stamps });
const patternState = grade => state(grade, PATTERN_CELLS.map(cell => ({ ...stamp(cell), ...expectedAt(grade, cell) })));
const mirrorState = grade => state(grade, [6, 11, 7, 10].map(cell => stamp(cell)).concat(grade >= 4 ? [stamp(12, 'circle', '#559fc7'), stamp(17, 'circle', '#559fc7')] : []));
const fits = text => {
  for (const sentence of text.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  for (const limit of Object.values(PAGE_CHARS)) for (const page of paginate(text, limit)) assert.ok(page.length <= limit);
};

test('the two patterns are exactly A B A then B A B, derived without saved stamps', () => {
  assert.equal(COLUMNS, 6); assert.equal(ROWS, 5);
  assert.deepEqual(PATTERN_CELLS, [3, 4, 5]); assert.deepEqual(YUKI_CELLS, [0, 1, 2]);
  assert.deepEqual(PATTERNS, { shapes: [{ shape: 'star', color: '#e96163' }, { shape: 'circle', color: '#e96163' }], colors: [{ shape: 'flower', color: '#e96163' }, { shape: 'flower', color: '#559fc7' }] });
  for (const grade of [1, 2]) {
    const pattern = patternFor(grade);
    assert.deepEqual(yukiStamps(grade), [0, 1, 2].map(cell => ({ ...pattern[cell % 2], ...stampPosition(cell), rotation: 0 })));
    assert.deepEqual(PATTERN_CELLS.map(cell => expectedAt(grade, cell)), [pattern[1], pattern[0], pattern[1]]);
    for (const cell of [0, 1, 2, 6, 29, -1, 30]) assert.equal(expectedAt(grade, cell), null);
    const draft = state(grade);
    assert.equal(bannerReady(draft), false); assert.deepEqual(draft.stamps, []);
  }
  for (const grade of [0, 3, 4, 5, undefined]) { assert.equal(patternFor(grade), null); assert.deepEqual(yukiStamps(grade), []); assert.equal(patternReport(state(grade)).complete, false); }
});

test('patterns check shape in grade 1 and shape plus color in grade 2, allow every turn, and reject missing cells', () => {
  for (const grade of [1, 2]) {
    const ready = patternState(grade);
    assert.deepEqual(patternReport(ready), { matched: 3, missing: [], complete: true });
    for (const missing of PATTERN_CELLS) {
      const changed = { ...ready, stamps: ready.stamps.filter(s => s.x !== stampPosition(missing).x) };
      assert.equal(bannerReady(changed), false); assert.deepEqual(patternReport(changed).missing, [missing]);
    }
    for (const rotation of [0, 45, 90, 135, 180, 225, 270, 315]) assert.equal(bannerReady({ ...ready, stamps: ready.stamps.map(s => ({ ...s, rotation })) }), true);
    for (const wrong of grade === 1 ? [{ shape: 'leaf' }] : [{ shape: 'leaf' }, { color: '#6dbea0' }]) {
      const stamps = [...ready.stamps, { ...ready.stamps[0], ...wrong }];
      assert.equal(stampAt({ stamps }, 3), 3); assert.equal(bannerReady({ ...ready, stamps }), false);
      assert.equal(bannerReady({ ...ready, stamps: [stamps.at(-1), ...ready.stamps] }), true);
    }
    assert.equal(bannerReady({ ...ready, stamps: [...ready.stamps, stamp(28, 'leaf')] }), true, 'free cells do not change the completed row');
  }
});

test('grade 1 accepts every paint for the shape pattern and preserves it through saving', () => {
  const ready = patternState(1);
  for (const color of ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf']) {
    const painted = { ...ready, stamps: ready.stamps.map(s => ({ ...s, color })) };
    assert.equal(patternReport(painted).complete, true);
    assert.equal(bannerReady(painted), true);
    const reopened = normalizeEncounterSnapshot('art', cleanCreation('art', painted), 1, 1);
    assert.deepEqual(reopened, painted);
    assert.equal(encounterReady(reopened), true);
  }
});

test('every mirror cell stays on its row and is its own inverse', () => {
  for (let cell = 0; cell < COLUMNS * ROWS; cell++) {
    assert.equal(mirrorCell(mirrorCell(cell)), cell);
    assert.equal(Math.floor(mirrorCell(cell) / COLUMNS), Math.floor(cell / COLUMNS));
    assert.notEqual(mirrorCell(cell), cell);
  }
  assert.equal(mirrorCell(6), 11); assert.equal(mirrorCell(7), 10);
  for (const cell of [-1, 30, 1.5, '3', null, NaN]) { assert.equal(mirrorCell(cell), -1); assert.equal(stampAt(state(0), cell), -1); }
});

test('mirror readiness requires matching pairs, four visible stamps, then six in two colors', () => {
  for (const grade of [3, 4, 5]) {
    const ready = mirrorState(grade), report = symmetryReport(ready);
    assert.equal(report.count, grade === 3 ? 4 : 6);
    assert.equal(report.colors.size, grade === 3 ? 1 : 2); assert.deepEqual(report.unmatched, []); assert.equal(report.symmetric, true);
    assert.equal(bannerReady(ready), true);
    for (let i = 0; i < ready.stamps.length; i++) {
      assert.equal(bannerReady({ ...ready, stamps: ready.stamps.filter((_, index) => index !== i) }), false);
      for (const wrong of [{ shape: 'leaf' }, { color: '#6dbea0' }]) assert.equal(bannerReady({ ...ready, stamps: ready.stamps.map((s, index) => index === i ? { ...s, ...wrong } : s) }), false);
    }
    assert.equal(bannerReady({ ...ready, stamps: ready.stamps.map((s, i) => ({ ...s, rotation: i * 45 })) }), true, 'matching is independent of turn');
    assert.equal(bannerReady(state(grade, [stamp(6), stamp(11)])), false);
    if (grade >= 4) {
      assert.equal(bannerReady({ ...ready, stamps: ready.stamps.map(s => ({ ...s, color: '#e96163' })) }), false);
      assert.equal(bannerReady(state(grade, [stamp(6), stamp(11), stamp(7, 'circle', '#559fc7'), stamp(10, 'circle', '#559fc7')])), false);
    }
  }
});

test('legacy stacks count only top stamps and off-grid stamps remain unmatched without moving', () => {
  const pair = [stamp(6), stamp(11)];
  const stacked = state(3, [...pair, ...pair]);
  assert.equal(symmetryReport(stacked).count, 2); assert.equal(bannerReady(stacked), false);
  const ready = mirrorState(3);
  const changed = { ...ready, stamps: [...ready.stamps, stamp(6, 'leaf')] };
  assert.deepEqual(symmetryReport(changed).unmatched.sort((a, b) => a - b), [6, 11]);
  const offGrid = { ...stamp(0), x: 50, y: 50 };
  const old = state(4, [offGrid, ...mirrorState(4).stamps]);
  const before = structuredClone(old); Object.freeze(old.stamps); Object.freeze(old);
  assert.equal(symmetryReport(old).unmatched.includes(-1), true); assert.equal(bannerReady(old), false);
  assert.deepEqual(old, before);
  assert.deepEqual(normalizeEncounterSnapshot('art', old, 4, 1), before);
  assert.deepEqual(cleanCreation('art', old), before);
});

test('the approved ready fixtures agree with encounters, openings and saved art at every grade', () => {
  for (let grade = 0; grade <= 5; grade++) {
    const ready = grade === 0 ? state(0, [stamp(0)]) : grade <= 2 ? patternState(grade) : mirrorState(grade);
    assert.equal(bannerReady(ready), true); assert.equal(encounterReady(ready), true);
    assert.equal(encounterReady(state(grade)), false);
    assert.equal(encounterOpeningDialogue(ready), BANNER_RULE_LINES.readyOpening);
    assert.deepEqual(cleanCreation('art', ready), ready);
    assert.deepEqual(normalizeEncounterSnapshot('art', ready, grade, grade ? 1 : 0), ready);
  }
  assert.equal(bannerReady({ kind: 'art', stamps: [stamp(8)] }), true, 'a missing grade is Kindergarten');
  for (const junk of [null, undefined, {}, { kind: 'writing', stamps: [stamp(0)] }, { kind: 'art', stamps: null }]) assert.equal(bannerReady(junk), false);
});

test('banner rule dialogue and grade help fit both page limits', () => {
  for (const line of Object.values(BANNER_RULE_LINES)) fits(line);
  for (let grade = 0; grade <= 5; grade++) {
    fits(bannerOpening(state(grade))); assert.equal(bannerHelp(grade).length, 4);
    for (const step of bannerHelp(grade)) fits(step);
    assert.equal(bannerHelp(grade).at(-1), 'Choose Hang banner.');
  }
});

test('art previews derive the starting row before child art and draw the mirror fold only in grades 3–5', () => {
  for (let grade = 0; grade <= 5; grade++) {
    const draft = state(grade, [stamp(29)]), before = structuredClone(draft);
    const markup = creationMarkup('art', draft);
    assert.match(markup, /viewBox="0 0 100 65"/); assert.match(markup, /aria-label="Your painted festival banner"/);
    assert.doesNotMatch(markup, /<script|onload|NaN|Infinity|undefined|<image|<linearGradient/);
    assert.equal((markup.match(/<g transform="translate/g) ?? []).length, grade === 1 || grade === 2 ? 4 : 1);
    assert.equal(markup.includes('creation-banner-fold'), grade >= 3);
    if (grade === 1 || grade === 2) {
      assert.ok(markup.indexOf('translate(8 6)') < markup.indexOf('translate(92 50)'));
      assert.equal(creationMarkup('art', state(grade)).match(/<g transform="translate/g).length, yukiStamps(grade).length);
      assert.equal(markup, creationMarkup('art', state(0, [...yukiStamps(grade), ...draft.stamps])), 'the preview uses the exact rule stamps before child art');
    }
    assert.deepEqual(draft, before);
  }
});
