import { normalizeEncounterSnapshot, encounterReady, cartBalance, encounterOpeningDialogue, startingCargo } from '../../encounters.js';
import { INK, INK_SOFT, PAPER, PAPER_SHADE, WOOD } from '../palette.js';
import { gridMove, keyIntent } from '../input.js';

// Opaque, one-pixel ink silhouettes. Wood and iron each have a top-left light and a bottom shade.
const WOOD_LIGHT = '#e7b57d', WOOD_SHADE = '#8d513c';
const IRON_LIGHT = '#7b80a5', IRON_SHADE = '#34375f';
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const art = (name, width, height, drawing) => `<svg class="cart__art cart__art--${name}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${drawing}</svg>`;
const nail = (x, y) => rect(x, y, 2, 2, INK) + rect(x, y, 1, 1, PAPER_SHADE);
const bayArt = art('bay', 216, 120,
  rect(0, 0, 216, 120, INK) + rect(1, 1, 214, 118, WOOD_SHADE)
  + [8, 40, 72].map((y, i) => rect(10, y, 196, 31, WOOD)
    + rect(10, y, 196, 3, WOOD_LIGHT) + rect(10, y + 28, 196, 3, WOOD_SHADE)
    + rect(26 + i * 24, y + 10, 34, 1, WOOD_SHADE) + rect(34 + i * 24, y + 12, 18, 1, WOOD_LIGHT)
    + rect(136 - i * 12, y + 20, 40, 1, WOOD_SHADE) + rect(150 - i * 12, y + 22, 16, 1, WOOD_LIGHT)).join('')
  + [1, 205].map(x => rect(x, 1, 10, 118, WOOD) + rect(x, 1, 3, 118, WOOD_LIGHT)
    + rect(x + 8, 1, 2, 118, WOOD_SHADE) + nail(x + 4, 12) + nail(x + 4, 92)).join('')
  + rect(1, 1, 214, 6, WOOD) + rect(1, 1, 214, 2, WOOD_LIGHT)
  + rect(1, 105, 214, 1, INK) + rect(1, 106, 214, 13, WOOD)
  + rect(1, 106, 214, 3, WOOD_LIGHT) + rect(1, 115, 214, 4, WOOD_SHADE)
  + rect(36, 111, 44, 1, WOOD_SHADE) + rect(138, 112, 26, 1, WOOD_SHADE)
  + nail(5, 110) + nail(209, 110));
const chassisArt = art('chassis', 416, 16,
  rect(0, 0, 416, 16, INK) + rect(1, 1, 414, 14, WOOD) + rect(1, 1, 414, 3, WOOD_LIGHT)
  + rect(1, 11, 414, 4, WOOD_SHADE) + rect(24, 7, 64, 1, WOOD_SHADE) + rect(288, 6, 76, 1, WOOD_SHADE)
  + [8, 198, 208, 406].map(x => nail(x, 6)).join(''));
const wheelArt = art('wheel', 40, 40,
  `<path d="M12 0H28V4H36V12H40V28H36V36H28V40H12V36H4V28H0V12H4V4H12Z" fill="${INK}"/>`
  + `<path d="M13 1H27V5H35V13H39V27H35V35H27V39H13V35H5V27H1V13H5V5H13Z" fill="${INK_SOFT}"/>`
  + `<path d="M13 1H27V4H13V8H8V13H4V25H1V13H5V5H13Z" fill="${IRON_LIGHT}"/>`
  + `<path d="M36 15H39V27H35V35H27V39H13V36H27V32H32V27H36Z" fill="${IRON_SHADE}"/>`
  + rect(6, 17, 28, 6, WOOD) + rect(17, 6, 6, 28, WOOD)
  + rect(6, 17, 28, 2, WOOD_LIGHT) + rect(17, 6, 2, 28, WOOD_LIGHT)
  + rect(6, 21, 28, 2, WOOD_SHADE) + rect(21, 6, 2, 28, WOOD_SHADE)
  + rect(14, 14, 12, 12, INK) + rect(15, 15, 10, 10, PAPER_SHADE)
  + rect(15, 15, 10, 2, PAPER) + rect(15, 23, 10, 2, WOOD_SHADE) + rect(18, 18, 4, 4, INK));

// Taro's cart (math): Taro pre-loads the left bay; the child loads the right until both sides weigh
// the same, then rolls it. Crate sizes are picked on a small rail inside the field; a loaded crate is a
// button that takes itself off unless it belongs to Taro's starting load. One verb everywhere: roll.
const MAX = 8;
const SIDES = ['left', 'right'];
export const LINES = {
  load: 'Make the two loads equal, then roll it.',
  unload: 'One crate off. Make the two loads equal.',
  fixed: 'Those are Taro’s crates. Load the right side to match.',
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

// Protect the starting load only while it is still the complete left prefix. Older drafts stay intact.
export function fixedCount(state, grade = state?.grade) {
  const fixed = startingCargo(grade).left;
  return Array.isArray(state?.left) && fixed.every((weight, i) => state.left[i] === weight) ? fixed.length : 0;
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
function remove(state, ui, side, index, grade) {
  if (!SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= state[side].length) return { state, ui };
  if (side === 'left' && index < fixedCount(state, grade)) return { state, ui, line: LINES.fixed };
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
  // A roll that changes nothing in the saved cart returns the same state object (the no-op identity rule).
  return { state: state.rolled ? state : { ...state, rolled: true }, ui: next, line };
}

const isSaved = snapshot => Boolean(snapshot) && typeof snapshot === 'object' && snapshot.kind === 'math' && snapshot.activity === undefined && snapshot.game === undefined;

const cart = {
  kind: 'math',
  title: 'Taro’s cart',
  help: ['Tap a crate size, then tap a side to load it.', 'Tap a crate you loaded to take it off.', 'Make both sides weigh the same.', 'Choose Roll it!, then Send cart.'],
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
  act(state, ui, action, grade = state.grade) {
    if (action?.type === 'field') {
      if (action.remove) return remove(state, ui, action.remove.side, action.remove.index, grade);
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
    const bays = SIDES.map(side => `<div class="cart__bay" data-side="${side}">${bayArt}
        <button type="button" class="cart__load" data-side="${side}"><span class="cart__hint">Tap to load</span></button>
        <div class="cart__crates">${Array.from({ length: MAX }, (_, i) => `<button type="button" class="cart__crate" data-side="${side}" data-index="${i}" hidden></button>`).join('')}</div>
      </div>`).join('');
    const rail = `<div class="cart__sizes" role="radiogroup" aria-label="Crate size">${sizes.map(w =>
      `<button type="button" role="radio" class="cart__size cart__crate--w${w}" data-weight="${w}" aria-checked="false" aria-label="Crates weigh ${w}">${w}</button>`).join('')}</div>`;
    root.innerHTML = `<div class="cart__badges">${SIDES.map(side => `<span class="px-chip cart__total" data-side="${side}"><span class="cart__total-label">${side === 'left' ? 'Left' : 'Right'}</span><span class="cart__total-num">0</span></span>`).join('')}</div>
      ${rail}
      <div class="cart__ground" aria-hidden="true"></div>
      <div class="cart__move"><div class="cart__body">${bays}<div class="cart__axle" aria-hidden="true"></div><div class="cart__chassis" aria-hidden="true">${chassisArt}</div><i class="cart__wheel cart__wheel--left" aria-hidden="true">${wheelArt}</i><i class="cart__wheel cart__wheel--right" aria-hidden="true">${wheelArt}</i></div></div>`;
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
    const onClick = event => {
      const size = event.target.closest('.cart__size');
      if (size) return dispatch({ type: 'field', weight: Number(size.dataset.weight) });
      const crate = event.target.closest('.cart__crate');
      if (crate) {
        if (crate.disabled || crate.hidden) return;
        return dispatch({ type: 'field', remove: { side: crate.dataset.side, index: Number(crate.dataset.index) } });
      }
      const bay = event.target.closest('.cart__load');
      if (bay) dispatch({ type: 'field', load: bay.dataset.side });
    };
    // Left/right arrows walk the size rail like a radio group; the pick happens at once.
    const onKey = event => {
      const size = event.target.closest?.('.cart__size');
      const intent = keyIntent(event);
      if (!size || !['left', 'right'].includes(intent)) return;
      event.preventDefault();
      event.stopPropagation();
      const at = sizeButtons.indexOf(size), moved = gridMove(at, intent, sizeButtons.length, sizeButtons.length);
      const next = sizeButtons[moved === at ? (intent === 'right' ? 0 : sizeButtons.length - 1) : moved];
      next.focus();
      dispatch({ type: 'field', weight: Number(next.dataset.weight) });
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    const replay = name => {
      move.classList.remove('cart--roll', 'cart--wobble');
      void move.offsetWidth;   // restart the animation
      move.classList.add(name);
    };
    const onAnimationEnd = () => move.classList.remove('cart--roll', 'cart--wobble');
    move.addEventListener('animationend', onAnimationEnd);
    let rolls = null;

    return {
      update(state, ui) {
        const fixed = fixedCount(state, grade);
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
            const tied = side === 'left' && i < fixed;
            if (tied && document.activeElement === button) bay.focus();
            button.disabled = tied;
            button.className = `cart__crate${weight === undefined ? '' : ` cart__crate--w${weight}`}${tied ? ' cart__crate--fixed' : ''}`;
            if (weight === undefined) {
              if (document.activeElement === button) bay.focus();
              button.hidden = true;
              return;
            }
            button.hidden = false;
            button.textContent = String(weight);
            button.setAttribute('aria-label', tied ? `Taro’s ${weight} crate. Load the right side to match.` : `Take off the ${weight} crate on the ${side}`);
          });
        }
        const { left, right } = cartBalance(state);
        body.style.transform = `rotate(${Math.max(-3, Math.min(3, (right - left) * 2))}deg)`;
        if (rolls !== null && ui.rolls !== rolls && ui.lastRoll) replay(ui.lastRoll === 'smooth' ? 'cart--roll' : 'cart--wobble');
        rolls = ui.rolls;
      },
      destroy() {
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        move.removeEventListener('animationend', onAnimationEnd);
        root.remove();
      },
    };
  },
};

export default cart;
