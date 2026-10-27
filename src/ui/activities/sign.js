// Fumi's sign: word tiles, a wooden writing board, and hints the child can choose.
import { normalizeEncounterSnapshot } from '../../encounters.js';
import { signWords, signTileGroups, reconcileTiles, signOpening, signHelp, SIGN_RULE_LINES } from '../../sign-rules.js';
import { checkSign, applyFix } from '../../sign-check.js';
import { nextScenario, scenarioById, scenariosFor, tilesFor, newSeed } from '../../sign-scenarios.js';
import { gridMove, keyIntent } from '../input.js';
import { icon } from '../icons.js';
export { signWords, signHelp, reconcileTiles } from '../../sign-rules.js';

const KIND = 'writing';
const MAX = 120;
const PAGE = 56;
const WORD_ISSUES = new Set(['spelling', 'name', 'unknown']);

export const SIGN_LINES = Object.freeze({
  ready: SIGN_RULE_LINES.ready,
  readyNow: 'Ready! Choose Put up sign.',
  full: 'The sign is full. Remove a word first.',
  cleared: 'The sign is empty. Tap words to add them.',
  empty: 'The sign is empty.',
  typed: 'You wrote it. Add more, or choose Put up sign.',
  next: 'Clear the sign first, then choose Next sign.',
  keptFull: 'You kept 20 words. You can still write your sign.',
});

const endsSentence = word => /[.!?…]$/.test(word);
export function reactionLine(verb, word) {
  const room = PAGE - `${verb}: `.length - 1;
  const shown = word.length > room ? `${word.slice(0, room).trimEnd()}…` : word;
  return `${verb}: ${shown}${endsSentence(shown) ? '' : '.'}`;
}
export function shuffledTiles(words, seed) {
  const result = [...words];
  let value = Number(seed) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((value / 0x100000000) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const scenarioFor = state => scenarioById(state.scenario, state.grade);
const groupsFor = state => {
  const scenario = scenarioFor(state);
  return scenario ? tilesFor(scenario, state.grade) : signTileGroups(state.grade);
};
const wordsFor = state => Object.values(groupsFor(state)).flat();
const reportFor = state => {
  const scenario = scenarioFor(state);
  return checkSign(state.text, { grade: state.grade, vocabulary: scenario?.vocabulary ?? [], kept: state.kept ?? [],
    goal: scenario?.goal, describing: scenario ? tilesFor(scenario, state.grade).describing : [] });
};
const hintFor = state => {
  if (state.grade === 0) return reportFor(state).ready ? SIGN_LINES.readyNow : SIGN_RULE_LINES.word;
  const report = reportFor(state);
  return report.issues.find(issue => issue.blocking)?.line ?? (report.ready ? SIGN_LINES.readyNow : SIGN_LINES.empty);
};
const tileLine = (state, verb, word) => {
  const hint = hintFor(state), reaction = reactionLine(verb, word);
  return `${reaction} ${hint}`.length <= PAGE ? `${reaction} ${hint}` : hint;
};
const wordIssue = issue => issue && WORD_ISSUES.has(issue.kind) && typeof issue.word === 'string';
const withText = (state, text, tiles) => ({ ...state, text, tiles });
const joined = (text, word) => [text.trim(), word].filter(Boolean).join(' ');
const lastWord = text => text.trimEnd().match(/\S+$/)?.[0] ?? '';
const withTiles = (ui, tiles) => ({ ...ui, tiles, hints: {} });
const reply = (state, ui, line) => (line ? { state, ui, line } : { state, ui });

// Old saves have only text. Recover whole word tiles without cutting typed words.
function legacyTiles(text, words) {
  const tiles = [];
  let rest = text.trimEnd();
  while (tiles.length < 60) {
    const word = words.find(word => reconcileTiles([word], rest).length);
    if (!word) break;
    tiles.unshift(word);
    rest = rest.slice(0, -word.length).trimEnd();
  }
  return reconcileTiles(tiles, text);
}

function act(state, ui, action) {
  if (action?.type === 'field' && typeof action.scenario === 'string') {
    if (!scenarioById(action.scenario, state.grade)) return { state, ui };
    if (scenarioFor(state)) return action.scenario === state.scenario ? { state: { ...state }, ui } : { state, ui };
    const next = { ...state, scenario: action.scenario };
    return reply(next, { ...ui, seed: ui?.seed ?? newSeed(), seen: [action.scenario], hints: {} }, signOpening(next));
  }
  const tiles = reconcileTiles(ui?.tiles ?? state.tiles ?? [], state.text);
  if (action?.type === 'command' && action.id === 'next') {
    if (state.text) return reply(state, ui, SIGN_LINES.next);
    const seed = ui?.seed ?? newSeed();
    const seen = ui?.seen ?? [state.scenario];
    const allSeen = scenariosFor(state.grade).every(scenario => seen.includes(scenario.id));
    const scenario = nextScenario(state.grade, { seed, current: state.scenario, seen: allSeen ? [] : seen });
    if (!scenario) return { state, ui };
    const next = { ...state, scenario: scenario.id, tiles: [] };
    return reply(next, { ...ui, seed, seen: [...(allSeen ? [] : seen), scenario.id], tiles: [], hints: {} }, signOpening(next));
  }
  if (action?.type === 'command' && action.id === 'remove') {
    if (!state.text.trim()) return { state, ui };
    const tile = tiles.at(-1), word = tile ?? lastWord(state.text);
    const trimmed = state.text.trimEnd();
    const next = withText(state, trimmed.slice(0, -word.length).trimEnd(), tile ? tiles.slice(0, -1) : tiles);
    return reply(next, withTiles(ui, next.tiles), tileLine(next, 'Removed', word));
  }
  if (action?.type === 'command' && action.id === 'clear') {
    if (!state.text) return { state, ui };
    return reply(withText(state, '', []), withTiles(ui, []), SIGN_LINES.cleared);
  }
  if (action?.type !== 'field') return { state, ui };
  if (typeof action.word === 'string') {
    if (!wordsFor(state).includes(action.word)) return { state, ui };
    const text = joined(state.text, action.word);
    if (text.length > MAX) return reply(state, ui, SIGN_LINES.full);
    const next = withText(state, text, [...tiles, action.word]);
    return reply(next, withTiles(ui, next.tiles), tileLine(next, 'Added', action.word));
  }
  if (state.grade === 0) return { state, ui };
  const report = reportFor(state);
  if (Number.isInteger(action.hint)) {
    const issue = report.issues[action.hint];
    if (!wordIssue(issue)) return { state, ui };
    const step = ui?.hints?.[action.hint] ?? 0;
    const hints = issue.hints.length ? issue.hints : [issue.line];
    return reply(state, { ...ui, hints: { ...ui?.hints, [action.hint]: Math.min(step + 1, hints.length - 1) } }, hints[Math.min(step, hints.length - 1)]);
  }
  if (Number.isInteger(action.fix)) {
    const issue = report.issues[action.fix];
    if (!wordIssue(issue) || !issue.fix) return { state, ui };
    const text = applyFix(state.text, issue);
    if (text.length > MAX) return reply(state, ui, SIGN_LINES.full);
    const next = withText(state, text, reconcileTiles(tiles, text));
    return reply(next, withTiles(ui, next.tiles), tileLine(next, 'Fixed', issue.suggestion ?? issue.fix.text));
  }
  if (typeof action.keep === 'string') {
    const word = action.keep.toLowerCase();
    if (!report.issues.some(issue => issue.kind === 'unknown' && issue.word?.toLowerCase() === word)) return { state, ui };
    const kept = [...new Set(state.kept ?? [])];
    if (kept.length >= 20) return reply(state, ui, SIGN_LINES.keptFull);
    const next = { ...state, kept: [...kept, word] };
    return reply(next, { ...ui, hints: {} }, tileLine(next, 'Kept', action.keep));
  }
  if (typeof action.typed === 'string') {
    const text = action.typed.slice(0, MAX);
    const next = withText(state, text, reconcileTiles(tiles, text));
    if (next.text === state.text) return reply(state, ui, action.typed.length > MAX ? SIGN_LINES.full : undefined);
    const after = reportFor(next);
    // Refresh guidance when a word, readiness, or a blocking problem changes.
    const guidance = result => result.issues.filter(issue => issue.blocking).map(issue => [issue.kind, issue.word, issue.line]);
    const shouldSpeak = after.tokens.length !== report.tokens.length || after.ready !== report.ready
      || JSON.stringify(guidance(after)) !== JSON.stringify(guidance(report));
    const line = action.typed.length > MAX ? SIGN_LINES.full
      : shouldSpeak ? (after.ready ? SIGN_LINES.typed : hintFor(next)) : undefined;
    return reply(next, withTiles(ui, next.tiles), line);
  }
  return { state, ui };
}

function commands(state) {
  return [
    { id: 'remove', label: 'Remove word', icon: 'back', disabled: !state.text.trim() },
    { id: 'clear', label: 'Clear sign', icon: 'trash', disabled: !state.text },
    { id: 'next', label: 'Next sign', icon: 'next' },
    { id: 'finish', label: 'Put up sign', icon: 'check', finish: true, disabled: !reportFor(state).ready },
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
  post.setAttribute('aria-hidden', 'true');
  const checks = el('div', 'sign-checks');
  checks.setAttribute('role', 'group'); checks.setAttribute('aria-label', 'Word hints'); checks.hidden = true;
  const groups = [];
  const makeGroup = (className, label, columns) => {
    const container = el('div', `sign-tiles ${className}`);
    container.setAttribute('role', 'group'); container.setAttribute('aria-label', label);
    const group = { container, buttons: [], columns, cursor: 0 };
    groups.push(group);
    return group;
  };
  const phrases = makeGroup('sign-tiles--phrases', grade >= 3 ? 'Phrase tiles' : 'Word tiles', grade >= 3 ? 1 : 4);
  const describing = grade >= 3 ? makeGroup('sign-tiles--describing', 'Describing words', 2) : null;
  const checkGroup = { container: checks, buttons: [], columns: 1, cursor: 0 };
  groups.push(checkGroup);
  if (describing) {
    const work = el('div', 'sign-work');
    work.append(board, checks, describing.container);
    root.append(work, phrases.container);
  } else root.append(board, post, checks, phrases.container);
  host.append(root);

  const focusButton = (group, i) => {
    if (!group?.buttons.length) return;
    if (group.buttons[group.cursor]) group.buttons[group.cursor].tabIndex = -1;
    group.cursor = Math.max(0, Math.min(i, group.buttons.length - 1));
    const button = group.buttons[group.cursor];
    button.tabIndex = 0; button.focus();
    if (group === checkGroup) button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  const fillTiles = (group, words) => {
    const focused = group.container.contains(doc.activeElement);
    group.container.textContent = '';
    group.cursor = 0;
    group.buttons = words.map((word, i) => {
      const tile = el('button', 'px-button sign-tile');
      tile.type = 'button'; tile.textContent = word; tile.dataset.word = word; tile.tabIndex = i === 0 ? 0 : -1;
      group.container.append(tile);
      return tile;
    });
    if (focused) focusButton(group, 0);
  };
  // The frame mounts before it supplies state; the first update replaces these with scenario tiles.
  fillTiles(phrases, signTileGroups(grade).phrases);
  if (describing) fillTiles(describing, signTileGroups(grade).describing);
  let tileKey, checkKey;
  const updateChecks = report => {
    const issues = report.issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => wordIssue(issue));
    const key = JSON.stringify(issues);
    if (key === checkKey) return;
    checkKey = key;
    const focused = checks.contains(doc.activeElement), focusKey = doc.activeElement?.dataset.checkKey, cursor = checkGroup.cursor;
    checks.textContent = ''; checkGroup.buttons = [];
    const makeButton = (parent, label, data, value, aria, identity) => {
      const button = el('button', `px-button sign-check sign-check--${data}`);
      button.type = 'button'; button.dataset[data] = String(value); button.tabIndex = -1;
      button.dataset.checkKey = `${identity}:${data}`;
      button.setAttribute('aria-label', aria);
      if (data === 'hint') {
        const picture = el('span', 'sign-check__icon'); picture.innerHTML = icon('help', { size: 16 });
        const word = el('span', 'sign-check__word'); word.textContent = label;
        button.append(picture, word);
      } else button.textContent = label;
      parent.append(button); checkGroup.buttons.push(button);
    };
    const occurrences = new Map();
    for (const { issue, index } of issues) {
      const word = `${issue.kind}:${issue.word}`, occurrence = occurrences.get(word) ?? 0;
      occurrences.set(word, occurrence + 1);
      const identity = `${word}:${occurrence}`;
      const item = el('div', 'sign-check-item');
      item.setAttribute('role', 'group'); item.setAttribute('aria-label', `Check ${issue.word}`);
      makeButton(item, issue.word, 'hint', index, `Hint for ${issue.word}`, identity);
      if (issue.fix) makeButton(item, 'Fix it', 'fix', index, `Fix ${issue.word}`, identity);
      if (issue.kind === 'unknown') makeButton(item, 'Keep it', 'keep', issue.word, `Keep ${issue.word}`, identity);
      checks.append(item);
    }
    checks.hidden = !checkGroup.buttons.length;
    checkGroup.columns = Math.max(1, checkGroup.buttons.length);
    const retained = checkGroup.buttons.findIndex(button => button.dataset.checkKey === focusKey);
    checkGroup.cursor = retained >= 0 ? retained : Math.min(cursor, Math.max(0, checkGroup.buttons.length - 1));
    if (checkGroup.buttons.length) checkGroup.buttons[checkGroup.cursor].tabIndex = 0;
    if (focused) {
      if (retained >= 0) focusButton(checkGroup, retained);
      else face.focus();
    }
  };
  const groupOf = button => groups.find(group => group.buttons.includes(button));
  const onFocus = event => {
    const group = groupOf(event.target);
    if (group) {
      if (group.buttons[group.cursor]) group.buttons[group.cursor].tabIndex = -1;
      group.cursor = group.buttons.indexOf(event.target); event.target.tabIndex = 0;
    }
  };
  const onClick = event => {
    const button = event.target.closest('button'), group = groupOf(button);
    if (!group) return;
    focusButton(group, group.buttons.indexOf(button));
    if (group !== checkGroup) dispatch({ type: 'field', word: button.dataset.word });
    else if (button.dataset.hint !== undefined) dispatch({ type: 'field', hint: Number(button.dataset.hint) });
    else if (button.dataset.fix !== undefined) dispatch({ type: 'field', fix: Number(button.dataset.fix) });
    else dispatch({ type: 'field', keep: button.dataset.keep });
  };
  const onKey = event => {
    const intent = keyIntent(event), group = groupOf(event.target);
    if (!group || !['left', 'right', 'up', 'down'].includes(intent)) return;
    const index = group.buttons.indexOf(event.target), next = gridMove(index, intent, group.columns, group.buttons.length);
    if (next !== index) focusButton(group, next);
    else if (group === checkGroup && intent === 'down') focusButton(describing ?? phrases, 0);
    else if (group === describing && intent === 'right') focusButton(phrases, Math.floor(index / 2));
    else if (describing && group === phrases && intent === 'left') focusButton(describing, Math.min(index, 2) * 2 + 1);
    else if (grade > 0 && intent === 'up') face.focus();
    else return;
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
      const words = groupsFor(state), key = JSON.stringify([state.scenario, ui?.seed, words]);
      if (key !== tileKey) {
        tileKey = key;
        fillTiles(phrases, grade === 0 ? words.phrases : shuffledTiles(words.phrases, ui?.seed));
        if (describing) fillTiles(describing, words.describing);
      }
      const report = reportFor(state);
      board.classList.toggle('sign-board--ready', report.ready);
      if (grade > 0) updateChecks(report);
      post.hidden = !checks.hidden;
      const used = new Set(reconcileTiles(ui?.tiles ?? state.tiles ?? [], text));
      for (const group of [phrases, describing].filter(Boolean)) for (const tile of group.buttons) {
        tile.classList.toggle('sign-tile--used', used.has(tile.dataset.word));
        if (used.has(tile.dataset.word)) tile.setAttribute('aria-description', 'On the sign');
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

export default {
  kind: KIND,
  title: 'A sign from you',
  help: signHelp(1),
  helpFor: signHelp,
  notReadyLine: SIGN_LINES.empty,
  start(snapshot, { chapter = 0, grade = 1, seed = newSeed() } = {}) {
    const state = normalizeEncounterSnapshot(KIND, snapshot ?? {}, grade, chapter);
    const scenario = scenarioFor(state) ?? nextScenario(state.grade, { seed });
    const next = { ...state, scenario: scenario.id };
    const allowed = [...new Set([...wordsFor(next), ...signWords(state.grade)])];
    const tiles = state.tiles ?? (state.grade < 3 ? legacyTiles(next.text, allowed) : []);
    return { state: { ...next, tiles }, ui: { seed, seen: [scenario.id], tiles: [...tiles], hints: {} } };
  },
  opening: signOpening,
  another(state, ui) {
    const request = state.request === 2 ? 1 : 2;
    const seed = ((ui?.seed ?? 0) + 0x9e3779b9) >>> 0;
    const scenario = nextScenario(state.grade, { seed, current: state.scenario, seen: [state.scenario] });
    if (!scenario) return null;
    const fresh = this.start({ kind: KIND, request, scenario: scenario.id }, { grade: state.grade, chapter: state.chapter, seed });
    return { ...fresh, line: signOpening(fresh.state) };
  },
  commands,
  act,
  mountField,
};
