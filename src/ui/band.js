import { PATTERNS, createDefaultBand, TEMPOS, FORMS } from '../audio.js';

// Pure helpers for Kiko's Sound Garden. No DOM here, so everything runs under node --test.
export const PITCH_NAMES = ['Do', 'Re', 'Mi', 'Sol', 'La'];
export const MUSICIAN_COLORS = { bass: '#6db8ff', voice: '#7fd46a', melody: '#ffd447', percussion: '#3fcfbf' };

const gradeNumber = grade => (grade === 'k' || grade === 'K' ? 0 : Number(grade) || 0);

// Kindergarten picks Tune 1 or Tune 2; grades 1–2 toggle beats; grades 3–5 pick notes. Percussion has no pitch, so it keeps beat toggles.
export function editorMode(grade, trackId) {
  const g = gradeNumber(grade);
  if (g <= 0) return 'patterns';
  if (g <= 2 || trackId === 'percussion') return 'beats';
  return 'notes';
}

// The lead musician edited on the lanterns. K only lights them up.
export function leadTrack(grade) {
  const g = gradeNumber(grade);
  if (g <= 0) return null;
  return g <= 2 ? 'percussion' : 'melody';
}

// Every edit copies the band and changes one track, so the caller's band is never touched.
const editTrack = (band, id, change) => ({
  ...band,
  tracks: band.tracks.map(track => (track.id === id ? change({ ...track, notes: [...track.notes] }) : { ...track, notes: [...track.notes] })),
});
const copyBand = band => ({ ...band, tracks: band.tracks.map(track => ({ ...track, notes: [...track.notes] })) });

export const toggleMusician = (band, id) => editTrack(band, id, track => ({ ...track, enabled: !track.enabled }));

export function setPattern(band, id, pattern) {
  const p = pattern === 1 ? 1 : 0;
  return editTrack(band, id, track => ({ ...track, pattern: p, notes: [...PATTERNS[id][p]] }));
}

export function toggleBeat(band, id, beat) {
  return editTrack(band, id, track => {
    track.notes[beat] = track.notes[beat] === null ? PATTERNS[id][track.pattern][beat] ?? 0 : null;
    return track;
  });
}

// null → Do → Re → Mi → Sol → La → null.
export function cycleNote(band, id, beat) {
  return editTrack(band, id, track => {
    const note = track.notes[beat];
    track.notes[beat] = note === null ? 0 : note >= PITCH_NAMES.length - 1 ? null : note + 1;
    return track;
  });
}

export const noteLabel = note => (note === null || note === undefined ? 'Rest' : PITCH_NAMES[note]);

// Replaces one track's eight notes. Anything that is not a note 0–4 becomes a rest.
const cleanNote = n => (Number.isInteger(n) && n >= 0 && n <= 4 ? n : null);
export function setTrackNotes(band, id, notes) {
  const list = Array.from({ length: 8 }, (_, i) => cleanNote(Array.isArray(notes) ? notes[i] : null));
  return editTrack(band, id, track => ({ ...track, notes: list }));
}

// Speed sign: Slow · Steady · Fast. Kept local so this file never waits on the engine.
export const TEMPO_NAMES = { 60: 'Slow', 90: 'Steady', 120: 'Fast' };
export const cycleTempo = tempo => TEMPOS[(TEMPOS.indexOf(tempo) + 1) % TEMPOS.length];
export const setTempo = (band, tempo) => ({ ...copyBand(band), tempo: TEMPOS.includes(tempo) ? tempo : 90 });

// Form chip for grades 4–5: A → A B → A B A.
export const formLabel = form => (FORMS.includes(form) ? form.split('').join(' ') : 'A');
export const cycleForm = form => FORMS[(FORMS.indexOf(form) + 1) % FORMS.length];
export const setForm = (band, form) => ({ ...copyBand(band), form: FORMS.includes(form) ? form : 'A' });

// The band a grade starts from. Grade 4 opens with A B, grade 5 with A B A.
export function defaultBandFor(grade) {
  const g = gradeNumber(grade);
  return { ...createDefaultBand(), form: g === 5 ? 'ABA' : g === 4 ? 'AB' : 'A' };
}

// Tolerates a saved track with missing fields: the finish gate must never throw.
const trackKey = track => JSON.stringify({ id: track.id, enabled: track.enabled, pattern: track.pattern, notes: (track.notes ?? []).map(cleanNote), volume: track.volume });
// Send band stays off until the child changed something: a track, the speed, or the form.
export function isEdited(band, grade) {
  const base = defaultBandFor(grade), tracks = Array.isArray(band?.tracks) ? band.tracks : [];
  if ((band?.tempo ?? 90) !== base.tempo || (band?.form ?? 'A') !== base.form) return true;
  return base.tracks.some(track => trackKey(track) !== trackKey(tracks.find(t => t?.id === track.id) ?? track));
}

const sounds = notes => notes.filter(n => n !== null && n !== undefined);

// Shape of the melody, judged on the sounded notes in order.
export function melodyShape(notes) {
  const played = sounds(notes);
  if (!played.length) return 'empty';
  const steps = played.slice(1).map((n, i) => Math.sign(n - played[i]));
  const up = steps.some(s => s > 0), down = steps.some(s => s < 0);
  if (up && down) return 'mixed';
  if (up) return 'up';
  if (down) return 'down';
  return 'same';
}

const SHAPE_LINES = {
  empty: 'Tap a lantern to add a note.',
  same: 'Your tune stays the same.',
  up: 'Your tune goes up!',
  down: 'Your tune goes down.',
  mixed: 'Up and down, like a hill!',
};
export const shapeLine = shape => SHAPE_LINES[shape] ?? SHAPE_LINES.empty;

// Rhythms Kiko plays for the grade 2 Echo game. Each has 3 to 5 sounds and none is Cricket's default.
const T = true, F = false;
export const ECHO_PATTERNS = [
  [T, F, F, T, F, F, T, F],
  [T, T, F, F, T, T, F, F],
  [T, F, T, F, T, F, T, F],
  [T, F, T, T, F, T, F, T],
];
export const pickEcho = index => ECHO_PATTERNS[((Math.trunc(index) % ECHO_PATTERNS.length) + ECHO_PATTERNS.length) % ECHO_PATTERNS.length];
// Only sound versus rest counts, never which pitch.
export const echoMatches = (notes, mask) => mask.length === 8 && mask.every((on, i) => Boolean(on) === (notes?.[i] !== null && notes?.[i] !== undefined));

export const patternGlyphs = (id, p) => (PATTERNS[id]?.[p === 1 ? 1 : 0] ?? []).map(n => (n === null ? '–' : '♪')).join(' ');

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const capital = word => word[0].toUpperCase() + word.slice(1);
const count = (n, word) => `${NUMBER_WORDS[n] ?? String(n)} ${word}${n === 1 ? '' : 's'}`;
// "Five sounds and three rests. Nice spacing!" A short list counts its missing lanterns as rests.
export function restsLine(notes) {
  const s = sounds((Array.isArray(notes) ? notes : []).slice(0, 8)).length, r = 8 - s;
  const tail = s === 0 ? 'Tap a lantern to add a sound.' : r === 0 ? 'Try a rest too!' : 'Nice spacing!';
  return `${capital(count(s, 'sound'))} and ${count(r, 'rest')}. ${tail}`;
}

// Kiko's words by grade. Every sentence fits one 56-character Bigger-words page.
const OPENING = {
  0: 'Tap a friend to join. Who sings low? Who whistles high? Try Slow and Fast!',
  1: 'Tap a lantern: sound or rest. Rests are part of the rhythm too!',
  2: 'Press Echo. I play a rhythm, then you copy it on the lanterns!',
  3: 'Tap a lantern to climb: Do, Re, Mi, Sol, La. Does your tune go up or down?',
  4: 'Cricket repeats the steady part. Change my tune above it!',
  5: 'Make tune A, then tap Form for A B A. Which part comes back?',
};
const MENU_HELP = 'Play starts the band. See beat lights the lanterns. Sounds picks a tune, loud or soft.';
const HELP = {
  0: ['Tap a friend to join or rest.', 'Tap Speed: Slow, Steady, or Fast.', MENU_HELP, 'Tap Send band when your band is ready.'],
  1: ['Tap a lantern: sound or rest.', 'Tap a friend to join or rest.', MENU_HELP, 'Tap Send band when your rhythm is ready.'],
  2: ['Press Echo. I play a rhythm for you.', 'Copy it on the lanterns: sound or rest.', MENU_HELP, 'Tap Send band when your rhythm is ready.'],
  3: ['Tap a lantern to climb: Do, Re, Mi, Sol, La.', 'High notes hang high. Low notes hang low.', MENU_HELP, 'Tap Send band when your tune is ready.'],
  4: ['Tap a lantern to change my tune.', 'Cricket keeps the steady part under it.', MENU_HELP, 'Tap Send band when your tune is ready.'],
  5: ['Tap a lantern to make tune A.', 'Tap Form for A B or A B A. Listen for the part that comes back.', MENU_HELP, 'Tap Send band when your tune is ready.'],
};
const gradeKey = grade => Math.max(0, Math.min(5, gradeNumber(grade)));
export const openingLine = grade => OPENING[gradeKey(grade)];
export const helpLines = grade => [...HELP[gradeKey(grade)]];

// The same four commands at every grade. Labels stay at 9 characters so the icon survives Bigger words.
export function musicCommands({ playing = false, quiet = false, edited = false } = {}) {
  return [
    { id: 'play', label: playing ? 'Stop' : 'Play', icon: playing ? 'stop' : 'play', pressed: Boolean(playing) },
    { id: 'quiet', label: quiet ? 'Stop' : 'See beat', icon: quiet ? 'stop' : 'quiet', pressed: Boolean(quiet) },
    { id: 'tunes', label: 'Sounds', icon: 'music' },
    { id: 'save', label: 'Send band', icon: 'check', finish: true, disabled: !edited },
  ];
}
