import test from 'node:test';
import assert from 'node:assert/strict';

import { Doc, Event } from './helpers/dom.js';

const doc = new Doc();
const speech = { cancels: 0, cancel() { this.cancels++; }, speak() {} };
Object.assign(globalThis, {
  document: doc,
  window: { innerWidth: 1920, innerHeight: 1080, addEventListener() {}, removeEventListener() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  speechSynthesis: speech,
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

const { createState, getCreations, getDraft, saveDraft, publishCreation, saveState, loadState } = await import('../src/progress.js');
const { figureMarkup } = await import('../src/ui/figures/index.js');
const { createMusicScene, ECHO_LINES, lanternStep } = await import('../src/ui/screens/music.js');
const { isEdited, lessonDone, lessonHint, defaultBandFor, pickEcho, setTrackNotes, toggleBeat, cycleNote } = await import('../src/ui/band.js');
const { withScope } = await import('../src/ui/save.js');

function fakeCtx(state = createState()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div');
  stage.className = 'stage';
  doc.body.append(stage);
  const ctx = {
    stage, gone: [], opened: [], said: [],
    getState: () => state,
    commit(next) { state = next; return state; },
    go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    speak() {}, announce() {},
    open: { help: (title, steps) => ctx.opened.push(steps) },
    scenes: { busy: false, pause() {} },
  };
  return ctx;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(b => b.dataset.id === id);
const at = grade => (grade === 0 ? { ...createState(), chapter: 0 } : { ...createState(), chapter: 1, grade });
const text = ctx => ctx.stage.querySelector('.dlg__text').textContent;
function completeLesson(ctx, grade) {
  if (grade === 0) { slot(ctx.stage, 'quiet').click(); return; }
  const lanterns = ctx.stage.querySelectorAll('button.music-lantern');
  if (grade === 2) {
    pickEcho(0).forEach((on, i) => { if ((lanterns[i].getAttribute('aria-pressed') === 'true') !== on) lanterns[i].click(); });
  } else lanterns[grade === 1 ? 1 : 0].click();
}

test('K: lanterns are pictures, Speed sign shows, no Echo/Form, Send band disabled until Play', () => {
  const ctx = fakeCtx(at(0)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('.music-lantern');
  assert.equal(ls.length, 8); assert.ok(ls.every(l => l.tagName === 'SPAN'));
  assert.ok(ctx.stage.querySelector('[data-sign="speed"]'));
  assert.equal(ctx.stage.querySelector('[data-sign="echo"]'), null);
  assert.equal(ctx.stage.querySelector('[data-sign="form"]'), null);
  assert.match(ctx.stage.querySelector('.music').innerHTML, /Slow and fast · high and low/);
  assert.equal(slot(ctx.stage, 'save').disabled, true);
  assert.match(text(ctx), /Who plays low/);
  slot(ctx.stage, 'quiet').click();
  assert.equal(slot(ctx.stage, 'save').disabled, false, 'See beat counts as played');
  assert.equal(slot(ctx.stage, 'quiet').querySelector('.cmd-slot__label').textContent, 'Stop');
  slot(ctx.stage, 'quiet').click();
  assert.equal(slot(ctx.stage, 'quiet').querySelector('.cmd-slot__label').textContent, 'See beat');
  ctx.stage.querySelector('.dlg__tab[data-act="help"]').click();
  assert.equal(ctx.opened[0].length, 4);
  scene.destroy();
});

test('grade 1: lantern buttons flip Cricket sound/rest, Kiko counts, Send band lights', () => {
  const ctx = fakeCtx(at(1)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  assert.equal(ls.length, 8);
  assert.equal(ctx.stage.querySelector('.music-lanterns').getAttribute('role'), 'group');
  assert.equal(ls[1].getAttribute('aria-pressed'), 'false');   // Cricket default: beat 2 is a rest
  assert.ok(ls[1].classList.contains('is-rest'));
  assert.equal(ls[1].querySelector('b').textContent, '–');
  assert.ok(ctx.stage.querySelector('.music-musician[data-id="percussion"]').classList.contains('is-lead'));
  assert.equal(slot(ctx.stage, 'save').disabled, true);
  ls[1].click();
  assert.equal(ls[1].getAttribute('aria-pressed'), 'true');
  assert.equal(ls[1].querySelector('b').textContent, '♪');
  assert.match(text(ctx), /Six sounds and two rests/);
  assert.equal(slot(ctx.stage, 'save').disabled, false);
  // keyboard: right along lanterns, down to the menu
  ls[0].focus();
  scene.handleIntent('right');
  assert.equal(doc.activeElement, ls[1]);
  scene.handleIntent('left'); scene.handleIntent('left');
  assert.equal(doc.activeElement, ls[0], 'stops at the end');
  scene.handleIntent('down');
  assert.ok(ctx.stage.querySelector('.music-menu').contains(doc.activeElement));
  ctx.stage.querySelector('.music-musician[data-id="bass"]').focus();
  scene.handleIntent('up');
  assert.equal(doc.activeElement, ls[0]);
  ls[1].click();
  assert.equal(slot(ctx.stage, 'save').disabled, true, 'restoring the default rhythm closes the gate');
  scene.destroy();
});

test('K: the opening instruction describes resting and rejoining the fresh band', () => {
  for (const largeText of [false, true]) {
    const state = at(0); state.settings.largeText = largeText;
    const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
    try {
      assert.match(text(ctx), /^Tap a friend to rest or join\./);
      if (largeText) assert.ok(text(ctx).length <= 56);
      const friends = ctx.stage.querySelectorAll('.music-musician');
      assert.ok(friends.slice(0, 3).every(friend => friend.getAttribute('aria-pressed') === 'true'));
      assert.equal(friends[3].getAttribute('aria-pressed'), 'false', 'Cricket starts resting in the quiet example at K');
      const kiko = friends.find(friend => friend.dataset.id === 'melody');
      kiko.click();
      assert.equal(kiko.getAttribute('aria-pressed'), 'false');
      assert.match(text(ctx), /^Kiko rests for now\./);
      kiko.click();
      assert.equal(kiko.getAttribute('aria-pressed'), 'true');
      assert.match(text(ctx), /^Kiko joins on the next beat\./);
    } finally { scene.destroy(); }
  }
});

test('each grade finishes its lesson and the published band stays ready after storage reload', async () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const ctx = fakeCtx(at(grade)), scene = createMusicScene(ctx); scene.mount();
    try {
      assert.equal(slot(ctx.stage, 'save').disabled, true, `grade ${grade} starts unready`);
      completeLesson(ctx, grade);
      assert.equal(slot(ctx.stage, 'save').disabled, false);
      slot(ctx.stage, 'save').click(); await tick();
      const card = ctx.stage.querySelector('.item-get');
      assert.ok(card);
      card.firstElementChild.click(); await tick();
      assert.ok(getCreations(ctx.getState()).music);
      assert.equal(isEdited(getCreations(ctx.getState()).music, grade), grade > 0, 'only K may send an untouched score');
      assert.equal(lessonDone(getCreations(ctx.getState()).music, {}, grade), grade > 0, 'later lessons survive without scene flags');
      assert.equal(saveState(ctx.getState(), storage), true);
    } finally { scene.destroy(); }
    const restored = loadState(storage);
    const ctx2 = fakeCtx(restored), scene2 = createMusicScene(ctx2); scene2.mount();
    try { assert.equal(slot(ctx2.stage, 'save').disabled, false, `grade ${grade} completed band stays ready`); }
    finally { scene2.destroy(); }
    const other = { ...restored, chapter: 1, grade: grade === 5 ? 1 : grade + 1 };
    const ctx3 = fakeCtx(other), scene3 = createMusicScene(ctx3); scene3.mount();
    try { assert.equal(slot(ctx3.stage, 'save').disabled, true, 'completion does not unlock another grade'); }
    finally { scene3.destroy(); }
  }
});

test('matching lesson drafts survive reload without publishing or saving scene flags', () => {
  for (const preset of ['minecraft', 'meadow']) for (const grade of [1, 2, 3, 4, 5]) {
    const state = at(grade), band = defaultBandFor(grade, preset);
    const changed = grade === 1 ? toggleBeat(band, 'percussion', 1)
      : grade === 2 ? setTrackNotes(band, 'percussion', pickEcho(0).map(on => on ? 0 : null)) : cycleNote(band, 'melody', 0);
    const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    assert.equal(saveState(saveDraft(state, 'music', withScope(changed, state)), storage), true);
    const restored = loadState(storage);
    assert.equal(getCreations(restored).music, undefined);
    const ctx = fakeCtx(restored), scene = createMusicScene(ctx); scene.mount();
    try {
      assert.equal(slot(ctx.stage, 'save').disabled, false, `${preset}, grade ${grade} saved lesson is ready`);
      for (const key of ['played', 'playedOnce', 'echoed', 'published']) assert.equal(Object.hasOwn(getDraft(ctx.getState(), 'music'), key), false);
    } finally { scene.destroy(); }
  }
});

test('already published default bands bypass the lesson at every grade, including after a preset switch', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const state = at(grade);
    state.settings.musicAutoplay = false;
    const completed = publishCreation(state, 'music', withScope(defaultBandFor(grade), state));
    const ctx = fakeCtx(completed), scene = createMusicScene(ctx); scene.mount();
    try {
      assert.equal(slot(ctx.stage, 'save').disabled, false);
      ctx.stage.querySelector('.music-preset').click();
      ctx.stage.querySelector('[data-preset="meadow"]').click();
      assert.equal(slot(ctx.stage, 'save').disabled, false, 'published status is independent of the current preset');
      slot(ctx.stage, 'quiet').click(); slot(ctx.stage, 'quiet').click();
      assert.equal(text(ctx), 'See beat stopped. Your song is safe.');
    } finally { scene.destroy(); }
  }
});

test('grades 1–5 keep Send band off after listening, Speed and friends, and explain the missing lesson', async () => {
  for (const grade of [1, 2, 3, 4, 5]) for (const largeText of [false, true]) {
    const state = at(grade);
    state.settings.largeText = largeText; state.settings.musicAutoplay = false;
    const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
    try {
      ctx.stage.querySelector('[data-sign="speed"]').click();
      for (const friend of ctx.stage.querySelectorAll('.music-musician')) friend.click();
      slot(ctx.stage, 'play').click(); await tick();
      assert.equal(slot(ctx.stage, 'save').disabled, true, `grade ${grade}: Play and mix do not finish the lesson`);
      slot(ctx.stage, 'quiet').click();
      assert.equal(slot(ctx.stage, 'save').disabled, true, 'See beat does not finish it either');
      slot(ctx.stage, 'quiet').click();
      const pages = [text(ctx)];
      while (!ctx.stage.querySelector('.dlg__more').hidden) { ctx.stage.querySelector('.dlg__more').click(); pages.push(text(ctx)); }
      assert.equal(pages.join(' '), `See beat stopped. ${lessonHint(grade)}`);
      assert.ok(pages.every(page => page.length <= (largeText ? 56 : 96)));
      slot(ctx.stage, 'save').click(); await tick();
      assert.equal(ctx.stage.querySelector('.item-get'), null);
      assert.equal(getCreations(ctx.getState()).music, undefined);
      ctx.stage.querySelector('.dlg__tab[data-act="help"]').click();
      assert.equal(ctx.opened.at(-1).at(-1), lessonHint(grade).replace('then Send band', 'then tap Send band'));
    } finally { scene.destroy(); }
  }
});

test('grade 3: lanterns cycle Kiko notes, hang by pitch, Kiko names the shape', () => {
  const ctx = fakeCtx(at(3)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  assert.equal(ls[0].querySelector('b').textContent, 'Mi');
  assert.equal(ls[0].style['--step'], '38px');
  assert.equal(ls[1].querySelector('b').textContent, '–'); assert.equal(ls[1].style['--step'], '96px');
  ls[1].click();
  assert.equal(ls[1].querySelector('b').textContent, 'Do'); assert.equal(ls[1].style['--step'], '76px');
  assert.match(text(ctx), /Up and down|goes/);
  assert.equal(lanternStep(2), 38);
  assert.ok(ctx.stage.querySelector('.music-musician[data-id="melody"]').classList.contains('is-lead'));
  assert.equal(ctx.stage.querySelector('.music-badge') && ctx.stage.querySelector('.music').classList.contains('music--steady'), false);
  // speed sign
  const speed = ctx.stage.querySelector('[data-sign="speed"]');
  assert.equal(speed.querySelector('.music-sign__word').textContent, 'Steady');
  speed.click();
  assert.equal(speed.querySelector('.music-sign__word').textContent, 'Fast');
  assert.match(text(ctx), /Fast/);
  assert.equal(getDraft(ctx.getState(), 'music').tempo, 120);
  scene.destroy();
});

test('grade 4: Form stays at A B; grade 5 saves Form changes but only tune edits unlock Send band', () => {
  let ctx = fakeCtx(at(4)), scene = createMusicScene(ctx); scene.mount();
  let form = ctx.stage.querySelector('[data-sign="form"]');
  assert.equal(form.disabled, true);
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A B');
  assert.ok(ctx.stage.querySelector('.music').classList.contains('music--steady'));
  assert.equal(slot(ctx.stage, 'save').disabled, true, 'default AB band is not edited at grade 4');
  form.click();
  assert.equal(slot(ctx.stage, 'save').disabled, true);
  ctx.stage.querySelector('button.music-lantern').click();
  assert.equal(slot(ctx.stage, 'save').disabled, false);
  scene.destroy();
  ctx = fakeCtx(at(5)); scene = createMusicScene(ctx); scene.mount();
  form = ctx.stage.querySelector('[data-sign="form"]');
  assert.equal(form.disabled, false);
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A B A');
  form.click();
  assert.equal(form.querySelectorAll('b').map(b => b.textContent).join(' '), 'A');
  assert.match(text(ctx), /Just tune A/);
  assert.equal(getDraft(ctx.getState(), 'music').form, 'A');
  assert.equal(slot(ctx.stage, 'save').disabled, true, 'Form alone does not finish tune A');
  ctx.stage.querySelector('button.music-lantern').click();
  assert.equal(slot(ctx.stage, 'save').disabled, false);
  scene.destroy();
});

test('grade 4 restores A B on older saved bands without Form, preserving every note and mix setting', async () => {
  for (const preset of ['minecraft', 'meadow']) {
    const state = at(4), { form, ...oldBand } = defaultBandFor(4, preset);
    oldBand.masterVolume = 0; oldBand.tempo = 120;
    const legacy = { ...state, drafts: { 'chapter-1-grade-4': { music: withScope(oldBand, state) } } };
    assert.equal(Object.hasOwn(legacy.drafts['chapter-1-grade-4'].music, 'form'), false);
    const restored = loadState({ getItem: key => key === 'all-aboard-demo-v2' ? JSON.stringify(legacy) : null });
    assert.equal(getDraft(restored, 'music').form, 'A', 'the loader supplies A before the scene can inspect the save');
    const ctx = fakeCtx(restored), scene = createMusicScene(ctx); scene.mount();
    try {
      const sign = ctx.stage.querySelector('[data-sign="form"]');
      assert.equal(sign.disabled, true);
      assert.equal(sign.querySelectorAll('b').map(b => b.textContent).join(' '), 'A B');
      assert.equal(slot(ctx.stage, 'save').disabled, true, 'repairing the form is not the melody lesson');
      ctx.stage.querySelector('.music-back').click(); await tick();
      const saved = getDraft(ctx.getState(), 'music');
      assert.equal(saved.form, 'AB');
      assert.deepEqual(saved.tracks, oldBand.tracks);
      assert.equal(saved.tempo, oldBand.tempo); assert.equal(saved.masterVolume, 0);
    } finally { scene.destroy(); }
  }
});

test('musician names describe the selected piano or Meadow sounds after a preset switch', () => {
  const state = at(3); state.settings.musicAutoplay = false;
  const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
  try {
    const nori = ctx.stage.querySelector('.music-musician[data-id="voice"]');
    const kiko = ctx.stage.querySelector('.music-musician[data-id="melody"]');
    assert.match(nori.getAttribute('aria-label'), /middle piano/);
    assert.equal(nori.querySelector('.music-name__text').textContent, 'Nori · Middle');
    assert.match(kiko.getAttribute('aria-label'), /high piano/);
    ctx.stage.querySelector('.music-preset').click();
    ctx.stage.querySelector('[data-preset="meadow"]').click();
    assert.match(nori.getAttribute('aria-label'), /Doo-doo singer/);
    assert.equal(nori.querySelector('.music-name__text').textContent, 'Nori · Singer');
    assert.match(kiko.getAttribute('aria-label'), /Whistling bird/);
    nori.click(); nori.click();
    assert.match(text(ctx), /I sing in the middle/);
  } finally { scene.destroy(); }
});

// Fake intervals and a monotonic clock drive silent Echo and See beat without real waits.
const realSetInterval = globalThis.setInterval, realClearInterval = globalThis.clearInterval;
const realPerformance = globalThis.performance;
const timers = new Map(); let timerId = 0, timerNow = 0;
function fakeTimers() {
  timers.clear(); timerNow = 0;
  globalThis.performance = { now: () => timerNow };
  globalThis.setInterval = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  globalThis.clearInterval = id => { timers.delete(id); };
}
function realTimers() { globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval; globalThis.performance = realPerformance; }
const runTicks = n => {
  for (let i = 0; i < n && timers.size; i++) {
    timerNow += Math.min(...[...timers.values()].map(t => t.delay));
    for (const t of [...timers.values()]) t.fn();
  }
};

test('audible Echo lights follow scheduled audio after a delayed tick and stop after eight beats', async () => {
  fakeTimers();
  const original = { AudioContext: globalThis.AudioContext, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const starts = [], frames = new Map(); let context, frameId = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  globalThis.AudioContext = class {
    constructor() { context = this; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {}, disconnect() {} }; }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() { return { frequency: parameter(), connect() {}, disconnect() {}, start(time) { starts.push(time); }, stop() {}, addEventListener() {} }; }
  };
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
  try {
    ctx.stage.querySelector('[data-sign="echo"]').click(); await tick();
    const lanterns = ctx.stage.querySelectorAll('.music-lantern');
    assert.ok(lanterns.every(l => !l.classList.contains('is-lit')), 'lights wait for the audio lead-in');
    context.currentTime = 2; timerNow = 2000;
    for (const timer of [...timers.values()]) timer.fn();
    assert.ok(starts.some(time => Math.abs(time - 2.055) < 1e-9), 'Cricket scheduled the fourth beat at 2.055 seconds');
    context.currentTime = 2.055; paint();
    assert.deepEqual(lanterns.map(l => l.classList.contains('is-lit')), [false, false, false, true, false, false, false, false]);
    assert.ok(ctx.stage.querySelector('.music-musician[data-id="percussion"]').classList.contains('is-performing'));
    // A later paint catches up through the last beat and the next phrase boundary.
    context.currentTime = .055 + 8 * 60 / 90 + .001;
    for (const timer of [...timers.values()]) timer.fn();
    paint();
    assert.equal(text(ctx), ECHO_LINES.copy);
    assert.ok(lanterns.every(l => l.classList.contains('is-rest') && !l.classList.contains('is-lit')));
    assert.equal(timers.size, 0, 'audio scheduler is stopped');
    assert.equal(frames.size, 0, 'stopping from onBeat leaves no animation frame');
    // If the browser suspends a later demonstration, it must not stay busy waiting for beats.
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    echo.click(); await tick();
    context.state = 'suspended'; context.onstatechange();
    assert.ok(!echo.classList.contains('is-busy'));
    assert.match(text(ctx), /^Sound was interrupted\./);
    assert.equal(timers.size, 0);
    assert.equal(frames.size, 0);
  } finally {
    scene.destroy(); realTimers();
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test('silent Echo uses elapsed time after delayed callbacks at every speed', async () => {
  fakeTimers();
  try {
    for (const speedTaps of [0, 1, 2]) {
      const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
      try {
        for (let i = 0; i < speedTaps; i++) ctx.stage.querySelector('[data-sign="speed"]').click();
        ctx.stage.querySelector('[data-sign="echo"]').click(); await tick();
        const lanterns = ctx.stage.querySelectorAll('.music-lantern');
        const interval = [...timers.values()][0], started = timerNow;
        timerNow = started + interval.delay * 3.1; interval.fn();
        assert.deepEqual(lanterns.map(l => l.classList.contains('is-lit')), [false, false, false, true, false, false, false, false]);
        timerNow = started + interval.delay * 8.1; interval.fn();
        assert.equal(text(ctx), ECHO_LINES.copy);
        assert.equal(timers.size, 0);
      } finally { scene.destroy(); }
    }
  } finally { realTimers(); }
});

test('grade 2: Echo plays a demo at the band’s speed, clears Cricket, a live match ends it, a wrong copy is told', async () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    assert.ok(echo);
    echo.click();
    await tick(); await tick();
    assert.equal(text(ctx), ECHO_LINES.listen);
    assert.ok(echo.classList.contains('is-busy'));
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 90], 'the demo ticks at the band tempo');
    const ls = ctx.stage.querySelectorAll('button.music-lantern');
    assert.ok(ls[0].classList.contains('is-lit'), 'beat 1 lit by the ticker (pattern 0 starts with a sound)');
    runTicks(8);
    assert.match(text(ctx), /Your turn/);
    assert.ok(ls.every(l => l.classList.contains('is-rest')), 'rail cleared to rests');
    assert.ok(!echo.classList.contains('is-busy'));
    assert.equal(timers.size, 0, 'the demo clock is gone');
    assert.equal(slot(ctx.stage, 'save').disabled, true, 'watching the demo and clearing Cricket do not complete Echo');
    // a wrong copy with as many sounds as the rhythm (1, 4, 7) is told, not praised
    ls[1].click(); ls[2].click();
    assert.match(text(ctx), /Two sounds and six rests/, 'the first taps are just counted');
    ls[4].click();
    assert.equal(text(ctx), ECHO_LINES.notYet);
    assert.equal(slot(ctx.stage, 'save').disabled, true, 'a wrong copy is not ready');
    // now the right one
    ls[1].click(); ls[2].click(); ls[4].click();
    ls[0].click(); ls[3].click(); ls[6].click();
    assert.equal(text(ctx), ECHO_LINES.matched);
    assert.equal(slot(ctx.stage, 'save').disabled, false, 'matching the rhythm completes the lesson');
    ls[1].click();
    assert.equal(lessonDone(getDraft(ctx.getState(), 'music'), {}, 2), false, 'the next rhythm need not match a demonstration');
    assert.equal(slot(ctx.stage, 'save').disabled, false, 'this visit remembers the successful Echo while making one back');
    scene.destroy();
  } finally { realTimers(); }
});

test('grade 2: a Sounds-window edit during the demo ends the demo; tab-hide says the demo stopped', async () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    echo.click(); await tick(); await tick();
    assert.ok(echo.classList.contains('is-busy'));
    slot(ctx.stage, 'tunes').click();
    ctx.stage.querySelector('.win [data-tab="bass"]').click();   // Cricket is the lead here; Sora has Tune buttons
    const pattern = ctx.stage.querySelector('.win .sounds-pattern');
    assert.ok(pattern, 'the Sounds window has Tune buttons for Sora');
    pattern.click();
    assert.ok(!echo.classList.contains('is-busy'), 'the demo ended on the edit');
    assert.equal(timers.size, 0, 'no demo clock left');
    assert.notEqual(text(ctx), ECHO_LINES.listen);
    ctx.stage.querySelector('.win__close').click();
    // a demo cut by hiding the tab leaves an honest line
    echo.click(); await tick(); await tick();
    assert.equal(text(ctx), ECHO_LINES.listen);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); doc.hidden = false;
    assert.equal(text(ctx), ECHO_LINES.stopped);
    assert.ok(!echo.classList.contains('is-busy'));
    scene.destroy();
  } finally { realTimers(); }
});

test('Echo retries replay the target until a successful copy unlocks the next rhythm', async () => {
  fakeTimers();
  const ctx = fakeCtx(at(2)), scene = createMusicScene(ctx); scene.mount();
  try {
    const echo = ctx.stage.querySelector('[data-sign="echo"]');
    const lanterns = ctx.stage.querySelectorAll('button.music-lantern');
    const demonstrate = async () => {
      echo.click(); await tick();
      const mask = [lanterns[0].classList.contains('is-lit')];
      for (let beat = 1; beat < 8; beat++) { runTicks(1); mask.push(lanterns[beat].classList.contains('is-lit')); }
      runTicks(1);
      assert.ok(lanterns.every(l => l.classList.contains('is-rest')));
      return mask;
    };
    const first = await demonstrate();
    assert.deepEqual(first, [true, false, false, true, false, false, true, false]);
    for (const beat of [1, 2, 4]) lanterns[beat].click();
    assert.equal(text(ctx), ECHO_LINES.notYet);
    assert.deepEqual(await demonstrate(), first, 'an incorrect copy retries the same target');
    // Interrupt a retry before the demonstration finishes, then replay the same target again.
    echo.click(); await tick(); runTicks(2);
    scene.pause();
    assert.equal(text(ctx), ECHO_LINES.stopped);
    assert.deepEqual(await demonstrate(), first, 'stopping a demo does not skip its target');
    for (const beat of [0, 3, 6]) lanterns[beat].click();
    assert.equal(text(ctx), ECHO_LINES.matched);
    assert.deepEqual(await demonstrate(), [true, true, false, false, true, true, false, false]);
  } finally { scene.destroy(); realTimers(); }
});

test('See beat ticks at 60000 / tempo and restarts when Speed changes', () => {
  fakeTimers();
  try {
    const ctx = fakeCtx(at(3)), scene = createMusicScene(ctx); scene.mount();
    slot(ctx.stage, 'quiet').click();
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 90]);
    ctx.stage.querySelector('[data-sign="speed"]').click();   // Steady -> Fast
    assert.deepEqual([...timers.values()].map(t => t.delay), [60000 / 120], 'one ticker, at the new speed');
    slot(ctx.stage, 'quiet').click();
    assert.equal(timers.size, 0);
    scene.destroy();
  } finally { realTimers(); }
});

test('See beat keeps A highlighted when ABA shortens at either phrase boundary', () => {
  fakeTimers();
  try {
    for (const boundary of [8, 16]) {
      const ctx = fakeCtx(at(5)), scene = createMusicScene(ctx); scene.mount();
      try {
        slot(ctx.stage, 'quiet').click();
        runTicks(boundary - 1);
        ctx.stage.querySelector('[data-sign="form"]').click(); // ABA -> A
        runTicks(1);
        const letters = ctx.stage.querySelectorAll('.music-form__letters b');
        assert.equal(letters.length, 1);
        assert.ok(letters[0].classList.contains('is-now'), `A highlights at old beat ${boundary}`);
        assert.ok(ctx.stage.querySelectorAll('.music-lantern')[0].classList.contains('is-lit'));
        runTicks(8);
        assert.ok(letters[0].classList.contains('is-now'), 'A stays highlighted on the next loop');
      } finally { scene.destroy(); }
    }
  } finally { realTimers(); }
});

test('keyboard: up from the rail reaches the signs, arrows walk Village and the signs, down comes back', () => {
  const ctx = fakeCtx(at(5)), scene = createMusicScene(ctx); scene.mount();
  const ls = ctx.stage.querySelectorAll('button.music-lantern');
  const speed = ctx.stage.querySelector('[data-sign="speed"]'), form = ctx.stage.querySelector('[data-sign="form"]'), back = ctx.stage.querySelector('.music-back');
  ls[2].focus();
  scene.handleIntent('up');
  assert.equal(doc.activeElement, speed);
  scene.handleIntent('right');
  assert.equal(doc.activeElement, form);
  scene.handleIntent('right');
  assert.equal(doc.activeElement, ctx.stage.querySelector('.music-preset'), 'preset choices are reachable with the arrow keys');
  scene.handleIntent('right');
  assert.equal(doc.activeElement, ctx.stage.querySelector('.music-preset'), 'stops at the end');
  scene.handleIntent('left'); scene.handleIntent('left'); scene.handleIntent('left');
  assert.equal(doc.activeElement, back, 'Village is the left end of the top row');
  scene.handleIntent('up');
  assert.equal(doc.activeElement, back, 'nothing above the top row');
  scene.handleIntent('down');
  assert.equal(doc.activeElement, ls[0]);
  scene.destroy();
  // K: no lantern buttons, so up from a musician reaches Speed and down from Speed reaches the menu
  const k = fakeCtx(at(0)), kScene = createMusicScene(k); kScene.mount();
  k.stage.querySelector('.music-musician[data-id="bass"]').focus();
  kScene.handleIntent('up');
  assert.equal(doc.activeElement, k.stage.querySelector('[data-sign="speed"]'));
  kScene.handleIntent('down');
  assert.ok(k.stage.querySelector('.music-menu').contains(doc.activeElement));
  kScene.destroy();
});

test('keyboard: each stage row has one Tab stop; arrows and WASD move focus without editing', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const state = at(grade); state.settings.musicAutoplay = false;
    const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
    try {
      const rows = [
        [ctx.stage.querySelector('.music-back'), ...ctx.stage.querySelectorAll('.music-sign'), ctx.stage.querySelector('.music-preset')].filter(button => !button.disabled),
        ctx.stage.querySelectorAll('button.music-lantern'),
        ctx.stage.querySelectorAll('.music-musician'),
      ].filter(row => row.length);
      for (const row of rows) {
        assert.deepEqual(row.map(button => button.tabIndex), row.map((_, i) => i === 0 ? 0 : -1));
        row[0].focus();
        const right = new Event('keydown', { key: 'ArrowRight' }); row[0].dispatchEvent(right);
        assert.equal(right.defaultPrevented, true);
        assert.equal(doc.activeElement, row[1]);
        assert.deepEqual(row.map(button => button.tabIndex), row.map((_, i) => i === 1 ? 0 : -1));
        const modified = new Event('keydown', { key: 'ArrowRight', ctrlKey: true }); row[1].dispatchEvent(modified);
        assert.equal(modified.defaultPrevented, false);
        assert.equal(doc.activeElement, row[1]);
        row[1].dispatchEvent(new Event('keydown', { key: 'a' }));
        assert.equal(doc.activeElement, row[0]);
        row.at(-1).focus(); row.at(-1).dispatchEvent(new Event('keydown', { key: 'd' }));
        assert.equal(doc.activeElement, row.at(-1), 'the right edge never wraps');
        assert.deepEqual(row.map(button => button.tabIndex), row.map((_, i) => i === row.length - 1 ? 0 : -1));
      }
      assert.deepEqual(ctx.getState(), state, 'navigation saves no edits and earns no lesson credit');
      assert.equal(slot(ctx.stage, 'save').disabled, true);
      const friends = rows.at(-1);
      friends[1].click();
      assert.deepEqual(friends.map(button => button.tabIndex), [-1, 0, -1, -1], 'a tap updates the row cursor too');
      assert.equal(ctx.stage.querySelectorAll('.music-musician')[1], friends[1], 'edits preserve the mounted controls');
    } finally { scene.destroy(); }
  }
});

test('Send band publishes "Festival band" once edited; destroy clears everything', async () => {
  const ctx = fakeCtx(at(1)), scene = createMusicScene(ctx); scene.mount();
  slot(ctx.stage, 'save').click(); await tick();
  assert.equal(ctx.stage.querySelector('.item-get'), null, 'disabled finish does nothing');
  ctx.stage.querySelectorAll('button.music-lantern')[1].click();
  slot(ctx.stage, 'save').click(); await tick();
  const card = ctx.stage.querySelector('.item-get');
  assert.ok(card); assert.equal(card.querySelector('.item-get__name').textContent, 'Festival band!');
  card.firstElementChild.click(); await tick();
  assert.ok(getCreations(ctx.getState()).music);
  scene.destroy();
});

test('a literal legacy v2 music draft without form loads, preserves notes and is ready to send', () => {
  const legacy = {
    version: 2, hasStarted: true, chapter: 1, grade: 5,
    drafts: { 'chapter-1-grade-5': { music: {
      kind: 'music', chapter: 1, grade: 5, tempo: 90, masterVolume: 0.45,
      tracks: [
        { id: 'bass', enabled: true, pattern: 0, volume: 0.8, notes: [0, null, 2, null, 0, null, 4, null] },
        { id: 'voice', enabled: true, pattern: 0, volume: 0.65, notes: [null, 1, null, 3, null, 2, null, 0] },
        { id: 'melody', enabled: true, pattern: 0, volume: 0.55, notes: [0, 1, 2, 3, 4, null, 2, 0] },
        { id: 'percussion', enabled: true, pattern: 0, volume: 0.65, notes: [0, null, 0, null, 0, null, 0, null] },
      ],
    } } },
  };
  const draft = legacy.drafts['chapter-1-grade-5'].music;
  assert.equal(Object.hasOwn(draft, 'form'), false, 'the serialized fixture predates form');
  const loaded = loadState({ getItem: key => key === 'all-aboard-demo-v2' ? JSON.stringify(legacy) : null });
  assert.deepEqual(getDraft(loaded, 'music').tracks, draft.tracks);
  assert.equal(getDraft(loaded, 'music').form, 'A', 'loadState supplies the legacy fallback');
  const ctx = fakeCtx(loaded), scene = createMusicScene(ctx); scene.mount();
  try {
    assert.deepEqual(ctx.stage.querySelectorAll('button.music-lantern').map(b => b.querySelector('b').textContent), ['Do', 'Re', 'Mi', 'Sol', 'La', '–', 'Mi', 'Do']);
    assert.match(ctx.stage.querySelector('[data-sign="form"]').textContent, /A/);
    assert.equal(slot(ctx.stage, 'save').disabled, false, 'the restored draft is edited and ready');
  } finally { scene.destroy(); }
});

test('Sounds opens the other lane’s window and its edits flow through edit() with the save flag', () => {
  const ctx = fakeCtx(at(0)), scene = createMusicScene(ctx); scene.mount();
  slot(ctx.stage, 'tunes').click();
  const win = ctx.stage.querySelector('.win');
  assert.ok(win, 'window opened');
  assert.equal(win.querySelector('.win__title').textContent, 'Sounds');
  ctx.stage.querySelector('.win__close').click();
  assert.equal(ctx.stage.querySelector('.win'), null);
  slot(ctx.stage, 'tunes').click();
  assert.ok(ctx.stage.querySelector('.win'), 'reopens after close (handle cleared)');
  scene.destroy();
  assert.equal(ctx.stage.querySelector('.win'), null, 'destroy closes the window');
});

test('changing only Band volume in Sounds saves the draft, with completion credit only at K', () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const ctx = fakeCtx(at(grade)), scene = createMusicScene(ctx); scene.mount();
    try {
      assert.equal(slot(ctx.stage, 'save').disabled, true);
      slot(ctx.stage, 'tunes').click();
      const input = ctx.stage.querySelector('.sounds [data-master]');
      input.type = 'range'; input.value = '0.2';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      ctx.stage.querySelector('.win__close').click();
      assert.equal(getDraft(ctx.getState(), 'music').masterVolume, 0.2);
      assert.equal(slot(ctx.stage, 'save').disabled, grade !== 0);
    } finally { scene.destroy(); }
  }
});

test('K: Speed still completes the lesson without playback', () => {
  const state = at(0); state.settings.musicAutoplay = false;
  const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
  try {
    assert.equal(slot(ctx.stage, 'save').disabled, true);
    ctx.stage.querySelector('[data-sign="speed"]').click();
    assert.equal(getDraft(ctx.getState(), 'music').tempo, 120);
    assert.equal(slot(ctx.stage, 'save').disabled, false);
  } finally { scene.destroy(); }
});

test('Sounds edit feedback reaches a live region inside the modal with Read to me off', () => {
  const state = at(1); state.settings.autoRead = false;
  const ctx = fakeCtx(state), scene = createMusicScene(ctx); scene.mount();
  try {
    slot(ctx.stage, 'tunes').click();
    assert.equal(ctx.stage.querySelector('.music').inert, true);
    ctx.stage.querySelector('.sounds [data-tab="bass"]').click();
    const live = ctx.stage.querySelector('.win [aria-live="polite"]');
    assert.ok(live, 'feedback lives inside the active window');
    assert.equal(live.getAttribute('aria-atomic'), 'true');
    ctx.stage.querySelector('.sounds [data-pattern="1"]').click();
    assert.equal(live.textContent, 'Tune 2! It starts when the song comes back to beat 1.');
    ctx.stage.querySelector('.sounds [data-beat="1"]').click();
    assert.equal(live.textContent, 'Beat 2 is a sound now.');
    assert.equal(ctx.stage.querySelector('.win [aria-live="polite"]'), live, 'panel repaint keeps the live region');
    for (let at = live; at; at = at.parentElement) assert.equal(at.inert, false);
  } finally { scene.destroy(); }
});
