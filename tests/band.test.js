import test from 'node:test';
import assert from 'node:assert/strict';
import { PITCH_NAMES, MUSICIAN_COLORS, editorMode, toggleMusician, setPattern, toggleBeat, cycleNote, noteLabel, musicCommands } from '../src/ui/band.js';
import { createDefaultBand, PATTERNS } from '../src/audio.js';
import { INK, contrastRatio } from '../src/ui/palette.js';

test('editing tiers follow the grade, and percussion always toggles beats', () => {
  assert.deepEqual([editorMode(0, 'melody'), editorMode(2, 'melody'), editorMode(3, 'melody'), editorMode(5, 'percussion')], ['patterns', 'beats', 'notes', 'beats']);
});
test('band edits return a new band and leave the old one untouched', () => {
  const band = createDefaultBand();
  const rested = toggleMusician(band, 'voice');
  assert.deepEqual([rested.tracks[1].enabled, band.tracks[1].enabled], [false, true]);
  const flower = setPattern(band, 'bass', 1);
  assert.deepEqual([flower.tracks[0].notes, flower.tracks[0].pattern], [PATTERNS.bass[1], 1]);
});
test('beat toggles switch between a rest and the tune note', () => {
  const band = createDefaultBand();
  const on = toggleBeat(band, 'bass', 1);
  assert.equal(on.tracks[0].notes[1], 0);
  assert.equal(toggleBeat(on, 'bass', 1).tracks[0].notes[1], null);
  assert.equal(toggleBeat(band, 'bass', 0).tracks[0].notes[0], null);
});
test('note cycling walks Do, Re, Mi, Sol, La, then Rest', () => {
  let band = createDefaultBand(); const seen = [];
  for (let i = 0; i < 6; i++) { band = cycleNote(band, 'melody', 0); seen.push(noteLabel(band.tracks[2].notes[0])); }
  assert.deepEqual(seen, ['Do', 'Re', 'Mi', 'Sol', 'La', 'Rest']);
  assert.deepEqual(PITCH_NAMES, ['Do', 'Re', 'Mi', 'Sol', 'La']);
});
test('music keeps four short commands and four readable musician colors', () => {
  assert.deepEqual(musicCommands({ playing: false, quiet: false }).map(c => c.label), ['Play', 'Quiet play', 'Tunes', 'Save band']);
  assert.deepEqual(musicCommands({ playing: true, quiet: true }).map(c => c.label), ['Stop', 'Stop quiet', 'Tunes', 'Save band']);
  assert.ok(Object.values(MUSICIAN_COLORS).every(color => contrastRatio(INK, color) >= 4.5));
});
