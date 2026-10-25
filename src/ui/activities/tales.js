// Whose tale is this? (reading, grades 3–5): Sora collected village tales for storytime, but the names fell off.
// The child reads a three-line tale, chooses which neighbor it is about, then taps the one line that proves it.
// start, opening, commands and act are pure; only mountField touches the DOM. The snapshot is the module's own
// (src/tales.js normalizeTales), so this runs and is tested without the shared encounter rules.
// Phases live in ui only (nothing about a pick is saved): 'read' (choose who) → 'prove' (choose the line) →
// 'done' (the name falls back onto the card, Next tale), or 'review' to reread a solved tale.
// A tale joins state.solved only when its proof is found.
// Every sentence a child can hear here is 56 characters or fewer (tests/activity-tales.test.js checks them all).
import {
  KIND, LINES, TALE_DECKS, TALE_CAST, normalizeTales, talesReady, talesOpening, currentTale, solvedCount,
  talePick, taleProof, solveTale, nextDeck, lineBadgeSVG,
} from '../../tales.js';
import { figureMarkup } from '../figures/index.js';
import { gridMove, keyIntent } from '../input.js';

const TALE_LINES = 3;
export { LINES };
export const HELP = [
  'Read the three lines of the tale.',
  'Choose who the tale is about.',
  'Tap the line that proves it.',
  'Name three tales, then choose Share tales.',
];
const FRESH_UI = Object.freeze({ phase: 'read', pick: null, review: null });

const deckOf = state => TALE_DECKS[state.deck] ?? TALE_DECKS[0];
const nameOf = who => TALE_CAST[who]?.name ?? '';
const lineIndex = value => (Number.isInteger(value) && value >= 0 && value < TALE_LINES ? value : null);
const solvedTale = (state, id) => deckOf(state).find(t => t.id === id && state.solved.includes(id));

// The phase the screen is really in, so a stale or hand-made ui can never strand the menu.
// A valid review wins even when ready; 'prove' needs the right pick; 'done' needs a solved tale.
export function phaseOf(state, ui) {
  if (ui?.phase === 'review' && solvedTale(state, ui.review)) return 'review';
  if (talesReady(state)) return 'ready';
  const tale = currentTale(state);
  if (ui?.phase === 'prove' && tale && ui.pick === tale.who) return 'prove';
  if (ui?.phase === 'done' && deckOf(state).some(t => t.id === ui.review) && state.solved.includes(ui.review)) return 'done';
  return 'read';
}

// The tale on the card: the named or reviewed one, otherwise the first unnamed one (none when ready).
function shownTale(state, ui) {
  const phase = phaseOf(state, ui);
  if (phase === 'ready') return null;
  if (phase === 'done' || phase === 'review') return solvedTale(state, ui.review);
  return currentTale(state);
}

function start(snapshot, { chapter = 1, grade = 3 } = {}) {
  return { state: normalizeTales(snapshot, grade, chapter), ui: { ...FRESH_UI } };
}

function opening(state, ui) {
  return phaseOf(state, ui) === 'review' ? LINES.review(nameOf(shownTale(state, ui).who)) : talesOpening(state);
}

function commands(state, ui) {
  const phase = phaseOf(state, ui);
  const ready = talesReady(state);
  const finish = { id: 'finish', label: 'Share tales', icon: 'check', finish: true, disabled: !ready };
  if (phase === 'review') return [
    { id: 'next', label: ready ? 'All tales' : 'Next tale', icon: 'next' },
    ...(ready ? [{ id: 'again', label: 'Start over', icon: 'undo' }] : []), finish,
  ];
  if (phase === 'ready') return [{ id: 'again', label: 'Start over', icon: 'undo' }, finish];
  if (phase === 'done') return [{ id: 'next', label: 'Next tale', icon: 'next' }, finish];
  if (phase === 'prove') return [0, 1, 2].map(i => ({ id: `line-${i}`, label: `Line ${i + 1}`, art: lineBadgeSVG(i + 1) })).concat(finish);
  return currentTale(state).choices.map(who => ({ id: `pick-${who}`, label: nameOf(who), icon: 'people' })).concat(finish);
}

function reviewTale(state, ui, id) {
  const tale = solvedTale(state, id);
  if (!tale) return { state, ui };
  return {
    state, ui: ui?.phase === 'review' && ui.review === id ? ui : { phase: 'review', pick: null, review: id },
    line: LINES.review(nameOf(tale.who)),
  };
}

// A tap on a line (the card or the Line 1/2/3 commands): proves while 'prove', reads it aloud otherwise.
function chooseLine(state, ui, i) {
  if (i === null) return { state, ui };
  const phase = phaseOf(state, ui);
  if (phase === 'ready') {
    const tale = deckOf(state)[i];
    return reviewTale(state, ui, tale.id);
  }
  const tale = shownTale(state, ui);
  if (phase !== 'prove') return { state, ui, line: LINES.readLine(i + 1, tale.lines[i]) };
  const isLast = solvedCount(state) === deckOf(state).length - 1;
  const result = taleProof(tale, i, isLast);
  if (!result.right) return { state, ui, line: result.line };
  const next = solveTale(state, tale.id);
  return { state: next, ui: talesReady(next) ? { ...FRESH_UI } : { phase: 'done', pick: null, review: tale.id }, line: result.line };
}

function act(state, ui, action) {
  if (action?.type === 'field') return Object.hasOwn(action, 'review')
    ? reviewTale(state, ui, action.review) : chooseLine(state, ui, lineIndex(action.line));
  if (action?.type !== 'command' || typeof action.id !== 'string') return { state, ui };
  const { id } = action;
  const phase = phaseOf(state, ui);
  if (/^line-[0-2]$/.test(id) && phase === 'prove') return chooseLine(state, ui, Number(id.slice(5)));
  if (id === 'next') {
    if (phase !== 'done' && phase !== 'review') return { state, ui };
    return { state, ui: { ...FRESH_UI }, line: talesReady(state) ? LINES.allNamed : LINES.nextTale(deckOf(state).indexOf(currentTale(state)) + 1) };
  }
  if (id === 'again') {
    if (!talesReady(state)) return { state, ui };
    return { state: nextDeck(state), ui: { ...FRESH_UI }, line: LINES.startOver };
  }
  if (id.startsWith('pick-')) {
    if (phase !== 'read') return { state, ui };   // a pick while proving or after naming changes nothing
    const result = talePick(currentTale(state), id.slice(5));
    if (!result) return { state, ui };
    return { state, ui: result.right ? { phase: 'prove', pick: id.slice(5), review: null } : ui, line: result.line };
  }
  return { state, ui };
}

// What the field shows, as plain data (tests read this; mountField paints it).
export function fieldView(state, ui) {
  const phase = phaseOf(state, ui);
  const deck = deckOf(state);
  const count = solvedCount(state);
  const book = { title: `Tales ${count}/3`, slots: deck.map(t => (state.solved.includes(t.id) ? { id: t.id, who: t.who, name: nameOf(t.who) } : null)) };
  if (phase === 'ready') {
    return {
      phase, head: LINES.allNamed, named: null, book, label: 'Three tales, three names',
      lines: deck.map((t, i) => ({ text: `${nameOf(t.who)}’s tale`, who: t.who, proof: false, hidden: false, label: `Tale ${i + 1}: ${nameOf(t.who)}. Tap to read it again.` })),
    };
  }
  const tale = shownTale(state, ui);
  const n = deck.indexOf(tale) + 1;
  const done = phase === 'done' || phase === 'review';
  return {
    phase, book,
    head: done ? `Tale ${n} of 3 · ✓ Named` : `Tale ${n} of 3`,
    named: done ? { who: tale.who, name: `${nameOf(tale.who)}’s tale` } : null,
    label: done ? `Tale ${n} of 3, named: ${nameOf(tale.who)}` : `Tale ${n} of 3`,
    // Keep every line available for rereading after naming the tale.
    lines: tale.lines.map((text, i) => ({
      text, who: null, proof: done && i === tale.proof, hidden: false,
      label: `Line ${i + 1}: ${text}${done && i === tale.proof ? ' This is the proof.' : ''}`,
    })),
  };
}

function mountField(host, { dispatch = () => {} } = {}) {
  let cursor = 0, slotCursor = 0;
  const root = document.createElement('div');
  root.className = 'tales-field';
  root.innerHTML = '<span class="tales-card-cover" aria-hidden="true"></span><section class="tales-card"><p class="tales-head"></p>'
    + '<div class="tales-named"><span class="tales-named__pic"></span><span class="tales-named__name"></span></div>'
    + '<div class="tales-lines" role="group" aria-label="Tale lines">'
    + [1, 2, 3].map(n => `<button type="button" class="tales-line"><span class="tales-line__tag" aria-hidden="true">${n}</span><span class="tales-line__who" aria-hidden="true"></span><span class="tales-line__text"></span></button>`).join('')
    + '</div></section>'
    + '<div class="tales-book" role="group"><p class="tales-book__title"></p>'
    + [0, 1, 2].map(() => '<button type="button" class="tales-slot" disabled><span class="tales-slot__pic" aria-hidden="true"></span><span class="tales-slot__name"></span></button>').join('')
    + '</div>';
  host.append(root);
  const card = root.querySelector('.tales-card'), head = root.querySelector('.tales-head');
  const named = root.querySelector('.tales-named'), namedPic = root.querySelector('.tales-named__pic'), namedName = root.querySelector('.tales-named__name');
  const book = root.querySelector('.tales-book'), bookTitle = root.querySelector('.tales-book__title');
  const lines = [...root.querySelectorAll('.tales-line')].map(el => ({ el, who: el.querySelector('.tales-line__who'), text: el.querySelector('.tales-line__text'), whoId: null }));
  const slots = [...root.querySelectorAll('.tales-slot')].map(el => ({ el, pic: el.querySelector('.tales-slot__pic'), name: el.querySelector('.tales-slot__name'), who: undefined }));
  let namedWho = null;
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const visible = () => lines.map((l, i) => (l.el.hidden ? -1 : i)).filter(i => i >= 0);
  const setCursor = i => { cursor = i; lines.forEach((l, j) => { l.el.tabIndex = j === cursor ? 0 : -1; }); };
  const focusLine = i => { setCursor(i); lines[i].el.focus?.(); };
  const filled = () => slots.map((s, i) => s.el.disabled ? -1 : i).filter(i => i >= 0);
  const setSlotCursor = i => { slotCursor = i; slots.forEach((s, j) => { s.el.tabIndex = !s.el.disabled && j === i ? 0 : -1; }); };
  const focusSlot = i => { setSlotCursor(i); slots[i].el.focus?.(); };

  const onClick = event => {
    const slot = slots.findIndex(s => s.el === event.target.closest?.('.tales-slot'));
    if (slot >= 0) {
      if (slots[slot].el.disabled) return;
      setSlotCursor(slot);
      dispatch({ type: 'field', review: slots[slot].taleId });
      return;
    }
    const at = lines.findIndex(l => l.el === event.target.closest?.('.tales-line'));
    if (at < 0) return;
    if (at !== cursor) setCursor(at);
    dispatch({ type: 'field', line: at });
  };
  // Roving focus down the three lines, like square.js over its cells. An ArrowDown on the last line is left alone,
  // so the scene hands focus to the menu; Enter and Space click the focused line natively.
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    const slot = slots.findIndex(s => s.el === event.target.closest?.('.tales-slot'));
    if (slot >= 0) {
      if (slots[slot].el.disabled) return;
      const shown = filled(), pos = shown.indexOf(slot), next = gridMove(pos, intent, 1, shown.length);
      if (next === pos && intent === 'down') return;
      event.preventDefault();
      if (intent === 'left') focusLine(slot);
      else if (next !== pos) focusSlot(shown[next]);
      return;
    }
    const at = lines.findIndex(l => l.el === event.target.closest?.('.tales-line'));
    if (at < 0) return;
    const shown = visible(), pos = shown.indexOf(at);
    const next = gridMove(pos, intent, 1, shown.length);
    if (next === pos && intent === 'down') return;
    event.preventDefault();
    if (intent === 'right' && filled().length) focusSlot(filled().includes(at) ? at : filled()[0]);
    else if (next !== pos) focusLine(shown[next]);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  function update(state, ui) {
    const view = fieldView(state, ui);
    const active = globalThis.document?.activeElement;
    const hadFocus = lines.some(l => l.el === active);
    const heldSlot = slots.find(s => s.el === active);
    card.classList.toggle('tales-card--prove', view.phase === 'prove');
    card.classList.toggle('tales-card--done', view.phase === 'done' || view.phase === 'review');
    card.classList.toggle('tales-card--ready', view.phase === 'ready');
    card.setAttribute('aria-label', view.label);
    setText(head, view.head);
    named.hidden = !view.named;
    if ((view.named?.who ?? null) !== namedWho) {
      namedWho = view.named?.who ?? null;
      namedPic.innerHTML = namedWho ? figureMarkup(namedWho, { pose: 'joy', scale: 0.5 }) : '';
    }
    setText(namedName, view.named?.name ?? '');
    view.lines.forEach((v, i) => {
      const l = lines[i];
      l.el.hidden = v.hidden;
      l.el.classList.toggle('tales-line--proof', v.proof);
      l.el.classList.toggle('tales-line--named', Boolean(v.who));
      l.el.setAttribute('aria-label', v.label);
      setText(l.text, v.text);
      if (l.whoId !== v.who) { l.whoId = v.who; l.who.innerHTML = v.who ? figureMarkup(v.who, { scale: 0.5 }) : ''; }
    });
    // The roving stop never rests on a hidden line; focus that was on the card stays on the card.
    const shown = visible();
    setCursor(shown.includes(cursor) ? cursor : shown[0] ?? 0);
    if (hadFocus && globalThis.document?.activeElement !== lines[cursor].el) lines[cursor].el.focus?.();
    setText(bookTitle, view.book.title);
    book.setAttribute('aria-label', `Sora’s tale book, ${view.book.slots.filter(Boolean).length} of 3 named`);
    view.book.slots.forEach((v, i) => {
      const slot = slots[i], who = v?.who ?? null;
      slot.taleId = v?.id ?? null;
      slot.el.disabled = !v;
      slot.el.setAttribute('aria-label', v ? `${v.name}’s tale. Read it again.` : `Tale ${i + 1}. Not named yet.`);
      slot.el.setAttribute('aria-pressed', String(view.phase === 'review' && ui.review === slot.taleId));
      if (slot.who === who) return;
      slot.who = who;
      slot.el.classList.toggle('tales-slot--filled', Boolean(who));
      slot.pic.innerHTML = who ? figureMarkup(who, { scale: 0.75 }) : '';
      setText(slot.name, who ? v.name : 'Empty');
    });
    const available = filled();
    setSlotCursor(available.includes(slotCursor) ? slotCursor : available[0] ?? 0);
    if (heldSlot?.el.disabled) focusLine(cursor);
  }

  return {
    update,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

export default {
  kind: KIND,
  title: 'Whose tale is this?', rewardLabel: 'Tale book',
  help: HELP,
  notReadyLine: LINES.notReady,
  start, opening, commands, act, mountField,
};
