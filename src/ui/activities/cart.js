import { normalizeEncounterSnapshot, encounterReady, cartBalance, encounterOpeningDialogue } from '../../encounters.js';

// Taro's cart (math): load crates into two bays until both sides weigh the same, then roll it.
const MAX = 8;
const SIDES = ['left', 'right'];
const LINES = {
  load: 'Make the two loads equal, then try the cart.',
  unload: 'One crate off. Make the two loads equal.',
  changed: 'The load changed. Try the cart again.',
  full: 'That side is full. Try the other side.',
  empty: 'The cart is empty. Load a crate first.',
  noCargo: 'Let’s load some supplies first, then try the wheels.',
  smooth: 'A smooth roll! Your cart is ready.',
  wobble: side => `Oop, a wobble! The ${side} load is heavier. Let’s adjust it.`,
};
const sum = list => list.reduce((a, b) => a + b, 0);

export function cartWeights(grade) {
  if (grade >= 3) return [1, 2, 3, 5];
  return grade >= 1 ? [1, 2] : [1];
}

// A new cargo list for one side. Any change re-arms the roll.
function changeCargo(state, ui, side, list, line) {
  return { state: { ...state, [side]: list, rolled: false }, ui, line: state.rolled ? LINES.changed : line };
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
function unload(state, ui) {
  const { left, right } = cartBalance(state);
  if (!left && !right) return { state, ui, line: LINES.empty };
  const side = left > right ? 'left' : 'right';
  return remove(state, ui, side, state[side].length - 1);
}
function roll(state, ui) {
  const { left, right, balanced } = cartBalance(state);
  if (!left && !right) return { state, ui, line: LINES.noCargo };
  const result = balanced ? 'smooth' : 'wobble';
  const next = { ...ui, lastRoll: result, rolls: (ui.rolls ?? 0) + 1 };
  return { state: { ...state, rolled: true }, ui: next, line: balanced ? LINES.smooth : LINES.wobble(left > right ? 'left' : 'right') };
}

const cart = {
  kind: 'math',
  title: 'Taro’s cart',
  help: ['Tap a side of the cart to load a crate.', 'Tap a crate to take it off.', 'Make both sides the same.', 'Choose Roll it! to test the cart.'],
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    return { state: normalizeEncounterSnapshot('math', snapshot, grade, chapter), ui: { weight: grade >= 3 ? 2 : 1, lastRoll: null, rolls: 0 } };
  },
  opening: state => encounterOpeningDialogue(state),
  commands(state, ui, grade) {
    const empty = !state.left.length && !state.right.length;
    const third = grade >= 1
      ? { id: 'weight', label: `Crate: ${ui.weight}`, icon: 'crate' }
      : { id: 'unload', label: 'Unload', icon: 'undo', disabled: empty };
    const last = encounterReady(state)
      ? { id: 'finish', label: 'Send cart', icon: 'check', finish: true }
      : { id: 'roll', label: 'Roll it!', icon: 'play' };
    return [{ id: 'load-left', label: 'Load left', icon: 'crate' }, { id: 'load-right', label: 'Load right', icon: 'crate' }, third, last];
  },
  act(state, ui, action, grade) {
    if (action?.type === 'field') {
      if (action.remove) return remove(state, ui, action.remove.side, action.remove.index);
      if (action.load) return load(state, ui, action.load);
      return { state, ui };
    }
    if (action?.type !== 'command') return { state, ui };
    switch (action.id) {
      case 'load-left': return load(state, ui, 'left');
      case 'load-right': return load(state, ui, 'right');
      case 'unload': return unload(state, ui);
      case 'roll': return roll(state, ui);
      case 'weight': {
        const sizes = cartWeights(grade), weight = sizes[(sizes.indexOf(ui.weight) + 1) % sizes.length];
        return { state, ui: { ...ui, weight }, line: `New crates weigh ${weight}.` };
      }
      default: return { state, ui };
    }
  },
  mountField(host, { dispatch }) {
    const root = document.createElement('div');
    root.className = 'cart';
    const bays = SIDES.map(side => `<div class="cart__bay" data-side="${side}">
        <button type="button" class="cart__load" data-side="${side}"><span class="cart__hint">Tap to load</span></button>
        <div class="cart__crates">${Array.from({ length: MAX }, (_, i) => `<button type="button" class="cart__crate" data-side="${side}" data-index="${i}" hidden></button>`).join('')}</div>
      </div>`).join('');
    root.innerHTML = `<div class="cart__badges">${SIDES.map(side => `<span class="px-chip cart__total" data-side="${side}"><span class="cart__total-label">${side === 'left' ? 'Left' : 'Right'}</span><span class="cart__total-num">0</span></span>`).join('')}</div>
      <div class="cart__ground" aria-hidden="true"></div>
      <div class="cart__move"><div class="cart__body">${bays}<div class="cart__chassis" aria-hidden="true"></div><i class="cart__wheel cart__wheel--left" aria-hidden="true"></i><i class="cart__wheel cart__wheel--right" aria-hidden="true"></i></div></div>`;
    host.append(root);
    const move = root.querySelector('.cart__move');
    const body = root.querySelector('.cart__body');
    const parts = Object.fromEntries(SIDES.map(side => [side, {
      load: root.querySelector(`.cart__load[data-side="${side}"]`),
      hint: root.querySelector(`.cart__load[data-side="${side}"] .cart__hint`),
      crates: [...root.querySelectorAll(`.cart__crate[data-side="${side}"]`)],
      total: root.querySelector(`.cart__total[data-side="${side}"] .cart__total-num`),
    }]));
    root.addEventListener('click', event => {
      const crate = event.target.closest('.cart__crate');
      if (crate) return dispatch({ type: 'field', remove: { side: crate.dataset.side, index: Number(crate.dataset.index) } });
      const bay = event.target.closest('.cart__load');
      if (bay) dispatch({ type: 'field', load: bay.dataset.side });
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
