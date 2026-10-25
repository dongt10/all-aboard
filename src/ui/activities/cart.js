import { normalizeEncounterSnapshot, encounterReady, cartBalance, encounterOpeningDialogue, startingCargo } from '../../encounters.js';

// Taro's cart (math): Taro pre-loads the left bay; the child loads the right until both sides weigh
// the same, then rolls it. Crate sizes are picked on a small rail inside the field; a loaded crate is a
// button that takes itself off. One verb everywhere: roll.
const MAX = 8;
const SIDES = ['left', 'right'];
export const LINES = {
  load: 'Make the two loads equal, then roll it.',
  unload: 'One crate off. Make the two loads equal.',
  equal: 'Equal! Choose Roll it!',
  changed: 'The load changed. Roll it again.',
  full: 'That side is full. Take a crate off.',
  empty: 'The left side is empty. Load crates on both sides.',
  noCargo: 'Load some crates first, then roll it.',
  smooth: 'A smooth roll! Choose Send cart.',
  wobble: (side, by) => `Oop, a wobble! The ${side} is heavier by ${by}.`,
  size: weight => `Next crate weighs ${weight}.`,
};
const sum = list => list.reduce((a, b) => a + b, 0);

export function cartWeights(grade) {
  if (grade >= 3) return [1, 2, 3, 5];
  return grade >= 1 ? [1, 2] : [1];
}

// What to say after the cargo changed: the equal line once the sides match (and stops repeating),
// "roll it again" when a rolled cart changed, else the line for the move that was made.
function cargoLine(before, after, moveLine) {
  const now = cartBalance(after);
  if (now.balanced) return cartBalance(before).balanced ? null : LINES.equal;
  return before.rolled ? LINES.changed : moveLine;
}
// A new cargo list for one side. Any change re-arms the roll.
function changeCargo(state, ui, side, list, moveLine) {
  const next = { ...state, [side]: list, rolled: false };
  return { state: next, ui, line: cargoLine(state, next, moveLine) };
}
function load(state, ui, side) {
  if (!SIDES.includes(side)) return { state, ui };
  if (state[side].length >= MAX) return { state, ui, line: LINES.full };
  return changeCargo(state, ui, side, [...state[side], ui.weight], LINES.load);
}
function remove(state, ui, side, index) {
  if (!SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= state[side].length) return { state, ui };
  return changeCargo(state, ui, side, state[side].filter((_, i) => i !== index), LINES.unload);
}
// Every tap on the rail answers with the weight, even a repeat (at K the rail is a single crate).
function pickSize(state, ui, weight, grade) {
  if (!cartWeights(grade).includes(weight)) return { state, ui };
  return { state, ui: weight === ui.weight ? ui : { ...ui, weight }, line: LINES.size(weight) };
}
function roll(state, ui) {
  const { left, right, balanced } = cartBalance(state);
  if (!left && !right) return { state, ui, line: LINES.noCargo };
  const result = balanced ? 'smooth' : 'wobble';
  const next = { ...ui, lastRoll: result, rolls: (ui.rolls ?? 0) + 1 };
  const line = balanced ? LINES.smooth : LINES.wobble(left > right ? 'left' : 'right', Math.abs(left - right));
  return { state: { ...state, rolled: true }, ui: next, line };
}

const isSaved = snapshot => Boolean(snapshot) && typeof snapshot === 'object' && snapshot.kind === 'math' && snapshot.activity === undefined && snapshot.game === undefined;

const cart = {
  kind: 'math',
  title: 'Taro’s cart',
  help: ['Tap a crate size, then tap a side to load it.', 'Tap a loaded crate to take it off.', 'Make both sides weigh the same.', 'Choose Roll it!, then Send cart.'],
  notReadyLine: LINES.changed,
  // A new cart starts with Taro's crates on the left (per grade band). A saved draft is never re-seeded.
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    const input = isSaved(snapshot) ? snapshot : { kind: 'math', ...startingCargo(grade) };
    return { state: normalizeEncounterSnapshot('math', input, grade, chapter), ui: { weight: cartWeights(grade)[0], lastRoll: null, rolls: 0 } };
  },
  // A saved draft with an emptied left bay must not claim "the left side weighs 8".
  opening: state => (!encounterReady(state) && state.left.length === 0 ? LINES.empty : encounterOpeningDialogue(state)),
  commands(state) {
    return [
      { id: 'load-left', label: 'Load left', icon: 'crate' },
      { id: 'load-right', label: 'Load right', icon: 'crate' },
      { id: 'roll', label: 'Roll it!', icon: 'play' },
      { id: 'finish', label: 'Send cart', icon: 'check', finish: true, disabled: !encounterReady(state) },
    ];
  },
  act(state, ui, action, grade) {
    if (action?.type === 'field') {
      if (action.remove) return remove(state, ui, action.remove.side, action.remove.index);
      if (action.load) return load(state, ui, action.load);
      if (action.weight !== undefined) return pickSize(state, ui, action.weight, grade);
      return { state, ui };
    }
    if (action?.type !== 'command') return { state, ui };
    switch (action.id) {
      case 'load-left': return load(state, ui, 'left');
      case 'load-right': return load(state, ui, 'right');
      case 'roll': return roll(state, ui);
      default: return { state, ui };
    }
  },
  mountField(host, { grade = 1, dispatch }) {
    const sizes = cartWeights(grade);
    const root = document.createElement('div');
    root.className = 'cart';
    const bays = SIDES.map(side => `<div class="cart__bay" data-side="${side}">
        <button type="button" class="cart__load" data-side="${side}"><span class="cart__hint">Tap to load</span></button>
        <div class="cart__crates">${Array.from({ length: MAX }, (_, i) => `<button type="button" class="cart__crate" data-side="${side}" data-index="${i}" hidden></button>`).join('')}</div>
      </div>`).join('');
    const rail = `<div class="cart__sizes" role="radiogroup" aria-label="Crate size">${sizes.map(w =>
      `<button type="button" role="radio" class="cart__size cart__crate--w${w}" data-weight="${w}" aria-checked="false" aria-label="Crates weigh ${w}">${w}</button>`).join('')}</div>`;
    root.innerHTML = `<div class="cart__badges">${SIDES.map(side => `<span class="px-chip cart__total" data-side="${side}"><span class="cart__total-label">${side === 'left' ? 'Left' : 'Right'}</span><span class="cart__total-num">0</span></span>`).join('')}</div>
      ${rail}
      <div class="cart__ground" aria-hidden="true"></div>
      <div class="cart__move"><div class="cart__body">${bays}<div class="cart__chassis" aria-hidden="true"></div><i class="cart__wheel cart__wheel--left" aria-hidden="true"></i><i class="cart__wheel cart__wheel--right" aria-hidden="true"></i></div></div>`;
    host.append(root);
    const move = root.querySelector('.cart__move');
    const body = root.querySelector('.cart__body');
    const sizeButtons = [...root.querySelectorAll('.cart__size')];
    const parts = Object.fromEntries(SIDES.map(side => [side, {
      load: root.querySelector(`.cart__load[data-side="${side}"]`),
      hint: root.querySelector(`.cart__load[data-side="${side}"] .cart__hint`),
      crates: [...root.querySelectorAll(`.cart__crate[data-side="${side}"]`)],
      total: root.querySelector(`.cart__total[data-side="${side}"] .cart__total-num`),
    }]));
    root.addEventListener('click', event => {
      const size = event.target.closest('.cart__size');
      if (size) return dispatch({ type: 'field', weight: Number(size.dataset.weight) });
      const crate = event.target.closest('.cart__crate');
      if (crate) return dispatch({ type: 'field', remove: { side: crate.dataset.side, index: Number(crate.dataset.index) } });
      const bay = event.target.closest('.cart__load');
      if (bay) dispatch({ type: 'field', load: bay.dataset.side });
    });
    // Left/right arrows walk the size rail like a radio group; the pick happens at once.
    root.addEventListener('keydown', event => {
      const size = event.target.closest?.('.cart__size');
      if (!size || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const at = sizeButtons.indexOf(size), step = event.key === 'ArrowRight' ? 1 : -1;
      const next = sizeButtons[(at + step + sizeButtons.length) % sizeButtons.length];
      next.focus();
      dispatch({ type: 'field', weight: Number(next.dataset.weight) });
    });
    const replay = name => {
      move.classList.remove('cart--roll', 'cart--wobble');
      void move.offsetWidth;   // restart the animation
      move.classList.add(name);
    };
    move.addEventListener('animationend', () => move.classList.remove('cart--roll', 'cart--wobble'));
    let rolls = null;

    return {
      update(state, ui) {
        for (const button of sizeButtons) {
          const picked = Number(button.dataset.weight) === ui.weight;
          button.setAttribute('aria-checked', String(picked));
          button.tabIndex = picked || sizeButtons.length === 1 ? 0 : -1;
        }
        for (const side of SIDES) {
          const { load: bay, hint, crates, total } = parts[side], list = state[side];
          const full = list.length >= MAX;
          bay.setAttribute('aria-label', full ? `${side} side is full` : `Load a ${ui.weight} crate on the ${side}`);
          hint.hidden = list.length > 0;
          total.textContent = String(sum(list));
          crates.forEach((button, i) => {
            const weight = list[i];
            if (weight === undefined) {
              if (document.activeElement === button) bay.focus();
              button.hidden = true;
              return;
            }
            button.hidden = false;
            button.className = `cart__crate cart__crate--w${weight}`;
            button.textContent = String(weight);
            button.setAttribute('aria-label', `Take off the ${weight} crate on the ${side}`);
          });
        }
        const { left, right } = cartBalance(state);
        body.style.transform = `rotate(${Math.max(-9, Math.min(9, (right - left) * 2))}deg)`;
        if (rolls !== null && ui.rolls !== rolls && ui.lastRoll) replay(ui.lastRoll === 'smooth' ? 'cart--roll' : 'cart--wobble');
        rolls = ui.rolls;
      },
      destroy() { root.remove(); },
    };
  },
};

export default cart;
