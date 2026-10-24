// The Matsuri Guide: the town's character index and the child's stamp book. Pure, no DOM.
import { CHARACTERS } from '../data.js';
import { getCompleted } from '../progress.js';
import { SUBJECT_THEME } from './palette.js';

export const LEARNED = {
  math: 'Equal groups balance a cart.',
  science: 'Shade keeps ice from melting.',
  art: 'Shapes and colors make a design.',
  reading: 'Story clues tell you what to pack.',
  writing: 'Words welcome your neighbors.',
  community: 'A good plan works for everyone.',
  music: 'Parts join together to make a song.',
};

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

export function guideEntries(state) {
  const done = new Set(getCompleted(state));
  const neighbors = CHARACTERS.map(c => ({
    id: c.id, name: c.name, species: c.species, role: `${SUBJECT_THEME[c.id].label} · ${c.location}`, bio: c.description,
    subject: c.id, stamp: { earned: done.has(c.id), learned: LEARNED[c.id] }, canFind: true, canVisit: true,
  }));
  const side = SIDE_CAST.map(s => ({ id: s.id, name: s.name, species: s.species, role: s.role, bio: SIDE_BIOS[s.id], subject: null, stamp: null, canFind: s.canFind, canVisit: false }));
  return [...neighbors, ...side];
}

export function stampCount(state) {
  const done = new Set(getCompleted(state));
  return { earned: CHARACTERS.filter(c => done.has(c.id)).length, total: CHARACTERS.length };
}
