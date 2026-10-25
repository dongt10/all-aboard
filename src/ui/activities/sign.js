// Fumi's sign (writing): a wooden sign built from word tiles; grades 1–5 can also type on it.
import { normalizeEncounterSnapshot } from '../../encounters.js';
import { signWords, signTileGroups, reconcileTiles, signReady, signOpening, signHelp, signHint, signReport, SIGN_RULE_LINES } from '../../sign-rules.js';
import { gridMove, keyIntent } from '../input.js';
export { signWords, signHelp, reconcileTiles } from '../../sign-rules.js';

const KIND = 'writing';
const MAX = 120;
const PAGE = 56;   // one dialogue page with Bigger words on; every sentence below fits it

export const SIGN_LINES = Object.freeze({
  ready: SIGN_RULE_LINES.ready,
  readyNow: 'Ready! Choose Put up sign.',
  full: 'The sign is full. Remove a word first.',
  cleared: 'The sign is empty. Tap words to add them.',
  empty: 'The sign is empty.',
  typed: 'You wrote it. Add more, or choose Put up sign.',
});

// "Added: Welcome, neighbors!" — a sentence of at most 56 characters, so it never breaks mid-word on a page.
const endsSentence = word => /[.!?…]$/.test(word);
export function reactionLine(verb, word) {
  const room = PAGE - `${verb}: `.length - 1;   // one character kept for the period or the ellipsis
  const shown = word.length > room ? `${word.slice(0, room).trimEnd()}…` : word;
  return `${verb}: ${shown}${endsSentence(shown) ? '' : '.'}`;
}

const withText = (state, text, tiles) => ({ ...state, text: text.slice(0, MAX), tiles });
const joined = (text, word) => [text.trim(), word].filter(Boolean).join(' ');
const lastWord = text => text.trimEnd().match(/\S+$/)?.[0] ?? '';

// Old saves have only text. Recover whole grade tiles from its end without cutting typed words.
function legacyTiles(text, grade) {
  const tiles = [], words = signWords(grade);
  let rest = text.trimEnd();
  while (tiles.length < 60) {
    const word = words.find(word => reconcileTiles([word], rest).length);
    if (!word) break;
    tiles.unshift(word);
    rest = rest.slice(0, -word.length).trimEnd();
  }
  return reconcileTiles(tiles, text);
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
    const next = withText(state, trimmed.slice(0, trimmed.length - word.length).trimEnd(), tile ? tiles.slice(0, -1) : tiles);
    const hint = signHint(next);
    const line = reactionLine('Removed', word) + (hint ? ` ${hint}` : '');
    return reply(next, withTiles(ui, next.tiles), line);
  }
  if (action?.type === 'command' && action.id === 'clear') {
    if (!state.text) return { state, ui };
    return reply(withText(state, '', []), withTiles(ui, []), SIGN_LINES.cleared);
  }
  if (action?.type === 'field' && typeof action.word === 'string') {
    if (!signWords(state.grade).includes(action.word)) return { state, ui };
    const text = joined(state.text, action.word);
    if (text.length > MAX) return reply(state, ui, SIGN_LINES.full);   // refused whole: never cut mid-word
    const next = withText(state, text, [...tiles, action.word]);
    const line = `${reactionLine('Added', action.word)} ${signReady(next) ? SIGN_LINES.readyNow : signHint(next)}`;
    return reply(next, withTiles(ui, next.tiles), line);
  }
  if (action?.type === 'field' && state.grade > 0 && typeof action.typed === 'string') {
    const text = action.typed.slice(0, MAX);
    const next = withText(state, text, reconcileTiles(tiles, text));
    if (next.text === state.text) return { state, ui };
    // Speak for a new word or a readiness change, including punctuation without a new word.
    // The textarea's maxLength already stops typing at 120, so the overflow line is only a guard for programmatic input.
    const shouldSpeak = signReport(next.text, next.grade).words !== signReport(state.text, state.grade).words
      || signReady(state) !== signReady(next);
    const line = action.typed.length > MAX ? SIGN_LINES.full
      : shouldSpeak ? (signReady(next) ? SIGN_LINES.typed : signHint(next)) : undefined;
    return reply(next, withTiles(ui, next.tiles), line);
  }
  return { state, ui };
}

function commands(state) {
  const empty = !state.text.trim();
  return [
    { id: 'remove', label: 'Remove word', icon: 'back', disabled: empty },
    { id: 'clear', label: 'Clear sign', icon: 'trash', disabled: !state.text },
    { id: 'finish', label: 'Put up sign', icon: 'check', finish: true, disabled: !signReady(state) },
  ];
}

function mountField(host, { grade, dispatch }) {
  const doc = host.ownerDocument;
  const el = (tag, className) => Object.assign(doc.createElement(tag), className ? { className } : {});
  const root = el('div', grade >= 3 ? 'sign-field sign-field--phrases' : 'sign-field');
  const board = el('div', 'sign-board');
  const face = el(grade > 0 ? 'textarea' : 'p', grade > 0 ? 'sign-face sign-input' : 'sign-face sign-display');
  const onInput = () => dispatch({ type: 'field', typed: face.value });
  if (grade > 0) {
    face.maxLength = MAX; face.rows = 3; face.spellcheck = false;
    face.setAttribute('aria-label', 'Write your festival sign');
    face.placeholder = 'Type your own words';
    face.addEventListener('input', onInput);
  } else face.setAttribute('aria-live', 'polite');
  board.append(face);
  const post = el('div', 'sign-post');
  const groups = [], tileButtons = new Map();
  const makeTiles = (words, className, label, columns) => {
    const container = el('div', `sign-tiles ${className}`);
    container.setAttribute('role', 'group'); container.setAttribute('aria-label', label);
    const buttons = words.map((word, i) => {
      const tile = el('button', 'px-button sign-tile');
      tile.type = 'button'; tile.textContent = word; tile.dataset.word = word; tile.tabIndex = i === 0 ? 0 : -1;
      container.append(tile); tileButtons.set(word, tile);
      return tile;
    });
    const group = { container, buttons, columns, cursor: 0 };
    groups.push(group);
    return group;
  };
  const words = signTileGroups(grade);
  const phrases = makeTiles(words.phrases, 'sign-tiles--phrases', grade >= 3 ? 'Phrase tiles' : 'Word tiles', grade >= 3 ? 1 : 4);
  let describing;
  if (grade >= 3) {
    describing = makeTiles(words.describing, 'sign-tiles--describing', 'Describing words', 2);
    const work = el('div', 'sign-work');
    work.append(board, describing.container);
    root.append(work, phrases.container);
  } else root.append(board, post, phrases.container);
  host.append(root);

  const focusTile = (group, i) => {
    group.buttons[group.cursor].tabIndex = -1;
    group.cursor = i; group.buttons[i].tabIndex = 0; group.buttons[i].focus();
  };
  const groupOf = button => groups.find(group => group.buttons.includes(button));
  const onFocus = event => {
    const group = groupOf(event.target);
    if (group) {
      group.buttons[group.cursor].tabIndex = -1;
      group.cursor = group.buttons.indexOf(event.target); event.target.tabIndex = 0;
    }
  };
  const onClick = event => {
    const button = event.target.closest('button');
    const group = groupOf(button);
    if (!group) return;
    focusTile(group, group.buttons.indexOf(button));
    dispatch({ type: 'field', word: button.dataset.word });
  };
  const onKey = event => {
    const intent = keyIntent(event), group = groupOf(event.target);
    if (!group || !['left', 'right', 'up', 'down'].includes(intent)) return;
    const index = group.buttons.indexOf(event.target), next = gridMove(index, intent, group.columns, group.buttons.length);
    if (next !== index) focusTile(group, next);
    else if (group === describing && intent === 'right') focusTile(phrases, Math.floor(index / 2));
    else if (describing && group === phrases && intent === 'left') focusTile(describing, Math.min(index, 2) * 2 + 1);
    else if (grade > 0 && intent === 'up') face.focus();
    else return; // The bottom edge lets the encounter frame reach its command menu.
    event.preventDefault(); event.stopPropagation();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('keydown', onKey);
  return {
    update(state, ui) {
      const text = state.text || '';
      if (grade > 0) { if (face.value !== text) face.value = text; }
      else {
        face.textContent = text || 'Your words go here';
        face.classList.toggle('sign-placeholder', !text);
      }
      board.classList.toggle('sign-board--ready', signReady(state));
      const used = new Set(reconcileTiles(ui?.tiles ?? [], text));
      for (const [word, tile] of tileButtons) {
        tile.classList.toggle('sign-tile--used', used.has(word));
        if (used.has(word)) tile.setAttribute('aria-description', 'On the sign');
        else tile.removeAttribute('aria-description');
      }
    },
    destroy() {
      face.removeEventListener('input', onInput);
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

// The frame asks helpFor(grade) for the grade's steps; `help` is the grade-1 fallback and never changes.
export default {
  kind: KIND,
  title: 'A sign from you',
  help: signHelp(1),
  helpFor: signHelp,
  notReadyLine: SIGN_LINES.empty,
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    const state = normalizeEncounterSnapshot(KIND, snapshot ?? {}, grade, chapter);
    const tiles = state.tiles ?? (grade < 3 ? legacyTiles(state.text, grade) : []);
    return { state: { ...state, tiles }, ui: { tiles: [...tiles] } };
  },
  opening: signOpening,
  commands,
  act,
  mountField,
};
