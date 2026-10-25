import { STAMP_PIZZA, STAMP_PIZZA_HALVES } from '../pizza.js';
import { STAMP_CHAIN } from '../chain.js';
import { STAMP_HELPDAY } from '../helpday.js';
import { STAMP_TALES } from '../tales.js';
// The Matsuri Guide: the town's character index and the child's stamp book. Pure, no DOM.
import { CHARACTERS } from '../data.js';
import { getCompleted, getRewards } from '../progress.js';
import { SUBJECT_THEME } from './palette.js';

// What each stamp says, by the lowest grade it applies to (0 is Kindergarten). The last row at or below the grade wins.
const STAMPS = {
  math: [[0, 'Same number on both sides is equal.'], [1, 'Different crates can weigh the same.'], [3, STAMP_PIZZA], [4, 'Sharing equally is dividing: 12 ÷ 4 = 3 each.'], [5, STAMP_PIZZA_HALVES]],
  science: [[0, 'Shade keeps the sun off the ice.'], [2, 'Shade makes ice melt slower.'], [3, STAMP_CHAIN], [4, 'A pond chain keeps one tenth at each step too.'], [5, 'Only 10% of energy moves up each step of a chain.']],
  reading: [[0, 'Letters make a word you can read.'], [1, 'The story tells you what to pack.'], [3, STAMP_TALES]],
  writing: [[0, 'Words welcome your neighbors.'], [1, 'A sentence starts big and ends with a mark.'], [3, 'Describing words paint a picture for readers.']],
  art: [[0, 'Shapes and colors make a design.'], [1, 'A pattern repeats: star, circle, star, circle.'], [3, 'A mirror design is the same on both sides.']],
  community: [[0, 'A bench gives a tired neighbor a rest.'], [1, 'A good plan works for everyone.'], [3, STAMP_HELPDAY], [4, 'Every job needs the strength that fits it.'], [5, 'Ask about a strength before you hand out a job.']],
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
  pip: 'Pip brings notes to every home.',
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
  const rewards = new Map(getRewards(state).map(record => [record.subjectId, record]));
  const grade = stampGrade(state);
  const learned = id => {
    const record = rewards.get(id);
    const legacy = record && !record.creation?.activity && ['math', 'science', 'reading', 'community'].includes(id);
    return learnedText(id, legacy ? Math.min(grade, 2) : grade);
  };
  const neighbors = CHARACTERS.map(c => ({
    id: c.id, name: c.name, species: c.species, role: `${SUBJECT_THEME[c.id].label} · ${c.location}`, bio: c.id === 'music' ? 'Kiko makes music you can see and hear.' : c.description,
    subject: c.id, stamp: { earned: rewards.has(c.id), learned: learned(c.id) }, canFind: true, canVisit: true,
  }));
  const side = SIDE_CAST.map(s => ({ id: s.id, name: s.name, species: s.species, role: s.role, bio: SIDE_BIOS[s.id], subject: null, stamp: null, canFind: s.canFind, canVisit: false }));
  return [...neighbors, ...side];
}

export function stampCount(state) {
  const done = new Set(getCompleted(state));
  return { earned: CHARACTERS.filter(c => done.has(c.id)).length, total: CHARACTERS.length };
}
