import test from 'node:test';
import assert from 'node:assert/strict';
import { paradeLineup, paradeCommands, paradeStatus } from '../src/ui/parade-lineup.js';
import { createDefaultBand } from '../src/audio.js';

test('the parade marches made creations in subject order', () => {   // Review Focus 2
  assert.deepEqual(paradeLineup({ music: { kind: 'music' }, art: { kind: 'art' }, math: { kind: 'math' } }).map(m => m.id), ['math', 'art', 'music']);
  assert.deepEqual(paradeLineup({}), []);
});
test('the lineup keeps each creation and skips empty or unknown entries', () => {
  const art = { kind: 'art' };
  assert.deepEqual(paradeLineup({ art, pip: { kind: 'x' }, science: null }), [{ id: 'art', creation: art }]);
  assert.deepEqual(paradeLineup(undefined), []);
});
test('band controls enable only what makes sense', () => {
  assert.deepEqual(paradeCommands({ hasBand: false, playing: false }).map(c => [c.label, Boolean(c.disabled)]), [['Play band', true], ['Stop', true], ['March again', false], ['Village', false]]);
  assert.deepEqual(paradeCommands({ hasBand: true, playing: true }).map(c => Boolean(c.disabled)), [true, false, false, false]);
  assert.deepEqual(paradeCommands({ hasBand: true, playing: false }).map(c => Boolean(c.disabled)), [false, true, false, false]);
});
test('parade commands are short and each has an icon', () => {
  const commands = paradeCommands({ hasBand: true, playing: false });
  assert.deepEqual(commands.map(c => c.icon), ['music', 'stop', 'undo', 'home']);
  assert.equal(new Set(commands.map(c => c.id)).size, 4);
  assert.ok(commands.every(c => c.label.length <= 12));
});
test('band status lines point back to Kiko instead of to controls the parade does not have', () => {
  const band = createDefaultBand();
  assert.equal(paradeStatus('starting', 'starting', band), 'Starting your band…');
  assert.equal(paradeStatus('playing', 'playing', band), 'Your band is playing.');
  assert.equal(paradeStatus('stopped', 'stopped', band), 'Music stopped');
  assert.equal(paradeStatus('stopped', 'unavailable', band), 'Sound could not start. The parade is still yours.');
  const resting = { ...band, tracks: band.tracks.map(track => ({ ...track, enabled: false })) };
  assert.equal(paradeStatus('playing', 'playing', resting), 'Everyone is resting. Visit Kiko to invite a friend or add a note.');
  assert.equal(paradeStatus('playing', 'playing', { ...band, masterVolume: 0 }), 'Band is playing with sound off. Visit Kiko to raise the band volume.');
});
