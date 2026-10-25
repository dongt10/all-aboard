import {
  GRID, PLACES, ERRAND_IDS, LINES, normalizeCompass, compassReady, compassOpening,
  currentErrand, deliver, routes, placeAt, tapLine, compassGlyph, routeMarkup,
} from '../../compass.js';
import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, VERMILION, PAPER } from '../palette.js';

export { LINES };
export const HELP = [
  'North is up on the map. East is right.',
  'Listen to the errand. Tap the square it names.',
  'Choose Compass or Next errand if you are stuck.',
  'Do all three errands, then choose Hang map.',
];

const PLACE_NAMES = { kiosk: 'Kiosk', bakery: 'Bakery', stage: 'Stage', shed: 'Lantern shed', workshop: 'Taro’s workshop', pond: 'Pond' };
const CARDS = {
  north: { picture: 'flour', title: 'Flour', clues: [{ text: '↑ 1', label: 'North 1' }] },
  west: { picture: 'drum', title: 'Drum', clues: [{ text: '← 2', label: 'West 2' }] },
  lantern: { picture: 'shed', title: 'Lantern', clues: [{ text: '→ 2', label: 'East 2' }, { text: '↓ 1', label: 'South 1' }] },
};
const ROSE = `<svg viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
  + `<path d="M11 0h2v5h2v3h1v1h3v2h5v2h-5v2h-3v1h-1v3h-2v5h-2v-5H9v-3H8v-1H5v-2H0v-2h5V9h3V8h1V5h2z" fill="${INK}"/>`
  + `<path d="M11 3h2v6h2v2h6v2h-8v8h-2v-8H3v-2h8z" fill="${PAPER}"/>`
  + `<path d="M11 3h2v6h2v2h-2v2h-2z" fill="${VERMILION}"/></svg>`;
const isCell = cell => Number.isInteger(cell) && cell >= 0 && cell < GRID * GRID;
const indexOf = ([row, col]) => row * GRID + col;

function start(snapshot, { grade = 2, chapter = 1 } = {}) {
  const saved = snapshot?.kind === 'community' && snapshot.activity === 'compass' ? snapshot : null;
  return { state: normalizeCompass(saved, grade, chapter), ui: {} };
}

function commands(state) {
  return [
    { id: 'next', label: 'Next errand', icon: 'next' },
    { id: 'rose', label: 'Compass', icon: 'map' },
    { id: 'reset', label: 'Start over', icon: 'undo', disabled: state.done.length === 0 },
    { id: 'finish', label: 'Hang map', icon: 'check', finish: true, disabled: !compassReady(state) },
  ];
}

function act(state, ui, action) {
  if (action?.type === 'field' && isCell(action.cell)) {
    const result = deliver(state, action.cell);
    return { state: result.state, ui, line: tapLine(state, action.cell, result) };
  }
  if (action?.type === 'command') {
    if (action.id === 'next') return { state, ui, line: compassOpening(state) };
    if (action.id === 'rose') return { state, ui, line: LINES.compass };
    if (action.id === 'reset' && state.done.length) return { state: { ...state, done: [] }, ui, line: LINES.startOver };
  }
  return { state, ui };
}

// The clue card holds the thing being carried and directions, never a destination name.
export function fieldView(state) {
  const errand = currentErrand(state);
  const pip = indexOf(state.done.includes('north') ? PLACES.bakery : PLACES.kiosk);
  const card = errand ? CARDS[errand.id] : { picture: 'check', title: 'Hang map', clues: [{ text: '✓ 3 of 3', label: 'Three errands done' }] };
  return {
    ready: compassReady(state), head: errand ? `Errand ${ERRAND_IDS.indexOf(errand.id) + 1} of 3` : '3 of 3 done',
    errand: errand?.id ?? null, pip, routes: routes(state),
    card: { ...card, clues: card.clues.map(clue => ({ ...clue })), hint: errand ? 'From the kiosk' : 'Choose Hang map.',
      label: errand ? `${card.title}. ${card.clues.map(clue => `${clue.label}.`).join(' ')} Start at the kiosk.` : LINES.allDone },
    cells: Array.from({ length: GRID * GRID }, (_, cell) => {
      const place = placeAt(cell);
      return { cell, place, pip: cell === pip,
        label: `Row ${Math.floor(cell / GRID) + 1}, column ${cell % GRID + 1}. ${PLACE_NAMES[place] ?? 'Grass'}.${cell === pip ? ' Pip is here.' : ''}` };
    }),
  };
}

function mountField(host, { dispatch = () => {} } = {}) {
  const doc = host.ownerDocument ?? document;
  const root = doc.createElement('div');
  root.className = 'compass-field';
  const allRoutes = routes(normalizeCompass({ done: ERRAND_IDS }));
  root.innerHTML = '<div class="compass-map"><div class="compass-grid" role="group" aria-label="Festival map, 5 rows and 5 columns. North is up."></div>'
    + `<svg class="compass-routes" viewBox="0 0 250 250" width="250" height="250" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${allRoutes.map(route => routeMarkup(route)).join('')}</svg>`
    + `<span class="compass-pip" aria-hidden="true">${figureMarkup('pip', { scale: 0.5 })}</span></div>`
    + '<div class="compass-side"><span class="px-chip compass-count"></span>'
    + `<div class="compass-rose" role="img" aria-label="${LINES.compass}"><span class="compass-rose__star" aria-hidden="true">${ROSE}</span>`
    + '<span class="compass-letter compass-letter--north" aria-hidden="true">N</span><span class="compass-letter compass-letter--east" aria-hidden="true">E</span>'
    + '<span class="compass-letter compass-letter--south" aria-hidden="true">S</span><span class="compass-letter compass-letter--west" aria-hidden="true">W</span></div>'
    + '<div class="compass-card" role="group"><div class="compass-card__pictures" aria-hidden="true">'
    + ['flour', 'drum', 'shed'].map(name => `<span class="compass-picture" data-picture="${name}" hidden>${compassGlyph(name)}</span>`).join('')
    + `<span class="compass-picture" data-picture="check" hidden>${icon('check', { size: 32 })}</span></div>`
    + '<p class="compass-card__title"></p><div class="compass-clues"><span class="compass-clue"></span><span class="compass-clue" hidden></span></div>'
    + '<p class="compass-card__hint"></p></div></div>';
  const grid = root.querySelector('.compass-grid');
  const cells = Array.from({ length: GRID * GRID }, (_, cell) => {
    const button = doc.createElement('button');
    const place = placeAt(cell);
    button.type = 'button'; button.className = 'compass-cell'; button.dataset.cell = String(cell);
    if (place) button.dataset.place = place;
    button.tabIndex = cell === indexOf(PLACES.kiosk) ? 0 : -1;
    button.innerHTML = place
      ? `<span class="compass-place" aria-hidden="true">${place === 'kiosk' ? figureMarkup('community', { scale: 0.5 }) : compassGlyph(place)}</span>`
      : '<span class="compass-grass" aria-hidden="true"></span>';
    grid.append(button);
    return button;
  });
  const count = root.querySelector('.compass-count'), card = root.querySelector('.compass-card');
  const title = root.querySelector('.compass-card__title'), hint = root.querySelector('.compass-card__hint');
  const pictures = [...root.querySelectorAll('.compass-picture')], clues = [...root.querySelectorAll('.compass-clue')];
  const paths = [...root.querySelectorAll('.compass-route')], pip = root.querySelector('.compass-pip');
  let cursor = indexOf(PLACES.kiosk);
  const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  const setCursor = (at, focus = false) => {
    cursor = at;
    cells.forEach((cell, i) => { cell.tabIndex = i === cursor ? 0 : -1; });
    if (focus) cells[cursor].focus();
  };
  const cellFrom = event => cells.indexOf(event.target.closest?.('.compass-cell'));
  const onFocus = event => { const at = cellFrom(event); if (at >= 0) setCursor(at); };
  const onClick = event => {
    const at = cellFrom(event);
    if (at < 0) return;
    setCursor(at, true);
    dispatch({ type: 'field', cell: at });
  };
  const onKey = event => {
    const intent = keyIntent(event), at = cellFrom(event);
    if (at < 0 || !['up', 'down', 'left', 'right'].includes(intent)) return;
    const next = gridMove(at, intent, GRID, cells.length);
    if (next === at && intent === 'down') return;
    event.preventDefault();
    setCursor(next, true);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocus);
  host.append(root);

  function update(state) {
    const view = fieldView(state);
    root.classList.toggle('compass-field--ready', view.ready);
    setText(count, view.head); setText(title, view.card.title); setText(hint, view.card.hint);
    card.setAttribute('aria-label', view.card.label);
    pictures.forEach(picture => { picture.hidden = picture.dataset.picture !== view.card.picture; });
    clues.forEach((chip, i) => {
      const clue = view.card.clues[i];
      chip.hidden = !clue;
      setText(chip, clue?.text ?? '');
      chip.setAttribute('aria-label', clue?.label ?? '');
    });
    paths.forEach(path => { path.setAttribute('visibility', view.routes.some(route => route.id === path.dataset.errand) ? 'visible' : 'hidden'); });
    pip.style.left = `${view.pip % GRID * 50 + 18}px`;
    pip.style.top = `${Math.floor(view.pip / GRID) * 50 + 18}px`;
    view.cells.forEach((cell, i) => {
      cells[i].setAttribute('aria-label', cell.label);
      cells[i].classList.toggle('compass-cell--pip', cell.pip);
    });
  }
  update(normalizeCompass(null));
  return {
    update,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('focusin', onFocus);
      root.remove();
    },
  };
}

export default {
  kind: 'community', title: 'Hana’s compass errands', rewardLabel: 'Delivery map',
  help: HELP, notReadyLine: LINES.notReady,
  start, opening: compassOpening, commands, act, mountField,
};
