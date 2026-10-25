import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PITCH_NAMES, MUSICIAN_COLORS, editorMode, toggleMusician, setPattern, toggleBeat, cycleNote, noteLabel, musicCommands,
  leadTrack, TEMPO_NAMES, cycleTempo, setTempo, formLabel, cycleForm, setForm, defaultBandFor, setTrackNotes, isEdited,
  melodyShape, shapeLine, ECHO_PATTERNS, pickEcho, echoMatches, patternGlyphs, restsLine, openingLine, helpLines,
} from '../src/ui/band.js';
import { createDefaultBand, PATTERNS } from '../src/audio.js';
import { cleanCreation } from '../src/progress.js';
import { INK, contrastRatio } from '../src/ui/palette.js';

const sentences = text => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const GRADES = [0, 1, 2, 3, 4, 5];

test('editing tiers follow the grade, and percussion always toggles beats', () => {
  assert.deepEqual([editorMode(0, 'melody'), editorMode(2, 'melody'), editorMode(3, 'melody'), editorMode(5, 'percussion')], ['patterns', 'beats', 'notes', 'beats']);
});
test('the lead on the lanterns is nobody at K, Cricket in 1-2, Kiko in 3-5', () => {
  assert.deepEqual(GRADES.map(leadTrack), [null, 'percussion', 'percussion', 'melody', 'melody', 'melody']);
  assert.equal(leadTrack('k'), null);
  assert.equal(leadTrack('4'), 'melody');
});
test('band edits return a new band and leave the old one untouched', () => {
  const band = createDefaultBand();
  const rested = toggleMusician(band, 'voice');
  assert.deepEqual([rested.tracks[1].enabled, band.tracks[1].enabled], [false, true]);
  const flower = setPattern(band, 'bass', 1);
  assert.deepEqual([flower.tracks[0].notes, flower.tracks[0].pattern], [PATTERNS.bass[1], 1]);
  const faster = setTempo(band, 120);
  assert.deepEqual([faster.tempo, band.tempo], [120, 90]);
  const aba = setForm(band, 'ABA');
  assert.deepEqual([aba.form, band.form], ['ABA', createDefaultBand().form]);
  const tuned = setTrackNotes(band, 'melody', [0, 1, 2, 3, 4, null, 9, 'x']);
  assert.deepEqual(tuned.tracks[2].notes, [0, 1, 2, 3, 4, null, null, null]);
  assert.deepEqual(band.tracks[2].notes, PATTERNS.melody[0]);
  assert.deepEqual(setTrackNotes(band, 'melody', [1, 2]).tracks[2].notes, [1, 2, null, null, null, null, null, null]);
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
test('the speed sign cycles Slow, Steady, Fast and refuses odd tempos', () => {
  assert.deepEqual([cycleTempo(60), cycleTempo(90), cycleTempo(120)], [90, 120, 60]);
  assert.deepEqual(TEMPO_NAMES, { 60: 'Slow', 90: 'Steady', 120: 'Fast' });
  assert.equal(setTempo(createDefaultBand(), 999).tempo, 90);
});
test('form cycles A, A B, A B A and labels with spaces', () => {
  assert.deepEqual([cycleForm('A'), cycleForm('AB'), cycleForm('ABA')], ['AB', 'ABA', 'A']);
  assert.deepEqual(['A', 'AB', 'ABA'].map(formLabel), ['A', 'A B', 'A B A']);
  assert.equal(setForm(createDefaultBand(), 'ZZ').form, 'A');
});
test('each grade starts from the default band, with A B at grade 4 and A B A at grade 5', () => {
  assert.deepEqual(GRADES.map(g => defaultBandFor(g).form), ['A', 'A', 'A', 'A', 'AB', 'ABA']);
  assert.equal(defaultBandFor('k').form, 'A');
  assert.equal(defaultBandFor('5').form, 'ABA');
  const base = createDefaultBand();
  for (const g of GRADES) {
    const band = defaultBandFor(g);
    assert.deepEqual(band.tracks, base.tracks);
    assert.equal(band.tempo, 90);
  }
});
test('a band counts as edited once a track, the speed or the form changes', () => {
  for (const g of GRADES) assert.equal(isEdited(defaultBandFor(g), g), false, `grade ${g} default`);
  // A saved band from before forms existed has no form field and still counts as untouched.
  assert.equal(isEdited(createDefaultBand(), 3), false);
  assert.equal(isEdited(createDefaultBand(), 5), true);
  const band = defaultBandFor(1);
  assert.equal(isEdited(toggleBeat(band, 'percussion', 0), 1), true);
  assert.equal(isEdited(toggleMusician(band, 'voice'), 1), true);
  assert.equal(isEdited(setTempo(band, 60), 1), true);
  assert.equal(isEdited(setForm(defaultBandFor(4), 'ABA'), 4), true);
  assert.equal(isEdited(setPattern(band, 'bass', 1), 1), true);
  const softer = { ...band, tracks: band.tracks.map(t => (t.id === 'voice' ? { ...t, volume: 0.2 } : t)) };
  assert.equal(isEdited(softer, 1), true);
});
test('a default band saved today reads as untouched after the progress round trip', () => {
  for (const g of GRADES) {
    const saved = cleanCreation('music', { ...defaultBandFor(g), chapter: g ? 1 : 0, grade: g });
    assert.ok(saved, `grade ${g} saves`);
    assert.equal(isEdited(saved, g), false, `grade ${g} round trip`);
    const { tempo, ...noTempo } = saved;
    assert.equal(isEdited(noTempo, g), false, `grade ${g} without a tempo field`);
    assert.equal(isEdited(cleanCreation('music', { ...toggleMusician(saved, 'voice'), chapter: g ? 1 : 0, grade: g }), g), true, `grade ${g} edit survives`);
  }
});
test('band volume alone counts as edited, with the default used for older saves', () => {
  for (const grade of GRADES) {
    const band = defaultBandFor(grade);
    assert.equal(isEdited({ ...band, masterVolume: 0.2 }, grade), true);
    assert.equal(isEdited({ ...band, masterVolume: 0 }, grade), true);
    const { masterVolume, ...older } = band;
    assert.equal(isEdited(older, grade), false);
    assert.equal(isEdited({ ...older, masterVolume }, grade), false);
  }
});
test('the finish gate never throws on a thin or broken band', () => {
  assert.equal(isEdited({ tracks: [{ id: 'bass' }] }, 1), true);
  assert.equal(isEdited({}, 1), false);
  assert.equal(isEdited(null, 1), false);
  assert.equal(isEdited({ tracks: 'nope', form: 'ABA' }, 5), false);
});
test('melody shape reads only the sounded notes, in order', () => {
  assert.equal(melodyShape([null, null, null, null, null, null, null, null]), 'empty');
  assert.equal(melodyShape([2, null, null, null, null, null, null, null]), 'same');
  assert.equal(melodyShape([2, null, 2, 2, null, null, 2, null]), 'same');
  assert.equal(melodyShape([0, null, 1, 1, null, 3, null, 4]), 'up');
  assert.equal(melodyShape([4, 3, null, 3, null, 1, null, 0]), 'down');
  assert.equal(melodyShape([0, null, 3, null, 1, null, null, null]), 'mixed');
  assert.deepEqual(['empty', 'same', 'up', 'down', 'mixed'].map(shapeLine), [
    'Tap a lantern to add a note.', 'Your tune stays the same.', 'Your tune goes up!', 'Your tune goes down.', 'Up and down, like a hill!',
  ]);
  assert.equal(shapeLine('nope'), 'Tap a lantern to add a note.');
});
test('echo rhythms have 3 to 5 sounds, differ from the default beat, and match on sound versus rest', () => {
  const defaultMask = PATTERNS.percussion[0].map(n => n !== null);
  assert.equal(ECHO_PATTERNS.length, 4);
  for (const mask of ECHO_PATTERNS) {
    assert.equal(mask.length, 8);
    assert.ok(mask.every(v => typeof v === 'boolean'));
    const count = mask.filter(Boolean).length;
    assert.ok(count >= 3 && count <= 5, `sounds: ${count}`);
    assert.notDeepEqual(mask, defaultMask);
  }
  assert.equal(new Set(ECHO_PATTERNS.map(m => m.join(''))).size, 4);
  assert.deepEqual([pickEcho(0), pickEcho(5), pickEcho(7)], [ECHO_PATTERNS[0], ECHO_PATTERNS[1], ECHO_PATTERNS[3]]);
  assert.equal(pickEcho(-1), ECHO_PATTERNS[3]);
  assert.equal(pickEcho(2.9), ECHO_PATTERNS[2]);
  const mask = [true, false, true, false, false, false, false, true];
  assert.equal(echoMatches([0, null, 1, null, null, null, null, 0], mask), true);
  assert.equal(echoMatches([1, null, 0, null, null, null, null, 1], mask), true);
  assert.equal(echoMatches([0, null, 1, null, null, null, null, null], mask), false);
  assert.equal(echoMatches([0, 1, 1, null, null, null, null, 0], mask), false);
  assert.equal(echoMatches(PATTERNS.percussion[0], defaultMask), true);
});
test('pattern glyphs and rest counts use kid words', () => {
  assert.equal(patternGlyphs('bass', 0), '♪ – – ♪ ♪ – ♪ –');
  assert.equal(patternGlyphs('percussion', 1), '♪ ♪ – ♪ ♪ – ♪ ♪');
  assert.equal(patternGlyphs('melody', 0).split(' ').length, 8);
  assert.equal(restsLine([0, null, 1, null, 0, 1, 1, null]), 'Five sounds and three rests. Nice spacing!');
  assert.equal(restsLine([0, null, null, null, null, null, null, null]), 'One sound and seven rests. Nice spacing!');
  assert.equal(restsLine([null, null, null, null, null, null, null, null]), 'Zero sounds and eight rests. Tap a lantern to add a sound.');
  assert.equal(restsLine([0, 0, 0, 0, 0, 0, 0, 0]), 'Eight sounds and zero rests. Try a rest too!');
  // A short list still describes all eight lanterns: the missing ones are rests.
  assert.equal(restsLine([0, 1]), 'Two sounds and six rests. Nice spacing!');
  assert.equal(restsLine([]), 'Zero sounds and eight rests. Tap a lantern to add a sound.');
  assert.equal(restsLine([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'Eight sounds and zero rests. Try a rest too!');
  assert.ok(sentences(restsLine([null, null, null, null, null, null, null, null])).every(s => s.length <= 56));
});
test('Kiko opens each grade with the planned line and four help steps that fit a Bigger-words page', () => {
  assert.equal(openingLine(0), 'Tap a friend to join. Who sings low? Who whistles high? Try Slow and Fast!');
  assert.equal(openingLine('k'), openingLine(0));
  assert.equal(openingLine(1), 'Tap a lantern: sound or rest. Rests are part of the rhythm too!');
  assert.equal(openingLine(2), 'Press Echo. I play a rhythm, then you copy it on the lanterns!');
  assert.equal(openingLine(3), 'Tap a lantern to climb: Do, Re, Mi, Sol, La. Does your tune go up or down?');
  assert.equal(openingLine(4), 'Cricket repeats the steady part. Change my tune above it!');
  assert.equal(openingLine(5), 'Make tune A, then tap Form for A B A. Which part comes back?');
  for (const g of GRADES) {
    const help = helpLines(g);
    assert.equal(help.length, 4, `grade ${g} help steps`);
    for (const text of [openingLine(g), ...help]) {
      assert.ok(text.length <= 96, `${text} fits one page`);
      for (const s of sentences(text)) assert.ok(s.length <= 56, `"${s}" is ${s.length} chars`);
    }
    assert.match(help.at(-1), /Send band/);
    const all = help.join(' ');
    for (const label of ['Play', 'See beat', 'Sounds', 'Send band']) assert.ok(all.includes(label), `grade ${g} help names ${label}`);
    assert.match(help[2], /Sounds picks a tune/, 'help says Sounds picks a tune, not only loud or soft');
  }
  helpLines(2).push('x');
  assert.equal(helpLines(2).length, 4);
});
test('music keeps four short commands with icons, and Send band waits for an edit', () => {
  const idle = musicCommands({ playing: false, quiet: false });
  assert.deepEqual(idle.map(c => c.label), ['Play', 'See beat', 'Sounds', 'Send band']);
  assert.deepEqual(idle.map(c => c.id), ['play', 'quiet', 'tunes', 'save']);
  assert.deepEqual(idle.map(c => c.icon), ['play', 'quiet', 'music', 'check']);
  assert.deepEqual(musicCommands({ playing: true, quiet: true }).map(c => c.label), ['Stop', 'Stop', 'Sounds', 'Send band']);
  assert.deepEqual(musicCommands({ playing: true, quiet: true }).map(c => c.icon), ['stop', 'stop', 'music', 'check']);
  for (const c of [...idle, ...musicCommands({ playing: true, quiet: true, edited: true })]) assert.ok(c.label.length <= 9, c.label);
  assert.equal(idle.at(-1).finish, true);
  assert.equal(idle.at(-1).disabled, true);
  assert.equal(musicCommands().at(-1).disabled, true);
  assert.equal(musicCommands({ edited: true }).at(-1).disabled, false);
  assert.ok(Object.values(MUSICIAN_COLORS).every(color => contrastRatio(INK, color) >= 4.5));
});
