// A tiny festival packing story. Saved progress is the same list of collected items.
export const READING_ITEMS = ['key', 'umbrella', 'book'];
export const READING_LABELS = { key: 'Key', umbrella: 'Umbrella', book: 'Book', cup: 'Cup' };

export function normalizeReadingFound(found) {
  return READING_ITEMS.filter(id => Array.isArray(found) && found.includes(id));
}

export function readingStep(found, grade = 1, reviewId = null) {
  const collected = normalizeReadingFound(found);
  const id = READING_ITEMS.includes(reviewId) ? reviewId : READING_ITEMS.find(item => !collected.includes(item));
  if (!id) return null;
  const moments = {
    key: {
      passage: grade < 3 ? 'Sora will lock her door. She packs a key.' : 'Before leaving for the festival, Sora will lock her front door. She packs a key for the lock.',
      question: 'What does Sora pack to lock her door?',
      reason: 'The key fits the lock on Sora’s door.',
      retry: 'Look for the thing that fits a door lock.',
    },
    umbrella: {
      passage: grade < 3 ? 'Rain is coming. Sora packs an umbrella to stay dry.' : 'Rain is expected on the way to the festival. Sora packs an umbrella to keep the rain off her.',
      question: 'What does Sora pack to stay dry?',
      reason: 'The umbrella keeps the rain off Sora.',
      retry: 'Look for the thing that keeps rain off Sora.',
    },
    book: {
      passage: grade < 3 ? 'Sora will read to her friends. She packs a book.' : 'At the festival, Sora plans to read a story to her friends. She packs a book to share at storytime.',
      question: 'What does Sora pack for storytime?',
      reason: 'The book has a story for Sora to read to her friends.',
      retry: 'Look for the thing with a story to read.',
    },
  };
  const moment = moments[id];
  return {
    id, index: READING_ITEMS.indexOf(id), word: READING_LABELS[id].toUpperCase(),
    passage: grade === 0 ? READING_LABELS[id].toUpperCase() : moment.passage,
    question: grade === 0 ? `Put the ${READING_LABELS[id].toUpperCase()} in the bag.` : moment.question,
    reason: grade === 0 ? `This says ${READING_LABELS[id].toUpperCase()}. You packed the ${id}.` : moment.reason,
    retry: grade === 0 ? `Look for ${READING_LABELS[id].toUpperCase()}.` : moment.retry,
  };
}

export function readingChoice(found, choice, grade = 1) {
  const collected = normalizeReadingFound(found);
  const step = readingStep(collected, grade);
  if (!step) return { found: collected, accepted: false, reviewId: null, message: 'Sora’s bag is ready.' };
  if (!READING_LABELS[choice]) return { found: collected, accepted: false, reviewId: null, message: 'Choose one of the pictured items.' };
  if (choice === step.id) return {
    found: normalizeReadingFound([...collected, choice]), accepted: true, reviewId: choice,
    message: `${READING_LABELS[choice]} packed! ${step.reason}`,
  };
  const uses = { key: 'A key fits a lock.', umbrella: 'An umbrella keeps rain off.', book: 'A book has a story.', cup: 'A cup holds a drink.' };
  return {
    found: collected, accepted: false, reviewId: null,
    message: grade === 0 ? `That says ${READING_LABELS[choice].toUpperCase()}. ${step.retry}` : `${uses[choice]} ${step.retry}`,
  };
}

export function readingObjectSVG(id) {
  const art = {
    key: '<g transform="rotate(-28 48 45)"><circle cx="30" cy="31" r="17" fill="#f6c85f"/><circle cx="30" cy="31" r="7" fill="#fff7df"/><path d="M29 48v34h11V71h10V60H40V47" fill="#f6c85f"/></g>',
    umbrella: '<path d="M48 17v62q0 11 10 11t10-11" fill="none"/><path d="M10 44C14 7 82 7 86 44q-12-9-25 0-13-9-26 0-12-9-25 0Z" fill="#91c5f5"/><path d="M35 44Q34 15 48 15q15 1 13 29" fill="#f397a8"/><path d="M10 44q12-9 25 0 13-9 26 0 13-9 25 0" fill="none"/>',
    book: '<path d="M10 24q20-8 38 4 18-12 38-4v51q-20-6-38 5-18-11-38-5Z" fill="#e96163"/><path d="M16 18q17-6 32 6 15-12 32-6v51q-17-6-32 5-15-11-32-5Z" fill="#fff1cf"/><path d="M48 25v49M24 33l14 4m-14 7 14 4m-14 7 14 4m20-22 14-4m-14 15 14-4m-14 15 14-4" fill="none"/>',
    cup: '<path d="M69 29h8c18 0 18 29 0 29H66" fill="#fff1cf"/><path d="M20 25h48v38q0 17-24 17T20 63Z" fill="#79cfc2"/><ellipse cx="44" cy="25" rx="24" ry="6" fill="#fff1cf"/><path d="M17 84h57" fill="none"/>',
  };
  return `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="#253449" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${art[id] || ''}</svg>`;
}
