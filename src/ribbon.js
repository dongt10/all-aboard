// Sora's story ribbon: read a whole story, explain why, order it, and find its lesson.
import { INK, PAPER, PAPER_SHADE, LANTERN, SUBJECT_THEME } from './ui/palette.js';

export const KIND = 'reading';
export const ACTIVITY = 'ribbon';
export const GRADES_RIBBON = [2];
export const STORY_COUNT = 2;
export const STAMP_RIBBON = 'Some stories have a lesson.';

export const STORIES = [
  {
    id: 'sandal', title: 'Taro’s sandal', who: 'math',
    lines: [
      'Taro ran to the festival.',
      'His sandal was loose, but he kept going.',
      'Splash! He fell in a puddle.',
      'Now Taro sat down and tied his sandal.',
      'Then he walked on, slow and safe.',
    ],
    question: 'Why did Taro fall in the puddle?', why: 'loose',
    options: [
      { id: 'loose', label: 'Loose sandal', glyph: 'sandal' },
      { id: 'rain', label: 'Rain', glyph: 'rain', wrong: 'No rain in the story. Read line 2 again.' },
      { id: 'wave', label: 'A big wave', glyph: 'wave', wrong: 'No big wave in the story. Read line 3 again.' },
      { id: 'sleepy', label: 'Too sleepy', glyph: 'sleep', wrong: 'The story does not say sleepy. Read line 2 again.' },
    ],
    whyYes: 'Yes! His sandal was loose. Now put the story in order.',
    cards: [
      { id: 'run', caption: 'Taro runs', art: 'run' },
      { id: 'splash', caption: 'Big splash', art: 'puddle' },
      { id: 'tie', caption: 'Ties; walks', detail: 'Ties his sandal, then walks safely', art: 'sandal' },
    ],
    shuffled: ['tie', 'run', 'splash'], lesson: 'fix',
    lessons: [
      { id: 'fix', text: 'Fix problems before they grow.', icon: 'star' },
      { id: 'faster', text: 'Run faster.', icon: 'play', wrong: 'Taro fell when he kept running. What did he learn?' },
      { id: 'home', text: 'Stay home on busy days.', icon: 'home', wrong: 'Taro still went to the festival. What did he fix?' },
      { id: 'fun', text: 'Puddles are fun.', icon: 'fill', wrong: 'The splash was a problem. What made Taro safe?' },
    ],
    lessonYes: 'Yes! Fix small problems early. Choose Share ribbon.',
  },
  {
    id: 'drum', title: 'Kiko’s drum', who: 'music',
    lines: [
      'Kiko wanted to play the big drum.',
      'Her first beat was too fast. Boom!',
      'The band could not keep up and stopped.',
      'Kiko took a breath and played slow.',
      'Soon the whole band played together.',
    ],
    question: 'Why did the band stop?', why: 'fast',
    options: [
      { id: 'fast', label: 'Beat too fast', glyph: 'fast' },
      { id: 'broken', label: 'Drum broke', glyph: 'broken', wrong: 'The drum did not break. Read line 2 again.' },
      { id: 'rain', label: 'Rain came', glyph: 'rain', wrong: 'No rain in the story. Read line 2 again.' },
      { id: 'dark', label: 'Lights off', glyph: 'dark', wrong: 'The lights did not go out. Read line 3 again.' },
    ],
    whyYes: 'Yes! The beat was too fast. Now put the story in order.',
    cards: [
      { id: 'drum', caption: 'Kiko drums', art: 'drum' },
      { id: 'stop', caption: 'Band stops', art: 'stop' },
      { id: 'together', caption: 'All together', art: 'together' },
    ],
    shuffled: ['stop', 'together', 'drum'], lesson: 'steady',
    lessons: [
      { id: 'steady', text: 'Take a breath and go steady.', icon: 'clock' },
      { id: 'loud', text: 'Play as loud as you can.', icon: 'hear', wrong: 'The band needed a slower beat. Read line 4 again.' },
      { id: 'hard', text: 'Big drums are too hard.', icon: 'stop', wrong: 'Kiko played the drum in the end. What helped her?' },
      { id: 'fast', text: 'Fast is always best.', icon: 'play', wrong: 'The band could not keep up. Read line 4 again.' },
    ],
    lessonYes: 'Yes! Slow and steady helps a band. Choose Share ribbon.',
  },
];

export const LINES = {
  openingFresh: 'Here is a short story. Read it, then answer my question.',
  order: 'Put the story in order. What happened first?',
  lesson: 'Pick the lesson of the story.',
  openingReady: 'Your ribbon is ready. Share it, or try the next story.',
  notReady: 'The ribbon changed. Fill it again.',
  nextStory: 'A new story! Read it, then answer my question.',
  startOver: 'The ribbon is empty. Read the story again.',
  cardPlaced: (step, caption) => `${['Beginning', 'Middle', 'End'][step]}: ${caption}.${step === 2 ? ' In order! Now pick the lesson.' : ''}`,
  wrongCard: step => `Not yet. What happened ${['first', 'next', 'last'][step]}?`,
};

const num = value => typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(num(value)) ? num(value) : 0));
const isStory = value => Number.isInteger(value) && value >= 0 && value < STORY_COUNT;
const isRibbon = input => Boolean(input) && typeof input === 'object' && !Array.isArray(input)
  && input.kind === KIND && input.activity === ACTIVITY;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function storyProgress(s = {}) {
  const why = s.why === true;
  const steps = why && Number.isInteger(s.steps) ? clamp(s.steps, 0, 3) : 0;
  return { why, steps, lesson: steps === 3 && s.lesson === true };
}

export function normalizeRibbon(input, grade = 2, chapter = 1) {
  const s = isRibbon(input) ? input : {}, story = isStory(s.story) ? s.story : 0;
  // The active story lives at the top level for older saves. Keep only the other story's draft.
  const storyDrafts = {};
  for (let i = 0; i < STORY_COUNT; i++) {
    const draft = s.storyDrafts?.[i];
    if (i !== story && draft && typeof draft === 'object' && !Array.isArray(draft)) {
      const progress = storyProgress(draft);
      if (progress.why) storyDrafts[i] = progress;
    }
  }
  return {
    kind: KIND, activity: ACTIVITY, grade: Math.round(clamp(grade, 0, 5)), chapter: chapter === 1 ? 1 : 0,
    found: [], story, ...storyProgress(s),
    ...(Object.keys(storyDrafts).length ? { storyDrafts } : {}),
  };
}

export function cleanRibbonCreation(input) {
  return isRibbon(input) ? normalizeRibbon(input, input.grade, input.chapter === 1 ? 1 : 0) : null;
}

export const currentStory = s => STORIES[isStory(s?.story) ? s.story : 0];
export function phaseOf(s) {
  if (s?.why !== true) return 'why';
  if (s.steps !== 3) return 'order';
  return s.lesson === true ? 'done' : 'lesson';
}

export function ribbonReady(s) {
  return isRibbon(s) && GRADES_RIBBON.includes(s.grade) && s.chapter === 1 && isStory(s.story)
    && s.why === true && s.steps === 3 && s.lesson === true;
}

export function ribbonOpening(s) {
  if (ribbonReady(s)) return LINES.openingReady;
  const phase = phaseOf(s);
  if (phase === 'order') return `Put the story in order. What happened ${['first', 'next', 'last'][s.steps] ?? 'first'}?`;
  return phase === 'lesson' ? LINES.lesson : currentStory(s).question;
}

const ignored = state => ({ state, right: false, line: null });
export function answerWhy(s, id) {
  if (phaseOf(s) !== 'why') return ignored(s);
  const story = currentStory(s), option = story.options.find(option => option.id === id);
  if (!option) return ignored(s);
  if (id !== story.why) return { state: s, right: false, line: option.wrong };
  return { state: { ...s, why: true, steps: 0, lesson: false }, right: true, line: story.whyYes };
}

export function placeCard(s, id) {
  if (phaseOf(s) !== 'order') return ignored(s);
  const story = currentStory(s), card = story.cards.find(card => card.id === id);
  if (!card || !Number.isInteger(s.steps) || s.steps < 0 || s.steps > 2) return ignored(s);
  if (id !== story.cards[s.steps].id) return { state: s, right: false, line: LINES.wrongCard(s.steps) };
  return { state: { ...s, steps: s.steps + 1, lesson: false }, right: true, line: LINES.cardPlaced(s.steps, card.detail ?? card.caption) };
}

export function chooseLesson(s, id) {
  if (phaseOf(s) !== 'lesson') return ignored(s);
  const story = currentStory(s), lesson = story.lessons.find(lesson => lesson.id === id);
  if (!lesson) return ignored(s);
  if (id !== story.lesson) return { state: s, right: false, line: lesson.wrong };
  return { state: { ...s, lesson: true }, right: true, line: story.lessonYes };
}

export function resetStory(s) {
  return !s.why && s.steps === 0 && !s.lesson ? s : { ...s, why: false, steps: 0, lesson: false };
}
export function nextStory(s) {
  const current = normalizeRibbon(s, s.grade, s.chapter);
  const story = (current.story + 1) % STORY_COUNT;
  const storyDrafts = { ...current.storyDrafts, [current.story]: storyProgress(current) };
  return normalizeRibbon({ ...current, story, ...storyProgress(storyDrafts[story]), storyDrafts }, s.grade, s.chapter);
}
export function readLine(s, i) {
  const lines = currentStory(s).lines;
  return Number.isInteger(i) && i >= 0 && i < lines.length ? `Line ${i + 1}: ${lines[i]}` : null;
}
export const storyText = s => currentStory(s).lines.join(' ');

// The ribbon is visible even before it is full. Only validated values reach the drawing.
export function ribbonCreationMarkup(input) {
  const s = normalizeRibbon(input, input?.grade, input?.chapter), story = currentStory(s);
  const label = `Your story ribbon: ${story.title}. ${s.lesson ? 'In order with its lesson.' : `${s.steps} of 3 cards.`}`;
  const blue = SUBJECT_THEME.reading.color;
  const cards = story.cards.map((card, i) => {
    const x = 9 + i * 22, filled = i < s.steps;
    return `<rect x="${x}" y="22" width="16" height="16" fill="${esc(filled ? PAPER : PAPER_SHADE)}" stroke="${esc(INK)}"${filled ? '' : ' stroke-dasharray="2 2"'}/>`
      + `<text x="${x + 8}" y="34" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="12" fill="${esc(INK)}">${i + 1}</text>`;
  }).join('');
  const star = s.lesson ? `<path d="M86 24h2v4h4v2h-2v2h1v4h-2v-2h-4v2h-2v-4h1v-2h-2v-2h4z" fill="${esc(INK)}"/>` : '';
  return `<svg class="creation creation--reading creation--ribbon" viewBox="0 0 100 65" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges">`
    + `<path d="M1 18h72v24H1v-6h3V24H1z" fill="${esc(blue)}" stroke="${esc(INK)}"/>`
    + `<path d="M7 20h64M7 40h64" stroke="${esc(PAPER)}" stroke-dasharray="2 2"/>${cards}`
    + `<path d="M73 28h7v4h-7z" fill="${esc(INK)}"/><rect x="85" y="13" width="4" height="6" fill="${esc(INK)}"/>`
    + `<path d="M81 18h12v3h3v22h-3v3H81v-3h-3V21h3z" fill="${esc(s.lesson ? LANTERN : PAPER_SHADE)}" stroke="${esc(INK)}"${s.lesson ? '' : ' stroke-dasharray="2 2"'}/>`
    + `<path d="M85 46h4v7h-4z" fill="${esc(INK)}"/>${star}</svg>`;
}
