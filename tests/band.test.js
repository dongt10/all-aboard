import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PITCH_NAMES, MUSICIAN_COLORS, editorMode, toggleMusician, setPattern, toggleBeat, cycleNote, noteLabel, musicCommands,
  leadTrack, TEMPO_NAMES, cycleTempo, setTempo, formLabel, cycleForm, setForm, defaultBandFor, setTrackNotes, isEdited, lessonDone,
  melodyShape, shapeLine, ECHO_PATTERNS, pickEcho, echoMatches, patternGlyphs, restsLine, openingLine, helpLines, LESSON_HINTS, lessonHint,
} from '../src/ui/band.js';
import { createDefaultBand, createBandPreset, patternsFor, PATTERNS } from '../src/audio.js';
import { cleanCreation } from '../src/progress.js';
import { INK, contrastRatio } from '../src/ui/palette.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';

const sentences = text => text.split(/(?<=[.!?…]["'”’)\]]*)\s+/).filter(Boolean);
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
  const base = createBandPreset('minecraft');
  for (const g of GRADES) {
    const band = defaultBandFor(g);
    assert.deepEqual(band.tracks.slice(0, 3), base.tracks.slice(0, 3));
    assert.equal(band.tracks[3].enabled, [1, 2, 4, 5].includes(g), 'Cricket supports rhythm and steady-part lessons');
    assert.equal(band.tracks[3].volume, .28);
    assert.equal(band.tempo, 90);
    assert.equal(band.preset, 'minecraft');
    assert.deepEqual(defaultBandFor(g, 'meadow').tracks, createDefaultBand().tracks);
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
test('lessonDone follows each grade\'s lesson', () => {
  const k = defaultBandFor(0);
  assert.equal(lessonDone(k, {}, 0), false);
  assert.equal(lessonDone(k, { played: true }, 'K'), true);
  assert.equal(lessonDone(k, { echoed: true }, 0), false);
  assert.equal(lessonDone(setTempo(k, 120), {}, 0), true);
  assert.equal(lessonDone(toggleMusician(k, 'voice'), {}, 0), true);
  assert.equal(lessonDone({ ...k, masterVolume: 0 }, {}, 0), true);

  for (const preset of ['minecraft', 'meadow']) {
    const rhythm = defaultBandFor(1, preset);
    assert.equal(lessonDone(toggleBeat(rhythm, 'percussion', 1), {}, 1), true);
    const pitches = rhythm.tracks[3].notes.map(note => note === null ? null : 4);
    assert.equal(lessonDone(setTrackNotes(rhythm, 'percussion', pitches), {}, 1), false, 'pitch alone does not change sound/rest');
    assert.equal(lessonDone(toggleBeat(toggleBeat(rhythm, 'percussion', 1), 'percussion', 1), {}, 1), false, 'reversing the rhythm edit closes the gate');

    const echo = defaultBandFor(2, preset);
    assert.equal(lessonDone(toggleBeat(echo, 'percussion', 1), {}, 2), false, 'an arbitrary rhythm edit is not an echo');
    assert.equal(lessonDone(echo, { echoed: true }, 2), true);
    assert.equal(lessonDone(echo, { echoed: 'true' }, 2), false, 'only a completed scene echo counts');
    for (const mask of ECHO_PATTERNS) {
      const matched = setTrackNotes(echo, 'percussion', mask.map(on => on ? 4 : null));
      assert.equal(lessonDone(matched, {}, 2), false, 'a matching rhythm alone does not complete Echo');
    }

    for (const grade of [3, 4, 5]) {
      const band = defaultBandFor(grade, preset), changed = cycleNote(band, 'melody', 0);
      assert.equal(lessonDone(changed, {}, grade), true, 'a saved melody edit counts without playback');
      assert.equal(lessonDone(setTrackNotes(changed, 'melody', band.tracks[2].notes), {}, grade), false, 'restoring the preset notes closes the gate');
      assert.equal(lessonDone({ ...changed, tracks: [...changed.tracks].reverse() }, {}, grade), true, 'finds the melody by id');
    }
  }
});
test('grades 1–5 ignore playback, mix, Speed, Form and other friends when deciding lesson completion', () => {
  for (const preset of ['minecraft', 'meadow']) for (const grade of [1, 2, 3, 4, 5]) {
    const band = defaultBandFor(grade, preset), before = structuredClone(band);
    for (const changed of [
      band, setTempo(band, 60), setForm(band, cycleForm(band.form)), { ...band, masterVolume: 0 },
      ...band.tracks.map(track => toggleMusician(band, track.id)),
      ...band.tracks.map(track => ({ ...band, tracks: band.tracks.map(t => t.id === track.id ? { ...t, volume: 0 } : t) })),
      ...band.tracks.filter(track => track.id !== leadTrack(grade)).map(track => cycleNote(band, track.id, 1)),
    ]) assert.equal(lessonDone(changed, { played: true }, grade), false, `${preset}, grade ${grade}`);
    assert.deepEqual(band, before, 'lesson checks are pure');
    assert.equal(lessonDone(band, { echoed: true }, grade), grade === 2, 'Echo credit belongs only to grade 2');
  }
});
test('melody lessons use the saved preset or the explicit preset, with Meadow for legacy scores', () => {
  for (const grade of [3, 4, 5]) {
    const { preset, ...legacy } = defaultBandFor(grade, 'meadow');
    assert.equal(lessonDone(legacy, {}, grade), false);
    assert.equal(lessonDone({ ...legacy, preset: 'unknown' }, {}, grade), false);
    const minecraft = defaultBandFor(grade, 'minecraft');
    assert.equal(lessonDone(minecraft, {}, grade, 'minecraft'), false);
    assert.equal(lessonDone(minecraft, {}, grade, 'meadow'), true);
  }
});
test('lesson completion refuses missing lead notes without throwing', () => {
  for (const grade of [1, 2, 3, 4, 5]) {
    for (const band of [null, {}, { tracks: 'nope' }, { tracks: [null] }, { tracks: [{ id: leadTrack(grade) }] }, setTrackNotes(defaultBandFor(grade), 'bass', [])]) {
      assert.equal(lessonDone(band, {}, grade), false);
    }
    assert.equal(lessonDone({ tracks: [{ id: leadTrack(grade), notes: [0] }] }, {}, grade), false);
  }
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
test('preset editing and restored rests keep the selected example’s notes', () => {
  const minecraft = defaultBandFor(3);
  const tune = setPattern(minecraft, 'bass', 1);
  assert.deepEqual(tune.tracks[0].notes, patternsFor('minecraft').bass[1]);
  assert.notDeepEqual(tune.tracks[0].notes, PATTERNS.bass[1]);
  const rest = toggleBeat(minecraft, 'bass', 3);
  assert.equal(rest.tracks[0].notes[3], null);
  assert.equal(toggleBeat(rest, 'bass', 3).tracks[0].notes[3], 0, 'Minecraft restores Do here, not Meadow’s Mi');
  assert.equal(patternGlyphs('melody', 0, minecraft), '♪ – ♪ – – ♪ – –');
  assert.equal(minecraft.preset, 'minecraft');
  const { preset, ...legacy } = createDefaultBand();
  assert.equal(isEdited(legacy, 3), false, 'a legacy Meadow draft is not silently compared to Minecraft');
  assert.equal(isEdited({ ...legacy, form: 'ABA' }, 5), false);
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
test('edit detection never throws on a thin or broken band', () => {
  assert.equal(isEdited({ tracks: [{ id: 'bass' }] }, 1), true);
  assert.equal(isEdited({}, 1), false);
  assert.equal(isEdited(null, 1), false);
  assert.equal(isEdited({ tracks: 'nope', form: 'ABA' }, 5), false);
});
test('melody shape reads only the sounded notes, in order', () => {
  assert.equal(melodyShape([null, null, null, null, null, null, null, null]), 'empty');
  assert.equal(melodyShape([2, null, null, null, null, null, null, null]), 'single');
  assert.equal(melodyShape([2, null, 2, 2, null, null, 2, null]), 'same');
  assert.equal(melodyShape([0, null, 1, 1, null, 3, null, 4]), 'up');
  assert.equal(melodyShape([4, 3, null, 3, null, 1, null, 0]), 'down');
  assert.equal(melodyShape([0, null, 3, null, 1, null, null, null]), 'mixed');
  assert.deepEqual(['empty', 'single', 'same', 'up', 'down', 'mixed'].map(shapeLine), [
    'Tap a lantern to add a note.', 'Add another note to hear your tune move.', 'Your tune stays the same.', 'Your tune goes up!', 'Your tune goes down.', 'Up and down, like a hill!',
  ]);
  assert.ok(shapeLine('single').length <= 56);
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
  const hints = [
    'Play the band once, then Send band.',
    'Change a lantern first, then Send band.',
    'Echo a rhythm first, then Send band.',
    'Change my tune first, then Send band.',
    'Change my tune above Cricket, then Send band.',
    'Change tune A first, then Send band.',
  ];
  assert.deepEqual(GRADES.map(lessonHint), hints);
  assert.deepEqual(Object.values(LESSON_HINTS), hints);
  assert.equal(lessonHint('k'), hints[0]);
  assert.equal(lessonHint('4'), hints[4]);
  assert.equal(openingLine(0), 'Tap a friend to rest or join. Who sings low? Who whistles high? Try Slow and Fast!');
  assert.equal(openingLine('k'), openingLine(0));
  assert.equal(openingLine(0, 'minecraft'), 'Tap a friend to rest or join. Who plays low? Who plays high? Try Slow and Fast!');
  assert.equal(openingLine(1), 'Tap a lantern: sound or rest. Rests are part of the rhythm too!');
  assert.equal(openingLine(2), 'Press Echo. I play a rhythm, then you copy it on the lanterns!');
  assert.equal(openingLine(3), 'Tap a lantern to climb: Do, Re, Mi, Sol, La. Does your tune go up or down?');
  assert.equal(openingLine(4), 'Cricket repeats the steady part. Change my tune above it!');
  assert.equal(openingLine(5), 'Make tune A, then tap Form for A B A. Which part comes back?');
  for (const g of GRADES) {
    const help = helpLines(g);
    assert.equal(help.length, 4, `grade ${g} help steps`);
    for (const text of [openingLine(g), ...help, lessonHint(g), `Band stopped. ${lessonHint(g)}`, `See beat stopped. ${lessonHint(g)}`]) {
      assert.ok(text.length <= 96, `${text} fits one page`);
      for (const s of sentences(text)) assert.ok(s.length <= 56, `"${s}" is ${s.length} chars`);
      for (const limit of Object.values(PAGE_CHARS)) assert.ok(paginate(text, limit).every(page => page.length <= limit));
    }
    assert.equal(help.at(-1), hints[g].replace('then Send band', 'then tap Send band'));
    const all = help.join(' ');
    for (const label of ['Play band', 'See beat', 'Sounds', 'Send band']) assert.ok(all.includes(label), `grade ${g} help names ${label}`);
    assert.match(help[2], /Sounds picks a tune/, 'help says Sounds picks a tune, not only loud or soft');
  }
  helpLines(2).push('x');
  assert.equal(helpLines(2).length, 4);
});
test('music keeps four short commands with icons, and Send band waits for the lesson', () => {
  const idle = musicCommands({ playing: false, quiet: false });
  assert.deepEqual(idle.map(c => c.label), ['Play band', 'See beat', 'Sounds', 'Send band']);
  assert.deepEqual(idle.map(c => c.id), ['play', 'quiet', 'tunes', 'save']);
  assert.deepEqual(idle.map(c => c.icon), ['play', 'quiet', 'music', 'check']);
  assert.deepEqual(musicCommands({ playing: true, quiet: true }).map(c => c.label), ['Stop', 'Stop', 'Sounds', 'Send band']);
  assert.deepEqual(musicCommands({ playing: true, quiet: true }).map(c => c.icon), ['stop', 'stop', 'music', 'check']);
  for (const c of [...idle, ...musicCommands({ playing: true, quiet: true, edited: true })]) {
    assert.ok(c.label.length <= 9, c.label);
    assert.ok(ICON_NAMES.includes(c.icon), c.icon);
  }
  assert.equal(idle.at(-1).finish, true);
  assert.equal(idle.at(-1).disabled, true);
  assert.equal(musicCommands().at(-1).disabled, true);
  assert.equal(musicCommands({ edited: true }).at(-1).disabled, false);
  assert.ok(Object.values(MUSICIAN_COLORS).every(color => contrastRatio(INK, color) >= 4.5));
});
