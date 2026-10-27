// A tiny festival packing story. Saved progress is the same list of collected items.
// K reads one word ("Key"). Grades 1–2 read a line that names the item. Grades 3–5 read clues that only imply it.
// Every sentence is 56 characters or fewer so a dialogue page never breaks mid-sentence with Bigger words on.
export const READING_ITEMS = ['key', 'umbrella', 'book'];
export const READING_LABELS = { key: 'Key', umbrella: 'Umbrella', book: 'Book', cup: 'Cup', ball: 'Ball', flower: 'Flower' };

export const readingItems = (request = 1) => request === 2 ? ['cup', 'ball', 'flower'] : READING_ITEMS;

export function normalizeReadingFound(found, request = 1) {
  return readingItems(request).filter(id => Array.isArray(found) && found.includes(id));
}

const MOMENTS = {
  ball: { short: 'Sora will play a game. She packs a ball.', clue: 'Sora wants to play a tossing game.', question: 'What does Sora pack for the game?', reason: 'The ball is for the tossing game.', retry: 'Look for the thing to toss.' },
  flower: { short: 'Sora has a gift. She packs a flower.', clue: 'Sora has a blooming gift for a friend.', question: 'What does Sora pack as a gift?', reason: 'The flower is Sora’s gift.', retry: 'Look for the blooming gift.' },
  cup: { short: 'Sora packs a cup for water.', clue: 'Sora wants a drink of water.', question: 'What does Sora pack for her drink?', reason: 'The cup holds Sora’s drink.', retry: 'Look for the thing that holds a drink.' },
  key: {
    short: 'Sora will lock her door. She packs a key.',
    clue: 'Sora’s front door has a lock. She wants to open it when she comes home.',
    question: 'What does Sora pack to lock her door?',
    reason: 'The key fits the lock on Sora’s door.',
    retry: 'Look for the thing that fits a door lock.',
  },
  umbrella: {
    short: 'Rain is coming. Sora packs an umbrella to stay dry.',
    clue: 'Gray clouds roll over the bay. Sora does not want to get wet.',
    question: 'What does Sora pack to stay dry?',
    reason: 'The umbrella keeps the rain off Sora.',
    retry: 'Look for the thing that keeps rain off Sora.',
  },
  book: {
    short: 'Sora will read to her friends. She packs a book.',
    clue: 'At storytime, Sora’s friends sit in a circle. They wait for her to begin.',
    question: 'What does Sora pack for storytime?',
    reason: 'The book has a story for Sora to read to her friends.',
    retry: 'Look for the thing with a story to read.',
  },
};
const CLUE_QUESTION = 'What should Sora pack?';

export function readingStep(found, grade = 1, reviewId = null, request = 1) {
  const items = readingItems(request);
  const collected = normalizeReadingFound(found, request);
  const id = items.includes(reviewId) ? reviewId : items.find(item => !collected.includes(item));
  if (!id) return null;
  const moment = MOMENTS[id], word = READING_LABELS[id];
  if (grade === 0) return {
    id, index: items.indexOf(id), word,
    passage: word,
    question: `Put the ${word} in the bag.`,
    reason: `This says ${word}. ${word} is in the bag!`,
    retry: `Look for ${word}.`,
  };
  const inferred = grade >= 3;
  return {
    id, index: items.indexOf(id), word,
    passage: inferred ? moment.clue : moment.short,
    question: inferred ? CLUE_QUESTION : moment.question,
    reason: moment.reason,
    retry: moment.retry,
  };
}

export function readingChoice(found, choice, grade = 1, request = 1) {
  const collected = normalizeReadingFound(found, request);
  const step = readingStep(collected, grade, null, request);
  if (!step) return { found: collected, accepted: false, reviewId: null, message: 'Sora’s bag is ready.' };
  if (!READING_LABELS[choice]) return { found: collected, accepted: false, reviewId: null, message: 'Choose one of the pictured items.' };
  if (choice === step.id) return {
    found: normalizeReadingFound([...collected, choice], request), accepted: true, reviewId: choice,
    message: `${READING_LABELS[choice]} packed! ${step.reason}`,
  };
  const uses = { key: 'A key fits a lock.', umbrella: 'An umbrella keeps rain off.', book: 'A book has a story.', cup: 'A cup holds a drink.', ball: 'A ball is for games.', flower: 'A flower can be a gift.' };
  return {
    found: collected, accepted: false, reviewId: null,
    message: grade === 0 ? `That says ${READING_LABELS[choice]}. ${step.retry}` : `${uses[choice]} ${step.retry}`,
  };
}

export function readingObjectSVG(id) {
  const art = {
    key: '<g transform="rotate(-28 48 45)"><circle cx="30" cy="31" r="17" fill="#f6c85f"/><circle cx="30" cy="31" r="7" fill="#fff7df"/><path d="M29 48v34h11V71h10V60H40V47" fill="#f6c85f"/></g>',
    umbrella: '<path d="M48 17v62q0 11 10 11t10-11" fill="none"/><path d="M10 44C14 7 82 7 86 44q-12-9-25 0-13-9-26 0-12-9-25 0Z" fill="#91c5f5"/><path d="M35 44Q34 15 48 15q15 1 13 29" fill="#f397a8"/><path d="M10 44q12-9 25 0 13-9 26 0 13-9 25 0" fill="none"/>',
    book: '<path d="M10 24q20-8 38 4 18-12 38-4v51q-20-6-38 5-18-11-38-5Z" fill="#e96163"/><path d="M16 18q17-6 32 6 15-12 32-6v51q-17-6-32 5-15-11-32-5Z" fill="#fff1cf"/><path d="M48 25v49M24 33l14 4m-14 7 14 4m-14 7 14 4m20-22 14-4m-14 15 14-4m-14 15 14-4" fill="none"/>',
    ball: '<circle cx="48" cy="48" r="30" fill="#f397a8"/><path d="M20 48h56M48 18c-14 16-14 44 0 60M48 18c14 16 14 44 0 60"/>',
    flower: '<path d="M48 48v35M48 68q-18-18-25-6 10 14 25 10M48 60q18-18 25-6-10 14-25 10" stroke="#4b8a64"/><g fill="#f397a8"><circle cx="48" cy="25" r="13"/><circle cx="34" cy="37" r="13"/><circle cx="62" cy="37" r="13"/></g><circle cx="48" cy="37" r="8" fill="#f6c85f"/>',
    cup: '<path d="M69 29h8c18 0 18 29 0 29H66" fill="#fff1cf"/><path d="M20 25h48v38q0 17-24 17T20 63Z" fill="#79cfc2"/><ellipse cx="44" cy="25" rx="24" ry="6" fill="#fff1cf"/><path d="M17 84h57" fill="none"/>',
  };
  return `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="#253449" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${art[id] || ''}</svg>`;
}
