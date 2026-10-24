// Sora’s story bag (reading): read a part of the story, then pack the picture that fits it.
import { READING_ITEMS, READING_LABELS, readingStep, readingChoice, readingObjectSVG } from '../../reading.js';
import { encounterReady, encounterOpeningDialogue, normalizeEncounterSnapshot } from '../../encounters.js';

const PICTURES = ['key', 'umbrella', 'book', 'cup'];
const READY_LINE = ' All three are packed. Your story is ready to share.';

const question = (state, grade) => readingStep(state.found, grade)?.question ?? '';

function start(snapshot, { chapter = 0, grade = 1 } = {}) {
  return { state: normalizeEncounterSnapshot('reading', snapshot, grade, chapter), ui: { review: null } };
}

function opening(state, ui, grade) {
  if (encounterReady(state)) return encounterOpeningDialogue(state);
  return `Help me pack three things for the festival. ${question(state, grade)}`;
}

function commands(state, ui, grade) {
  const ready = encounterReady(state);
  if (ready) return [
    { id: 'again', label: 'Read again', icon: 'undo' },
    { id: 'finish', label: 'Share story', icon: 'check', finish: true },
  ];
  if (ui.review) return [{ id: 'next', label: 'Next part', icon: 'next' }];
  return PICTURES.map(id => ({ id: `pick-${id}`, label: READING_LABELS[id], art: readingObjectSVG(id), disabled: state.found.includes(id) }));
}

function act(state, ui, action, grade) {
  if (action?.type !== 'command') return { state, ui };
  const { id } = action;
  if (id === 'next') {
    if (!ui.review) return { state, ui };
    return { state, ui: { ...ui, review: null }, line: question(state, grade) };
  }
  if (id === 'again') return { state: { ...state, found: [] }, ui: { ...ui, review: null }, line: 'Let’s read from the start and pack again.' };
  if (!id?.startsWith('pick-') || ui.review || encounterReady(state)) return { state, ui };
  const result = readingChoice(state.found, id.slice(5), grade);
  const next = { ...state, found: result.found };
  return { state: next, ui: { ...ui, review: result.reviewId }, line: result.message + (result.accepted && encounterReady(next) ? READY_LINE : '') };
}

function mountField(host, { grade = 1 } = {}) {
  const root = document.createElement('div');
  root.className = 'story-field';
  root.innerHTML = '<section class="story-page"><p class="story-part"></p><p class="story-passage"></p></section>'
    + '<div class="story-bag" role="group"><p class="story-bag__title"></p>'
    + READING_ITEMS.map(() => '<div class="story-slot"><span class="story-slot__pic" aria-hidden="true"></span><span class="story-slot__label"></span></div>').join('')
    + '</div>';
  host.append(root);
  const page = root.querySelector('.story-page'), part = root.querySelector('.story-part'), passage = root.querySelector('.story-passage');
  const bag = root.querySelector('.story-bag'), bagTitle = root.querySelector('.story-bag__title');
  const slots = [...root.querySelectorAll('.story-slot')].map(el => ({ el, pic: el.children[0], label: el.children[1], id: null }));
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

  function update(state, ui = {}) {
    const ready = encounterReady(state);
    const step = ready ? null : readingStep(state.found, grade, ui.review);
    page.classList.toggle('story-page--ready', ready);
    page.classList.toggle('story-page--packed', Boolean(ui.review) && !ready);
    passage.classList.toggle('story-passage--word', grade === 0 && !ready);
    setText(part, ready ? 'The whole story' : `Part ${step.index + 1} of 3${ui.review ? ' · ✓ Packed' : ''}`);
    setText(passage, ready ? 'Ready for the festival!' : step.passage);
    page.setAttribute('aria-label', ready ? 'Story page: ready for the festival' : `Story page, part ${step.index + 1} of 3`);
    const packed = READING_ITEMS.filter(id => state.found.includes(id));
    setText(bagTitle, `Bag ${packed.length}/3`);
    bag.setAttribute('aria-label', `Sora’s bag, ${packed.length} of 3 packed`);
    slots.forEach((slot, i) => {
      const id = packed[i] ?? null;
      if (slot.id === id) return;
      slot.id = id;
      slot.el.classList.toggle('story-slot--packed', Boolean(id));
      slot.pic.innerHTML = id ? readingObjectSVG(id) : '';
      setText(slot.label, id ? READING_LABELS[id] : 'Empty');
    });
  }

  return { update, destroy() { root.remove(); } };
}

export default {
  kind: 'reading',
  title: 'Pack for the festival',
  help: ['Read the story page.', 'Choose the picture that fits.', 'Read why it belongs.', 'Choose Next part.'],
  start, opening, commands, act, mountField,
};
