import { normalizeEncounterSnapshot, encounterReady } from '../../encounters.js';

// A placeholder activity: a "Still setting up" card and a finish that works once a saved creation is ready.
export function stubActivity(kind, title) {
  return {
    kind,
    title,
    help: ['This activity is still being set up.'],
    start(snapshot, { chapter = 0, grade = 1 } = {}) {
      return { state: normalizeEncounterSnapshot(kind, snapshot, grade, chapter), ui: {} };
    },
    opening: () => 'This part of the festival is still being set up.',
    commands: state => [{ id: 'finish', label: 'Finish', icon: 'check', finish: true, disabled: !encounterReady(state) }],
    act: (state, ui) => ({ state, ui }),
    mountField(host) {
      const card = document.createElement('div');
      card.className = 'px-frame stub-field';
      card.style.cssText = 'position:absolute;inset:24px;display:grid;place-items:center;text-align:center;font-size:var(--text-field)';
      card.textContent = 'Still setting up';
      host.append(card);
      return { update() {}, destroy() { card.remove(); } };
    },
  };
}
