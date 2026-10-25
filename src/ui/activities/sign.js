// Fumi's sign (writing): a wooden sign built from word tiles; grades 1–5 can also type on it.
import { encounterReady, encounterOpeningDialogue, normalizeEncounterSnapshot } from '../../encounters.js';

const KIND = 'writing';
const MAX = 120;
const PAGE = 56;   // one dialogue page with Bigger words on; every sentence below fits it

export const SIGN_LINES = Object.freeze({
  ready: 'Your sign is ready. Add words, or put it up.',
  readyNow: 'Ready! Choose Put up sign.',
  full: 'The sign is full. Remove a word first.',
  cleared: 'The sign is empty. Tap words to add them.',
  empty: 'The sign is empty.',
  typed: 'You wrote it. Add more, or choose Put up sign.',
});

// Verbatim from the original writing encounter's word lists.
export function signWords(grade) {
  return grade === 0 ? ['Hello', 'friend!', 'Welcome', '♡']
    : grade < 3 ? ['Welcome', 'to', 'our', 'festival!', 'Come', 'play', 'with', 'us.']
    : ['Welcome, neighbors!', 'Come explore', 'our summer festival.', 'Everyone belongs here.', 'Please keep the path clear.'];
}

// Help per grade: Kindergarten has no typing box, so its help never mentions typing.
export function signHelp(grade) {
  return [
    grade === 0 ? 'Tap words to add them.' : 'Tap words to add them, or type your own.',
    'Remove word takes one tile back.',
    'Clear sign starts again.',
    'Choose Put up sign.',
  ];
}

// "Added: Welcome, neighbors!" — a sentence of at most 56 characters, so it never breaks mid-word on a page.
const endsSentence = word => /[.!?…]$/.test(word);
export function reactionLine(verb, word) {
  const room = PAGE - `${verb}: `.length - 1;   // one character kept for the period or the ellipsis
  const shown = word.length > room ? `${word.slice(0, room).trimEnd()}…` : word;
  return `${verb}: ${shown}${endsSentence(shown) ? '' : '.'}`;
}

const withText = (state, text) => ({ ...state, text: text.slice(0, MAX) });
const joined = (text, word) => [text.trim(), word].filter(Boolean).join(' ');
const lastWord = text => text.trimEnd().match(/\S+$/)?.[0] ?? '';
const wordCount = text => text.trim().split(/\s+/).filter(Boolean).length;

// The tiles added so far, newest last, trimmed to the ones the sign still ends with (typing can break the run).
// The run must start at a word boundary, so Remove word never cuts a typed word in half ("Come bus." keeps no "us.").
export function reconcileTiles(tiles, text) {
  const end = text.trimEnd();
  let kept = tiles.slice();
  while (kept.length) {
    const run = kept.join(' ');
    const fits = end === run || (end.endsWith(run) && /\s$/.test(end.slice(0, -run.length)));
    if (fits) break;
    kept = kept.slice(1);
  }
  return kept;
}

const withTiles = (ui, tiles) => ({ ...ui, tiles });
const reply = (state, ui, line) => (line ? { state, ui, line } : { state, ui });

function act(state, ui, action) {
  const tiles = reconcileTiles(ui?.tiles ?? [], state.text);
  if (action?.type === 'command' && action.id === 'remove') {
    if (!state.text.trim()) return { state, ui };
    const tile = tiles.at(-1);
    const word = tile ?? lastWord(state.text);
    const trimmed = state.text.trimEnd();
    const next = withText(state, trimmed.slice(0, trimmed.length - word.length).trimEnd());
    const line = reactionLine('Removed', word) + (next.text.trim() ? '' : ` ${SIGN_LINES.empty}`);
    return reply(next, withTiles(ui, tile ? tiles.slice(0, -1) : tiles), line);
  }
  if (action?.type === 'command' && action.id === 'clear') {
    if (!state.text) return { state, ui };
    return reply(withText(state, ''), withTiles(ui, []), SIGN_LINES.cleared);
  }
  if (action?.type === 'field' && typeof action.word === 'string') {
    const text = joined(state.text, action.word);
    if (text.length > MAX) return reply(state, withTiles(ui, tiles), SIGN_LINES.full);   // refused whole: never cut mid-word
    const next = withText(state, text);
    const line = reactionLine('Added', action.word) + (!encounterReady(state) && encounterReady(next) ? ` ${SIGN_LINES.readyNow}` : '');
    return reply(next, withTiles(ui, [...tiles, action.word]), line);
  }
  if (action?.type === 'field' && typeof action.typed === 'string') {
    const next = withText(state, action.typed);
    if (next.text === state.text) return { state, ui: withTiles(ui, tiles) };
    // One line per typed word (not per keystroke), so the last reaction never goes stale; the frame says the flip to empty.
    // The textarea's maxLength already stops typing at 120, so the overflow line is only a guard for programmatic input.
    const line = action.typed.length > MAX ? SIGN_LINES.full
      : wordCount(next.text) !== wordCount(state.text) && encounterReady(next) ? SIGN_LINES.typed : undefined;
    return reply(next, withTiles(ui, reconcileTiles(tiles, next.text)), line);
  }
  return { state, ui };
}

function commands(state) {
  const empty = !state.text.trim();
  return [
    { id: 'remove', label: 'Remove word', icon: 'back', disabled: empty },
    { id: 'clear', label: 'Clear sign', icon: 'trash', disabled: !state.text },
    { id: 'finish', label: 'Put up sign', icon: 'check', finish: true, disabled: !encounterReady(state) },
  ];
}

function mountField(host, { grade, dispatch }) {
  const doc = host.ownerDocument;
  const el = (tag, className) => Object.assign(doc.createElement(tag), className ? { className } : {});
  const root = el('div', grade >= 3 ? 'sign-field sign-field--phrases' : 'sign-field');
  const board = el('div', 'sign-board');
  let face;
  if (grade > 0) {
    face = el('textarea', 'sign-face sign-input');
    face.maxLength = MAX; face.rows = 3; face.spellcheck = false;
    face.setAttribute('aria-label', 'Write your festival sign');
    face.placeholder = 'Type your own words';
    face.addEventListener('input', () => dispatch({ type: 'field', typed: face.value }));
  } else {
    face = el('p', 'sign-face sign-display');
    face.setAttribute('aria-live', 'polite');
  }
  board.append(face);
  const post = el('div', 'sign-post');
  const tiles = el('div', 'sign-tiles');
  tiles.setAttribute('role', 'group'); tiles.setAttribute('aria-label', 'Word tiles');
  const tileButtons = new Map();
  for (const word of signWords(grade)) {
    const tile = el('button', 'px-button sign-tile');
    tile.type = 'button'; tile.textContent = word;
    tile.addEventListener('click', () => dispatch({ type: 'field', word }));
    tiles.append(tile);
    tileButtons.set(word, tile);
  }
  root.append(board, post, tiles);
  host.append(root);
  return {
    update(state, ui) {
      const text = state.text || '';
      if (grade > 0) { if (face.value !== text) face.value = text; }
      else {
        face.textContent = text || 'Your words go here';
        face.classList.toggle('sign-placeholder', !text);
      }
      board.classList.toggle('sign-board--ready', encounterReady(state));
      // Tiles already on the sign look pressed in (and say so to a screen reader), so a child can see what Remove word will take back.
      const used = new Set(reconcileTiles(ui?.tiles ?? [], text));
      for (const [word, tile] of tileButtons) {
        tile.classList.toggle('sign-tile--used', used.has(word));
        if (used.has(word)) tile.setAttribute('aria-description', 'On the sign');
        else tile.removeAttribute('aria-description');
      }
    },
    destroy() { root.remove(); },
  };
}

// The help window reads `help` without a grade, so it follows the grade of the last start().
let helpGrade = 1;

export default {
  kind: KIND,
  title: 'A sign from you',
  get help() { return signHelp(helpGrade); },
  helpFor: signHelp,
  notReadyLine: SIGN_LINES.empty,
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    helpGrade = grade;
    return { state: normalizeEncounterSnapshot(KIND, snapshot ?? {}, grade, chapter), ui: { tiles: [] } };
  },
  opening(state) { return encounterReady(state) ? SIGN_LINES.ready : encounterOpeningDialogue(state); },
  commands,
  act,
  mountField,
};
