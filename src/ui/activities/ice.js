// Momo's ice stand (science): two trays of equal ice, one in the shade, a clock. Kid words at every grade.
import { iceRemaining, iceWords, shadeScienceTray, scienceNextStep, predictionLine, encounterReady, encounterOpeningDialogue, normalizeEncounterSnapshot, gradeBand } from '../../encounters.js';
import { icon } from '../icons.js';
import { INK, LANTERN, PAPER, PAPER_SHADE, SUBJECT_THEME } from '../palette.js';

const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const art = (name, width, height, drawing) => `<svg class="ice-art ice-art--${name}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${drawing}</svg>`;
const sunArt = art('sun', 40, 40,
  rect(17, 0, 6, 40, INK) + rect(18, 1, 4, 38, LANTERN) + rect(18, 1, 1, 38, '#ffe08f')
  + rect(21, 1, 1, 38, '#d99a30') + rect(0, 17, 40, 6, INK) + rect(1, 18, 38, 4, LANTERN)
  + rect(1, 18, 38, 1, '#ffe08f') + rect(1, 21, 38, 1, '#d99a30')
  + `<path d="M12 8H28V12H32V28H28V32H12V28H8V12H12Z" fill="${INK}"/>`
  + `<path d="M13 9H27V13H31V27H27V31H13V27H9V13H13Z" fill="${LANTERN}"/>`
  + rect(13, 9, 14, 3, '#ffe08f') + rect(9, 13, 3, 14, '#ffe08f')
  + rect(28, 13, 3, 14, '#d99a30') + rect(13, 28, 14, 3, '#d99a30') + rect(14, 14, 4, 4, PAPER)
  + [[4, 4], [34, 4], [4, 34], [34, 34]].map(([x, y]) => rect(x, y, 3, 3, INK) + rect(x + 1, y + 1, 1, 1, LANTERN)).join(''));
// 227px is the tray's 219px content width plus the existing 4px overhang on each side.
const canopyArt = art('canopy', 227, 26,
  rect(0, 0, 227, 20, INK)
  + Array.from({ length: 9 }, (_, i) => {
    const x = 1 + i * 25;
    const [light, base, shade] = i % 2 ? [PAPER, PAPER_SHADE, '#d8c499'] : ['#9be7dd', SUBJECT_THEME.science.color, '#279c96'];
    return rect(x, 1, 25, 18, base) + rect(x, 1, 25, 3, light) + rect(x, 4, 3, 12, light)
      + rect(x + 21, 4, 4, 12, shade) + rect(x, 16, 25, 1, INK) + rect(x, 17, 25, 2, shade)
      + rect(x + 2, 19, 21, 7, INK) + rect(x + 3, 19, 19, 6, shade) + rect(x + 3, 19, 19, 2, base);
  }).join(''));

const TRAYS = ['left', 'right'];
const TRAY_NAME = { left: 'Tray A', right: 'Tray B' };
const RESULT_MINUTES = 10;   // a shaded tray is compared after ten minutes; then Wait 5 min becomes Fresh ice
const MELTED_MINUTES = 20;   // the clock stops here; sunny trays are water, so Fresh ice takes over too

// Every sentence 56 characters or fewer, so pages break between sentences with Bigger words on.
export const ICE_LINES = {
  notReady: 'Shade a tray, then wait 10 minutes.',
  waitSunny: 'Both trays are in the sun. They melt the same. Shade one!',
  waitShaded: side => `${TRAY_NAME[side]} is in the shade. Its ice melts slower. Wait more!`,
  result: 'Look! The shaded tray kept more ice.',
  finishHint: 'Choose Serve ice.',
  shaded: side => `${TRAY_NAME[side]} is in the shade. Now wait and look!`,
  guessed: side => `You picked ${TRAY_NAME[side]}. Wait and see if it keeps more ice!`,
  moved: side => `Fresh ice. ${TRAY_NAME[side]} is in the shade now. Wait and look!`,
  movedGuess: side => `Fresh ice. You picked ${TRAY_NAME[side]}. Wait and see!`,
  fresh: 'Fresh ice in both trays. Try shading the other tray!',
  freshSunny: 'Fresh ice in both trays. Shade one tray!',
};

// Words at every grade; grades 2 to 5 add the number beside them ("Less ice · 75").
export function iceLabel(remaining, grade) {
  const words = iceWords(remaining);
  return Number(grade) >= 2 ? `${words} · ${remaining}` : words;
}

const predicts = state => gradeBand(state.grade) >= 3;
// The trays have been compared once a shaded tray has had ten minutes; two sunny trays never compare anything.
const compared = state => state.time >= RESULT_MINUTES && state.canopy !== 'none';
// Wait 5 min stays until the trays are compared or the clock runs out; then Fresh ice takes its place.
const canWait = state => !compared(state) && state.time < MELTED_MINUTES;

function shade(state, ui, side) {
  const next = shadeScienceTray(state, side);
  if (next === state) return { state, ui, line: scienceNextStep(state) };
  const first = ui.predicted == null;   // the first Shade pick of a run is the guess (kept in ui, never saved)
  const nextUi = first ? { ...ui, predicted: side } : ui;
  const guess = first && predicts(state);
  if (state.canopy !== 'none' || state.time > 0) return { state: next, ui: nextUi, line: guess ? ICE_LINES.movedGuess(side) : ICE_LINES.moved(side) };
  return { state: next, ui: nextUi, line: guess ? ICE_LINES.guessed(side) : ICE_LINES.shaded(side) };
}

function wait(state, ui) {
  const next = { ...state, time: Math.min(MELTED_MINUTES, state.time + 5) };
  if (state.canopy === 'none') return { state: next, ui, line: ICE_LINES.waitSunny };
  if (next.time < RESULT_MINUTES) return { state: next, ui, line: ICE_LINES.waitShaded(state.canopy) };
  const result = predicts(state) && ui.predicted != null ? predictionLine(ui.predicted, next) : ICE_LINES.result;
  return { state: next, ui, line: `${result} ${ICE_LINES.finishHint}` };
}

function mountField(host, { grade = 1, dispatch = () => {} } = {}) {
  const doc = host.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'ice-field';
  root.innerHTML = `<div class="ice-top"><span class="ice-sun" aria-hidden="true"><i>${sunArt}</i></span><span class="ice-clock">${icon('clock', { size: 20 })}<b></b></span></div>
<div class="ice-trays">${TRAYS.map(side => `<button type="button" class="ice-tray" data-tray="${side}" aria-pressed="false">
<span class="ice-canopy" aria-hidden="true">${canopyArt}</span><span class="ice-box" aria-hidden="true"><span class="ice-water"></span><span class="ice-cube"></span></span>
<span class="ice-name">${TRAY_NAME[side]}</span><span class="ice-left"></span></button>`).join('')}</div>`;
  const click = event => {
    const tray = event.target.closest?.('.ice-tray');
    if (tray && root.contains(tray)) dispatch({ type: 'field', tray: tray.dataset.tray });
  };
  root.addEventListener('click', click);
  host.append(root);
  const clock = root.querySelector('.ice-clock b');
  return {
    update(state) {
      clock.textContent = `${state.time} minutes`;
      root.classList.toggle('ice-field--shaded', state.canopy !== 'none');
      for (const side of TRAYS) {
        const tray = root.querySelector(`.ice-tray[data-tray="${side}"]`);
        const shaded = state.canopy === side, remaining = iceRemaining(state.time, shaded), label = iceLabel(remaining, grade);
        tray.setAttribute('aria-pressed', String(shaded));
        tray.classList.toggle('ice-tray--shaded', shaded);
        tray.setAttribute('aria-label', `${TRAY_NAME[side]}, ${shaded ? 'in the shade' : 'in the sun'}, ${label}`);
        tray.querySelector('.ice-left').textContent = label;
        tray.querySelector('.ice-water').style.height = `${Math.round((100 - remaining) * 0.55 + 8)}%`;
        const cube = tray.querySelector('.ice-cube');
        cube.style.width = `${Math.round(remaining * 0.5)}%`;
        cube.style.height = `${Math.round(remaining * 0.75)}%`;
        cube.style.visibility = remaining > 0 ? '' : 'hidden';
      }
    },
    destroy() { root.removeEventListener('click', click); root.remove(); },
  };
}

export default {
  kind: 'science',
  title: 'Momo’s ice test',
  help: ['Tap a tray, or choose Shade A or Shade B.', 'Choose Wait 5 min two times. Watch the ice.', 'Which tray kept more ice? Fresh ice starts over.', 'Choose Serve ice.'],
  notReadyLine: ICE_LINES.notReady,
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    const state = normalizeEncounterSnapshot('science', snapshot ?? {}, grade, chapter);
    // A draft that already has a shaded tray counts that tray as the guess; the guess itself is never saved.
    return { state, ui: { predicted: state.canopy === 'none' ? null : state.canopy } };
  },
  opening(state) {
    if (encounterReady(state)) return encounterOpeningDialogue(state);
    // A resumed draft with a shaded tray that is still melting: say what comes next, not "shade a tray".
    if (state.canopy !== 'none') return scienceNextStep(state);
    return encounterOpeningDialogue(state);   // per band: K-2 'wait and look!', 3-5 the guess question
  },
  commands(state) {
    return [
      { id: 'shade-left', label: 'Shade A', icon: 'shade', pressed: state.canopy === 'left' },
      { id: 'shade-right', label: 'Shade B', icon: 'shade', pressed: state.canopy === 'right' },
      canWait(state) ? { id: 'wait', label: 'Wait 5 min', icon: 'clock' } : { id: 'fresh', label: 'Fresh ice', icon: 'undo' },
      { id: 'finish', label: 'Serve ice', icon: 'check', finish: true, disabled: !encounterReady(state) },
    ];
  },
  act(state, ui, action) {
    if (action?.type === 'field') return TRAYS.includes(action.tray) ? shade(state, ui, action.tray) : { state, ui };
    if (action?.type !== 'command') return { state, ui };
    if (action.id === 'shade-left' || action.id === 'shade-right') return shade(state, ui, action.id.slice(6));
    if (action.id === 'wait' && canWait(state)) return wait(state, ui);
    if (action.id === 'fresh') return { state: { ...state, time: 0 }, ui: { ...ui, predicted: null }, line: state.canopy === 'none' ? ICE_LINES.freshSunny : ICE_LINES.fresh };
    return { state, ui };
  },
  mountField,
};
