import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import activity, { HELP, GLYPHS, helperLabel } from '../src/ui/activities/helpday.js';
import {
  GRADES_HELPDAY, STAMP_HELPDAY, HELP_JOBS, HELP_HELPERS, HELP_FITS,
  JOB_IDS, HELPER_IDS, HELPDAY_LINES, normalizeHelpday, normalizeHelpDaySnapshot,
  cleanHelpdayCreation, helpdayReady, helpDayReady, helpdayOpening,
  helpDayOpening, helpdayCreationMarkup, normalizeCrew, assignHelper,
  undoAssignment, helpDayFitCount, helpDayNextJob,
  HELP_SETS, helpSetFor, helpSetOfCrew, JOB_SHORT, helperById, fits,
} from '../src/helpday.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { arrangeCommands, nextCursorIndex } from '../src/ui/menu.js';
import { createState, saveDraft, saveState, loadState, getDraft, publishCreation, getCreations } from '../src/progress.js';
import { PAGE_CHARS, paginate } from '../src/ui/dialogue.js';
import { declarations } from './helpers/css.js';
import { Doc, Event } from './helpers/dom.js';

const pairs = Object.entries(HELP_FITS).map(([job, helper]) => ({ job, helper }));
const pairsFor = grade => Object.entries(helpSetFor(grade).fits).map(([job, helper]) => ({ job, helper }));

test('job names stay on the field scale when Bigger words is enabled', () => {
  const css = readFileSync(new URL('../src/ui/activities/helpday.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors.trim().endsWith('.helpday-job-name'));
  const fonts = rules.flatMap(([, , declarations]) => [...declarations.matchAll(/font-size:\s*([^;]+);/g)].map(m => m[1]));
  assert.ok(fonts.length);
  assert.ok(fonts.every(font => font === 'var(--text-field)'), 'job names must grow from 20px to 24px');
});

test('two large job-name lines and the helper slot fit each card and the board', () => {
  const css = readFileSync(new URL('../src/ui/activities/helpday.css', import.meta.url), 'utf8');
  const rule = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, selectors]) => selectors.trim() === selector)[2];
  const px = (selector, property) => Number(rule(selector).match(new RegExp(`${property}:\\s*([\\d.]+)px`))[1]);
  const card = px('.helpday-job', 'height'), slot = px('.helpday-slot', 'height');
  const border = px('.helpday-job', 'border');
  assert.ok(card - 2 * border >= 2 * 24 + slot, 'two 24px lines fit above the slot');
  assert.ok(slot - 2 * px('.helpday-slot', 'border') >= 48, 'the 48px helper fits inside the slot border');
  const board = px('.helpday-board', 'height');
  assert.ok(px('.helpday-header', 'height') + 2 * card + px('.helpday-grid', 'gap') + 2 * px('.helpday-board', 'border') <= board);
  assert.ok(board + 10 <= px('.helpday-field', 'height'), 'board fits with the field padding');
});
const fixture = { kind: 'community', activity: 'helpday', request: 1, chapter: 1, grade: 3, crew: pairs };
const fixtureFor = grade => ({ ...fixture, grade, crew: pairsFor(grade) });
const fresh = grade => activity.start(null, { grade, chapter: 1 });
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const short = line => {
  assert.ok(line.length <= 96, `${line.length}: ${line}`);
  assert.equal(typeof line, 'string');
  // The dialogue.js sentence boundary, including closing quotes/brackets.
  for (const sentence of line.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) {
    assert.ok(sentence.length <= 56, `${sentence.length}: ${sentence}`);
  }
  for (const limit of Object.values(PAGE_CHARS)) {
    const pages = paginate(line, limit);
    assert.ok(pages.every(page => page.length <= limit));
    assert.equal(pages.join(' '), line);
  }
};

test('starts independently at grades 3, 4, 5; legacy and other activities start fresh', () => {
  assert.deepEqual(GRADES_HELPDAY, [3, 4, 5]);
  assert.equal(normalizeHelpDaySnapshot, normalizeHelpday);
  assert.equal(helpDayReady, helpdayReady);
  assert.equal(helpDayOpening, helpdayOpening);
  for (const grade of GRADES_HELPDAY) {
    const { state, ui } = fresh(grade);
    assert.deepEqual(state, { kind: 'community', activity: 'helpday', request: 1, grade, chapter: 1, crew: [] });
    assert.deepEqual(ui, { helper: helpSetFor(grade).helperIds[0] });
    assert.equal(helpdayReady(state), false);
    assert.equal(activity.opening(state), HELPDAY_LINES.opening);
    for (const snapshot of [null, {}, { ...fixture, activity: undefined }, { ...fixture, activity: 'square' }, { ...fixture, kind: 'math' }]) {
      assert.deepEqual(activity.start(snapshot, { grade, chapter: 1 }).state.crew, []);
    }
    assert.equal(helpdayReady(activity.start(fixtureFor(grade), { grade, chapter: 1 }).state), true);
  }
  assert.equal(activity.help, HELP);
  assert.equal(HELP.length, 4);
  assert.match(HELP.at(-1), /Start day/);
  assert.equal(activity.rewardLabel, 'Help Day team');
  assert.equal(typeof activity.mountField, 'function');
  assert.deepEqual(Object.keys(GLYPHS), ['lantern', 'gate', 'envelope', 'pot', 'book', 'brush', 'pen']);
});

test('four stable short commands, pictured, with the disabled finish always last', () => {
  for (const grade of GRADES_HELPDAY) for (const helper of helpSetFor(grade).helperIds) for (const crew of [[], pairsFor(grade).slice(0, 2), pairsFor(grade)]) {
    const state = normalizeHelpday({ crew }, grade, 1), ui = { helper };
    const commands = activity.commands(state, ui, grade);
    assert.equal(commands.length, 4);
    assert.equal(new Set(commands.map(c => c.id)).size, 4);
    commands.forEach(c => { assert.ok(c.label.length <= 9); assert.ok(ICON_NAMES.includes(c.icon)); });
    assert.equal(commands.filter(c => c.finish).length, 1);
    assert.equal(commands.at(-1).id, 'finish');
    assert.equal(commands.at(-1).finish, true);
    assert.equal(commands.at(-1).disabled, !helpdayReady(state));
    assert.equal(arrangeCommands(commands)[3], commands.at(-1));
    assert.equal(commands[2].disabled, crew.length === 0);
    assert.equal(commands[0].label, `Ask ${helperById(helper).name}`);
    assert.equal(nextCursorIndex(activity.commands(state, { helper: helpSetFor(grade).helperIds[0] }), commands, 0), 0);
  }
});

test('ready requires exactly four unique fitting pairs; every missing and swapped pair fails', () => {
  assert.equal(helpdayReady(fixture), true);
  assert.equal(helpdayReady({ crew: [...pairs].reverse() }), true);
  for (const crew of [[], null, {}, [null], [...pairs, pairs[0]]]) assert.equal(helpdayReady({ crew }), false);
  assert.equal(helpdayReady(null), false);
  for (let i = 0; i < 4; i++) {
    assert.equal(helpdayReady({ crew: pairs.filter((_, j) => i !== j) }), false);
    for (let j = i + 1; j < 4; j++) {
      const crew = pairs.map(p => ({ ...p }));
      [crew[i].helper, crew[j].helper] = [crew[j].helper, crew[i].helper];
      assert.equal(helpdayReady({ crew }), false);
    }
  }
});

test('normalizer bounds scope, keeps first valid unique pairs, and strips all extra fields', () => {
  const input = freeze({ ...fixture, extra: 'no', crew: [null, 2, {}, { job: 'bad', helper: 'kiko' }, { job: 'gate', helper: 'bad' },
    { ...pairs[0], extra: 'no' }, { job: 'lanterns', helper: 'taro' }, { job: 'drum', helper: 'kiko' }, ...pairs.slice(1), pairs[0]] });
  assert.deepEqual(normalizeHelpday(input, 900, 22), { ...fixture, grade: 5, chapter: 0 });
  assert.deepEqual(normalizeHelpday(input, -8, 1), { ...fixture, grade: 0 });
  assert.equal(normalizeHelpday({}, 3.6, 1).grade, 4);
  for (const n of [NaN, Infinity, -Infinity, '5', Symbol('bad'), {}, null]) {
    const result = normalizeHelpday({}, n, n);
    assert.equal(result.grade, 0);
    assert.equal(result.chapter, 0);
  }
  for (const crew of [null, 4, 'kiko', {}]) assert.deepEqual(normalizeCrew(crew), []);
  for (const input of [null, 5, 'bad', []]) assert.deepEqual(normalizeHelpday(input).crew, []);
  const normal = normalizeHelpday(fixture);
  assert.deepEqual(normalizeHelpday(normal), normal);
});

test('clean saved objects reject junk and preserve valid scoped snapshots', () => {
  for (const junk of [null, undefined, [], 'bad', 5, {}, { ...fixture, kind: 'math' }, { ...fixture, activity: undefined }]) assert.equal(cleanHelpdayCreation(junk), null);
  for (const grade of GRADES_HELPDAY) {
    const clean = cleanHelpdayCreation({ ...fixtureFor(grade), crew: [...pairsFor(grade), { job: '<script>', helper: 'pip' }] });
    assert.deepEqual(clean, fixtureFor(grade));
    assert.deepEqual(normalizeHelpday(clean, grade, 1), clean);
  }
  assert.equal(cleanHelpdayCreation({ ...fixture, grade: 99 }).grade, 5);
  assert.equal(cleanHelpdayCreation({ ...fixture, grade: -8 }).grade, 1);
  assert.equal(cleanHelpdayCreation({ ...fixture, grade: Infinity }).grade, 1);
  assert.deepEqual(cleanHelpdayCreation({ ...fixture, chapter: 99 }), { ...fixture, chapter: 0, grade: 0 });
});

test('assignment replaces and moves helpers, keeps immutable work, and Undo follows assignment order', () => {
  const initial = freeze(normalizeHelpday({ crew: pairs.slice(0, 2) }));
  const same = assignHelper(initial, 'lanterns', 'kiko');
  assert.equal(same.status, 'same'); assert.equal(same.state, initial);
  const moved = assignHelper(initial, 'drum', 'kiko');
  assert.equal(moved.status, 'mismatch');
  assert.deepEqual(moved.state.crew, [{ job: 'drum', helper: 'kiko' }]);
  const next = assignHelper(moved.state, 'lanterns', 'taro').state;
  const undone = undoAssignment(next);
  assert.equal(undone.helper, 'taro'); assert.deepEqual(undone.state, moved.state);
  assert.deepEqual(undoAssignment(undone.state).state, initial);
  const empty = fresh(3).state;
  assert.deepEqual(undoAssignment(empty), { state: empty, helper: null });
  for (const [job, helper] of [['bad', 'kiko'], ['drum', 'bad']]) assert.equal(assignHelper(initial, job, helper).state, initial);
  for (const job of JOB_IDS) for (const helper of HELPER_IDS) {
    const result = assignHelper(fixture, job, helper);
    assert.equal(new Set(result.state.crew.map(p => p.job)).size, result.state.crew.length);
    assert.equal(new Set(result.state.crew.map(p => p.helper)).size, result.state.crew.length);
  }
});

test('all live assignments in both sets explain the fit or mismatch without losing work', () => {
  for (const grade of GRADES_HELPDAY) for (const job of helpSetFor(grade).jobIds) for (const helper of helpSetFor(grade).helperIds) {
    const { state, ui } = fresh(grade); freeze(state); freeze(ui);
    const pick = activity.act(state, ui, { type: 'field', helper });
    assert.equal(pick.state, state); assert.equal(pick.ui.helper, helper);
    assert.equal(pick.line, HELPDAY_LINES.pick(helper));
    const put = activity.act(state, freeze(pick.ui), { type: 'field', job });
    assert.deepEqual(put.state.crew, [{ job, helper }]);
    assert.equal(put.line, helpSetFor(grade).fits[job] === helper ? HELPDAY_LINES.fit(job) : HELPDAY_LINES.mismatch(job, helper));
    assert.doesNotMatch(put.line, /cannot|can't|failed/i);
    short(put.line);
    const same = activity.act(freeze(put.state), pick.ui, { type: 'field', job });
    assert.equal(same.state, put.state); assert.equal(same.line, HELPDAY_LINES.same(job, helper));
  }
});

test('helper then job flow reaches ready, celebrates, and Undo reopens a job', () => {
  for (const grade of GRADES_HELPDAY) {
    let result = fresh(grade);
    for (const { job, helper } of pairsFor(grade)) {
      result = activity.act(freeze(result.state), freeze(result.ui), { type: 'field', helper });
      result = activity.act(freeze(result.state), freeze(result.ui), { type: 'field', job });
      short(result.line);
    }
    assert.equal(helpdayReady(result.state), true);
    assert.ok(result.line.endsWith(HELPDAY_LINES.allSet));
    assert.equal(activity.opening(result.state), HELPDAY_LINES.openingReady);
    assert.equal(activity.act(result.state, result.ui, { type: 'command', id: 'next' }).line, HELPDAY_LINES.allSet);
    const undo = activity.act(result.state, result.ui, { type: 'command', id: 'undo' });
    assert.equal(undo.line, HELPDAY_LINES.undo(pairsFor(grade).at(-1).helper));
    assert.equal(helpdayReady(undo.state), false);
    assert.equal(activity.opening(undo.state), HELPDAY_LINES.openingPartial);
    assert.equal(activity.commands(undo.state, undo.ui).at(-1).disabled, true);
  }
});

test('Next job follows board order, Ask follows selection, partial wrong teams resume', () => {
  for (let i = 0; i <= 4; i++) {
    const state = normalizeHelpday({ crew: pairs.slice(0, i) });
    assert.equal(helpDayFitCount(state), i);
    assert.equal(helpDayNextJob(state), JOB_IDS[i] ?? null);
    assert.equal(activity.act(state, { helper: 'pip' }, { type: 'command', id: 'next' }).line, HELPDAY_LINES.next(JOB_IDS[i]));
  }
  const { state, ui } = fresh(3);
  for (const helper of HELPER_IDS) assert.equal(activity.act(state, { helper }, { type: 'command', id: 'ask' }).line, HELPDAY_LINES.ask(helper));
  const wrong = assignHelper(state, 'lanterns', 'nori').state;
  assert.equal(helpDayFitCount(wrong), 0); assert.equal(helpDayNextJob(wrong), 'lanterns');
  assert.equal(activity.opening(wrong), HELPDAY_LINES.openingPartial);
  for (const action of [null, {}, { type: 'command', id: 'finish' }, { type: 'command', id: 'undo' }, { type: 'field', job: 'bad' }]) {
    const result = activity.act(state, ui, action); assert.equal(result.state, state); assert.equal(result.ui, ui);
  }
});

test('Undo restores both displaced helpers, including after saving and reopening a draft', () => {
  for (const grade of GRADES_HELPDAY) {
    let result = fresh(grade);
    const pairs = pairsFor(grade), helper = pairs[0].helper;
    for (const { job, helper } of pairs) result = { ...result, state: assignHelper(result.state, job, helper).state };
    const complete = freeze(result.state);
    const moved = assignHelper(complete, pairs[1].job, helper).state;
    assert.equal(moved.crew.length, 3);
    const values = new Map();
    const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null };
    assert.equal(saveState(saveDraft({ ...createState(), chapter: 1, grade }, 'community', moved), storage), true);
    const reopened = activity.start(getDraft(loadState(storage), 'community'), { grade, chapter: 1 });
    for (const state of [moved, reopened.state]) {
      const undone = activity.act(freeze(state), { helper }, { type: 'command', id: 'undo' });
      assert.deepEqual(undone.state, complete);
      assert.equal(helpdayReady(undone.state), true);
      assert.equal(activity.commands(undone.state, undone.ui).at(-1).disabled, false);
      assert.ok(undone.line.startsWith(`${helperById(helper).name} is back on ${JOB_SHORT[pairs[0].job]}.`));
      assert.doesNotMatch(undone.line, /bench|open/);
      short(undone.line);
      assert.equal(undoAssignment(undone.state).state.crew.length, 3);
    }
  }
});

test('assignment history is bounded, sanitized, immutable and reversible through repeated moves', () => {
  let state = normalizeHelpday(fixture);
  const previous = [];
  for (let i = 0; i < 45; i++) {
    previous.push(state.crew);
    state = assignHelper(freeze(state), i % 2 ? 'lanterns' : 'drum', 'kiko').state;
  }
  assert.equal(state.history.length, 40);
  const cleaned = normalizeHelpday(freeze({ ...state, history: [...state.history, null, 'bad', [{ ...pairs[0], extra: true }, pairs[0], { job: 'bad', helper: 'pip' }]] }));
  assert.ok(cleaned.history.length <= 40);
  assert.deepEqual(cleaned.history.at(-1), [pairs[0]]);
  assert.deepEqual(normalizeHelpday(cleaned), cleaned);
  for (let i = 44; i >= 5; i--) {
    state = undoAssignment(freeze(state)).state;
    assert.deepEqual(state.crew, previous[i]);
  }
  assert.ok(!state.history?.length);
  // Older saves have no history; Undo can still remove their most recent pair.
  assert.deepEqual(undoAssignment(fixture).state.crew, pairs.slice(0, -1));
});

test('a fully occupied wrong team resumes with a prompt to check each job', () => {
  for (const grade of GRADES_HELPDAY) {
    const set = helpSetFor(grade);
    const crew = set.jobIds.map((job, i) => ({ job, helper: set.helperIds[(i + 1) % 4] }));
    const resumed = activity.start({ ...fixture, crew }, { grade, chapter: 1 });
    assert.equal(resumed.state.crew.length, 4);
    assert.equal(helpDayFitCount(resumed.state), 0);
    assert.equal(activity.opening(resumed.state), 'Let’s check your team. Who fits each job?');
    assert.equal(activity.commands(resumed.state, resumed.ui).at(-1).disabled, true);
  }
});

test('every possible dialogue sentence, including help and completion suffix, fits 56 characters', () => {
  HELP.forEach(short); short(STAMP_HELPDAY); short(activity.notReadyLine);
  Object.values(HELPDAY_LINES).filter(v => typeof v === 'string').forEach(short);
  for (const set of Object.values(HELP_SETS)) {
    for (const job of set.jobIds) {
      short(HELPDAY_LINES.fit(job)); short(`${HELPDAY_LINES.fit(job)} ${HELPDAY_LINES.allSet}`); short(HELPDAY_LINES.next(job));
      for (const helper of set.helperIds) { short(HELPDAY_LINES.mismatch(job, helper)); short(HELPDAY_LINES.same(job, helper)); }
    }
    for (const helper of set.helperIds) { short(HELPDAY_LINES.ask(helper)); short(HELPDAY_LINES.pick(helper)); short(HELPDAY_LINES.undo(helper)); }
  }
  short(HELPDAY_LINES.next(null));
});

test('grade 5 helper aria labels omit strengths while Ask still provides each clue', () => {
  for (const person of HELP_HELPERS) {
    assert.equal(helperLabel({ crew: [] }, person.id, 5), `${person.name}. On the bench.`);
    assert.match(helperLabel(fixture, person.id, 3), new RegExp(person.strength.toLowerCase()));
    assert.doesNotMatch(helperLabel(fixture, person.id, 5), new RegExp(person.strength.toLowerCase()));
  }
});

test('grade 4 uses the four set-B jobs and helpers; grades 3 and 5 keep set A', () => {
  assert.equal(helpSetFor(3), HELP_SETS.A); assert.equal(helpSetFor(5), HELP_SETS.A);
  assert.equal(helpSetFor(4), HELP_SETS.B);
  assert.deepEqual(HELP_SETS.B.jobs.map(job => [job.id, job.name, job.need, job.glyph]), [
    ['stew', 'Cook stew', 'Big pot', 'pot'], ['tale', 'Tell a tale', 'Loud voice', 'book'],
    ['banner', 'Paint banner', 'Steady hand', 'brush'], ['signs', 'Write signs', 'Neat words', 'pen'],
  ]);
  assert.deepEqual(HELP_SETS.B.helpers.map(person => [person.id, person.name, person.strength, person.figure]), [
    ['momo', 'Momo', 'Cook', 'science'], ['sora', 'Sora', 'Storyteller', 'reading'],
    ['yuki', 'Yuki', 'Steady hand', 'art'], ['fumi', 'Fumi', 'Neat writer', 'writing'],
  ]);
  assert.deepEqual(HELP_SETS.B.fits, { stew: 'momo', tale: 'sora', banner: 'yuki', signs: 'fumi' });
  assert.equal(HELPDAY_LINES.fit('stew'), 'Momo stirs a stew that smells amazing. Great match!');
  assert.equal(HELPDAY_LINES.ask('sora'), 'Sora says: I know a hundred tales by heart!');
  assert.equal(helpSetOfCrew(pairs), HELP_SETS.A);
  assert.equal(helpSetOfCrew(pairsFor(4)), HELP_SETS.B);
  for (const junk of [null, {}, [null], [{ job: '__proto__', helper: 'momo' }]]) assert.equal(helpSetOfCrew(junk), HELP_SETS.A);
});

test('set B requires every unique fit and rejects other-set actions without saving', () => {
  const pairs = pairsFor(4), complete = fixtureFor(4);
  assert.equal(helpdayReady(complete), true);
  for (let i = 0; i < 4; i++) {
    assert.equal(helpdayReady({ ...complete, crew: pairs.filter((_, j) => j !== i) }), false);
    for (let j = i + 1; j < 4; j++) {
      const crew = pairs.map(pair => ({ ...pair }));
      [crew[i].helper, crew[j].helper] = [crew[j].helper, crew[i].helper];
      assert.equal(helpdayReady({ ...complete, crew }), false);
    }
  }
  assert.equal(helpdayReady({ ...complete, crew: [...pairs, pairs[0]] }), false);
  assert.equal(helpdayReady({ ...fixture, grade: 4 }), false);
  assert.equal(helpdayReady({ ...complete, grade: 5 }), false);
  for (const grade of GRADES_HELPDAY) {
    const { state, ui } = fresh(grade); freeze(state); freeze(ui);
    const other = grade === 4 ? HELP_SETS.A : HELP_SETS.B;
    for (const job of other.jobIds) {
      assert.equal(assignHelper(state, job, other.helperIds[0]).status, 'invalid');
      assert.deepEqual(activity.act(state, ui, { type: 'field', job }), { state, ui });
    }
    for (const helper of other.helperIds) assert.deepEqual(activity.act(state, ui, { type: 'field', helper }), { state, ui });
    for (let i = 0; i <= 4; i++) {
      const s = normalizeHelpday({ crew: pairsFor(grade).slice(0, i) }, grade, 1);
      const job = helpSetFor(grade).jobIds[i] ?? null;
      assert.equal(helpDayFitCount(s), i); assert.equal(helpDayNextJob(s), job);
      assert.equal(activity.act(s, ui, { type: 'command', id: 'next' }).line, HELPDAY_LINES.next(job));
    }
    for (const helper of helpSetFor(grade).helperIds) {
      assert.equal(activity.act(state, { helper }, { type: 'command', id: 'ask' }).line, HELPDAY_LINES.ask(helper));
    }
  }
});

test('both saved boards retain their pictures after reload; grade 4 opens old set A as a fresh set B', () => {
  const legacy = { ...fixture, grade: 4, history: [[], pairs.slice(0, 3)] };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null };
  for (const snapshot of [legacy, fixtureFor(4)]) {
    const clean = cleanHelpdayCreation(snapshot);
    assert.deepEqual(clean, snapshot); assert.deepEqual(cleanHelpdayCreation(clean), clean);
    const published = publishCreation({ ...createState(), chapter: 1, grade: 4 }, 'community', snapshot);
    assert.equal(saveState(published, storage), true);
    const saved = getCreations(loadState(storage)).community;
    assert.deepEqual(saved, snapshot);
    const set = helpSetOfCrew(snapshot.crew), markup = helpdayCreationMarkup(saved);
    for (const job of set.jobIds) assert.ok(markup.includes(`data-job="${job}"`));
    assert.equal((markup.match(/l3 3 6-6/g) ?? []).length, 4);
    assert.doesNotMatch(markup, /<script|onload|undefined|NaN|Infinity/);
    const reopened = activity.start(saved, { grade: 4, chapter: 1 });
    assert.deepEqual(reopened.state, set === HELP_SETS.A ? fresh(4).state : fixtureFor(4));
    assert.equal(reopened.ui.helper, 'momo');
  }
  const bad = cleanHelpdayCreation({ ...fixtureFor(4), crew: [...pairsFor(4), { job: '<script>', helper: 'fumi' }], payload: 'bad' });
  assert.deepEqual(bad, fixtureFor(4));
});

test('set-B controls keep their nodes, visible clues and text tokens with Bigger words', () => {
  const previous = globalThis.document, doc = new Doc(); globalThis.document = doc;
  const css = readFileSync(new URL('../src/ui/activities/helpday.css', import.meta.url), 'utf8');
  try {
    for (const grade of [3, 4, 5]) for (const large of [false, true]) {
      const host = doc.createElement('section'); doc.body.append(host); host.className = large ? 'large-text' : '';
      let result = fresh(grade);
      const view = activity.mountField(host, { grade, dispatch(action) {
        result = activity.act(result.state, result.ui, action); view.update(result.state, result.ui);
      } });
      view.update(result.state, result.ui);
      const jobs = host.querySelectorAll('.helpday-job'), helpers = host.querySelectorAll('.helpday-helper');
      const strengths = helpers.map(button => button.querySelector('.helpday-strength'));
      assert.deepEqual(strengths.map(span => span.textContent), helpSetFor(grade).helpers.map(person => person.strength));
      assert.ok(strengths.every(span => span.hidden === (grade === 5)));
      for (const button of helpers) {
        short(button.getAttribute('aria-label'));
        assert.equal(button.querySelector('.figure--missing'), null);
      }
      helpers[0].focus(); helpers[0].dispatchEvent(new Event('keydown', { key: 'ArrowDown' }));
      assert.equal(doc.activeElement, helpers[1]);
      assert.deepEqual(helpers.map(button => button.tabIndex), [-1, 0, -1, -1]);
      for (let i = 0; i < 4; i++) {
        helpers[i].click(); jobs[i].click();
        for (const button of [...jobs, ...helpers]) short(button.getAttribute('aria-label'));
      }
      assert.equal(helpdayReady(result.state), true);
      assert.deepEqual(host.querySelectorAll('.helpday-job'), jobs);
      assert.deepEqual(host.querySelectorAll('.helpday-helper'), helpers);
      const strength = helpers[0].querySelector('.helpday-strength');
      assert.equal(strength, strengths[0]);
      view.destroy(); assert.equal(host.children.length, 0); host.remove();
    }
    const px = (selector, prop) => Number.parseFloat(declarations(css, selector)[prop]);
    assert.equal(declarations(css, '.helpday-helper-words')['font-size'], 'var(--text-small)');
    assert.equal(declarations(css, '.helpday-job-name')['font-size'], 'var(--text-field)');
    assert.ok(px('.helpday-board', 'width') + px('.helpday-field', 'gap') + px('.helpday-bench', 'width') <= px('.helpday-field', 'width'));
    const wordsWidth = px('.helpday-helper', 'width') - 2 * px('.helpday-helper', 'border') - 48 - px('.helpday-helper', 'gap');
    for (const helper of HELP_SETS.B.helpers) assert.ok(helper.strength.length * 20 / 2 <= wordsWidth, helper.strength);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});

test('small creation markup rejects injected text and numbers; tokens show shape and fit cues', () => {
  const attack = `"><script>alert('x')</script><svg onload="x">&`;
  const clean = helpdayCreationMarkup(fixture);
  assert.match(clean, /creation--helpday/); assert.match(clean, /4 of 4 jobs filled/);
  assert.equal((clean.match(/l3 3 6-6/g) ?? []).length, 4);
  assert.match(helpdayCreationMarkup({ crew: [] }), /stroke-dasharray/);
  assert.match(helpdayCreationMarkup({ crew: [{ job: 'lanterns', helper: 'nori' }] }), />\?<\/text>/);
  const markup = helpdayCreationMarkup({ ...fixture, name: attack, color: attack, grade: Infinity,
    crew: [...pairs.map(p => ({ ...p, name: attack, color: attack, x: Infinity })), { job: attack, helper: attack }] });
  assert.equal(markup, clean); // No free text is interpolated; unknown fields/IDs are discarded.
  assert.doesNotMatch(markup, /<script|onload|Infinity|NaN/);
  assert.match(helpdayCreationMarkup({ crew: [{ job: 'lanterns', helper: attack }] }), /0 of 4/);
  assert.doesNotThrow(() => helpdayCreationMarkup(null));
});

// A small DOM fixture exercises the actual mountField handlers without a dependency or registry wiring.
// Browser layout remains a separate check; this fixture makes no claims about pixel measurements.
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = [];
    this.dataset = {}; this.attrs = {}; this.events = {}; this.tabIndex = -1;
    this.className = ''; this.hidden = false; this.parentElement = null;
  }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'class') this.className = value;
    if (name === 'hidden') this.hidden = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  matches(selector) { return selector.startsWith('.') ? this.className.split(' ').includes(selector.slice(1)) : this.tagName === selector.toUpperCase(); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  set innerHTML(html) {
    this.html = html; this.children = [];
    const stack = [this];
    for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
      const [, close, tag, attrs] = match;
      if (close) { if (stack.length > 1) stack.pop(); continue; }
      const node = this.doc.createElement(tag);
      for (const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(a[1], a[2] ?? '');
      stack.at(-1).append(node);
      if (!attrs.endsWith('/') && !['input', 'img', 'br'].includes(tag)) stack.push(node);
    }
  }
  get innerHTML() { return this.html ?? ''; }
  addEventListener(type, fn) { (this.events[type] ??= new Set()).add(fn); }
  removeEventListener(type, fn) { this.events[type]?.delete(fn); }
  fire(type, extra = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (let at = this; at; at = at.parentElement) for (const fn of at.events[type] ?? []) fn(event);
    return event;
  }
  focus() { this.doc.activeElement = this; this.fire('focusin'); }
}

test('field keeps nodes and focus, supports grid/radio arrows and native clicks, and cleans listeners', () => {
  const previous = globalThis.document;
  const doc = { createElement(tag) { return new Element(tag, this); }, activeElement: null };
  globalThis.document = doc;
  try {
    for (const grade of GRADES_HELPDAY) {
      const set = helpSetFor(grade);
      const host = doc.createElement('section');
      let result = fresh(grade);
      const field = activity.mountField(host, { grade, dispatch(action) { result = activity.act(result.state, result.ui, action); field.update(result.state, result.ui); } });
      field.update(result.state, result.ui);
      const root = host.children[0], jobs = root.querySelectorAll('.helpday-job'), radios = root.querySelectorAll('.helpday-helper');
      assert.equal(jobs.length, 4); assert.equal(radios.length, 4);
      for (const [i, job] of jobs.entries()) {
        const name = job.querySelector('.helpday-job-name').textContent;
        const need = job.querySelector('.helpday-need').textContent;
        assert.ok(name.length <= 12, `${name} exceeds 12 characters`);
        assert.ok(need.length <= 12, `${need} exceeds 12 characters`);
        assert.ok(job.querySelector('.helpday-glyph').querySelector('svg'), 'each job has an icon');
        const full = set.jobs[i].description;
        assert.ok(job.getAttribute('aria-label').startsWith(full), 'full job description remains accessible');
      }
      assert.deepEqual(jobs.map(b => b.tabIndex), [0, -1, -1, -1]);
      assert.deepEqual(radios.map(b => b.tabIndex), [0, -1, -1, -1]);
      assert.equal(root.querySelector('.helpday-bench').getAttribute('role'), 'radiogroup');
      assert.equal(radios[0].querySelector('.helpday-strength').hidden, grade === 5);
      jobs[0].focus();
      assert.equal(jobs[0].fire('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
      assert.equal(doc.activeElement, jobs[1]);
      jobs[1].fire('keydown', { key: 'ArrowDown' }); assert.equal(doc.activeElement, jobs[3]);
      assert.equal(jobs[3].fire('keydown', { key: 'ArrowDown' }).defaultPrevented, false, 'down at bottom reaches the frame');
      assert.equal(jobs[3].fire('keydown', { key: 'Enter' }).defaultPrevented, false, 'native button activation remains available');
      assert.equal(jobs[3].fire('keydown', { key: ' ' }).defaultPrevented, false);
      radios[0].focus(); radios[0].fire('keydown', { key: 'ArrowRight' });
      assert.equal(result.ui.helper, set.helperIds[1]); assert.equal(doc.activeElement, radios[1]);
      assert.deepEqual(radios.map(b => b.tabIndex), [-1, 0, -1, -1]);
      radios[1].fire('keydown', { key: 'ArrowLeft' }); assert.equal(result.ui.helper, set.helperIds[0]);
      radios[0].fire('keydown', { key: 'ArrowDown' }); radios[1].fire('keydown', { key: 'ArrowDown' });
      assert.equal(result.ui.helper, set.helperIds[2]);
      jobs[0].fire('click');
      assert.equal(jobs[0].dataset.fit, 'no'); assert.ok(jobs[0].getAttribute('aria-label').includes(`${set.helpers[2].name} is here, try again`));
      assert.equal(jobs[0].querySelector('.helpday-badge').innerHTML, '?');
      assert.equal(radios[2].querySelector('.helpday-at').textContent, set.jobs[0].at);
      for (let i = 0; i < 4; i++) { radios[i].fire('click'); jobs[i].fire('click'); }
      assert.equal(helpdayReady(result.state), true);
      assert.equal(root.querySelector('.helpday-count').textContent, 'Help Day · 4 of 4');
      assert.ok(jobs.every(b => b.dataset.fit === 'yes'));
      assert.deepEqual(root.querySelectorAll('.helpday-job'), jobs, 'updates retain all four original buttons');
      const sprite = jobs[3].querySelector('.helpday-figure').children[0];
      field.update(result.state, result.ui);
      assert.equal(jobs[3].querySelector('.helpday-figure').children[0], sprite, 'unchanged occupants retain their sprite');
      assert.equal(radios[3].fire('keydown', { key: 'ArrowDown' }).defaultPrevented, false);
      assert.equal(doc.activeElement, jobs[3]);
      field.destroy();
      assert.equal(host.children.length, 0);
      assert.ok(Object.values(root.events).every(set => set.size === 0));
    }
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});

test('lanterns describe reaching up high and use a compact helper caption with a full accessible location', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement(tag) { return new Element(tag, this); }, activeElement: null };
  try {
    for (const grade of [3, 5]) {
      const host = document.createElement('section');
      host.className = 'large-text';
      const view = activity.mountField(host, { grade });
      const result = fresh(grade);
      view.update(result.state, result.ui);
      const lanterns = host.querySelector('.helpday-job');
      assert.equal(lanterns.getAttribute('aria-label'), 'Hang lanterns, a helper must reach up high, empty. Send Kiko here.');
      view.update(assignHelper(result.state, 'lanterns', 'kiko').state, result.ui);
      const helper = host.querySelector('.helpday-helper');
      assert.equal(helper.querySelector('.helpday-at').textContent, 'lanterns');
      assert.match(helper.getAttribute('aria-label'), /On the lanterns\./);
      assert.match(lanterns.getAttribute('aria-label'), /a helper must reach up high\. Kiko is here, it fits\./);
      view.destroy();
    }
  } finally { globalThis.document = previous; }
});


test('another swaps job sets and completes after a round trip', () => {
  for (const grade of [3, 4, 5]) {
    const first = activity.start(null, { grade, chapter: 1 });
    let { state, ui } = activity.another(first.state, first.ui);
    assert.equal(state.request, 2);
    assert.notEqual(helpSetFor(grade, 2), helpSetFor(grade));
    for (const [job, helper] of Object.entries(helpSetFor(grade, 2).fits)) {
      ({ state, ui } = activity.act(state, ui, { type: 'field', helper }));
      ({ state, ui } = activity.act(state, ui, { type: 'field', job }));
    }
    assert.equal(helpdayReady(state), true);
    assert.deepEqual(activity.start(cleanHelpdayCreation(state), { grade, chapter: 1 }).state, state);
    assert.equal(activity.another(state, ui).state.request, 1);
  }
});

test('mounted board switches request sets without replacing controls', () => {
  const previous = globalThis.document, doc = new Doc(); globalThis.document = doc;
  try {
    const host = doc.createElement('section'); doc.body.append(host);
    const first = fresh(3), view = activity.mountField(host, { grade: 3 });
    view.update(first.state, first.ui);
    const jobs = host.querySelectorAll('.helpday-job'), helpers = host.querySelectorAll('.helpday-helper');
    const next = activity.another(first.state, first.ui);
    view.update(next.state, next.ui);
    assert.deepEqual(host.querySelectorAll('.helpday-job'), jobs);
    assert.deepEqual(jobs.map(button => button.dataset.job), helpSetFor(3, 2).jobIds);
    assert.deepEqual(helpers.map(button => button.dataset.helper), helpSetFor(3, 2).helperIds);
    assert.equal(helpers[0].getAttribute('aria-checked'), 'true');
    view.destroy();
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
