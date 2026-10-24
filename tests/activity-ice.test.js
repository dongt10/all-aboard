import test from 'node:test';
import assert from 'node:assert/strict';
import ice, { iceLabel } from '../src/ui/activities/ice.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { encounterOpeningDialogue } from '../src/encounters.js';

const cmd = id => ({ type: 'command', id });
test('fresh trays offer shade, wait and a locked finish', () => {
  const { state, ui } = ice.start(null, { chapter: 1, grade: 2 });
  assert.deepEqual(ice.commands(state, ui, 2).map(c => [c.id, Boolean(c.disabled)]), [['shade-left', false], ['shade-right', false], ['wait', false], ['finish', true]]);
});
test('ten shaded minutes unlock Use shade', () => {
  let s = ice.start(null, { chapter: 1, grade: 2 });
  for (const id of ['shade-left', 'wait', 'wait']) s = ice.act(s.state, s.ui, cmd(id), 2);
  assert.deepEqual([s.state.time, s.line], [10, 'The shaded ice melts more slowly in this model.']);
  const commands = ice.commands(s.state, s.ui, 2);
  assert.deepEqual([commands[3].label, Boolean(commands[3].disabled), commands[0].pressed], ['Use shade', false, true]);
});
test('at twenty minutes Wait becomes Fresh ice, which restarts the clock and keeps the shade', () => {
  let s = ice.start({ kind: 'science', canopy: 'right', time: 20 }, { chapter: 1, grade: 4 });
  assert.equal(ice.commands(s.state, s.ui, 4)[2].id, 'fresh');
  s = ice.act(s.state, s.ui, cmd('fresh'), 4);
  assert.deepEqual([s.state.time, s.state.canopy], [0, 'right']);
});
test('shading the same tray again keeps time and explains the next step', () => {
  const s = ice.start({ kind: 'science', canopy: 'left', time: 5 }, { chapter: 1, grade: 3 });
  const again = ice.act(s.state, s.ui, cmd('shade-left'), 3);
  assert.deepEqual([again.state.time, again.line], [5, 'Advance 5 more model minutes to compare the ice.']);
});
test('tapping a tray in the field shades it', () => {
  const s = ice.start(null, { chapter: 0, grade: 0 });
  assert.equal(ice.act(s.state, s.ui, { type: 'field', tray: 'right' }, 0).state.canopy, 'right');
});

test('identity, help and opening line', () => {
  assert.deepEqual([ice.kind, ice.title], ['science', 'A little shade experiment']);
  assert.deepEqual(ice.help, ['Tap a tray to shade it.', 'Choose Wait 5 min two times.', 'Compare the two ice cubes.', 'Choose Use shade.']);
  const s = ice.start(null, { chapter: 1, grade: 2 });
  assert.equal(ice.opening(s.state, s.ui, 2), encounterOpeningDialogue(s.state));
});
test('commands use known icons and labels', () => {
  const s = ice.start({ kind: 'science', canopy: 'right', time: 20 }, { chapter: 1, grade: 3 });
  const commands = ice.commands(s.state, s.ui, 3);
  assert.deepEqual(commands.map(c => [c.label, c.icon]), [['Shade A', 'shade'], ['Shade B', 'shade'], ['Fresh ice', 'undo'], ['Use shade', 'check']]);
  assert.ok(commands.every(c => ICON_NAMES.includes(c.icon)));
  assert.deepEqual(commands.map(c => Boolean(c.pressed)).slice(0, 2), [false, true]);
  assert.equal(commands.filter(c => c.finish).length, 1);
  assert.equal(ice.start(null, { chapter: 1, grade: 3 }).state.canopy, 'none');
  assert.equal(ice.commands(ice.start(null, { chapter: 1, grade: 3 }).state, {}, 3)[2].icon, 'clock');
});
test('shading a new tray restarts with fresh cubes; act is pure', () => {
  const s = ice.start({ kind: 'science', canopy: 'left', time: 15 }, { chapter: 1, grade: 3 });
  const moved = ice.act(s.state, s.ui, cmd('shade-right'), 3);
  assert.deepEqual([moved.state.canopy, moved.state.time, moved.line], ['right', 0, 'Fresh equal cubes. Watch 10 model minutes with one tray shaded.']);
  assert.deepEqual([s.state.canopy, s.state.time], ['left', 15]);
});
test('waiting with no shade, the clock cap and fresh ice line', () => {
  let s = ice.start(null, { chapter: 1, grade: 3 });
  s = ice.act(s.state, s.ui, cmd('wait'), 3);
  assert.deepEqual([s.state.time, s.line], [5, 'Both trays are sunny. Their ice melts at the same rate.']);
  const capped = ice.act({ ...s.state, time: 20 }, s.ui, cmd('wait'), 3);
  assert.equal(capped.state.time, 20);
  const fresh = ice.act({ ...s.state, time: 20 }, s.ui, cmd('fresh'), 3);
  assert.deepEqual([fresh.state.time, fresh.line], [0, 'Equal cubes again. Try moving the shade to the other tray.']);
});
test('tray labels are words for little ones and percents for older kids', () => {
  assert.deepEqual([iceLabel(100, 0), iceLabel(60, 1), iceLabel(0, 1)], ['Lots of ice', 'Less ice', 'Water']);
  assert.deepEqual([iceLabel(80, 2), iceLabel(0, 5)], ['80% ice left', '0% ice left']);
});
