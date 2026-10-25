import test from 'node:test';
import assert from 'node:assert/strict';
import ice, { iceLabel, ICE_LINES } from '../src/ui/activities/ice.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { encounterOpeningDialogue, encounterReady, predictionLine, scienceNextStep, iceRemaining } from '../src/encounters.js';

const cmd = id => ({ type: 'command', id });
const run = (s, ids, grade) => ids.reduce((acc, id) => ice.act(acc.state, acc.ui, cmd(id), grade), s);
const sentences = text => text.split(/(?<=[.!?])\s+/);
const GRADES = [0, 1, 2, 3, 4, 5];
const chapterOf = grade => (grade === 0 ? 0 : 1);

test('first shade after sunny waits explains the fresh ice at every grade and for both trays', () => {
  for (const grade of GRADES) for (const side of ['left', 'right']) for (const waits of [1, 2, 3, 4]) {
    const sunny = run(ice.start(null, { chapter: chapterOf(grade), grade }), Array(waits).fill('wait'), grade);
    assert.ok(iceRemaining(sunny.state.time, false) < 100);
    for (const action of [cmd(`shade-${side}`), { type: 'field', tray: side }]) {
      const shaded = ice.act(sunny.state, sunny.ui, action, grade);
      assert.equal(shaded.state.time, 0);
      assert.equal(shaded.state.canopy, side);
      assert.equal(iceRemaining(shaded.state.time, true), 100);
      assert.equal(iceRemaining(shaded.state.time, false), 100);
      assert.equal(shaded.line, grade >= 3 ? ICE_LINES.movedGuess(side) : ICE_LINES.moved(side));
      assert.equal(shaded.ui.predicted, side);
    }
  }
});

test('commands: Shade A, Shade B, Wait 5 min, then Serve ice last and disabled, at every grade', () => {
  for (const grade of GRADES) {
    const { state, ui } = ice.start(null, { chapter: chapterOf(grade), grade });
    const commands = ice.commands(state, ui, grade);
    assert.deepEqual(commands.map(c => [c.id, c.label, c.icon, Boolean(c.disabled)]),
      [['shade-left', 'Shade A', 'shade', false], ['shade-right', 'Shade B', 'shade', false], ['wait', 'Wait 5 min', 'clock', false], ['finish', 'Serve ice', 'check', true]], `grade ${grade}`);
    assert.ok(commands.every(c => ICON_NAMES.includes(c.icon) && c.label.length <= 12));
    assert.equal(commands.filter(c => c.finish).length, 1);
    assert.equal(commands.at(-1).finish, true);
  }
});

test('ten shaded minutes unlock Serve ice; the shaded tray shows pressed', () => {
  const s = run(ice.start(null, { chapter: 1, grade: 2 }), ['shade-left', 'wait', 'wait'], 2);
  assert.equal(s.state.time, 10);
  assert.equal(encounterReady(s.state), true);
  const commands = ice.commands(s.state, s.ui, 2);
  assert.deepEqual([commands[3].label, Boolean(commands[3].disabled), commands[0].pressed, commands[1].pressed], ['Serve ice', false, true, false]);
});

test('once ten minutes have passed, Wait 5 min becomes Fresh ice, which restarts the clock and keeps the shade', () => {
  for (const time of [10, 15, 20]) {
    const s = ice.start({ kind: 'science', canopy: 'right', time }, { chapter: 1, grade: 4 });
    assert.deepEqual(ice.commands(s.state, s.ui, 4)[2], { id: 'fresh', label: 'Fresh ice', icon: 'undo' }, `at ${time} minutes`);
  }
  const s = ice.start({ kind: 'science', canopy: 'right', time: 10 }, { chapter: 1, grade: 4 });
  const fresh = ice.act(s.state, s.ui, cmd('fresh'), 4);
  assert.deepEqual([fresh.state.time, fresh.state.canopy, fresh.line], [0, 'right', 'Fresh ice in both trays. Try shading the other tray!']);
  assert.equal(encounterReady(fresh.state), false);
  // a stray wait at or after ten minutes does nothing
  assert.equal(ice.act(s.state, s.ui, cmd('wait'), 4).state, s.state);
});

test('shading the same tray again keeps time and says the next step in kid words', () => {
  const s = ice.start({ kind: 'science', canopy: 'left', time: 5 }, { chapter: 1, grade: 3 });
  const again = ice.act(s.state, s.ui, cmd('shade-left'), 3);
  assert.equal(again.state, s.state);
  assert.equal(again.line, scienceNextStep(s.state));
  assert.equal(again.line, 'Wait 5 more minutes. Then look at both trays.');
  const ready = ice.start({ kind: 'science', canopy: 'left', time: 10 }, { chapter: 1, grade: 3 });
  assert.equal(ice.act(ready.state, ready.ui, cmd('shade-left'), 3).line, 'Ready! Choose Serve ice.');
});

test('tapping a tray in the field shades it; moving the shade gives fresh ice; act is pure', () => {
  const s = ice.start(null, { chapter: 0, grade: 0 });
  const tapped = ice.act(s.state, s.ui, { type: 'field', tray: 'right' }, 0);
  assert.deepEqual([tapped.state.canopy, tapped.state.time, tapped.line], ['right', 0, 'Tray B is in the shade. Now wait and look!']);
  assert.equal(ice.act(s.state, s.ui, { type: 'field', tray: 'top' }, 0).state, s.state);
  const mid = ice.start({ kind: 'science', canopy: 'left', time: 15 }, { chapter: 1, grade: 1 });
  const moved = ice.act(mid.state, mid.ui, cmd('shade-right'), 1);
  assert.deepEqual([moved.state.canopy, moved.state.time, moved.line], ['right', 0, 'Fresh ice. Tray B is in the shade now. Wait and look!']);
  assert.deepEqual([mid.state.canopy, mid.state.time], ['left', 15]);
});

test('wait lines: sunny trays melt the same; the shaded tray melts slower; the result names Serve ice', () => {
  let s = ice.start(null, { chapter: 1, grade: 1 });
  s = ice.act(s.state, s.ui, cmd('wait'), 1);
  assert.deepEqual([s.state.time, s.line], [5, 'Both trays are in the sun. They melt the same. Shade one!']);
  s = ice.act(s.state, s.ui, cmd('wait'), 1);
  assert.deepEqual([s.state.time, s.line], [10, 'Both trays are in the sun. They melt the same. Shade one!']);
  assert.equal(encounterReady(s.state), false);
  let shaded = run(ice.start(null, { chapter: 0, grade: 0 }), ['shade-left', 'wait'], 0);
  assert.equal(shaded.line, 'Tray A is in the shade. Its ice melts slower. Wait more!');
  shaded = ice.act(shaded.state, shaded.ui, cmd('wait'), 0);
  assert.equal(shaded.line, 'Look! The shaded tray kept more ice. Choose Serve ice.');
});

test('grades 3 to 5 predict: the first Shade pick is the guess, kept in ui and never in the saved state', () => {
  for (const grade of [3, 4, 5]) {
    const start = ice.start(null, { chapter: 1, grade });
    assert.equal(ice.opening(start.state, start.ui, grade), 'Which tray will keep more ice? Shade your guess.');
    assert.equal(start.ui.predicted, null);
    const picked = ice.act(start.state, start.ui, cmd('shade-right'), grade);
    assert.equal(picked.line, 'You picked Tray B. Wait and see if it keeps more ice!');
    assert.equal(picked.ui.predicted, 'right');
    assert.equal('predicted' in picked.state, false, 'the guess is not saved');
    const right = run(picked, ['wait', 'wait'], grade);
    assert.equal(right.line, `${predictionLine('right', right.state)} Choose Serve ice.`);
    assert.equal(right.line, 'You guessed right! The shaded tray kept more ice. Choose Serve ice.');
    assert.equal(encounterReady(right.state), true);
  }
});

test('a changed mind keeps the first guess, so the result can surprise', () => {
  const start = ice.start(null, { chapter: 1, grade: 3 });
  const switched = run(start, ['shade-left', 'shade-right'], 3);
  assert.deepEqual([switched.ui.predicted, switched.state.canopy, switched.state.time], ['left', 'right', 0]);
  const done = run(switched, ['wait', 'wait'], 3);
  assert.equal(done.line, 'Surprise! The shaded tray kept more ice. Shade keeps the sun off. Choose Serve ice.');
});

test('Fresh ice clears the guess; a run without a new guess gets the plain result', () => {
  const ready = run(ice.start(null, { chapter: 1, grade: 5 }), ['shade-left', 'wait', 'wait'], 5);
  const fresh = ice.act(ready.state, ready.ui, cmd('fresh'), 5);
  assert.equal(fresh.ui.predicted, null);
  assert.equal(run(fresh, ['wait', 'wait'], 5).line, 'Look! The shaded tray kept more ice. Choose Serve ice.');
  const reguessed = ice.act(fresh.state, fresh.ui, cmd('shade-right'), 5);
  assert.deepEqual([reguessed.ui.predicted, reguessed.line], ['right', 'Fresh ice. You picked Tray B. Wait and see!'], 'the kid hears that the new pick is the guess');
  // a second move after the guess is just a move
  const movedAgain = ice.act(reguessed.state, reguessed.ui, cmd('shade-left'), 5);
  assert.deepEqual([movedAgain.ui.predicted, movedAgain.line], ['right', 'Fresh ice. Tray A is in the shade now. Wait and look!']);
  // K to 2 never hear the guess line, even after Fresh ice
  const youngFresh = run(ice.start(null, { chapter: 1, grade: 1 }), ['shade-left', 'wait', 'wait', 'fresh'], 1);
  const young = ice.act(youngFresh.state, youngFresh.ui, cmd('shade-right'), 1);
  assert.equal(young.line, 'Fresh ice. Tray B is in the shade now. Wait and look!');
});

test('two sunny waits keep the Wait button; the clock runs to 20, then Fresh ice names shading a tray', () => {
  const s = ice.start({ kind: 'science', canopy: 'none', time: 10 }, { chapter: 1, grade: 1 });
  assert.equal(ice.commands(s.state, s.ui, 1)[2].id, 'wait', 'nothing was compared, so Wait stays');
  assert.equal(ice.commands(s.state, s.ui, 1)[3].disabled, true);
  const waited = ice.act(s.state, s.ui, cmd('wait'), 1);
  assert.deepEqual([waited.state.time, waited.line], [15, 'Both trays are in the sun. They melt the same. Shade one!']);
  const melted = ice.act(waited.state, waited.ui, cmd('wait'), 1);
  assert.equal(melted.state.time, 20);
  assert.equal(ice.commands(melted.state, melted.ui, 1)[2].id, 'fresh', 'the clock is out, so Fresh ice takes over');
  assert.equal(ice.act(melted.state, melted.ui, cmd('wait'), 1).state, melted.state, 'a stray wait at 20 does nothing');
  const fresh = ice.act(melted.state, melted.ui, cmd('fresh'), 1);
  assert.deepEqual([fresh.state.time, fresh.state.canopy, fresh.line], [0, 'none', 'Fresh ice in both trays. Shade one tray!']);
  // a sunny saved draft at 15 also keeps Wait
  const draft = ice.start({ kind: 'science', canopy: 'none', time: 15 }, { chapter: 1, grade: 4 });
  assert.equal(ice.commands(draft.state, draft.ui, 4)[2].id, 'wait');
});

test('a resumed draft with a shaded tray still melting opens with the next step, not "shade a tray"', () => {
  for (const grade of [1, 3]) {
    const s = ice.start({ kind: 'science', canopy: 'left', time: 5 }, { chapter: 1, grade });
    assert.equal(ice.opening(s.state, s.ui, grade), scienceNextStep(s.state), `grade ${grade}`);
    assert.equal(ice.opening(s.state, s.ui, grade), 'Wait 5 more minutes. Then look at both trays.');
  }
  const zero = ice.start({ kind: 'science', canopy: 'right', time: 0 }, { chapter: 0, grade: 0 });
  assert.equal(ice.opening(zero.state, zero.ui, 0), 'Wait 10 more minutes. Then look at both trays.');
});

test('a saved draft with a shaded tray counts that tray as the guess', () => {
  const s = ice.start({ kind: 'science', canopy: 'left', time: 5 }, { chapter: 1, grade: 4 });
  assert.equal(s.ui.predicted, 'left');
  assert.equal(run(s, ['wait'], 4).line, 'You guessed right! The shaded tray kept more ice. Choose Serve ice.');
});

test('K to 2 never hear the guess line and get the simple opening', () => {
  for (const grade of [0, 1, 2]) {
    const start = ice.start(null, { chapter: chapterOf(grade), grade });
    assert.equal(ice.opening(start.state, start.ui, grade), 'Shade one tray. Then wait and look!');
    const picked = ice.act(start.state, start.ui, cmd('shade-left'), grade);
    assert.equal(picked.line, 'Tray A is in the shade. Now wait and look!');
    assert.equal(run(picked, ['wait', 'wait'], grade).line, 'Look! The shaded tray kept more ice. Choose Serve ice.');
  }
});

test('a ready draft opens with the ready line at every grade', () => {
  for (const grade of GRADES) {
    const s = ice.start({ kind: 'science', canopy: 'right', time: 10 }, { chapter: chapterOf(grade), grade });
    assert.equal(ice.opening(s.state, s.ui, grade), encounterOpeningDialogue(s.state));
    assert.equal(ice.opening(s.state, s.ui, grade), 'Your ice test is ready. Serve ice, or try fresh ice.');
  }
});

test('identity, help and the not-ready line use kid words and name every command', () => {
  assert.deepEqual([ice.kind, ice.title], ['science', 'Momo’s ice test']);
  assert.deepEqual(ice.help, ['Tap a tray, or choose Shade A or Shade B.', 'Choose Wait 5 min two times. Watch the ice.', 'Which tray kept more ice? Fresh ice starts over.', 'Choose Serve ice.']);
  assert.equal(ice.help.at(-1), 'Choose Serve ice.');
  for (const label of ['Shade A', 'Shade B', 'Wait 5 min', 'Fresh ice', 'Serve ice']) assert.ok(ice.help.some(step => step.includes(label)), `help names ${label}`);
  assert.equal(ice.notReadyLine, 'Shade a tray, then wait 10 minutes.');
});

test('every line fits one Bigger words page per sentence and avoids grown-up words', () => {
  const lines = [ice.notReadyLine, ...ice.help, ICE_LINES.waitSunny, ICE_LINES.result, ICE_LINES.fresh, ICE_LINES.freshSunny, ICE_LINES.finishHint,
    ...['left', 'right'].flatMap(side => [ICE_LINES.waitShaded(side), ICE_LINES.shaded(side), ICE_LINES.guessed(side), ICE_LINES.moved(side), ICE_LINES.movedGuess(side)])];
  for (const line of lines) {
    for (const sentence of sentences(line)) assert.ok(sentence.length <= 56, `"${sentence}" is ${sentence.length} characters`);
    assert.doesNotMatch(line, /model|canopy|%|simplified|experiment/i, line);
  }
  assert.doesNotMatch(ice.title, /model|canopy|experiment/i);
});

test('tray labels are words at every grade, with the number from grade 2 up', () => {
  assert.deepEqual([iceLabel(100, 0), iceLabel(60, 1), iceLabel(0, 1), iceLabel(70, 0)], ['Lots of ice', 'Less ice', 'Water', 'Lots of ice']);
  assert.deepEqual([iceLabel(80, 2), iceLabel(65, 3), iceLabel(0, 5)], ['Lots of ice · 80', 'Less ice · 65', 'Water · 0']);
  for (const grade of GRADES) assert.doesNotMatch(iceLabel(50, grade), /%/);
});

import { Doc } from './helpers/dom.js';
const fakeDoc = () => new Doc();

test('the field reads minutes, Tray A / Tray B with ice words, and shows the shade only over the shaded tray', () => {
  const doc = fakeDoc();
  const host = doc.createElement('section');
  host.ownerDocument = doc;
  const field = ice.mountField(host, { grade: 3, dispatch() {} });
  const root = host.children[0];
  assert.equal(root.querySelectorAll('.ice-tag').length, 0, 'no model tag');
  assert.equal(root.querySelectorAll('.ice-sun').length, 1, 'the sun is drawn');
  assert.equal(root.querySelectorAll('.ice-canopy').length, 2, 'each tray has a shade to show');
  const { state } = ice.start({ kind: 'science', canopy: 'left', time: 10 }, { chapter: 1, grade: 3 });
  field.update(state, {});
  assert.equal(root.querySelector('.ice-clock b').textContent, '10 minutes');
  const [a, b] = root.querySelectorAll('.ice-tray');
  assert.deepEqual([a.querySelector('.ice-name').textContent, a.querySelector('.ice-left').textContent], ['Tray A', 'Lots of ice · 80']);
  assert.deepEqual([b.querySelector('.ice-name').textContent, b.querySelector('.ice-left').textContent], ['Tray B', 'Less ice · 50']);
  assert.deepEqual([a.classList.contains('ice-tray--shaded'), b.classList.contains('ice-tray--shaded')], [true, false]);
  assert.deepEqual([a.getAttribute('aria-pressed'), b.getAttribute('aria-pressed')], ['true', 'false']);
  assert.equal(a.getAttribute('aria-label'), 'Tray A, in the shade, Lots of ice · 80');
  assert.equal(b.getAttribute('aria-label'), 'Tray B, in the sun, Less ice · 50');
  assert.deepEqual([a.querySelector('.ice-cube').style.width, b.querySelector('.ice-cube').style.width], ['40%', '25%'], 'the ice block shrinks with remaining');
  field.update(ice.start({ kind: 'science', canopy: 'right', time: 20 }, { chapter: 0, grade: 0 }).state, {});
  assert.equal(root.querySelector('.ice-clock b').textContent, '20 minutes');
  assert.equal(root.querySelectorAll('.ice-tray')[0].querySelector('.ice-cube').style.visibility, 'hidden', 'melted ice disappears');
  // the K field shows words only, whatever the saved grade says
  const kField = ice.mountField(host, { grade: 0 });
  kField.update(ice.start({ kind: 'science', canopy: 'none', time: 5 }, { chapter: 0, grade: 0 }).state, {});
  assert.equal(host.children[1].querySelectorAll('.ice-left')[0].textContent, 'Lots of ice');
});
