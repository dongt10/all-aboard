// Hana's square (community): place benches, signs and a quiet garden on a 5×5 map, then invite neighbors.
// start, opening, commands and act are pure; only mountField touches the DOM.
import {
  normalizeEncounterSnapshot, encounterReady, encounterOpeningDialogue,
  routeReport, placeCommunityItem, communityCellLabel,
} from '../../encounters.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';

const KIND = 'community';
const SIZE = 5;
const CELLS = SIZE * SIZE;

// Small pixel glyphs drawn in currentColor on a 24×24 grid, like icons.js.
const GLYPHS = {
  bench: 'M4 5h16v2H4zM5 7h2v3H5zm12 0h2v3h-2zM3 10h18v3H3zM5 13h2v6H5zm12 0h2v6h-2z',
  sign: 'M3 4h15v8H3zm15 2h2v4h-2zm2 1h2v2h-2zM11 12h2v10h-2z',
  quiet: 'M9 3h6v2H9zM7 5h10v2H7zM5 7h14v4H5zM7 11h10v2H7zM11 13h2v9h-2zM7 16h4v2H7zm6 2h4v2h-4z',
  tree: 'M10 2h4v2h-4zM8 4h8v3H8zM6 7h12v4H6zM8 11h8v2H8zM11 13h2v7h-2z',
};
const glyph = (name, size = 24) =>
  `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${GLYPHS[name]}"/></svg>`;

const TOOLS = [
  { id: 'bench', word: 'Bench', picture: () => glyph('bench', 28) },
  { id: 'sign', word: 'Sign', picture: () => glyph('sign', 28) },
  { id: 'quiet', word: 'Garden', picture: () => glyph('quiet', 28) },
  { id: 'remove', word: 'Remove', picture: () => icon('trash', { size: 28 }) },
];
const TOOL_IDS = TOOLS.map(t => t.id);

const LINES = {
  full: 'All 12 places are used. Remove an item or replace one already on the map.',
  nothing: 'There is nothing here to remove.',
  same: 'That item is already here. Choose another place.',
  changed: 'The square changed. Invite neighbors to try it.',
};

export function cellPosition(cell) {
  return { x: 10 + (cell % SIZE) * 20, y: 10 + Math.floor(cell / SIZE) * 20 };
}

// One step at a time, in order: blocked → quiet → rest → tried → ready.
export function nextNeed(state) {
  const r = routeReport(state);
  if (r.blocked) return 'Move benches and gardens off the path.';
  if (!r.quiet) return 'Put a quiet garden by the quiet trees, top left.';
  if (!r.rest) return 'Put a bench beside the path.';
  if (!state.tried) return 'Choose Invite so neighbors can try it.';
  return 'Everything is ready! Choose Open square.';
}

// The same order and wording the old encounter used after “Try the square”.
function inviteLine(state) {
  const r = routeReport(state);
  if (r.blocked) return 'A neighbor is blocked. Move that object off the path.';
  if (!r.quiet) return 'Add a quiet garden by the upper-left trees.';
  if (!r.rest) return 'A tired neighbor needs a bench off the path.';
  return 'A clear path, a bench, and a quiet spot. Ready!';
}

function place(state, ui, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return { state, ui };
  const { x, y } = cellPosition(cell);
  const result = placeCommunityItem(state, ui.tool, x, y);
  if (result.status === 'full') return { state, ui, line: LINES.full };
  if (result.status === 'unchanged') return { state, ui, line: ui.tool === 'remove' ? LINES.nothing : LINES.same };
  return { state: result.state, ui, line: LINES.changed };
}

function act(state, ui, action, grade) {
  if (action?.type === 'command') {
    if (action.id === 'invite') { const next = { ...state, tried: true }; return { state: next, ui, line: inviteLine(next) }; }
    if (action.id === 'needs') return { state, ui, line: nextNeed(state) };
    return { state, ui };
  }
  if (action?.type === 'field') {
    if (TOOL_IDS.includes(action.tool)) return { state, ui: { ...ui, tool: action.tool } };
    if ('cell' in action) return place(state, ui, action.cell);
  }
  return { state, ui };
}

// Landmarks, for the eye (drawn) and for screen readers (added to the cell name).
function landmark(cell) {
  const row = Math.floor(cell / SIZE), column = cell % SIZE;
  if (row < 2 && column < 2) return 'by the quiet trees';
  if (row === 2) return 'on the path';
  if (row === 0 && column === SIZE - 1) return 'by the stage';
  if (row === SIZE - 1 && column === 0) return 'by the entrance';
  return '';
}

function mountField(host, { dispatch = () => {} } = {}) {
  let cursor = 0;
  const root = document.createElement('div');
  root.className = 'square-field';
  root.innerHTML = `
    <div class="square-map">
      <div class="square-quiet" aria-hidden="true"><span class="square-quiet__trees">${glyph('tree', 20)}${glyph('tree', 20)}${glyph('tree', 20)}</span><span class="square-quiet__word">Quiet trees</span></div>
      <div class="square-path" aria-hidden="true"></div>
      <div class="square-stage" aria-hidden="true"><span class="square-stage__roof"></span><span class="square-stage__deck"></span></div>
      <div class="square-entrance" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="square-walkers" aria-hidden="true" hidden><span></span><span></span><span></span></div>
      <div class="square-grid" role="group" aria-label="Square map, 5 by 5"></div>
    </div>
    <div class="square-rail" role="radiogroup" aria-label="Tool"></div>`;
  const grid = root.querySelector('.square-grid');
  const rail = root.querySelector('.square-rail');
  const walkers = root.querySelector('.square-walkers');

  const cells = Array.from({ length: CELLS }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'square-cell';
    b.dataset.cell = String(i);
    b.tabIndex = i === cursor ? 0 : -1;
    grid.append(b);
    return b;
  });
  const radios = TOOLS.map(tool => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `square-tool square-tool--${tool.id}`;
    b.setAttribute('role', 'radio');
    b.dataset.tool = tool.id;
    b.innerHTML = `<span class="square-tool__pic">${tool.picture()}</span><span class="square-tool__word">${tool.word}</span>`;
    rail.append(b);
    return b;
  });

  const focusCell = i => {
    cells[cursor].tabIndex = -1;
    cursor = i;
    cells[cursor].tabIndex = 0;
    cells[cursor].focus();
  };
  const onClick = event => {
    const cell = event.target.closest('.square-cell');
    if (cell) { const i = Number(cell.dataset.cell); if (i !== cursor) focusCell(i); dispatch({ type: 'field', cell: i }); return; }
    const radio = event.target.closest('.square-tool');
    if (radio) dispatch({ type: 'field', tool: radio.dataset.tool });
  };
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    if (event.target.closest('.square-cell')) {
      event.preventDefault();
      const next = gridMove(cursor, intent, SIZE, CELLS);
      if (next !== cursor) focusCell(next);
    } else if (event.target.closest('.square-tool')) {
      event.preventDefault();
      const at = TOOL_IDS.indexOf(event.target.closest('.square-tool').dataset.tool);
      const next = gridMove(at, intent === 'left' ? 'up' : intent === 'right' ? 'down' : intent, 1, TOOLS.length);
      if (next !== at) { radios[next].focus(); dispatch({ type: 'field', tool: TOOL_IDS[next] }); }
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  host.append(root);

  return {
    update(state, ui) {
      const tool = ui?.tool ?? 'bench';
      const report = routeReport(state);
      cells.forEach((b, i) => {
        const { x, y } = cellPosition(i);
        const placed = state.placements.find(p => p.x === x && p.y === y);
        const item = placed?.item ?? '';
        if (b.dataset.item !== item) {
          b.dataset.item = item;
          b.innerHTML = item ? `<span class="square-item square-item--${item}">${glyph(item, 28)}</span>` : '';
        }
        const where = landmark(i);
        const name = communityCellLabel(tool, placed, Math.floor(i / SIZE) + 1, (i % SIZE) + 1);
        b.setAttribute('aria-label', where ? `${name}, ${where}` : name);
      });
      radios.forEach(b => {
        const on = b.dataset.tool === tool;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      walkers.hidden = !state.tried;
      walkers.classList.toggle('square-walkers--blocked', report.blocked);
      root.classList.toggle('square-field--ready', encounterReady(state));
    },
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

export default {
  kind: KIND,
  title: 'Room for every neighbor',
  help: ['Pick a tool.', 'Tap the map to place it.', 'Choose What’s left if you are stuck.', 'Choose Invite, then Open square.'],
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    return { state: normalizeEncounterSnapshot(KIND, snapshot, grade, chapter), ui: { tool: 'bench' } };
  },
  opening(state) { return encounterOpeningDialogue(state); },
  commands(state) {
    return [
      { id: 'invite', label: 'Invite', icon: 'people' },
      { id: 'needs', label: 'What’s left', icon: 'help' },
      { id: 'finish', label: 'Open square', icon: 'check', finish: true, disabled: !encounterReady(state) },
    ];
  },
  act,
  mountField,
};
