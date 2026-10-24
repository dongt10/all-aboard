// Keys become game intents. Everything here is pure, so it runs under node --test.
const A_KEYS = new Set(['Enter', ' ', 'z', 'Z']);
const B_KEYS = new Set(['Escape', 'x', 'X', 'Backspace']);
const MOVES = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// A = Enter, Space or Z. B = Escape, X or Backspace. Text fields keep every key except Escape.
export function keyIntent(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const { key, target } = event;
  if (TEXT_TAGS.has(target?.tagName) || target?.isContentEditable) return key === 'Escape' ? 'b' : null;
  if (A_KEYS.has(key)) return 'a';
  if (B_KEYS.has(key)) return 'b';
  return Object.hasOwn(MOVES, key) ? MOVES[key] : null;
}

// 'native': the browser already clicks a focused button on Enter or Space, so the game stays out of it.
// 'click-target': Z clicks the focused button for us. 'scene': hand the intent to the current scene.
// A held key must not act twice, so auto-repeated A and B are dropped.
export function routeIntent(event) {
  const intent = keyIntent(event);
  if (!intent) return null;
  const onButton = event.target?.tagName === 'BUTTON';
  if (intent === 'a' && onButton && (event.key === 'Enter' || event.key === ' ')) return 'native';
  if (event.repeat && (intent === 'a' || intent === 'b')) return null;
  return intent === 'a' && onButton ? 'click-target' : 'scene';
}

// One step through a grid. Edges stop the cursor, and so do cells past the last real item.
export function gridMove(index, intent, columns, count) {
  const step = STEPS[intent];
  if (!step) return index;
  const column = (index % columns) + step[0];
  const next = index + step[0] + step[1] * columns;
  return column < 0 || column >= columns || next < 0 || next >= count ? index : next;
}

// The command menu is a 2-column grid.
export const moveCursor = (index, intent, count) => gridMove(index, intent, 2, count);
