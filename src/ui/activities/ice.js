// Momo's ice stand (science): two trays of equal ice, one shaded, a model clock.
import { iceRemaining, shadeScienceTray, scienceNextStep, encounterReady, encounterOpeningDialogue, normalizeEncounterSnapshot } from '../../encounters.js';
import { icon } from '../icons.js';

const TRAYS = ['left', 'right'];
const TRAY_NAME = { left: 'Tray A', right: 'Tray B' };

export function iceLabel(remaining, grade) {
  if (grade >= 2) return `${remaining}% ice left`;
  return remaining > 60 ? 'Lots of ice' : remaining > 0 ? 'Less ice' : 'Water';
}

function shade(state, ui, side) {
  const next = shadeScienceTray(state, side);
  if (next === state) return { state, ui, line: scienceNextStep(state) };
  return { state: next, ui, line: 'Fresh equal cubes. Watch 10 model minutes with one tray shaded.' };
}

function mountField(host, { grade = 1, dispatch = () => {} } = {}) {
  const doc = host.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'ice-field';
  root.innerHTML = `<div class="ice-top"><span class="ice-tag">Simplified model</span><span class="ice-sun" aria-hidden="true"><i></i></span><span class="ice-clock">${icon('clock', { size: 20 })}<b></b></span></div>
<div class="ice-trays">${TRAYS.map(side => `<button type="button" class="ice-tray" data-tray="${side}" aria-pressed="false">
<span class="ice-canopy" aria-hidden="true"></span><span class="ice-box" aria-hidden="true"><span class="ice-water"></span><span class="ice-cube"></span></span>
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
      clock.textContent = `${state.time} model minutes`;
      root.classList.toggle('ice-field--shaded', state.canopy !== 'none');
      for (const side of TRAYS) {
        const tray = root.querySelector(`.ice-tray[data-tray="${side}"]`);
        const shaded = state.canopy === side, remaining = iceRemaining(state.time, shaded), label = iceLabel(remaining, grade);
        tray.setAttribute('aria-pressed', String(shaded));
        tray.classList.toggle('ice-tray--shaded', shaded);
        tray.setAttribute('aria-label', `${TRAY_NAME[side]}, ${shaded ? 'shaded' : 'in the sun'}, ${label}`);
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
  title: 'A little shade experiment',
  help: ['Tap a tray to shade it.', 'Choose Wait 5 min two times.', 'Compare the two ice cubes.', 'Choose Use shade.'],
  start(snapshot, { chapter = 0, grade = 1 } = {}) {
    return { state: normalizeEncounterSnapshot('science', snapshot ?? {}, grade, chapter), ui: {} };
  },
  opening(state) { return encounterOpeningDialogue(state); },
  commands(state) {
    const late = state.time >= 20;
    return [
      { id: 'shade-left', label: 'Shade A', icon: 'shade', pressed: state.canopy === 'left' },
      { id: 'shade-right', label: 'Shade B', icon: 'shade', pressed: state.canopy === 'right' },
      late ? { id: 'fresh', label: 'Fresh ice', icon: 'undo' } : { id: 'wait', label: 'Wait 5 min', icon: 'clock' },
      { id: 'finish', label: 'Use shade', icon: 'check', finish: true, disabled: !encounterReady(state) },
    ];
  },
  act(state, ui, action) {
    if (action?.type === 'field') return TRAYS.includes(action.tray) ? shade(state, ui, action.tray) : { state, ui };
    if (action?.type !== 'command') return { state, ui };
    if (action.id === 'shade-left' || action.id === 'shade-right') return shade(state, ui, action.id.slice(6));
    if (action.id === 'wait') return {
      state: { ...state, time: Math.min(20, state.time + 5) }, ui,
      line: state.canopy === 'none' ? 'Both trays are sunny. Their ice melts at the same rate.' : 'The shaded ice melts more slowly in this model.',
    };
    if (action.id === 'fresh') return { state: { ...state, time: 0 }, ui, line: 'Equal cubes again. Try moving the shade to the other tray.' };
    return { state, ui };
  },
  mountField,
};
