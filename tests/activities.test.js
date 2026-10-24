import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES } from '../src/ui/registry.js';
import { encounterReady } from '../src/encounters.js';

const SCOPES = [[0, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]];
const READY = {
  math: { kind: 'math', left: [2], right: [2], rolled: true },
  science: { kind: 'science', canopy: 'left', time: 10 },
  art: { kind: 'art', background: '#fff1cf', stamps: [{ shape: 'star', color: '#e96163', x: 50, y: 50, rotation: 0 }] },
  reading: { kind: 'reading', found: ['key', 'umbrella', 'book'] },
  writing: { kind: 'writing', text: 'Hello!' },
  community: { kind: 'community', tried: true, placements: [{ item: 'bench', x: 50, y: 90 }, { item: 'quiet', x: 10, y: 10 }] },
};
test('every subject but music has an activity module', () => {
  assert.deepEqual(Object.keys(ACTIVITIES).sort(), ['art', 'community', 'math', 'reading', 'science', 'writing']);
});
test('activities start unfinished with at most four short, unique, pictured commands', () => {   // Review Focus 3
  for (const [kind, activity] of Object.entries(ACTIVITIES)) for (const [chapter, grade] of SCOPES) {
    const where = `${kind} grade ${grade}`;
    const { state, ui } = activity.start(null, { chapter, grade });
    assert.equal(activity.kind, kind); assert.equal(state.kind, kind);
    assert.equal(typeof activity.title, 'string'); assert.equal(typeof activity.mountField, 'function');
    assert.ok(activity.help.length >= 1 && activity.help.length <= 4, where);
    assert.equal(typeof activity.opening(state, ui, grade), 'string');
    const commands = activity.commands(state, ui, grade);
    assert.ok(commands.length <= 4, where);
    assert.equal(new Set(commands.map(c => c.id)).size, commands.length, where);
    assert.ok(commands.every(c => c.label.length <= 12 && (c.icon || c.art)), `${where} label or picture`);
    assert.ok(commands.filter(c => c.finish).length <= 1, where);
    assert.ok(!commands.some(c => c.finish && !c.disabled), `${where} finish enabled at start`);
  }
});
test('a ready creation always offers exactly one enabled finish', () => {
  for (const [kind, activity] of Object.entries(ACTIVITIES)) {
    const { state, ui } = activity.start(READY[kind], { chapter: 1, grade: 3 });
    assert.equal(encounterReady(state), true, kind);
    const finishes = activity.commands(state, ui, 3).filter(c => c.finish);
    assert.equal(finishes.length, 1, kind); assert.ok(!finishes[0].disabled, kind);
  }
});
