// Village replies read only the published creation, never an encounter's transient ui.
import { CHARACTERS } from './data.js';
import { cartBalance, iceRemaining, ENCOUNTER_COLOR_NAMES } from './encounters.js';
import { rowsReady, rowsReport } from './rows.js';
import { pizzaReady, shareWords } from './pizza.js';
import { beansReady, TILE_NAMES } from './beans.js';
import { CARD_WORDS, ENERGY_TILES } from './chain.js';
import { READING_LABELS, readingItems } from './reading.js';
import { STORIES, ribbonReady } from './ribbon.js';
import { TALE_DECKS, TALE_CAST } from './tales.js';
import { STAMP_FORMS, patternReport, symmetryReport } from './banner-rules.js';
import { scenarioById } from './sign-scenarios.js';
import { errandsFor } from './compass.js';
import { helpSetOfCrew, helperById } from './helpday.js';
import { CAST } from './music.js';
import { FORMS, phraseNotes } from './audio.js';
import { TEMPO_NAMES, melodyShape } from './ui/band.js';

const FALLBACK = {
  math: 'Thank you for making things with me!',
  science: 'Thank you for exploring with me!',
  reading: 'Thank you for sharing with me!',
  art: 'Thank you for making art with me!',
  writing: 'Thank you for sharing your words!',
  community: 'Thank you for helping our village!',
  music: 'Thank you for making music with me!',
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = values => values.length < 3 ? values.join(' and ') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
const fits = words => typeof words === 'string' && words.length <= 96
  && words.split(/(?<=[.!?])\s+/).every(sentence => sentence.length <= 56);

function mathLine(s) {
  if (s.activity === 'rows') {
    if (!rowsReady(s)) return null;
    const r = rowsReport(s);
    return `${r.rows} ${r.rows === 1 ? 'row' : 'rows'} of ${r.perRow}. ${r.sum}! Thank you!`;
  }
  if (s.activity === 'pizza') {
    if (!Number.isInteger(s.grade) || !pizzaReady(s)) return null;
    const units = s.plates[0];
    return `${s.plates.length} plates, ${shareWords(units)} ${units === 2 ? 'slice' : 'slices'} each. Everyone eats!`;
  }
  if (s.activity !== undefined || ![s.left, s.right].every(cargo => Array.isArray(cargo)
    && cargo.length <= 8 && Array.from(cargo).every(n => [1, 2, 3, 5].includes(n)))) return null;
  const r = cartBalance(s);
  return s.rolled === true && r.balanced ? `${r.left} and ${r.right}! Your cart rolls smooth. Thank you!` : null;
}

function scienceLine(s) {
  if (s.activity === 'beans') {
    if (!beansReady(s)) return null;
    const change = s.change === 'water' ? 'Cup B got no water.' : 'You put cup B in a dark box.';
    const bed = list(s.bed.map(tile => TILE_NAMES[tile].toLowerCase()));
    return `${change} Your bed card has ${bed}!`;
  }
  if (s.activity === 'chain') {
    if (!Array.isArray(s.chain) || s.chain.length !== 3 || !Array.from(s.chain).every(card => typeof card === 'string' && Object.hasOwn(CARD_WORDS, card))
      || !Array.isArray(s.energy) || s.energy.length !== 3 || !Array.from(s.energy).every(n => ENERGY_TILES.includes(n))) return null;
    return `${s.energy.join(', ')} on your chart. The ${CARD_WORDS[s.chain[2]].word.toLowerCase()} is last!`;
  }
  if (s.activity !== undefined || !['left', 'right'].includes(s.canopy)) return null;
  const shaded = `You shaded tray ${s.canopy === 'left' ? 'A' : 'B'}.`;
  return Number.isFinite(s.time) && s.time > 0 && iceRemaining(s.time, true) > iceRemaining(s.time, false)
    ? `${shaded} It kept more ice!` : `${shaded} Thank you for testing with me!`;
}

function readingLine(s) {
  if (s.activity === 'ribbon') {
    if (!ribbonReady(s)) return null;
    const story = STORIES[s.story], lesson = story.lessons.find(item => item.id === story.lesson);
    return `${lesson.text} That is the lesson you chose!`;
  }
  if (s.activity === 'tales') {
    const deck = Number.isInteger(s.deck) ? TALE_DECKS[s.deck] : null;
    if (!deck || !Array.isArray(s.solved)) return null;
    const names = deck.filter(tale => s.solved.includes(tale.id)).map(tale => TALE_CAST[tale.who].name);
    return names.length ? `You named ${list(names)} in the tales. Thank you!` : null;
  }
  if (s.activity !== undefined || !Array.isArray(s.found)) return null;
  const packed = readingItems(s.request).filter(id => s.found.includes(id)).map(id => READING_LABELS[id].toLowerCase());
  return packed.length ? `You packed ${list(packed)}. Thank you for helping me!` : null;
}

function artLine(s, grade) {
  const stamps = s.stamps;
  if (s.activity !== undefined || !Array.isArray(stamps) || !stamps.length || stamps.length > 30
    || !Array.from(stamps).every(stamp => object(stamp) && typeof stamp.shape === 'string' && Object.hasOwn(STAMP_FORMS, stamp.shape)
      && typeof stamp.color === 'string' && Object.hasOwn(ENCOUNTER_COLOR_NAMES, stamp.color) && Number.isFinite(stamp.x) && Number.isFinite(stamp.y)
      && Number.isFinite(stamp.rotation))) return null;
  // The count is the child's saved stamps; Yuki's preprinted pattern is not in this list.
  const colors = [...new Set(stamps.map(stamp => ENCOUNTER_COLOR_NAMES[stamp.color].toLowerCase()))];
  const count = `You made ${stamps.length} ${stamps.length === 1 ? 'stamp' : 'stamps'}!`;
  const design = [1, 2].includes(grade) && patternReport({ ...s, grade }).complete
    ? (grade === 1 ? 'Your shape pattern repeats!' : 'Your color pattern repeats!')
    : grade >= 3 && symmetryReport(s).symmetric ? 'Both sides mirror!' : 'Thank you!';
  return `${count} ${capital(list(colors))}. ${design}`;
}

function signReaction(s, grade) {
  const scenario = scenarioById(s.scenario, grade);
  // Pip and Nori live in the village too. Cricket stays on the music stage.
  const readers = [...CHARACTERS, { id: 'pip', name: 'Pip' }, { id: 'nori', name: 'Nori' }];
  const reader = readers.find(character => character.name === scenario?.reader
    || (character.id === 'music' && scenario?.reader === 'Kiko and the band'));
  const text = typeof s.text === 'string' ? s.text.replace(/\s+/g, ' ').trim() : '';
  const count = text ? text.split(' ').length : 0;
  // A short sign is read back word for word: the reader noticing the child's own words is the point.
  const quote = text && text.length <= 40 ? `It says: ${/[.!?…]$/.test(text) ? text : `${text}.`}` : '';
  const readBack = quote ? `${reader ? 'A sign for me!' : 'Your sign is up!'} ${quote} ${reader ? 'Thank you, friend!' : 'Thank you!'}` : '';
  if (readBack && fits(readBack)) return { id: reader ? reader.id : 'writing', words: readBack };
  if (reader) return { id: reader.id, words: count
    ? `A sign for me! ${count} ${count === 1 ? 'word' : 'words'} on your sign. Thank you, friend!`
    : 'You made a sign for me. Thank you!' };
  return { id: 'writing', words: count
    ? `${count} ${count === 1 ? 'word' : 'words'} on your sign! Thank you for sharing your words.`
    : FALLBACK.writing };
}

function communityLine(s) {
  if (s.activity === 'compass') {
    if (!Array.isArray(s.done)) return null;
    const errands = errandsFor(s).map(errand => errand.id).filter(id => s.done.includes(id));
    const names = { north: 'flour', west: 'drum', lantern: 'lantern', east: 'lantern', south: 'flour' };
    const things = [...new Set(errands.map(id => names[id]).filter(Boolean))];
    return errands.length && things.length ? `${capital(list(things))} delivered! ${errands.length} ${errands.length === 1 ? 'errand' : 'errands'} done. Thank you!` : null;
  }
  if (s.activity === 'helpday') {
    if (!Array.isArray(s.crew)) return null;
    const set = helpSetOfCrew(s.crew);
    const matched = s.crew.filter(pair => object(pair) && typeof pair.job === 'string' && Object.hasOwn(set.fits, pair.job) && set.fits[pair.job] === pair.helper);
    const names = [...new Set(matched.map(pair => helperById(pair.helper).name))];
    return names.length ? `${list(names)} ${names.length === 1 ? 'fits the job' : 'fit their jobs'}. Thank you for matching our crew!` : null;
  }
  if (s.activity !== undefined || !Array.isArray(s.placements)) return null;
  const items = ['bench', 'quiet', 'sign'].filter(item => s.placements.some(p => p?.item === item));
  const names = items.map(item => item === 'quiet' ? 'a garden' : `a ${item}`);
  return names.length ? `You placed ${list(names)}. Thank you for planning our square!` : null;
}

function musicLine(s) {
  if (s.activity !== undefined || !Array.isArray(s.tracks)) return null;
  const validNotes = notes => Array.isArray(notes) && notes.length === 8
    && Array.from(notes).every(note => note === null || (Number.isInteger(note) && note >= 0 && note <= 4));
  const tracks = CAST.map(friend => s.tracks.find(track => object(track) && track.id === friend.id));
  const knownPlayback = Number.isFinite(s.masterVolume) && s.masterVolume >= 0 && s.masterVolume <= 1
    && FORMS.includes(s.form) && ['meadow', 'minecraft'].includes(s.preset)
    && tracks.every(track => track && typeof track.enabled === 'boolean' && validNotes(track.notes)
      && Number.isFinite(track.volume) && track.volume >= 0 && track.volume <= 1);
  // B can still sound when the edited A contains only rests. Follow playback's saved form and preset.
  const canPlay = track => track?.enabled === true && Number.isFinite(track.volume) && track.volume > 0 && validNotes(track.notes)
    && FORMS.includes(s.form) && ['meadow', 'minecraft'].includes(s.preset)
    && [...s.form].some(letter => phraseNotes(track, letter, s.preset).some(note => note !== null));
  const names = CAST.filter((friend, index) => canPlay(tracks[index])).map(friend => friend.name);
  const parts = [];
  if (s.masterVolume === 0) parts.push('Your band has sound off.');
  else if (knownPlayback) parts.push(names.length ? `${list(names)} join in!` : 'Your friends are quiet.');
  if (Number.isFinite(s.tempo) && Object.hasOwn(TEMPO_NAMES, s.tempo)) parts.push(`${TEMPO_NAMES[s.tempo]}!`);
  const melody = tracks[2];
  if (validNotes(melody?.notes)) {
    const shape = melodyShape(melody.notes);
    parts.push({ up: 'Tune A goes up!', down: 'Tune A goes down.', mixed: 'Tune A goes up and down.',
      same: 'Tune A stays on one note.', single: 'Tune A has one sound.', empty: 'Tune A has only rests.' }[shape]);
  }
  if (FORMS.includes(s.form)) parts.push(`Form ${s.form.split('').join(' ')}.`);
  return parts.length ? parts.join(' ') : null;
}

// Unknown subjects do not celebrate. Recognized subjects can always say a true thank-you,
// even for an old or incomplete snapshot. Do not normalize here: defaults could invent facts.
export function reactionLine(id, creation, grade) {
  if (typeof id !== 'string' || !Object.hasOwn(FALLBACK, id)) return null;
  const fallback = { id, words: FALLBACK[id] };
  if (!object(creation) || creation.kind !== id) return fallback;
  const s = creation;
  const savedGrade = Number.isInteger(s.grade) && s.grade >= 0 && s.grade <= 5 ? s.grade
    : Number.isInteger(grade) && grade >= 0 && grade <= 5 ? grade : 0;
  if (id === 'writing' && s.activity === undefined) return signReaction(s, savedGrade);
  const words = id === 'math' ? mathLine(s) : id === 'science' ? scienceLine(s)
    : id === 'reading' ? readingLine(s) : id === 'art' ? artLine(s, savedGrade)
      : id === 'community' ? communityLine(s) : id === 'music' ? musicLine(s) : null;
  // Never cut a sentence in half to fit; future content still has a safe reply.
  return fits(words) ? { id, words } : fallback;
}
