// The Matsuri Guide: the town's character index and the child's stamp book. Pure, no DOM.
import { CHARACTERS } from '../data.js';
import { getCompleted } from '../progress.js';
import { SUBJECT_THEME } from './palette.js';

// What each stamp says, by the lowest grade it applies to (0 is Kindergarten). The last row at or below the grade wins.
const STAMPS = {
  math: [[0, 'Same number on both sides is equal.'], [1, 'Different crates can weigh the same.'], [3, 'Sums can match in more than one way.']],
  science: [[0, 'Shade keeps the sun off the ice.'], [2, 'Shade makes ice melt slower.']],
  reading: [[0, 'Letters make a word you can read.'], [1, 'The story tells you what to pack.'], [3, 'Clues in a story tell you what is needed.']],
  writing: [[0, 'Words welcome your neighbors.']],
  art: [[0, 'Shapes and colors make a design.']],
  community: [[0, 'A bench gives a tired neighbor a rest.'], [1, 'A good plan works for everyone.'], [3, 'A plan has room for every need.']],
  music: [[0, 'Music can be fast or slow, high or low.'], [1, 'Rests are part of a rhythm.'], [3, 'A tune can go up, down, or stay the same.'], [4, 'A steady part holds up a changing tune.']],
};

// A missing grade reads as Kindergarten here and in encounters.js gradeBand.
export function learnedText(subject, grade = 0) {
  const rows = STAMPS[subject];
  if (!rows) return '';
  const g = Number.isFinite(Number(grade)) ? Number(grade) : 0;
  let text = rows[0][1];
  for (const [min, line] of rows) if (g >= min) text = line;
  return text;
}

export const SIDE_BIOS = {
  pip: 'A duck courier who delivers every invitation, except his own.',
  nori: 'A turtle festival helper. Slow is her favorite speed.',
  cricket: 'Plays the tap-tap rhythm in Kiko’s band.',
};

const SIDE_CAST = [
  { id: 'pip', name: 'Pip', species: 'duck', role: 'Courier', canFind: true },
  { id: 'nori', name: 'Nori', species: 'turtle', role: 'Festival helper', canFind: true },
  { id: 'cricket', name: 'Cricket', species: 'cricket', role: 'Band drummer', canFind: false },
];

// The app state keeps grade 1 for Kindergarten with chapter 0, so the stamp grade is 0 unless chapter 1 is on.
export const stampGrade = state => (state?.chapter === 1 ? state.grade : 0);

export function guideEntries(state) {
  const done = new Set(getCompleted(state));
  const grade = stampGrade(state);
  const neighbors = CHARACTERS.map(c => ({
    id: c.id, name: c.name, species: c.species, role: `${SUBJECT_THEME[c.id].label} · ${c.location}`, bio: c.description,
    subject: c.id, stamp: { earned: done.has(c.id), learned: learnedText(c.id, grade) }, canFind: true, canVisit: true,
  }));
  const side = SIDE_CAST.map(s => ({ id: s.id, name: s.name, species: s.species, role: s.role, bio: SIDE_BIOS[s.id], subject: null, stamp: null, canFind: s.canFind, canVisit: false }));
  return [...neighbors, ...side];
}

export function stampCount(state) {
  const done = new Set(getCompleted(state));
  return { earned: CHARACTERS.filter(c => done.has(c.id)).length, total: CHARACTERS.length };
}
