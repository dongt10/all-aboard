import { PATTERNS } from '../audio.js';

// Pure helpers for Kiko's Sound Garden. No DOM here, so everything runs under node --test.
export const PITCH_NAMES = ['Do', 'Re', 'Mi', 'Sol', 'La'];
export const MUSICIAN_COLORS = { bass: '#6db8ff', voice: '#7fd46a', melody: '#ffd447', percussion: '#3fcfbf' };

const gradeNumber = grade => (grade === 'k' || grade === 'K' ? 0 : Number(grade) || 0);

// Kindergarten picks Sprout or Flower; grades 1–2 toggle beats; grades 3–5 pick notes. Percussion has no pitch, so it keeps beat toggles.
export function editorMode(grade, trackId) {
  const g = gradeNumber(grade);
  if (g <= 0) return 'patterns';
  if (g <= 2 || trackId === 'percussion') return 'beats';
  return 'notes';
}

// Every edit copies the band and changes one track, so the caller's band is never touched.
const editTrack = (band, id, change) => ({
  ...band,
  tracks: band.tracks.map(track => (track.id === id ? change({ ...track, notes: [...track.notes] }) : { ...track, notes: [...track.notes] })),
});

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

export function musicCommands({ playing = false, quiet = false } = {}) {
  return [
    { id: 'play', label: playing ? 'Stop' : 'Play', icon: playing ? 'stop' : 'play', pressed: Boolean(playing) },
    { id: 'quiet', label: quiet ? 'Stop quiet' : 'Quiet play', icon: quiet ? 'stop' : 'quiet', pressed: Boolean(quiet) },
    { id: 'tunes', label: 'Tunes', icon: 'music' },
    { id: 'save', label: 'Save band', icon: 'check', finish: true },
  ];
}
