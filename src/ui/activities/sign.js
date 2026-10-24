// Fumi's sign (writing): a wooden sign built from word tiles; grades 1–5 can also type on it.
import { encounterReady, encounterOpeningDialogue, normalizeEncounterSnapshot } from '../../encounters.js';

const KIND = 'writing';
const MAX = 120;
const READY_LINE = 'Your sign is ready. Add words or put it up.';

// Verbatim from src/encounters.js writingWords().
export function signWords(grade) {
  return grade === 0 ? ['Hello', 'friend!', 'Welcome', '♡']
    : grade < 3 ? ['Welcome', 'to', 'our', 'festival!', 'Come', 'play', 'with', 'us.']
    : ['Welcome, neighbors!', 'Come explore', 'our summer festival.', 'Everyone belongs here.', 'Please keep the path clear.'];
}

const withText = (state, text) => ({ ...state, text: text.slice(0, MAX) });
const lineFor = state => (encounterReady(state) ? READY_LINE : undefined);

function act(state, ui, action, grade) {
  let next = state;
  if (action?.type === 'command') {
    if (action.id === 'remove') next = withText(state, state.text.trimEnd().replace(/\s*\S+$/, ''));
    else if (action.id === 'clear') next = withText(state, '');
  } else if (action?.type === 'field') {
    if (typeof action.word === 'string') next = withText(state, [state.text.trim(), action.word].filter(Boolean).join(' '));
    else if (typeof action.typed === 'string') next = withText(state, action.typed);
  }
  if (next === state) return { state, ui };
  const line = action.type === 'field' && action.word !== undefined ? lineFor(next) : undefined;
  return line ? { state: next, ui, line } : { state: next, ui };
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
  for (const word of signWords(grade)) {
    const tile = el('button', 'px-button sign-tile');
    tile.type = 'button'; tile.textContent = word;
    tile.addEventListener('click', () => dispatch({ type: 'field', word }));
    tiles.append(tile);
  }
  root.append(board, post, tiles);
  host.append(root);
  return {
    update(state) {
      const text = state.text || '';
      if (grade > 0) { if (face.value !== text) face.value = text; }
      else {
        face.textContent = text || 'Your words go here';
        face.classList.toggle('sign-placeholder', !text);
      }
      board.classList.toggle('sign-board--ready', encounterReady(state));
    },
    destroy() { root.remove(); },
  };
}

export default {
  kind: KIND,
  title: 'A sign from you',
  help: ['Tap words to add them.', 'Grades 1–5 can type on the sign.', 'Remove word takes one back.', 'Choose Put up sign.'],
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    return { state: normalizeEncounterSnapshot(KIND, snapshot ?? {}, grade, chapter), ui: {} };
  },
  opening(state) { return encounterOpeningDialogue(state); },
  commands,
  act,
  mountField,
};
