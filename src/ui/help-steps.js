import { encounterReady, cartBalance, squareSteps } from '../encounters.js';
import { chainComplete } from '../chain.js';
import { remainingUnits } from '../pizza.js';
import { patternFor, patternReport, symmetryReport } from '../banner-rules.js';
import { normalizeReadingFound } from '../reading.js';

// The text is owned by each activity, including its grade-specific variants.
export function helpSteps(activity, grade) {
  const source = activity?.helpFor ?? activity?.help;
  const steps = typeof source === 'function' ? source(grade) : source;
  return Array.isArray(steps) ? steps : [];
}

const TITLES = {
  'Taro’s cart': 'math', 'Momo’s ice test': 'science', 'Your colors, flying high': 'art',
  'Pack for the festival': 'reading', 'A sign from you': 'writing', 'Room for every neighbor': 'community',
  'Taro’s pizza party': 'pizza', 'Momo’s bean test': 'beans', 'Hana’s compass errands': 'compass',
  'Hana’s Help Day': 'helpday', 'Sora’s story ribbon': 'ribbon', 'Taro’s crate rows': 'rows',
  'Momo’s sunbeam chart': 'chain', 'Whose tale is this?': 'tales',
};
const KINDS = { pizza: 'math', rows: 'math', beans: 'science', chain: 'science',
  compass: 'community', helpday: 'community', ribbon: 'reading', tales: 'reading' };
function activityName(activity, state) {
  const name = TITLES[activity?.title];
  if (!name || activity.kind !== (KINDS[name] ?? name) || state?.kind !== activity.kind) return null;
  if (state.activity !== undefined && state.activity !== name) return null;
  // Banded creations always carry their discriminator.
  if (KINDS[name] && state.activity !== name) return null;
  return name;
}

export function stepIndex(activity, state, ui = {}, grade = state?.grade) {
  const steps = helpSteps(activity, grade), last = Math.max(0, steps.length - 1);
  if (!state || !steps.length) return 0;
  // Unknown activities get only the general ready fallback, never another activity's mapping.
  try { if (encounterReady(state)) return last; } catch { return 0; }
  let index = 0;
  switch (activityName(activity, state)) {
    case 'math': index = cartBalance(state).balanced ? 3 : state.right?.length ? 2 : 0; break;
    case 'science': index = state.canopy !== 'none' ? 1 : 0; break;
    case 'art':
      if (patternFor(grade)) index = patternReport(state).matched ? 1 : 0;
      else if (state.stamps?.length) index = grade >= 3 && symmetryReport(state).symmetric ? 2 : 1;
      break;
    case 'writing': index = state.text?.trim() ? 1 : 0; break;
    case 'community': { const needs = squareSteps(state).slice(0, -1); index = needs.every(s => s.done) ? 2 : needs.some(s => s.done) ? 1 : 0; break; }
    case 'reading': {
      const found = normalizeReadingFound(state.found);
      index = found.includes(ui?.review) ? 2 : found.length ? 1 : 0;
      break;
    }
    case 'pizza': index = state.plates?.some(n => n > 0) ? (remainingUnits(state) === 0 && (grade < 5 || state.halves) ? 2 : 1) : 0; break;
    case 'chain': index = chainComplete(state, grade) ? 2 : state.chain?.some(Boolean) ? 1 : 0; break;
    case 'beans': index = state.weeks >= 2 ? 2 : state.change !== 'none' ? 1 : 0; break;
    case 'rows': index = state.crates?.length ? 1 : 0; break;
    case 'compass': index = state.done?.length ? 1 : 0; break;
    case 'helpday': index = state.crew?.length ? 1 : 0; break;
    case 'ribbon': index = state.why ? 2 : 0; break;
    case 'tales': index = ui?.phase === 'prove' ? 2 : state.solved?.length ? 1 : 0; break;
  }
  return Math.min(last, Math.max(0, index || 0));
}

const PICTURES = {
  math: ['crate', 'undo', 'math', 'check'], science: ['shade', 'clock', 'science', 'check'],
  art: ['art', 'star', 'turn', 'check'], writing: ['writing', 'writing', 'help', 'check'],
  community: ['map', 'help', 'people', 'check'], reading: ['reading', 'star', 'reading', 'check'],
  pizza: ['people', 'math', 'play', 'check'], chain: ['science', 'math', 'play', 'check'],
  beans: ['science', 'clock', 'star', 'check'], rows: ['crate', 'math', 'people', 'check'],
  compass: ['map', 'map', 'help', 'check'], helpday: ['people', 'check', 'help', 'check'],
  ribbon: ['reading', 'hear', 'next', 'check'], tales: ['reading', 'people', 'reading', 'check'],
};
export function stepPicture(activity, state, index, grade = state?.grade) {
  if (!Number.isInteger(index) || index < 0 || index >= helpSteps(activity, grade).length) return null;
  const name = activityName(activity, state);
  return (name === 'art' && grade >= 3 ? ['art', 'turn', 'star', 'check'] : PICTURES[name])?.[index] ?? null;
}

