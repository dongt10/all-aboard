import {
  KIND, LINES, STORY_COUNT, normalizeRibbon, ribbonReady, ribbonOpening, currentStory, phaseOf,
  answerWhy, placeCard, chooseLesson, nextStory, resetStory, readLine, storyText,
} from '../../ribbon.js';
import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import { speak as speakWords } from '../voice.js';
import { INK, PAPER, PAPER_SHADE, WOOD, LANTERN, SUBJECT_THEME } from '../palette.js';

export { LINES, phaseOf };
export const HELP = [
  'Read the story. Tap a line to hear it.',
  'Choose Hear prompt or Hear choices. Then pick an answer.',
  'Tap the three cards in story order, then a lesson.',
  'When the ribbon is full, choose Share ribbon.',
];

function start(snapshot, { grade = 2, chapter = 1 } = {}) {
  return { state: normalizeRibbon(snapshot, grade, chapter), ui: {} };
}
function commands(state) {
  return [
    { id: 'read', label: 'Read again', icon: 'reading' },
    { id: 'next', label: 'Next story', icon: 'next' },
    { id: 'reset', label: 'Start over', icon: 'undo', disabled: !state.why },
    { id: 'finish', label: 'Share ribbon', icon: 'check', finish: true, disabled: !ribbonReady(state) },
  ];
}

function hearText(state, part) {
  const view = fieldView(state);
  if (part === 'prompt') return view.prompt;
  if (part !== 'choices') return null;
  const choices = view.phase === 'why' ? view.options.map(option => option.label)
    : view.phase === 'order' ? view.cards.filter(card => !card.placed).map(card => card.detail ?? card.caption)
      : view.phase === 'lesson' ? view.lessons.map(lesson => lesson.text) : [];
  return choices.map(text => /[.!?]$/.test(text) ? text : `${text}.`).join(' ');
}

function act(state, ui, action) {
  if (action?.type === 'command') {
    if (action.id === 'read') return { state, ui, line: storyText(state) };
    if (action.id === 'next') {
      const next = nextStory(state);
      return { state: next, ui, line: ribbonOpening(next) };
    }
    if (action.id === 'reset' && state.why) return { state: resetStory(state), ui, line: `${LINES.startOver} ${currentStory(state).question}` };
    return { state, ui };
  }
  if (action?.type !== 'field') return { state, ui };
  const fields = ['line', 'why', 'card', 'lesson', 'hear'].filter(key => Object.hasOwn(action, key));
  if (fields.length !== 1) return { state, ui };
  const key = fields[0];
  if (key === 'hear') {
    const line = hearText(state, action.hear);
    return line ? { state, ui, line } : { state, ui };
  }
  if (key === 'line') {
    const line = readLine(state, action.line);
    return line ? { state, ui, line } : { state, ui };
  }
  const result = key === 'why' ? answerWhy(state, action.why)
    : key === 'card' ? placeCard(state, action.card) : chooseLesson(state, action.lesson);
  return result.line ? { state: result.state, ui, line: result.line } : { state, ui };
}

export function fieldView(state) {
  const story = currentStory(state), phase = phaseOf(state);
  return {
    phase, story: story.id,
    head: `Story ${state.story + 1} of ${STORY_COUNT} · ${story.title}`,
    label: story.title, question: story.question,
    prompt: ribbonOpening(state),
    lines: story.lines.map((text, i) => ({ text, label: readLine(state, i) })),
    options: story.options,
    cards: story.shuffled.map(id => {
      const index = story.cards.findIndex(card => card.id === id), card = story.cards[index];
      return { ...card, placed: index < state.steps, label: `${card.detail ?? card.caption}${index < state.steps ? '. On the ribbon.' : ''}` };
    }),
    lessons: story.lessons,
    band: story.cards.map((card, i) => ({
      number: i + 1, card: i < state.steps ? card : null,
      label: `${['Beginning', 'Middle', 'End'][i]}: ${i < state.steps ? card.detail ?? card.caption : 'Empty'}.`,
    })),
    lesson: state.lesson ? story.lessons.find(lesson => lesson.id === story.lesson) : null,
  };
}

// Transparent, square-edged pictures share the festival palette and existing cast.
const pixel = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
function glyph(name) {
  const blue = SUBJECT_THEME.reading.color;
  const drum = pixel(4, 5, 16, 16, INK) + pixel(6, 3, 12, 20, INK)
    + pixel(5, 8, 14, 12, WOOD) + pixel(7, 4, 10, 2, PAPER) + pixel(5, 6, 14, 2, PAPER_SHADE)
    + pixel(6, 9, 2, 10, LANTERN) + pixel(11, 9, 2, 10, LANTERN) + pixel(16, 9, 2, 10, LANTERN);
  const pictures = {
    sandal: `<path d="M8 3h8v2h3v15h-3v2H6v-2H3V8h2V5h3z" fill="${INK}"/>`
      + pixel(6, 7, 11, 13, WOOD) + pixel(8, 5, 7, 2, PAPER_SHADE)
      + pixel(7, 7, 2, 7, LANTERN) + pixel(9, 12, 6, 2, LANTERN) + pixel(13, 7, 2, 7, LANTERN)
      + pixel(4, 6, 3, 2, INK) + pixel(2, 4, 2, 2, INK) + pixel(16, 5, 5, 2, INK),
    rain: `<path d="M7 2h9v2h4v3h2v6H2V7h2V4h3z" fill="${INK}"/>`
      + pixel(5, 7, 14, 4, PAPER) + pixel(8, 4, 7, 4, PAPER)
      + pixel(4, 16, 2, 5, blue) + pixel(11, 15, 2, 6, blue) + pixel(18, 16, 2, 5, blue),
    wave: `<path d="M9 4h9v3h3v3h-6V8h-3v5h3v3h7v5H2v-7h3V8h4z" fill="${INK}"/>`
      + `<path d="M10 6h7v2h-7v6h5v4h6v2H3v-5h3V9h4z" fill="${blue}"/>`
      + pixel(10, 6, 7, 2, PAPER),
    sleep: `<path d="M6 2h9v2h-4v3H8v6h3v3h6v-3h3v7h-3v2H6v-3H3V5h3z" fill="${INK}"/>`
      + `<path d="M7 4h3v2H7v8h3v3h8v2h-2v1H7v-2H5V6h2z" fill="${LANTERN}"/>`
      + pixel(17, 4, 2, 2, LANTERN) + pixel(20, 8, 2, 2, LANTERN),
    fast: drum + `<path d="M0 2h5v2H0zM0 5h3v2H0zM19 0h5v2h-5zM21 3h3v2h-3z" fill="${INK}"/>`,
    broken: drum + `<path d="M12 8h3v3h-3v3h3v3h-3v5H9v-7h3v-2H9v-4h3z" fill="${INK}"/>`,
    dark: pixel(8, 2, 8, 3, INK) + pixel(5, 5, 14, 14, INK) + pixel(8, 19, 8, 3, INK)
      + pixel(7, 7, 10, 10, PAPER_SHADE) + pixel(10, 8, 4, 8, INK) + pixel(11, 22, 2, 2, INK),
    puddle: `<path d="M7 12h10v2h5v6h-5v2H7v-2H2v-6h5z" fill="${INK}"/>`
      + pixel(7, 14, 10, 6, blue) + pixel(3, 15, 18, 4, blue) + pixel(6, 15, 7, 1, PAPER)
      + pixel(4, 7, 2, 3, blue) + pixel(11, 3, 2, 5, blue) + pixel(18, 7, 2, 3, blue),
    drum,
  };
  return `<svg viewBox="0 0 24 24" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${pictures[name] ?? ''}</svg>`;
}
function cardArt(card) {
  if (card.art === 'run') return figureMarkup('math', { scale: 0.5, step: 1 });
  if (card.id === 'tie') return glyph('sandal') + figureMarkup('math', { scale: 0.375, step: 1 });
  if (card.art === 'drum') return figureMarkup('music', { scale: 0.5 }) + glyph('drum');
  if (card.art === 'stop') return icon('stop', { size: 32 }) + glyph('drum');
  if (card.art === 'together') return figureMarkup('math', { scale: 0.375 })
    + figureMarkup('music', { scale: 0.5, pose: 'joy' }) + figureMarkup('reading', { scale: 0.375 });
  return glyph(card.art);
}

const button = name => `<button type="button" class="ribbon-choice ${name}"><span class="ribbon-choice__pic" aria-hidden="true"></span><span class="ribbon-choice__text"></span><span class="ribbon-choice__check" aria-hidden="true" hidden>✓</span></button>`;
const bandMarkup = () => '<div class="ribbon-band" role="group" aria-label="Beginning, middle, end">'
  + [1, 2, 3].map(n => `<div class="ribbon-slot" role="img"><span class="ribbon-slot__number">${n}</span><span class="ribbon-slot__pic" aria-hidden="true"></span></div>`).join('') + '</div>';

function mountField(host, { dispatch = () => {}, speak = speakWords } = {}) {
  const doc = host.ownerDocument ?? document, root = doc.createElement('div');
  root.className = 'ribbon-field';
  root.innerHTML = '<section class="ribbon-story"><div class="ribbon-heading"><p class="ribbon-head"></p><p class="ribbon-question"></p></div>'
    + '<div class="ribbon-lines" role="group" aria-label="Story lines">'
    + [1, 2, 3, 4, 5].map(n => `<button type="button" class="ribbon-line"><span class="ribbon-line__tag" aria-hidden="true">${n}</span><span class="ribbon-line__text"></span></button>`).join('')
    + '</div><button type="button" class="ribbon-line ribbon-hear-prompt" aria-label="Hear prompt">Hear prompt</button>'
    + '<button type="button" class="ribbon-line ribbon-hear-choices" aria-label="Hear choices">Hear choices</button></section><div class="ribbon-strip">'
    + `<div class="ribbon-phase ribbon-why" role="group">${Array.from({ length: 4 }, () => button('ribbon-option')).join('')}</div>`
    + `<div class="ribbon-phase ribbon-order" role="group" hidden>${Array.from({ length: 3 }, () => button('ribbon-card')).join('')}${bandMarkup()}</div>`
    + `<div class="ribbon-phase ribbon-lessons" role="group" hidden>${Array.from({ length: 4 }, () => button('ribbon-lesson')).join('')}</div>`
    + `<div class="ribbon-phase ribbon-done" role="group" hidden>${bandMarkup()}<div class="ribbon-lesson-tag"><span class="ribbon-lesson-tag__pic" aria-hidden="true"></span><span class="ribbon-lesson-tag__text"></span></div></div>`
    + '</div>';
  host.append(root);
  const storyCard = root.querySelector('.ribbon-story'), head = root.querySelector('.ribbon-head'), question = root.querySelector('.ribbon-question');
  const panels = { why: root.querySelector('.ribbon-why'), order: root.querySelector('.ribbon-order'), lesson: root.querySelector('.ribbon-lessons'), done: root.querySelector('.ribbon-done') };
  const controls = [];
  const lines = [...root.querySelectorAll('.ribbon-lines .ribbon-line')].map((el, i) => {
    const record = { el, key: 'line', value: i, text: el.querySelector('.ribbon-line__text') };
    controls.push(record); return record;
  });
  const hears = ['prompt', 'choices'].map(value => {
    const record = { el: root.querySelector(`.ribbon-hear-${value}`), key: 'hear', value };
    controls.push(record); return record;
  });
  function choices(selector, key, panel) {
    return [...root.querySelectorAll(selector)].map(el => {
      const record = { el, key, panel, text: el.querySelector('.ribbon-choice__text'), pic: el.querySelector('.ribbon-choice__pic'), check: el.querySelector('.ribbon-choice__check'), art: null };
      controls.push(record); return record;
    });
  }
  const options = choices('.ribbon-option', 'why', panels.why), cards = choices('.ribbon-card', 'card', panels.order), lessons = choices('.ribbon-lesson', 'lesson', panels.lesson);
  const slots = [...root.querySelectorAll('.ribbon-slot')].map((el, i) => ({ el, index: i % 3, pic: el.querySelector('.ribbon-slot__pic'), art: null }));
  const tagPic = root.querySelector('.ribbon-lesson-tag__pic'), tagText = root.querySelector('.ribbon-lesson-tag__text');
  tagPic.innerHTML = icon('star');
  const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  const setArt = (record, key, markup) => { if (record.art !== key) { record.art = key; record.pic.innerHTML = markup(); } };
  const available = () => controls.filter(c => !c.panel?.hidden && !c.el.hidden && !c.el.disabled);
  let cursor = lines[0], currentState;
  function setCursor(record) {
    cursor = record;
    controls.forEach(c => { c.el.tabIndex = c === record ? 0 : -1; });
  }
  const focus = record => { setCursor(record); record.el.focus(); };
  const targetControl = event => controls.find(c => c.el.contains(event.target));
  setCursor(cursor);

  function onClick(event) {
    const control = targetControl(event);
    if (!control || !available().includes(control)) return;
    setCursor(control);
    const words = control.key === 'hear' && currentState ? hearText(currentState, control.value) : null;
    dispatch({ type: 'field', [control.key]: control.value });
    // An explicit Hear request works even when automatic reading is off.
    if (words) speak(words);
  }
  function onFocus(event) {
    const control = targetControl(event);
    if (control && available().includes(control)) setCursor(control);
  }
  function onKey(event) {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    const control = targetControl(event), shown = available();
    if (!control || !shown.includes(control)) return;
    const reading = shown.filter(c => c.key === 'line' || c.key === 'hear');
    const strip = shown.filter(c => c.key !== 'line' && c.key !== 'hear');
    let next = control;
    if (reading.includes(control)) {
      const at = reading.indexOf(control), moved = gridMove(at, intent, 1, reading.length);
      next = reading[moved];
      if (intent === 'down' && moved === at && strip.length) next = strip[0];
    } else if (intent === 'up') next = reading.at(-1);
    else next = strip[gridMove(strip.indexOf(control), intent, strip.length, strip.length)];
    // A Down arrow at the bottom belongs to the scene's command menu.
    if (next === control && intent === 'down') return;
    event.preventDefault();
    if (next !== control) focus(next);
  }
  root.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('keydown', onKey);

  function update(state) {
    currentState = state;
    const view = fieldView(state), active = doc.activeElement;
    const hadFocus = controls.some(c => c.el === active);
    root.dataset.phase = view.phase;
    storyCard.setAttribute('aria-label', view.label);
    setText(head, view.head);
    setText(question, view.prompt);
    hears[1].el.hidden = view.phase === 'done';
    for (const [phase, panel] of Object.entries(panels)) {
      panel.hidden = phase !== view.phase;
      if (phase === view.phase) panel.setAttribute('aria-label', view.prompt);
    }
    view.lines.forEach((line, i) => { setText(lines[i].text, line.text); lines[i].el.setAttribute('aria-label', line.label); });
    view.options.forEach((option, i) => {
      const record = options[i]; record.value = option.id;
      setText(record.text, option.label); record.el.setAttribute('aria-label', option.label);
      setArt(record, option.glyph, () => glyph(option.glyph));
    });
    view.cards.forEach((card, i) => {
      const record = cards[i]; record.value = card.id;
      setText(record.text, card.caption); record.el.setAttribute('aria-label', card.label);
      record.el.disabled = card.placed; record.check.hidden = !card.placed;
      record.el.classList.toggle('ribbon-card--placed', card.placed);
      setArt(record, card.art, () => cardArt(card));
    });
    view.lessons.forEach((lesson, i) => {
      const record = lessons[i]; record.value = lesson.id;
      setText(record.text, lesson.text); record.el.setAttribute('aria-label', lesson.text);
      setArt(record, lesson.icon, () => icon(lesson.icon));
    });
    slots.forEach(record => {
      const slot = view.band[record.index];
      record.el.classList.toggle('ribbon-slot--filled', Boolean(slot.card));
      record.el.setAttribute('aria-label', slot.label);
      setArt(record, slot.card?.art ?? '', () => slot.card ? cardArt(slot.card) : '');
    });
    setText(tagText, view.lesson?.text ?? '');
    const shown = available();
    if (!shown.includes(cursor)) cursor = shown.find(c => c.key !== 'line' && c.key !== 'hear') ?? lines.at(-1);
    setCursor(cursor);
    if (hadFocus && doc.activeElement !== cursor.el) cursor.el.focus();
  }

  return {
    update,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

export default {
  kind: KIND, title: 'Sora’s story ribbon', rewardLabel: 'Story ribbon',
  help: HELP, notReadyLine: LINES.notReady,
  start, opening: ribbonOpening, commands, act, mountField,
};
