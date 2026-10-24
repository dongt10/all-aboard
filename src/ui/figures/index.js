import { NEIGHBORS } from './neighbors.js';
import { SIDE_CAST } from './side-cast.js';

// Every figure is a 256×256 PNG sprite sheet of 64×64 frames, drawn on the team's chibi body base.
// Rows: front, left, right, back. Columns: step A, stand, step B, joy (front row only). Feet sit on row 56.
// To change a character's art, edit its sheet in assets/figures/ — the layout above is the only contract.
export const FRAME = { width: 64, height: 64 };
export const FEET_ROW = 56;
export const ROWS = { front: 0, left: 1, right: 2, back: 3 };
export const COLUMNS = { stepA: 0, stand: 1, stepB: 2, joy: 3 };
const ALL_VIEWS = ['front', 'left', 'right', 'back'];

export const PLAYERS = [
  { id: 'player-boy', name: 'You', species: 'human', sheet: 'assets/figures/player-boy.png', views: ALL_VIEWS, walks: true, joy: true },
  { id: 'player-girl', name: 'You', species: 'human', sheet: 'assets/figures/player-girl.png', views: ALL_VIEWS, walks: true, joy: true },
];
export const FIGURE_IDS = ['player-boy', 'player-girl', 'math', 'science', 'art', 'reading', 'writing', 'community', 'music', 'pip', 'nori', 'cricket'];

export const allFigures = () => [...PLAYERS, ...NEIGHBORS, ...SIDE_CAST];
export const getFigure = id => allFigures().find(figure => figure.id === id);
export const playerFigureId = state => (state?.avatar === 'girl' ? 'player-girl' : 'player-boy');

// step: 0 stand, 1 step A, 2 step B. Missing views and non-walkers fall back to the front standing frame.
export function frameFor(figure, { pose = 'idle', facing = 'front', step = 0 } = {}) {
  const view = figure.views.includes(facing) ? facing : 'front';
  let col = COLUMNS.stand;
  if (pose === 'joy' && view === 'front' && figure.joy) col = COLUMNS.joy;
  else if (figure.walks && step === 1) col = COLUMNS.stepA;
  else if (figure.walks && step === 2) col = COLUMNS.stepB;
  return { row: ROWS[view], col };
}

export function figureMarkup(id, { pose = 'idle', facing = 'front', step = 0, scale = 1 } = {}) {
  const width = FRAME.width * scale;
  const height = FRAME.height * scale;
  const figure = getFigure(id);
  if (!figure) return `<span class="figure figure--missing" style="width:${width}px;height:${height}px" aria-hidden="true"></span>`;
  const { row, col } = frameFor(figure, { pose, facing, step });
  const position = `${-col * width}px ${-row * height}px`;
  return `<span class="figure figure--${id}" style="width:${width}px;height:${height}px;background-image:url(${figure.sheet});background-size:${width * 4}px ${height * 4}px;background-position:${position}" aria-hidden="true"></span>`;
}
