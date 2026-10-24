import { icon } from './icons.js';
import { moveCursor } from './input.js';

// Command = { id, label, icon?, art?, disabled?, pressed?, finish? }
//   icon: a name from icons.js. art: trusted SVG markup from our own figures. Neither is escaped.
const SLOTS = 4;
const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const usable = command => Boolean(command) && !command.disabled;

// Where the cursor goes when the commands change: the same command if it is still usable, otherwise
// the nearest usable slot (forward first), and -1 when nothing can be chosen.
export function nextCursorIndex(prev, next, prevIndex) {
  const id = prev[prevIndex]?.id;
  const same = id === undefined ? -1 : next.findIndex(command => command.id === id);
  if (same >= 0 && usable(next[same])) return same;
  if (!next.length) return -1;
  const start = Math.min(Math.max(Number.isInteger(prevIndex) ? prevIndex : 0, 0), next.length - 1);
  for (let i = start; i < next.length; i++) if (usable(next[i])) return i;
  for (let i = start - 1; i >= 0; i--) if (usable(next[i])) return i;
  return -1;
}

// An arrow follows the 2×2 grid and hops over disabled commands. If disabled commands block the way
// (say Undo and Hang banner are off, leaving two commands on a diagonal), it takes the nearest usable
// command on that side instead, so Tab and the arrows can always reach every usable command.
export function stepCursor(commands, index, intent) {
  const [dx, dy] = STEPS[intent] ?? [0, 0];
  let at = index, next = moveCursor(at, intent, commands.length);
  if (next === index) return index;
  while (next !== at) {
    if (usable(commands[next])) return next;
    at = next;
    next = moveCursor(at, intent, commands.length);
  }
  let best = index, bestDistance = Infinity;
  commands.forEach((command, i) => {
    const x = (i % 2) - (index % 2), y = Math.floor(i / 2) - Math.floor(index / 2);
    if (!usable(command) || x * dx + y * dy <= 0 || Math.abs(x) + Math.abs(y) >= bestDistance) return;
    best = i; bestDistance = Math.abs(x) + Math.abs(y);
  });
  return best;
}

// The 2×2 command menu: four permanent slot buttons that set() fills in place. Only the cursor
// button is in the tab order, a ▶ marks it, and hovering or focusing a command moves it.
export function createCommandMenu(host, { onChoose = () => {} } = {}) {
  const frame = document.createElement('div');
  frame.className = 'px-frame cmd-frame';
  const grid = document.createElement('div');
  grid.className = 'cmd-menu';
  grid.setAttribute('role', 'toolbar');
  grid.setAttribute('aria-label', 'Choices');
  grid.tabIndex = -1;   // holds focus while every command is disabled
  const slots = Array.from({ length: SLOTS }, () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'px-button cmd-slot';
    button.innerHTML = '<span class="cmd-slot__cursor" aria-hidden="true"></span><span class="cmd-slot__pic" aria-hidden="true"></span><span class="cmd-slot__label"></span>';
    return { button, pic: button.children[1], label: button.children[2], picHTML: '' };
  });
  grid.append(...slots.map(slot => slot.button));
  frame.append(grid);
  host.append(frame);

  let commands = [], cursor = -1;
  const hasFocus = () => grid.contains(document.activeElement);
  const focusCursor = () => { if (cursor >= 0) slots[cursor].button.focus({ preventScroll: true }); };
  const indexOf = event => slots.findIndex(slot => slot.button === event.target.closest?.('.cmd-slot'));

  function paintSlot(slot, command) {
    const { button, pic, label } = slot;
    button.hidden = !command;           // an empty slot is inert: hidden and disabled
    button.disabled = !command || Boolean(command.disabled);
    if (!command) { delete button.dataset.id; button.removeAttribute('aria-pressed'); button.removeAttribute('data-long'); return; }
    button.dataset.id = command.id;
    button.classList.toggle('px-button--finish', Boolean(command.finish));
    if (typeof command.pressed === 'boolean') button.setAttribute('aria-pressed', String(command.pressed)); else button.removeAttribute('aria-pressed');
    if (label.textContent !== command.label) label.textContent = command.label;
    button.toggleAttribute('data-long', command.label.length > 9);   // Bigger words drops the picture to fit
    const picture = command.art ?? (command.icon ? icon(command.icon) : '');
    if (slot.picHTML !== picture) { pic.innerHTML = picture; slot.picHTML = picture; }
    pic.hidden = !picture;
  }
  function markCursor() {
    slots.forEach(({ button }, i) => { button.tabIndex = i === cursor ? 0 : -1; button.dataset.cursor = String(i === cursor); });
  }
  function moveTo(index, focus) {
    cursor = index;
    markCursor();
    if (focus) focusCursor();
  }
  function choose(index) {
    moveTo(index, false);
    onChoose(commands[index].id);
  }

  grid.addEventListener('click', event => {
    const i = indexOf(event);
    if (i >= 0 && usable(commands[i])) choose(i);
  });
  grid.addEventListener('pointerover', event => {
    const i = indexOf(event);
    if (event.pointerType !== 'touch' && i >= 0 && i !== cursor && usable(commands[i])) moveTo(i, hasFocus());
  });
  grid.addEventListener('focusin', event => {
    const i = indexOf(event);
    if (i >= 0 && i !== cursor && usable(commands[i])) moveTo(i, false);
  });
  slots.forEach(slot => paintSlot(slot));
  markCursor();

  return {
    set(next) {
      if (next.length > SLOTS) throw new RangeError('A command menu holds at most 4 commands');
      const hadFocus = hasFocus();
      cursor = nextCursorIndex(commands, next, cursor);
      commands = [...next];
      slots.forEach((slot, i) => paintSlot(slot, commands[i]));
      markCursor();
      if (hadFocus) cursor >= 0 ? focusCursor() : grid.focus({ preventScroll: true });   // focus never falls back to the page
    },
    focus: focusCursor,
    // Arrows move the cursor, A chooses it. Anything else (B, say) is left to the scene.
    handleIntent(intent) {
      if (cursor < 0) return false;
      if (intent === 'a') { choose(cursor); return true; }
      if (!STEPS[intent]) return false;
      moveTo(stepCursor(commands, cursor, intent), true);
      return true;
    },
    destroy() { frame.remove(); },
  };
}
