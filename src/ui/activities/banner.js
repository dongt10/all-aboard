// Yuki's banner (art): stamp shapes in festival paints onto a 6×5 cloth.
// start, opening, commands and act are pure; mountField builds the field once and updates it in place.
import { ENCOUNTER_COLORS, ENCOUNTER_COLOR_NAMES, normalizeEncounterSnapshot, encounterReady, encounterOpeningDialogue } from '../../encounters.js';
import { keyIntent, gridMove } from '../input.js';

export const BANNER_SHAPES = ['star', 'flower', 'leaf', 'circle'];
const COLUMNS = 6, ROWS = 5, CELLS = COLUMNS * ROWS, MAX_STAMPS = 30;
const FULL_LINE = 'The cloth has 30 stamps. Undo one to make room, or hang your banner.';

export function stampPosition(cell) {
  return { x: 8.33 + (cell % COLUMNS) * 16.66, y: 10 + Math.floor(cell / COLUMNS) * 20 };
}

const FORMS = {
  star: '<path d="m20 2 5 12 13 1-10 9 3 13-11-7-11 7 3-13L2 15l13-1Z"/>',
  flower: '<path d="M20 12C7-5-4 18 12 20-5 33 18 44 20 28c13 17 24-6 8-8C45 7 22-4 20 12Z"/><circle cx="20" cy="20" r="5" fill="#fff1cf"/>',
  leaf: '<path d="M5 35C-1 10 17 0 35 5c5 19-6 36-30 30Z"/><path d="m8 32 20-20" stroke="#284b45" fill="none" stroke-width="2"/>',
  circle: '<circle cx="20" cy="20" r="16"/><circle cx="15" cy="14" r="4" fill="#fff" opacity=".4"/>',
};
const stampSVG = (shape, color, rotation = 0) =>
  `<svg class="banner-stamp" viewBox="0 0 40 40" aria-hidden="true" focusable="false" style="fill:${color};transform:rotate(${rotation}deg)">${FORMS[shape] || FORMS.circle}</svg>`;
const shapeName = shape => shape[0].toUpperCase() + shape.slice(1);

function start(snapshot, { chapter = 0, grade = 1 } = {}) {
  return { state: normalizeEncounterSnapshot('art', snapshot, grade, chapter), ui: { color: ENCOUNTER_COLORS[0], shape: 'star', rotation: 0 } };
}

const opening = state => encounterOpeningDialogue(state);

function commands(state, ui) {
  return [
    { id: 'undo', icon: 'undo', label: 'Undo', disabled: !state.stamps.length },
    { id: 'turn', icon: 'turn', label: `Turn ${ui.rotation}°` },
    { id: 'fill', icon: 'fill', label: 'Fill cloth' },
    { id: 'finish', icon: 'check', label: 'Hang banner', finish: true, disabled: !encounterReady(state) },
  ];
}

function act(state, ui, action) {
  if (action?.type === 'command') {
    if (action.id === 'undo' && state.stamps.length) return { state: { ...state, stamps: state.stamps.slice(0, -1) }, ui };
    if (action.id === 'turn') return { state, ui: { ...ui, rotation: (ui.rotation + 45) % 360 } };
    if (action.id === 'fill') return { state: state.background === ui.color ? state : { ...state, background: ui.color }, ui, line: `The cloth is ${ENCOUNTER_COLOR_NAMES[ui.color]} now.` };
    return { state, ui };
  }
  if (action?.type !== 'field') return { state, ui };
  if (ENCOUNTER_COLORS.includes(action.color)) return { state, ui: { ...ui, color: action.color } };
  if (BANNER_SHAPES.includes(action.shape)) return { state, ui: { ...ui, shape: action.shape } };
  if (Number.isInteger(action.cell) && action.cell >= 0 && action.cell < CELLS) {
    if (state.stamps.length >= MAX_STAMPS) return { state, ui, line: FULL_LINE };
    const stamp = { shape: ui.shape, color: ui.color, rotation: ui.rotation, ...stampPosition(action.cell) };
    return { state: { ...state, stamps: [...state.stamps, stamp] }, ui, line: 'Keep stamping, or hang your banner.' };
  }
  return { state, ui };
}

// ---- Field ----

// A radio group with roving focus: up/down (and left/right inside the rail) pick the next option.
function radioRail(className, label, options) {
  const rail = document.createElement('div');
  rail.className = `banner-rail ${className}`;
  rail.setAttribute('role', 'radiogroup');
  rail.setAttribute('aria-label', label);
  const buttons = options.map(({ value, html, name }) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'banner-option'; b.dataset.value = value;
    b.setAttribute('role', 'radio');
    b.innerHTML = `${html}<span class="banner-option__name">${name}</span>`;
    rail.append(b);
    return b;
  });
  return { rail, buttons };
}

function mountField(host, { dispatch }) {
  const root = document.createElement('div');
  root.className = 'banner-field';

  const paints = radioRail('banner-paints', 'Paint', ENCOUNTER_COLORS.map(c => ({ value: c, name: ENCOUNTER_COLOR_NAMES[c], html: `<i class="banner-pot" style="background:${c}" aria-hidden="true"></i>` })));
  const stamps = radioRail('banner-shapes', 'Stamp', BANNER_SHAPES.map(s => ({ value: s, name: shapeName(s), html: `<span class="banner-shape-pic" aria-hidden="true"></span>` })));

  const cloth = document.createElement('div');
  cloth.className = 'banner-cloth';
  const layer = document.createElement('div');
  layer.className = 'banner-stamps';
  layer.setAttribute('role', 'img');
  const grid = document.createElement('div');
  grid.className = 'banner-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Banner cloth');
  const cells = Array.from({ length: CELLS }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'banner-cell'; b.dataset.cell = i;
    b.setAttribute('aria-label', `Stamp row ${Math.floor(i / COLUMNS) + 1}, column ${(i % COLUMNS) + 1}`);
    b.tabIndex = i === 0 ? 0 : -1;
    grid.append(b);
    return b;
  });
  cloth.append(layer, grid);
  const pole = document.createElement('div');
  pole.className = 'banner-pole';
  const middle = document.createElement('div');
  middle.className = 'banner-middle';
  middle.append(pole, cloth);
  root.append(paints.rail, middle, stamps.rail);
  host.append(root);

  let cursor = 0, current = { state: null, ui: null };
  const focusCell = i => { cells[cursor].tabIndex = -1; cursor = i; cells[i].tabIndex = 0; cells[i].focus(); };
  const checked = buttons => buttons.find(b => b.getAttribute('aria-checked') === 'true') || buttons[0];

  const onClick = event => {
    const b = event.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.cell !== undefined) { focusCell(Number(b.dataset.cell)); dispatch({ type: 'field', cell: Number(b.dataset.cell) }); }
    else if (paints.buttons.includes(b)) dispatch({ type: 'field', color: b.dataset.value });
    else if (stamps.buttons.includes(b)) dispatch({ type: 'field', shape: b.dataset.value });
  };

  // Arrows move inside the field and hop between rails and cloth; at the cloth's top or bottom
  // edge the key is left alone so the encounter frame can take focus elsewhere.
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    const b = event.target.closest?.('button');
    if (!b) return;
    let handled = true;
    if (b.dataset.cell !== undefined) {
      const next = gridMove(cursor, intent, COLUMNS, CELLS);
      if (next !== cursor) focusCell(next);
      else if (intent === 'left') checked(paints.buttons).focus();
      else if (intent === 'right') checked(stamps.buttons).focus();
      else handled = false;
    } else {
      const group = paints.buttons.includes(b) ? paints : stamps;
      const towardCloth = group === paints ? 'right' : 'left';
      if (intent === towardCloth) cells[cursor].focus();
      else {
        const i = group.buttons.indexOf(b), step = intent === 'up' || intent === 'left' ? -1 : 1;
        const next = group.buttons[(i + step + group.buttons.length) % group.buttons.length];
        next.focus();
        dispatch({ type: 'field', [group === paints ? 'color' : 'shape']: next.dataset.value });
      }
    }
    if (handled) { event.preventDefault(); event.stopPropagation(); }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  const setRadio = (buttons, value) => buttons.forEach(b => {
    const on = b.dataset.value === value;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });

  function update(state, ui) {
    if (state !== current.state) {
      cloth.style.background = state.background;
      layer.innerHTML = state.stamps.map(s => `<span class="banner-stamp-spot" style="left:${s.x}%;top:${s.y}%">${stampSVG(s.shape, s.color, s.rotation)}</span>`).join('');
      layer.setAttribute('aria-label', `Your banner, ${ENCOUNTER_COLOR_NAMES[state.background]} cloth, ${state.stamps.length} ${state.stamps.length === 1 ? 'stamp' : 'stamps'}`);
    }
    if (ui !== current.ui) {
      setRadio(paints.buttons, ui.color);
      setRadio(stamps.buttons, ui.shape);
      stamps.buttons.forEach(b => { b.querySelector('.banner-shape-pic').innerHTML = stampSVG(b.dataset.value, ui.color, ui.rotation); });
    }
    current = { state, ui };
  }

  function destroy() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    root.remove();
  }

  return { update, destroy };
}

export default {
  kind: 'art',
  title: 'Your colors, flying high',
  help: ['Pick a paint and a stamp.', 'Tap the cloth to stamp.', 'Turn or undo any time.', 'Choose Hang banner.'],
  start, opening, commands, act, mountField,
};
