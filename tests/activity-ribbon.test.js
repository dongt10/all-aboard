import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ribbon, { HELP, fieldView } from '../src/ui/activities/ribbon.js';
import {
  KIND, ACTIVITY, GRADES_RIBBON, STORY_COUNT, STORIES, STAMP_RIBBON, LINES,
  normalizeRibbon, cleanRibbonCreation, ribbonReady, ribbonOpening, phaseOf, currentStory,
  answerWhy, placeCard, chooseLesson, nextStory, resetStory, readLine, storyText, ribbonCreationMarkup,
} from '../src/ribbon.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands } from '../src/ui/menu.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { routeIntent } from '../src/ui/input.js';
import { FIGURE_IDS } from '../src/ui/figures/index.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { controlStyle, declarations } from './helpers/css.js';

const cmd = id => ({ type: 'command', id });
const field = data => ({ type: 'field', ...data });
const snapshot = (parts = {}) => ({ kind: 'reading', activity: 'ribbon', grade: 2, chapter: 1, found: [], story: 0, why: false, steps: 0, lesson: false, ...parts });
const ready = (story = 0) => snapshot({ story, why: true, steps: 3, lesson: true });
const step = (session, action) => ribbon.act(session.state, session.ui, action);
const freeze = session => {
  Object.freeze(session.state.found); Object.freeze(session.state); Object.freeze(session.ui);
  return session;
};
function fits(text) {
  assert.equal(typeof text, 'string');
  for (const sentence of text.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  for (const limit of Object.values(PAGE_CHARS)) {
    const pages = paginate(text, limit);
    assert.ok(pages.every(page => page.length <= limit));
    assert.equal(pages.join(' '), text);
  }
}
function contract(state, ui) {
  const commands = ribbon.commands(state, ui);
  assert.equal(commands.length, 4);
  assert.equal(new Set(commands.map(command => command.id)).size, 4);
  assert.deepEqual(commands.map(({ id, label, icon }) => ({ id, label, icon })), [
    { id: 'read', label: 'Read again', icon: 'reading' },
    { id: 'next', label: 'Next story', icon: 'next' },
    { id: 'reset', label: 'Start over', icon: 'undo' },
    { id: 'finish', label: 'Share ribbon', icon: 'check' },
  ]);
  assert.ok(commands.every(command => command.label.length <= 12 && ICON_NAMES.includes(command.icon)));
  assert.equal(commands.filter(command => command.finish).length, 1);
  assert.deepEqual(commands.at(-1), { id: 'finish', label: 'Share ribbon', icon: 'check', finish: true, disabled: !ribbonReady(state) });
  assert.equal(commands[2].disabled, !state.why);
  assert.equal(arrangeCommands(commands)[3], commands.at(-1));
  fits(ribbon.opening(state, ui));
  return commands;
}
const phases = story => [
  snapshot({ story }), snapshot({ story, why: true }), snapshot({ story, why: true, steps: 1 }),
  snapshot({ story, why: true, steps: 2 }), snapshot({ story, why: true, steps: 3 }), ready(story),
];

test('two cast stories preserve all five lines, options, cards, shuffles and lessons', () => {
  assert.equal(KIND, 'reading'); assert.equal(ACTIVITY, 'ribbon');
  assert.deepEqual(GRADES_RIBBON, [2]); assert.equal(STORY_COUNT, 2); assert.equal(STORIES.length, 2);
  const expected = [
    {
      id: 'sandal', who: 'math', question: 'Why did Taro fall in the puddle?',
      lines: ['Taro ran to the festival.', 'His sandal was loose, but he kept going.', 'Splash! He fell in a puddle.', 'Now Taro sat down and tied his sandal.', 'Then he walked on, slow and safe.'],
      options: ['Loose sandal', 'Rain', 'A big wave', 'Too sleepy'],
      cards: ['Taro runs', 'Big splash', 'Ties sandal'], shuffled: ['tie', 'run', 'splash'],
      lessons: ['Fix problems before they grow.', 'Run faster.', 'Stay home on busy days.', 'Puddles are fun.'],
      whyYes: 'Yes! His sandal was loose. Now put the story in order.',
      lessonYes: 'Yes! Fix small problems early. Choose Share ribbon.',
    },
    {
      id: 'drum', who: 'music', question: 'Why did the band stop?',
      lines: ['Kiko wanted to play the big drum.', 'Her first beat was too fast. Boom!', 'The band could not keep up and stopped.', 'Kiko took a breath and played slow.', 'Soon the whole band played together.'],
      options: ['Beat too fast', 'Drum broke', 'Rain came', 'Lights off'],
      cards: ['Kiko drums', 'Band stops', 'All together'], shuffled: ['stop', 'together', 'drum'],
      lessons: ['Take a breath and go steady.', 'Play as loud as you can.', 'Big drums are too hard.', 'Fast is always best.'],
      lessonYes: 'Yes! Slow and steady helps a band. Choose Share ribbon.',
    },
  ];
  for (const [i, story] of STORIES.entries()) {
    const spec = expected[i];
    for (const key of ['id', 'who', 'question', 'lines', 'shuffled', 'lessonYes']) assert.deepEqual(story[key], spec[key]);
    if (spec.whyYes) assert.equal(story.whyYes, spec.whyYes);
    assert.ok(FIGURE_IDS.includes(story.who));
    assert.deepEqual(story.options.map(option => option.label), spec.options);
    assert.deepEqual(story.cards.map(card => card.caption), spec.cards);
    assert.deepEqual(story.lessons.map(lesson => lesson.text), spec.lessons);
    assert.equal(new Set(story.options.map(option => option.id)).size, 4);
    assert.equal(new Set(story.lessons.map(lesson => lesson.id)).size, 4);
    assert.deepEqual([...story.shuffled].sort(), story.cards.map(card => card.id).sort());
    assert.notDeepEqual(story.shuffled, story.cards.map(card => card.id));
    assert.equal(story.options.filter(option => option.id === story.why).length, 1);
    assert.equal(story.lessons.filter(lesson => lesson.id === story.lesson).length, 1);
    assert.ok(story.lines.every(line => line.length <= 40));
    assert.ok(story.options.every(option => option.label.length <= 13 && option.glyph));
    assert.ok(story.lessons.every(lesson => lesson.text.length <= 30 && ICON_NAMES.includes(lesson.icon)));
  }
  assert.equal(STORIES[0].options[1].wrong, 'No rain in the story. Read line 2 again.');
  assert.deepEqual(STORIES[0].lessons.map(lesson => lesson.icon), ['star', 'play', 'home', 'fill']);
  assert.equal(STORIES[1].lessons[0].icon, 'clock');
});

test('standalone contract starts fresh from legacy reading saves and resumes every phase', () => {
  const fresh = ribbon.start();
  assert.deepEqual(fresh, { state: snapshot(), ui: {} });
  assert.equal(ribbon.kind, 'reading'); assert.equal(ribbon.title, 'Sora’s story ribbon');
  assert.equal(ribbon.rewardLabel, 'Story ribbon');
  for (const method of ['start', 'opening', 'commands', 'act', 'mountField']) assert.equal(typeof ribbon[method], 'function');
  for (const grade of [0, 1, 2]) {
    for (const legacy of [
      { kind: 'reading', grade, found: ['key', 'umbrella', 'book'] },
      { ...ready(), grade, activity: undefined },
      { ...ready(), activity: 'tales' }, { ...ready(), kind: 'math' },
    ]) assert.deepEqual(ribbon.start(legacy, { grade: 2, chapter: 1 }), fresh);
  }
  for (let story = 0; story < STORY_COUNT; story++) for (const state of phases(story)) {
    const resumed = ribbon.start(state);
    assert.deepEqual(resumed.state, state); assert.deepEqual(resumed.ui, {});
    contract(resumed.state, resumed.ui);
    assert.equal(ribbon.opening(state), ribbonOpening(state));
  }
  assert.deepEqual(phases(0).map(phaseOf), ['why', 'order', 'order', 'order', 'lesson', 'done']);
  assert.equal(ribbon.opening(fresh.state), 'Here is a short story. Read it, then answer my question.');
  assert.equal(ribbonOpening(phases(0)[1]), 'Put the story in order. What happened first?');
  assert.equal(ribbonOpening(phases(0)[4]), 'Pick the lesson of the story.');
  assert.equal(ribbonOpening(ready()), 'Your ribbon is ready. Share it, or try the next story.');
});

test('normalization rejects foreign shapes, bounds numbers, and preserves only saved fields', () => {
  const junk = [null, undefined, 2, 'ribbon', [], {}, Symbol('junk'), { kind: 'reading' }, { kind: 'reading', activity: 'story' }, { kind: 'math', activity: 'ribbon' }];
  for (const value of junk) {
    assert.equal(cleanRibbonCreation(value), null);
    assert.deepEqual(normalizeRibbon(value), snapshot());
  }
  for (const bad of [-1, 2, 99, Infinity, NaN, 0.5, '1', {}, null, Symbol('story')]) {
    assert.equal(normalizeRibbon(snapshot({ story: bad })).story, 0);
  }
  for (const [grade, expected] of [[-8, 0], [12, 5], [2.7, 3], ['2', 2], [Infinity, 0], [NaN, 0], [{}, 0], [Symbol('grade'), 0]]) {
    const s = normalizeRibbon(ready(), grade, 1);
    assert.equal(s.grade, expected); assert.deepEqual(cleanRibbonCreation(s), s);
  }
  for (const chapter of [0, 2, -2, '1', null, undefined, NaN, Infinity]) {
    const s = cleanRibbonCreation({ ...ready(), chapter });
    assert.equal(s.chapter, 0); assert.equal(s.grade, 2); assert.equal(ribbonReady(s), false);
    assert.deepEqual(normalizeRibbon(s, s.grade, s.chapter), s);
  }
  for (const bad of ['3', null, undefined, NaN, Infinity, {}, Symbol('steps'), 1.5]) {
    assert.equal(normalizeRibbon(snapshot({ why: true, steps: bad, lesson: true })).steps, 0);
  }
  assert.equal(normalizeRibbon(snapshot({ why: true, steps: 99 })).steps, 3);
  assert.equal(normalizeRibbon(snapshot({ why: true, steps: -5 })).steps, 0);
  const input = Object.freeze({ ...ready(1), found: Object.freeze(['book']), phase: 'done', title: '<script>', stray: true });
  const normalized = normalizeRibbon(input);
  assert.deepEqual(normalized, ready(1));
  assert.deepEqual(input.found, ['book']);
  assert.deepEqual(Object.keys(normalized).sort(), Object.keys(snapshot()).sort());
});

test('normalization enforces phase prerequisites and round-trips at every grade and chapter', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) for (const chapter of [0, 1]) {
    for (const story of [0, 1]) for (const why of [false, true, 1, 'true']) {
      for (const steps of [0, 1, 2, 3]) for (const lesson of [false, true, 1, 'true']) {
        const s = normalizeRibbon(snapshot({ story, why, steps, lesson }), grade, chapter);
        assert.equal(s.grade, grade); assert.equal(s.chapter, chapter);
        assert.equal(s.why, why === true);
        assert.equal(s.steps, why === true ? steps : 0);
        assert.equal(s.lesson, why === true && steps === 3 && lesson === true);
        assert.deepEqual(normalizeRibbon(s, grade, chapter), s);
        assert.deepEqual(cleanRibbonCreation(s), s);
        assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
      }
    }
  }
});

test('ready strictly requires grade 2, chapter 1, a real story and all three tasks', () => {
  for (const story of [0, 1]) {
    const s = ready(story); assert.equal(ribbonReady(s), true);
    for (const patch of [
      { kind: 'math' }, { activity: undefined }, { activity: 'tales' }, { chapter: 0 }, { chapter: '1' },
      { story: -1 }, { story: 2 }, { story: '0' }, { story: undefined },
      { why: false }, { why: 1 }, { steps: 0 }, { steps: 1 }, { steps: 2 }, { steps: 4 }, { steps: '3' },
      { lesson: false }, { lesson: 1 }, ...[0, 1, 3, 4, 5, 2.5, '2', undefined].map(grade => ({ grade })),
    ]) {
      assert.equal(ribbonReady({ ...s, ...patch }), false, JSON.stringify(patch));
      assert.equal(ribbon.commands({ ...s, ...patch }).at(-1).disabled, true);
    }
  }
  for (const s of [null, undefined, [], {}, 'ribbon']) assert.equal(ribbonReady(s), false);
});

for (const [index, story] of STORIES.entries()) test(`${story.id}: wrong tries, why, three cards, lesson, reread, reset and replay`, () => {
  let s = freeze(ribbon.start(snapshot({ story: index })));
  assert.equal(currentStory(s.state), story);
  contract(s.state, s.ui);
  for (const option of story.options.filter(option => option.id !== story.why)) {
    const wrong = step(s, field({ why: option.id }));
    assert.equal(wrong.state, s.state); assert.equal(wrong.ui, s.ui); fits(wrong.line);
    assert.equal(wrong.line, option.wrong);
  }
  const answered = step(s, field({ why: story.why }));
  assert.notEqual(answered.state, s.state); assert.equal(answered.ui, s.ui); fits(answered.line);
  assert.equal(answered.line, story.whyYes); assert.equal(s.state.why, false);
  s = freeze(answered); assert.equal(phaseOf(s.state), 'order');
  for (const [i, card] of story.cards.entries()) {
    contract(s.state, s.ui);
    for (const other of story.cards.filter(other => other.id !== card.id)) {
      const wrong = step(s, field({ card: other.id }));
      assert.equal(wrong.state, s.state); assert.equal(wrong.ui, s.ui); fits(wrong.line);
      assert.equal(wrong.line, `Not yet. What happened ${['first', 'next', 'last'][i]}?`);
    }
    const placed = step(s, field({ card: card.id })); fits(placed.line);
    assert.equal(placed.line, `${['Beginning', 'Middle', 'End'][i]}: ${card.caption}.${i === 2 ? ' In order! Now pick the lesson.' : ''}`);
    assert.equal(placed.state.steps, i + 1); assert.equal(s.state.steps, i);
    assert.equal(placed.state.lesson, false); assert.equal(ribbonReady(placed.state), false);
    s = freeze(placed);
    assert.deepEqual(cleanRibbonCreation(s.state), s.state);
    assert.deepEqual(fieldView(s.state).band.map(slot => slot.card?.id), story.cards.map((card, at) => at <= i ? card.id : undefined));
  }
  assert.equal(phaseOf(s.state), 'lesson');
  for (const lesson of story.lessons.filter(lesson => lesson.id !== story.lesson)) {
    const wrong = step(s, field({ lesson: lesson.id }));
    assert.equal(wrong.state, s.state); assert.equal(wrong.ui, s.ui); fits(wrong.line);
    assert.equal(wrong.line, lesson.wrong);
  }
  s = freeze(step(s, field({ lesson: story.lesson })));
  assert.equal(s.line, story.lessonYes); fits(s.line);
  assert.equal(phaseOf(s.state), 'done'); assert.equal(ribbonReady(s.state), true);
  assert.deepEqual(s.state, ready(index)); contract(s.state, s.ui);
  for (let i = 0; i < 5; i++) {
    const read = step(s, field({ line: i }));
    assert.equal(read.state, s.state); assert.equal(read.ui, s.ui); fits(read.line);
    assert.equal(read.line, `Line ${i + 1}: ${story.lines[i]}`);
  }
  const reread = step(s, cmd('read'));
  assert.equal(reread.state, s.state); assert.equal(reread.ui, s.ui);
  assert.equal(reread.line, story.lines.join(' ')); fits(reread.line);
  const reset = step(s, cmd('reset')); fits(reset.line);
  assert.deepEqual(reset.state, snapshot({ story: index })); assert.equal(reset.ui, s.ui);
  assert.equal(reset.line, 'The ribbon is empty. Read the story again.');
  const next = step(s, cmd('next')); fits(next.line);
  assert.deepEqual(next.state, snapshot({ story: (index + 1) % 2 })); assert.equal(next.ui, s.ui);
  assert.equal(next.line, 'A new story! Read it, then answer my question.');
});

test('stale and malformed actions cannot skip phases or change state or ui identities', () => {
  for (const story of [0, 1]) for (const state of phases(story)) {
    const s = freeze({ state, ui: { phase: 'done', story: 99 } });
    const tale = currentStory(state), phase = phaseOf(state);
    const actions = [null, undefined, {}, { type: 'unknown' }, cmd('unknown'), cmd('finish'), cmd(0),
      field({ why: '__proto__' }), field({ card: 'constructor' }), field({ lesson: 'foreign' }),
      field({ line: 0, why: tale.why }), field({ why: tale.why, card: tale.cards[0].id }),
      ...[-1, 5, 1.5, '0', null, undefined, NaN, Infinity, {}, Symbol('line')].map(line => field({ line })),
    ];
    if (phase !== 'why') actions.push(field({ why: tale.why }));
    if (phase !== 'order') actions.push(field({ card: tale.cards[0].id }));
    if (phase !== 'lesson') actions.push(field({ lesson: tale.lesson }));
    if (!state.why) actions.push(cmd('reset'));
    for (const action of actions) {
      const result = step(s, action);
      assert.deepEqual(result, { state, ui: s.ui });
      assert.equal(result.state, state); assert.equal(result.ui, s.ui);
    }
    for (let line = 0; line < 5; line++) {
      const result = step(s, field({ line }));
      assert.equal(result.state, state); assert.equal(result.ui, s.ui); fits(result.line);
    }
    assert.equal(step(s, cmd('read')).state, state);
    assert.deepEqual(step(s, cmd('next')).state, snapshot({ story: (story + 1) % 2 }));
    assert.equal(phaseOf(state), phase);
  }
});

test('pure helpers ignore wrong-phase input and preserve replay identity when nothing changes', () => {
  const fresh = Object.freeze(snapshot()), done = Object.freeze(ready());
  for (const result of [answerWhy(fresh, 'bad'), answerWhy(done, 'loose'), placeCard(fresh, 'run'), chooseLesson(fresh, 'fix'), chooseLesson(done, 'fix')]) {
    assert.equal(result.right, false); assert.equal(result.line, null);
    assert.ok(result.state === fresh || result.state === done);
  }
  assert.equal(resetStory(fresh), fresh);
  assert.deepEqual(resetStory(done), fresh);
  assert.deepEqual(nextStory(nextStory(fresh)), fresh);
  assert.equal(currentStory({ story: 'bad' }), STORIES[0]);
  for (const invalid of [-1, 5, 0.5, '0', {}, Symbol('line')]) assert.equal(readLine(fresh, invalid), null);
  assert.equal(storyText(fresh), STORIES[0].lines.join(' '));
});

test('every child-facing sentence and field label fits, including both sets of wrong feedback', () => {
  assert.deepEqual(HELP, ['Read the story. Tap a line to hear it.', 'Answer the why question. Tap one picture.', 'Tap the three cards in story order, then a lesson.', 'When the ribbon is full, choose Share ribbon.']);
  assert.equal(ribbon.help, HELP); assert.equal(ribbon.notReadyLine, 'The ribbon changed. Fill it again.');
  assert.equal(STAMP_RIBBON, 'A story has a beginning, middle, end, and a lesson.');
  for (const line of [...HELP, STAMP_RIBBON, ...Object.values(LINES).filter(value => typeof value === 'string')]) fits(line);
  for (const story of STORIES) {
    for (const text of [story.title, story.question, story.whyYes, story.lessonYes, ...story.lines,
      ...story.options.flatMap(option => [option.label, ...(option.wrong ? [option.wrong] : [])]),
      ...story.lessons.flatMap(lesson => [lesson.text, ...(lesson.wrong ? [lesson.wrong] : [])]),
    ]) fits(text);
  }
  for (const story of [0, 1]) for (const state of phases(story)) {
    const view = fieldView(state);
    for (const text of [view.head, view.label, view.question, view.prompt, ...view.lines.flatMap(line => [line.text, line.label]),
      ...view.cards.flatMap(card => [card.caption, card.label]), ...view.band.map(slot => slot.label),
    ]) fits(text);
    assert.equal(view.lines.length, 5);
    assert.deepEqual(view.lines.map(line => line.text), STORIES[story].lines);
  }
});

test('creation SVG always draws a ribbon, its numbered slots and its earned lesson star safely', () => {
  for (const story of [0, 1]) for (const state of phases(story)) {
    const markup = ribbonCreationMarkup(state);
    assert.match(markup, /^<svg class="creation creation--reading creation--ribbon"/);
    assert.match(markup, /viewBox="0 0 100 65" role="img" aria-label="/);
    assert.equal((markup.match(/<svg/g) ?? []).length, 1);
    assert.equal((markup.match(/width="16" height="16"/g) ?? []).length, 3);
    assert.equal((markup.match(/stroke-dasharray="2 2"/g) ?? []).length, 3 - state.steps + (state.lesson ? 0 : 1) + 1);
    for (const n of [1, 2, 3]) assert.match(markup, new RegExp(`>${n}</text>`));
    assert.doesNotMatch(markup, /<script|onload|NaN|Infinity|undefined|<image|<filter|<linearGradient/);
    if (state.lesson) assert.ok(markup.includes(`Your story ribbon: ${STORIES[story].title}. In order with its lesson.`));
    fits(/aria-label="([^"]+)"/.exec(markup)[1]);
  }
  const attack = '<script onload="bad">&\'';
  for (const junk of [null, undefined, {}, [], 42, 'bad', Symbol('creation'), { ...ready(), story: attack, title: attack, steps: attack }]) {
    assert.doesNotMatch(ribbonCreationMarkup(junk), /<script|onload|NaN|Infinity|undefined/);
    assert.match(ribbonCreationMarkup(junk), /creation--ribbon/);
  }
  const title = STORIES[0].title;
  try {
    STORIES[0].title = attack;
    const markup = ribbonCreationMarkup(ready());
    assert.ok(markup.includes('&lt;script onload=&quot;bad&quot;&gt;&amp;&#39;'));
    assert.doesNotMatch(markup, /<script|aria-label="[^"]*"bad/);
  } finally { STORIES[0].title = title; }
});

function mount() {
  const doc = new Doc(), host = doc.createElement('section'); doc.body.append(host);
  let session = ribbon.start(); const actions = [];
  const mounted = ribbon.mountField(host, { grade: 2, dispatch(action) {
    actions.push(action); session = step(session, action); mounted.update(session.state, session.ui);
  } });
  mounted.update(session.state, session.ui);
  return { doc, host, actions, mounted, root: host.children[0], get session() { return session; }, set(sessionNext) { session = sessionNext; mounted.update(session.state, session.ui); } };
}
const visible = button => {
  for (let at = button; at; at = at.parentElement) if (at.hidden) return false;
  return !button.disabled;
};
const arrow = (button, key) => { const event = new Event('keydown', { key }); button.dispatchEvent(event); return event; };

test('mounted field keeps lines and buttons, displays only the active strip, and recovers focus', () => {
  const env = mount(), { root, doc, mounted, host } = env;
  const buttons = root.querySelectorAll('button'), lines = root.querySelectorAll('.ribbon-line');
  const options = root.querySelectorAll('.ribbon-option'), cards = root.querySelectorAll('.ribbon-card'), lessons = root.querySelectorAll('.ribbon-lesson');
  const panels = root.querySelectorAll('.ribbon-phase');
  const checkPhase = phase => {
    assert.equal(root.dataset.phase, phase); assert.equal(panels.filter(panel => !panel.hidden).length, 1);
    assert.ok(lines.every(visible)); assert.deepEqual(root.querySelectorAll('button'), buttons);
    assert.equal(buttons.filter(button => button.tabIndex === 0).length, 1);
    assert.ok(visible(buttons.find(button => button.tabIndex === 0)));
    for (const button of buttons.filter(visible)) fits(button.getAttribute('aria-label'));
  };
  checkPhase('why');
  assert.equal(root.querySelector('.ribbon-head').textContent, 'Story 1 of 2 · Taro’s sandal');
  assert.equal(root.querySelector('.ribbon-question').textContent, 'Why did Taro fall in the puddle?');
  assert.deepEqual(lines.map(line => line.tabIndex), [0, -1, -1, -1, -1]);
  options[1].focus(); options[1].querySelector('.ribbon-choice__text').click();
  assert.equal(env.session.state.why, false); assert.equal(doc.activeElement, options[1]);
  options[0].focus(); options[0].click(); checkPhase('order');
  assert.equal(doc.activeElement, cards[0]);
  assert.equal(root.querySelector('.ribbon-question').hidden, true);
  assert.deepEqual(cards.map(card => card.querySelector('.ribbon-choice__text').textContent), ['Ties sandal', 'Taro runs', 'Big splash']);
  assert.match(cards[1].querySelector('.ribbon-choice__pic').innerHTML, /figure--math.*background-position:0px/);
  for (const index of [1, 2, 0]) {
    cards[index].focus(); cards[index].click();
    assert.equal(cards[index].disabled, true);
    assert.equal(cards[index].querySelector('.ribbon-choice__check').hidden, false);
  }
  checkPhase('lesson'); assert.equal(doc.activeElement, lessons[0]);
  assert.equal(root.querySelector('.ribbon-order').querySelectorAll('.ribbon-slot--filled').length, 3);
  lessons[1].focus(); lessons[1].click(); checkPhase('lesson');
  lessons[0].focus(); lessons[0].click(); checkPhase('done');
  assert.equal(doc.activeElement, lines[4]);
  assert.equal(root.querySelector('.ribbon-lesson-tag__text').textContent, 'Fix problems before they grow.');
  assert.equal(root.querySelector('.ribbon-done').querySelectorAll('.ribbon-slot--filled').length, 3);
  lines[1].querySelector('.ribbon-line__text').click();
  assert.equal(env.session.line, 'Line 2: His sandal was loose, but he kept going.');
  const outside = doc.createElement('button'); doc.body.append(outside); outside.focus();
  env.set(step(env.session, cmd('next'))); checkPhase('why');
  assert.equal(doc.activeElement, outside);
  assert.equal(root.querySelector('.ribbon-head').textContent, 'Story 2 of 2 · Kiko’s drum');
  assert.equal(root.querySelector('.ribbon-question').textContent, 'Why did the band stop?');
  assert.equal(lines[0].querySelector('.ribbon-line__text').textContent, STORIES[1].lines[0]);
  assert.equal(options[0].getAttribute('aria-label'), 'Beat too fast');
  options[0].click();
  assert.deepEqual(env.actions.at(-1), field({ why: 'fast' }));
  assert.deepEqual(cards.map(card => card.disabled), [false, false, false]);
  const count = env.actions.length;
  options[0].click(); assert.equal(env.actions.length, count, 'a hidden phase cannot dispatch');
  mounted.destroy(); assert.equal(host.children.length, 0);
  assert.ok(Object.values(root.listeners).every(list => list.length === 0));
  lines[0].click(); assert.equal(env.actions.length, count);
});

test('keyboard roves through story lines and the active strip, then yields Down to commands', () => {
  const env = mount(), { root, doc } = env;
  const lines = root.querySelectorAll('.ribbon-line'), options = root.querySelectorAll('.ribbon-option');
  lines[0].focus();
  for (let i = 0; i < 4; i++) {
    assert.equal(arrow(lines[i], 'ArrowDown').defaultPrevented, true); assert.equal(doc.activeElement, lines[i + 1]);
  }
  arrow(lines[4], 'ArrowDown'); assert.equal(doc.activeElement, options[0]);
  for (let i = 0; i < 3; i++) { arrow(options[i], 'ArrowRight'); assert.equal(doc.activeElement, options[i + 1]); }
  assert.equal(arrow(options[3], 'ArrowDown').defaultPrevented, false);
  arrow(options[3], 'ArrowLeft'); assert.equal(doc.activeElement, options[2]);
  arrow(options[2], 'ArrowUp'); assert.equal(doc.activeElement, lines[4]);
  assert.equal(arrow(lines[4], 'Tab').defaultPrevented, false);
  const modified = new Event('keydown', { key: 'ArrowUp', ctrlKey: true }); lines[4].dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false); assert.equal(doc.activeElement, lines[4]);
  for (const key of ['Enter', ' ']) {
    assert.equal(routeIntent({ target: lines[4], key }), 'native');
    const count = env.actions.length;
    assert.equal(pressKey(lines[4], 'keydown', key).defaultPrevented, false);
    pressKey(lines[4], 'keyup', key);
    assert.equal(env.actions.length, count + 1); assert.deepEqual(env.actions.at(-1), field({ line: 4 }));
  }
  options[0].focus(); pressKey(options[0], 'keydown', 'Enter');
  const cards = root.querySelectorAll('.ribbon-card');
  cards[1].focus(); pressKey(cards[1], 'keydown', 'Enter');
  cards[0].focus(); arrow(cards[0], 'ArrowRight');
  assert.equal(doc.activeElement, cards[2], 'placed cards are skipped');
  assert.equal(arrow(cards[2], 'ArrowDown').defaultPrevented, false);
  env.set({ state: ready(), ui: {} });
  assert.equal(doc.activeElement, lines[4]);
  assert.equal(arrow(lines[4], 'ArrowDown').defaultPrevented, false);
  env.mounted.destroy();
});

test('updates preserve picture nodes for unchanged content and never replace the story card', () => {
  const env = mount(), story = env.root.querySelector('.ribbon-story');
  const optionPic = env.root.querySelector('.ribbon-option .ribbon-choice__pic').firstElementChild;
  env.mounted.update(env.session.state, env.session.ui);
  assert.equal(env.root.querySelector('.ribbon-option .ribbon-choice__pic').firstElementChild, optionPic);
  env.set({ state: snapshot({ why: true, steps: 1 }), ui: {} });
  assert.equal(env.root.querySelector('.ribbon-story'), story);
  assert.equal(env.root.querySelector('.ribbon-option .ribbon-choice__pic').firstElementChild, optionPic);
  const slotPic = env.root.querySelector('.ribbon-slot__pic').firstElementChild;
  env.mounted.update(env.session.state, env.session.ui);
  assert.equal(env.root.querySelector('.ribbon-slot__pic').firstElementChild, slotPic);
  env.mounted.destroy();
});

test('field typography grows with tokens and the planned rectangles stay within the activity field', () => {
  const css = readFileSync(new URL('../src/ui/activities/ribbon.css', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  const allCSS = `${tokens}\n${css}`, env = mount();
  assert.equal(declarations(css, '.ribbon-story')['overflow-y'], 'auto');
  assert.equal(declarations(css, '.large-text .ribbon-head').display, 'none');
  for (const selector of ['.ribbon-story', '.ribbon-strip']) {
    const style = declarations(css, selector);
    assert.ok(parseInt(style.left) + parseInt(style.width) <= 520);
    assert.ok(parseInt(style.top) + parseInt(style.height) <= 268);
  }
  assert.equal(declarations(css, '.ribbon-choice').width, '118px');
  assert.equal(declarations(css, '.ribbon-choice').height, '84px');
  assert.equal(declarations(css, '.ribbon-card').width, '96px');
  assert.equal(declarations(css, '.ribbon-band').width, '180px');
  assert.equal(declarations(css, '.ribbon-slot').width, '48px');
  for (const large of [false, true]) {
    env.host.classList.toggle('large-text', large);
    const lineStyle = controlStyle(env.root.querySelector('.ribbon-line'), allCSS);
    assert.equal(lineStyle['font-size'], large ? '24px' : '20px');
    for (const selector of ['.ribbon-question', '.ribbon-option', '.ribbon-card', '.ribbon-lesson', '.ribbon-slot__number']) {
      assert.equal(controlStyle(env.root.querySelector(selector), allCSS)['font-size'], large ? '20px' : '16px');
    }
    const tag = controlStyle(env.root.querySelector('.ribbon-line__tag'), allCSS);
    assert.equal(tag.width, large ? '20px' : '24px'); assert.equal(tag.height, large ? '20px' : '24px');
    assert.notEqual(controlStyle(env.root.querySelector('.ribbon-question'), allCSS).display, 'none');
    for (const line of env.root.querySelectorAll('.ribbon-line')) assert.notEqual(controlStyle(line, allCSS).display, 'none');
  }
  assert.doesNotMatch(css, /font-size:\s*\d|text-overflow:\s*ellipsis|linear-gradient|radial-gradient/);
  env.mounted.destroy();
});
