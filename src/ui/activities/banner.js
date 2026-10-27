// Yuki's banner (art): stamp shapes in festival paints onto a 6×5 cloth.
// start, opening, commands and act are pure; mountField builds the field once and updates it in place.
import { ENCOUNTER_COLORS, ENCOUNTER_COLOR_NAMES, normalizeEncounterSnapshot } from '../../encounters.js';
import {
  COLUMNS, ROWS, YUKI_CELLS, PATTERN_CELLS, patternFor, yukiStamps, expectedAt, patternReport, patternMismatch,
  stampPosition, stampAt, stampSource, stampFilled, symmetryReport, bannerReady, bannerOpening, bannerHelp, BANNER_RULE_LINES,
} from '../../banner-rules.js';
export { stampPosition, stampAt } from '../../banner-rules.js';
import { keyIntent, gridMove } from '../input.js';
import { icon } from '../icons.js';
import { INK, PAPER } from '../palette.js';

export const BANNER_SHAPES = ['star', 'flower', 'leaf', 'circle'];
const CELLS = COLUMNS * ROWS, MAX_STAMPS = 30, HISTORY = 40;
const FULL_LINE = 'The cloth has 30 stamps. Undo one to make room, or hang your banner.';
const NOT_READY_LINE = 'Nothing on the cloth yet.';
export const BANNER_LINES = {
  stamped: 'Keep stamping, or hang your banner.',
  turned: 'Turned.',
  undone: 'Undone.',
  notReady: NOT_READY_LINE,
  paint: color => `${ENCOUNTER_COLOR_NAMES[color]} paint.`,
  stamp: shape => `${shapeName(shape)} stamp.`,
  filled: color => `The cloth is ${ENCOUNTER_COLOR_NAMES[color]} now.`,
};

const sameStamp = (a, b) => a.shape === b.shape && a.color === b.color && a.rotation === b.rotation && (a.flipped === true) === (b.flipped === true);

// Hand-picked light/shadow steps of the festival's coral, lantern, mint, sea, lavender and paper paints.
const PAINT_STEPS = {
  '#e96163': ['#ffadb0', '#b53b42'], '#f4bf4f': ['#ffe59a', '#c28c32'],
  '#6dbea0': ['#b3e3c4', '#3c856c'], '#559fc7': ['#9fdcff', '#367399'],
  '#9d7fbd': ['#d6c4ff', '#70578f'], '#fff1cf': [PAPER, '#d5bc88'],
};
// Two-pixel steps at the actual 32px stamp size. The filled masks include their closed ink edge.
const stampCache = new Map();
function stampSVG(shape, color, rotation = 0, flipped = false) {
  const key = `${shape}:${color}:${rotation}:${flipped}`;
  if (stampCache.has(key)) return stampCache.get(key);
  const [light, shade] = PAINT_STEPS[color] || PAINT_STEPS['#fff1cf'];
  const source = (x, y) => stampSource(x, y, rotation, flipped);
  const filled = (x, y) => stampFilled(shape, x, y, rotation, flipped);
  let pixels = '';
  for (let y = 0; y < 32; y++) {
    let run = '', from = 0;
    for (let x = 0; x <= 32; x++) {
      let fill = '';
      if (x < 32 && filled(x, y)) {
        const [sx, sy] = source(x, y);
        fill = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1) ? INK
          : !filled(x + 3, y) || !filled(x, y + 3) ? shade
          : !filled(x - 3, y) || !filled(x, y - 3) ? light : color;
        if (fill !== INK && shape === 'flower' && sx >= 6 && sx <= 9 && sy >= 6 && sy <= 9) fill = sx === 6 || sy === 6 ? PAPER : '#f4bf4f';
        if (fill !== INK && shape === 'leaf' && sx + sy === 15 && sx > 3 && sx < 12) fill = shade;
      }
      if (fill !== run) {
        if (run) pixels += `<rect x="${from}" y="${y}" width="${x - from}" height="1" fill="${run}"/>`;
        from = x; run = fill;
      }
    }
  }
  // Keep the original 40×40 viewBox; the nested grid maps one pixel to one pixel at its existing 32px size.
  // Rotations are sampled into that grid, so Turn never rotates/antialiases a square pixel in CSS.
  const svg = `<svg class="banner-stamp" viewBox="0 0 40 40" shape-rendering="crispEdges" aria-hidden="true" focusable="false" style="fill:${color}"><svg width="40" height="40" viewBox="0 0 32 32">${pixels}</svg></svg>`;
  stampCache.set(key, svg);
  return svg;
}
function shapeName(shape) { return shape[0].toUpperCase() + shape.slice(1); }

function start(snapshot, { chapter = 0, grade = 1 } = {}) {
  // history holds the cloth before each stamp or fill, so Undo reverses both. It is not saved.
  return { state: normalizeEncounterSnapshot('art', snapshot, grade, chapter), ui: { color: ENCOUNTER_COLORS[0], shape: 'star', rotation: 0, flipped: false, history: [] } };
}

const opening = bannerOpening;

const canUndo = (state, ui) => (ui.history?.length || 0) > 0 || state.stamps.length > 0;
const remember = (ui, state) => ({ ...ui, history: [...(ui.history || []), state].slice(-HISTORY) });

function commands(state, ui) {
  return [
    { id: 'undo', icon: 'undo', label: 'Undo', disabled: !canUndo(state, ui) },
    { id: 'turn', icon: 'turn', label: 'Turn' },
    { id: 'fill', icon: 'fill', label: 'Fill cloth' },
    { id: 'finish', icon: 'check', label: 'Hang banner', finish: true, disabled: !bannerReady(state) },
  ];
}

function stampedLine(state, cell) {
  if (patternFor(state.grade)) {
    if (patternReport(state).complete) return BANNER_RULE_LINES.patternDone;
    return PATTERN_CELLS.includes(cell) ? BANNER_RULE_LINES.fits : BANNER_RULE_LINES.free;
  }
  if (state.grade >= 3) {
    const report = symmetryReport(state);
    if (!report.symmetric) return BANNER_RULE_LINES.mirror;
    if (bannerReady(state)) return BANNER_RULE_LINES.mirrorDone;
    if (state.grade >= 4 && report.count >= (state.request === 2 ? 8 : 6) && report.colors.size < 2) return BANNER_RULE_LINES.secondColor;
    if (state.request === 2) return state.grade >= 4 ? 'Use two colors and eight stamps.' : 'Use six stamps for this banner.';
    return state.grade >= 4 ? BANNER_RULE_LINES.pairColors : BANNER_RULE_LINES.pair;
  }
  if (state.request === 2 && !bannerReady(state)) return 'Add a flower stamp to the cloth.';
  return BANNER_LINES.stamped;
}

function act(state, ui, action) {
  if (action?.type === 'command') {
    if (action.id === 'undo' && canUndo(state, ui)) {
      const history = ui.history || [];
      // A saved banner arrives with stamps but no history: Undo still lifts the last stamp.
      const before = history.length ? history.at(-1) : { ...state, stamps: state.stamps.slice(0, -1) };
      const hint = bannerReady(state) && !bannerReady(before)
        ? patternFor(state.grade) ? BANNER_RULE_LINES.patternAgain : state.grade >= 3 ? BANNER_RULE_LINES.mirrorAgain : NOT_READY_LINE
        : !before.stamps.length && !(state.grade > 0) ? NOT_READY_LINE : '';
      const line = BANNER_LINES.undone + (hint ? ` ${hint}` : '');
      return { state: before, ui: { ...ui, history: history.slice(0, -1) }, line };
    }
    if (action.id === 'turn') return { state, ui: { ...ui, rotation: (ui.rotation + 45) % 360 }, line: BANNER_LINES.turned };
    if (action.id === 'fill') {
      const line = BANNER_LINES.filled(ui.color);
      if (state.background === ui.color) return { state, ui, line };
      return { state: { ...state, background: ui.color }, ui: remember(ui, state), line };
    }
    return { state, ui };
  }
  if (action?.type !== 'field') return { state, ui };
  if (typeof action.flipped === 'boolean') return { state, ui: { ...ui, flipped: action.flipped }, line: action.flipped ? 'Flipped stamp.' : 'Plain stamp.' };
  if (ENCOUNTER_COLORS.includes(action.color)) return { state, ui: { ...ui, color: action.color, patternHint: null }, line: BANNER_LINES.paint(action.color) };
  if (BANNER_SHAPES.includes(action.shape)) return { state, ui: { ...ui, shape: action.shape, patternHint: null }, line: BANNER_LINES.stamp(action.shape) };
  if (Number.isInteger(action.cell) && action.cell >= 0 && action.cell < CELLS) {
    if (patternFor(state.grade)) {
      if (YUKI_CELLS.includes(action.cell)) return { state, ui, line: BANNER_RULE_LINES.yuki };
      const expected = expectedAt(state.grade, action.cell, state.request);
      const mismatch = patternMismatch(state.grade, action.cell, ui, state.request);
      if (mismatch) {
        const hint = `${action.cell}:${mismatch}`;
        const answer = mismatch === 'shape' ? `Try a ${expected.shape} here.`
          : `Try ${ENCOUNTER_COLOR_NAMES[expected.color].toLowerCase()} paint here.`;
        const line = ui.patternHint === hint ? answer
          : mismatch === 'shape' ? BANNER_RULE_LINES.wrongShape : BANNER_RULE_LINES.wrongColor;
        return { state, ui: { ...ui, patternHint: hint }, line };
      }
      // A successful stamp ends this retry, even if it leaves the cloth unchanged.
      if (ui.patternHint) ui = { ...ui, patternHint: null };
    }
    const stamp = { shape: ui.shape, color: ui.color, rotation: ui.rotation, flipped: ui.flipped === true, ...stampPosition(action.cell) };
    const index = stampAt(state, action.cell);
    // Tapping a cell that already holds a stamp swaps it for the new one instead of piling up.
    if (index >= 0) {
      // The very same stamp again changes nothing, so there is nothing for Undo to take back.
      if (sameStamp(state.stamps[index], stamp)) return { state, ui, line: stampedLine(state, action.cell) };
      // Keep saved stamps in edit order for Undo after reopening without live history.
      const stamps = [...state.stamps.filter((_, i) => i !== index), stamp];
      const next = { ...state, stamps };
      return { state: next, ui: remember(ui, state), line: stampedLine(next, action.cell) };
    }
    if (state.stamps.length >= MAX_STAMPS) return { state, ui, line: FULL_LINE };
    const next = { ...state, stamps: [...state.stamps, stamp] };
    return { state: next, ui: remember(ui, state), line: stampedLine(next, action.cell) };
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

  const paints = radioRail('banner-paints', 'Paint', ENCOUNTER_COLORS.map(c => ({ value: c, name: ENCOUNTER_COLOR_NAMES[c], html: `<i class="banner-pot" style="background:${c};--paint-light:${PAINT_STEPS[c][0]};--paint-shade:${PAINT_STEPS[c][1]}" aria-hidden="true"></i>` })));
  const stamps = radioRail('banner-shapes', 'Stamp', BANNER_SHAPES.map(s => ({ value: s, name: shapeName(s), html: `<span class="banner-shape-pic" aria-hidden="true"></span><span class="banner-option__turn" aria-hidden="true"></span>` })));

  const cloth = document.createElement('div');
  cloth.className = 'banner-cloth';
  const layer = document.createElement('div');
  layer.className = 'banner-stamps';
  layer.setAttribute('role', 'img');
  const makeSpots = (count, isYuki) => Array.from({ length: count }, () => {
    const spot = document.createElement('span');
    spot.className = `banner-stamp-spot${isYuki ? ' banner-stamp-spot--yuki' : ''}`;
    spot.hidden = true;
    layer.append(spot);
    return spot;
  });
  const yukiSpots = makeSpots(3, true), childSpots = makeSpots(MAX_STAMPS, false);
  const fold = document.createElement('div');
  fold.className = 'banner-fold'; fold.hidden = true;
  fold.setAttribute('aria-hidden', 'true');
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
  cloth.append(layer, fold, grid);
  const pole = document.createElement('div');
  pole.className = 'banner-pole';
  const middle = document.createElement('div');
  middle.className = 'banner-middle';
  const flip = document.createElement('button');
  flip.type = 'button'; flip.className = 'banner-option banner-flip';
  middle.append(pole, cloth, flip);
  root.append(paints.rail, middle, stamps.rail);
  host.append(root);

  let cursor = 0, current = { state: null, ui: null };
  const focusCell = i => { cells[cursor].tabIndex = -1; cursor = i; cells[i].tabIndex = 0; cells[i].focus(); };
  const checked = buttons => buttons.find(b => b.getAttribute('aria-checked') === 'true') || buttons[0];

  const onClick = event => {
    const b = event.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b === flip) dispatch({ type: 'field', flipped: !current.ui.flipped });
    else if (b.dataset.cell !== undefined) { focusCell(Number(b.dataset.cell)); dispatch({ type: 'field', cell: Number(b.dataset.cell) }); }
    else if (paints.buttons.includes(b)) dispatch({ type: 'field', color: b.dataset.value });
    else if (stamps.buttons.includes(b)) dispatch({ type: 'field', shape: b.dataset.value });
  };

  // Arrows move inside the field and hop between rails and cloth; at the cloth's top or bottom
  // edge the key is left alone so the encounter frame can take focus elsewhere.
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    const b = event.target.closest?.('button');
    if (!b || b === flip) return;
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

  const drawStamps = (spots, values) => spots.forEach((spot, i) => {
    const stamp = values[i];
    spot.hidden = !stamp;
    if (!stamp) return;
    spot.style.left = `${stamp.x}%`; spot.style.top = `${stamp.y}%`;
    const html = stampSVG(stamp.shape, stamp.color, stamp.rotation, stamp.flipped);
    if (spot.innerHTML !== html) spot.innerHTML = html;
  });

  function update(state, ui) {
    if (state !== current.state) {
      const [light, shade] = PAINT_STEPS[state.background] || PAINT_STEPS['#fff1cf'];
      cloth.setAttribute('style', `background:${state.background};--cloth-light:${light};--cloth-shade:${shade}`);
      const yuki = yukiStamps(state.grade, state.request);
      drawStamps(yukiSpots, yuki);
      drawStamps(childSpots, state.stamps);
      fold.hidden = !(state.grade >= 3);
      const lonely = new Set(state.grade >= 3 ? symmetryReport(state).unmatched : []);
      layer.setAttribute('aria-label', `Your banner, ${ENCOUNTER_COLOR_NAMES[state.background]} cloth, ${state.stamps.length} ${state.stamps.length === 1 ? 'stamp' : 'stamps'}`);
      cells.forEach((cell, i) => {
        const stamp = state.stamps[stampAt(state, i)];
        const contents = yuki[i]
          ? `Yuki’s ${ENCOUNTER_COLOR_NAMES[yuki[i].color]} ${yuki[i].shape}. Part of the pattern.${stamp ? ` Your ${ENCOUNTER_COLOR_NAMES[stamp.color]} ${stamp.shape}, rotated ${stamp.rotation} degrees, ${stamp.flipped ? 'flipped' : 'plain'}, is on top.` : ''}`
          : stamp
          ? `${ENCOUNTER_COLOR_NAMES[stamp.color]} ${stamp.shape}, rotated ${stamp.rotation} degrees, ${stamp.flipped ? 'flipped' : 'plain'}. Tap to replace.`
          : 'Empty. Tap to stamp.';
        cell.classList.toggle('banner-cell--yuki', Boolean(yuki[i]));
        cell.classList.toggle('banner-cell--lonely', lonely.has(i));
        cell.setAttribute('aria-label', `Row ${Math.floor(i / COLUMNS) + 1}, column ${(i % COLUMNS) + 1}. ${contents}${lonely.has(i) ? ' Needs its mirror.' : ''}`);
      });
    }
    if (ui !== current.ui) {
      flip.textContent = ui.flipped ? 'Flipped' : 'Plain';
      flip.setAttribute('aria-label', `Stamp: ${ui.flipped ? 'Flipped' : 'Plain'}. Change to ${ui.flipped ? 'Plain' : 'Flipped'}`);
      flip.setAttribute('aria-pressed', String(ui.flipped === true));
      setRadio(paints.buttons, ui.color);
      setRadio(stamps.buttons, ui.shape);
      // The previews turn with the stamp. The chosen one wears a small turn arrow, itself turned the same way,
      // so no number or degree ever reaches the screen (the rotated preview already shows the angle).
      stamps.buttons.forEach(b => {
        b.querySelector('.banner-shape-pic').innerHTML = stampSVG(b.dataset.value, ui.color, ui.rotation, ui.flipped);
        const turned = b.dataset.value === ui.shape && ui.rotation !== 0;
        const chip = b.querySelector('.banner-option__turn');
        chip.innerHTML = turned ? icon('turn', { size: 12 }) : '';
        chip.style.transform = turned ? `rotate(${ui.rotation}deg)` : '';
        b.setAttribute('aria-label', `${shapeName(b.dataset.value)}${turned ? ', turned' : ''}${ui.flipped ? ', flipped' : ', plain'}`);
      });
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
  help: bannerHelp(1),
  helpFor: bannerHelp,
  notReadyLine: NOT_READY_LINE,
  start, opening, commands, act, mountField,
  another(state) {
    const request = state.request === 2 ? 1 : 2;
    const fresh = start({ kind: 'art', request }, { grade: state.grade, chapter: state.chapter });
    return { ...fresh, line: opening(fresh.state) };
  },
};
