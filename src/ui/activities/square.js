// Hana's square (community): place benches, a garden and a sign on a 5×5 map, then walk it with Try it.
// start, opening, commands and act are pure; only mountField touches the DOM.
// The checklist grows with the grade (encounters.js squareSteps): K wants a bench off the path, grades 1–2 add
// a garden by the quiet trees, grades 3–5 add a sign next to the stage. Every sentence here is 56 characters
// or fewer so a dialogue page never breaks mid-sentence with Bigger words on.
import {
  normalizeEncounterSnapshot, encounterReady, encounterOpeningDialogue,
  routeReport, squareSteps, gradeBand, STAGE_CELLS, placeCommunityItem, communityCellLabel,
} from '../../encounters.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, PAPER, WOOD, GRASS, GRASS_DARK, FINISH, LANTERN, VERMILION } from '../palette.js';

const KIND = 'community';
const SIZE = 5;
const CELLS = SIZE * SIZE;

// Rectangles form the silhouettes as well as the grain, nails, leaves and petals. No stroked curves.
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const WOOD_LIGHT = '#dfa777', WOOD_SHADE = '#815035', LEAF_LIGHT = '#b3e38a';
const GLYPHS = {
  bench: [
    [4, 4, 16, 7, INK], [5, 5, 14, 5, WOOD], [5, 5, 14, 1, WOOD_LIGHT], [5, 9, 14, 1, WOOD_SHADE],
    [6, 6, 1, 1, INK], [17, 6, 1, 1, INK], [9, 7, 5, 1, WOOD_SHADE],
    [5, 11, 3, 10, INK], [16, 11, 3, 10, INK], [6, 12, 1, 8, WOOD], [17, 12, 1, 8, WOOD],
    [2, 11, 20, 5, INK], [3, 12, 18, 3, WOOD], [3, 12, 18, 1, WOOD_LIGHT], [3, 14, 18, 1, WOOD_SHADE],
  ],
  sign: [
    [10, 12, 4, 10, INK], [11, 13, 2, 8, WOOD_SHADE], [11, 13, 1, 7, WOOD_LIGHT],
    [2, 3, 16, 11, INK], [18, 5, 2, 7, INK], [20, 7, 2, 3, INK],
    [3, 4, 14, 9, WOOD], [17, 6, 2, 5, WOOD], [19, 8, 2, 1, WOOD],
    [3, 4, 14, 1, WOOD_LIGHT], [3, 12, 14, 1, WOOD_SHADE], [17, 10, 2, 1, WOOD_SHADE],
    [4, 6, 1, 1, INK], [4, 10, 1, 1, INK], [7, 8, 6, 1, PAPER], [11, 6, 2, 5, PAPER], [13, 7, 2, 3, PAPER],
  ],
  quiet: [
    [7, 9, 2, 9, INK], [15, 6, 2, 12, INK], [4, 11, 4, 4, INK], [16, 9, 4, 4, INK],
    [5, 12, 2, 2, FINISH], [17, 10, 2, 2, GRASS_DARK], [5, 12, 1, 1, GRASS], [17, 10, 1, 1, GRASS],
    [5, 3, 6, 9, INK], [3, 5, 10, 5, INK], [6, 4, 4, 7, VERMILION], [4, 6, 8, 3, VERMILION],
    [6, 4, 3, 2, '#ff9c7c'], [5, 6, 2, 2, '#ff9c7c'], [6, 10, 4, 1, '#a52e2b'], [7, 7, 2, 2, LANTERN],
    [14, 2, 4, 7, INK], [12, 4, 8, 3, INK], [15, 3, 2, 5, LANTERN], [13, 5, 6, 1, LANTERN], [15, 4, 1, 1, PAPER], [15, 7, 2, 1, '#c28c32'],
    [2, 16, 20, 6, INK], [3, 17, 18, 4, WOOD], [3, 17, 18, 1, WOOD_LIGHT], [3, 20, 18, 1, WOOD_SHADE],
    [5, 18, 1, 1, INK], [18, 18, 1, 1, INK], [9, 19, 5, 1, WOOD_SHADE],
  ],
  tree: [
    [10, 12, 4, 10, INK], [11, 13, 2, 8, WOOD_SHADE], [11, 13, 1, 7, WOOD_LIGHT],
    [8, 2, 8, 2, INK], [6, 4, 12, 2, INK], [4, 6, 16, 7, INK], [6, 13, 12, 2, INK],
    [9, 3, 6, 2, GRASS], [7, 5, 10, 8, GRASS], [5, 7, 14, 5, GRASS], [7, 13, 10, 1, GRASS_DARK],
    [9, 3, 5, 2, LEAF_LIGHT], [7, 5, 3, 2, LEAF_LIGHT], [5, 7, 2, 3, LEAF_LIGHT],
    [16, 7, 3, 5, GRASS_DARK], [13, 11, 5, 2, GRASS_DARK], [7, 12, 8, 1, GRASS_DARK], [10, 8, 2, 2, LEAF_LIGHT],
  ],
};
const glyph = (name, size = 24) =>
  `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${GLYPHS[name].map(parts => rect(...parts)).join('')}</svg>`;

const TOOLS = [
  { id: 'bench', word: 'Bench', picture: () => glyph('bench', 28) },
  { id: 'sign', word: 'Sign', picture: () => glyph('sign', 28) },
  { id: 'quiet', word: 'Garden', picture: () => glyph('quiet', 28) },
  { id: 'remove', word: 'Remove', picture: () => icon('trash', { size: 28 }) },
];
const TOOL_IDS = TOOLS.map(t => t.id);
// The word a kid reads for each item: the garden is always "garden", never "quiet".
const ITEM_WORDS = { bench: 'bench', quiet: 'garden' };

export const LINES = {
  placed: 'Placed. Choose Try it when you are ready.',
  removed: 'Removed. Choose Try it when you are ready.',
  changed: 'Something changed. Choose Try it again.',
  full: 'All 12 places are used. Remove an item or replace one already on the map.',
  nothing: 'There is nothing here to remove.',
  same: 'That item is already here. Choose another place.',
  ready: 'Everything is ready! Choose Open square.',
  readyOpening: 'Your square is ready to open. You can still change it.',
};
export const HELP = [
  'Pick a tool, then tap the map to place it.',
  'Choose Next step if you are stuck.',
  'Choose Try it to walk the square.',
  'Choose Open square.',
];
// What the walkers say when a step is missing, in the order squareSteps lists them, and when all is well per band.
const WALK_LINES = {
  rest: 'A tired neighbor needs a bench off the path.',
  quiet: 'Neighbors want a garden by the quiet trees.',
  signed: 'Neighbors cannot find the stage. Put a sign next to the stage.',
};
// The ready line names the finish command, so the kid who just unlocked it knows what to choose next.
const WALK_READY = {
  0: 'A clear path and a bench to rest. Ready! Choose Open square.',
  1: 'A clear path, a bench, and a quiet garden. Ready! Choose Open square.',
  3: 'A clear path, a bench, a garden, and a sign. Ready! Choose Open square.',
};

export function cellPosition(cell) {
  return { x: 10 + (cell % SIZE) * 20, y: 10 + Math.floor(cell / SIZE) * 20 };
}
const onPath = p => Math.abs(p.y - 50) < 16;
const isStageCell = cell => { const { x, y } = cellPosition(cell); return STAGE_CELLS.some(c => c.x === x && c.y === y); };

// The first item sitting on the path (benches and gardens block it; signs do not), named for a kid.
export function blockedLine(state) {
  const blocker = (state?.placements ?? []).find(p => p.item !== 'sign' && onPath(p));
  return blocker ? `Move the ${ITEM_WORDS[blocker.item]} off the path.` : null;
}

// Next step: the blocked path first, then the first step of this grade's checklist that is not done, then ready.
export function nextNeed(state) {
  const blocked = blockedLine(state);
  if (blocked) return blocked;
  const step = squareSteps(state).find(s => !s.done);
  return step ? step.text : LINES.ready;
}

// Try it: the neighbors walk the square and report the first thing missing, or that everything is in place.
export function walkLine(state) {
  const blocked = blockedLine(state);
  if (blocked) return blocked;
  const step = squareSteps(state).find(s => !s.done && s.id !== 'tried');
  if (step) return WALK_LINES[step.id] ?? step.text;   // a step this file does not know still speaks its checklist text
  return WALK_READY[gradeBand(state?.grade)];
}

function place(state, ui, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return { state, ui };
  const { x, y } = cellPosition(cell);
  const result = placeCommunityItem(state, ui.tool, x, y);
  if (result.status === 'full') return { state, ui, line: LINES.full };
  if (result.status === 'unchanged') return { state, ui, line: ui.tool === 'remove' ? LINES.nothing : LINES.same };
  // A change after a walk-through undoes it, so the kid hears that Try it is needed again.
  const line = state.tried ? LINES.changed : result.status === 'removed' ? LINES.removed : LINES.placed;
  return { state: result.state, ui, line };
}

function act(state, ui, action) {
  if (action?.type === 'command') {
    // A second Try it changes nothing saved, so the same state object comes back and the frame skips the save.
    if (action.id === 'invite') { const next = state.tried ? state : { ...state, tried: true }; return { state: next, ui, line: walkLine(next) }; }
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
export function landmark(cell) {
  const row = Math.floor(cell / SIZE), column = cell % SIZE;
  if (row < 2 && column < 2) return 'by the quiet trees';
  if (row === 2) return 'on the path';
  if (isStageCell(cell)) return 'by the stage';
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
    if (isStageCell(i)) b.dataset.stage = '';
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
    // An arrow the grid or rail cannot use (down past the last row) is left alone so the scene hands focus to the menu.
    if (event.target.closest('.square-cell')) {
      const next = gridMove(cursor, intent, SIZE, CELLS);
      if (next === cursor && intent === 'down') return;
      event.preventDefault();
      if (next !== cursor) focusCell(next);
    } else if (event.target.closest('.square-tool')) {
      const at = TOOL_IDS.indexOf(event.target.closest('.square-tool').dataset.tool);
      const next = gridMove(at, intent === 'left' ? 'up' : intent === 'right' ? 'down' : intent, 1, TOOLS.length);
      if (next === at && intent === 'down') return;
      event.preventDefault();
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
      // The sign matters from grade 3 on, so only then does the map mark the three cells next to the stage.
      root.classList.toggle('square-field--stage-marked', gradeBand(state.grade) >= 3);
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
  help: HELP,
  notReadyLine: LINES.changed,
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    return { state: normalizeEncounterSnapshot(KIND, snapshot, grade, chapter), ui: { tool: 'bench' } };
  },
  opening(state) { return encounterReady(state) ? LINES.readyOpening : encounterOpeningDialogue(state); },
  commands(state) {
    return [
      { id: 'invite', label: 'Try it', icon: 'people' },
      { id: 'needs', label: 'Next step', icon: 'help' },
      { id: 'finish', label: 'Open square', icon: 'check', finish: true, disabled: !encounterReady(state) },
    ];
  },
  act,
  mountField,
};
