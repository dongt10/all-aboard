import test from 'node:test';
import assert from 'node:assert/strict';
import { Doc, Event, Target } from './helpers/dom.js';

const doc = new Doc();
class WindowTarget extends Target { dispatchEvent(event) { this.fire(event); } }
const win = new WindowTarget();
Object.assign(win, { innerWidth: 1920, innerHeight: 1080 });
const contexts = [], timers = new Map(), frames = new Map();
let holdResume = false, mediaCalls = 0, sequence = 0, clock = 0;
const parameter = () => ({ value: 0, events: [], setValueAtTime(value, time) { this.value = value; this.events.push([value, time]); }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
class AudioContext {
  constructor() { Object.assign(this, { currentTime: 0, state: holdResume ? 'suspended' : 'running', sampleRate: 44100, destination: {}, sources: [], resumes: [] }); contexts.push(this); }
  resume() {
    if (!holdResume) { this.state = 'running'; return Promise.resolve(); }
    return new Promise((resolve, reject) => this.resumes.push({ resolve: () => { this.state = 'running'; resolve(); }, reject }));
  }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { const node = { gain: parameter(), connect() {}, disconnect() {} }; (this.gains ??= []).push(node); return node; }
  createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {}, disconnect() {} }; }
  createBiquadFilter() { return { frequency: parameter(), Q: {}, connect() {}, disconnect() {} }; }
  createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { numberOfChannels: channels, length, sampleRate, getChannelData: i => data[i] }; }
  source(kind) {
    const source = { kind, frequency: parameter(), starts: [], stoppedNow: false, connect() {}, disconnect() {}, addEventListener() {}, start(time) { this.starts.push(time); }, stop(time) { if (time === undefined) this.stoppedNow = true; } };
    this.sources.push(source); return source;
  }
  createOscillator() { return this.source('tone'); }
  createBufferSource() { return this.source('noise'); }
}
class OfflineAudioContext extends AudioContext {
  constructor(channels, length, sampleRate) { super(); Object.assign(this, { offline: true, channels, length, sampleRate }); }
  startRendering() { return Promise.resolve(this.createBuffer(this.channels, this.length, this.sampleRate)); }
}
const speech = { cancels: 0, cancel() { this.cancels++; }, speak() {} };
Object.assign(globalThis, {
  document: doc, window: win, AudioContext, OfflineAudioContext,
  Audio: class { constructor() { mediaCalls++; throw new Error('Editable scores must use the band engine.'); } },
  MutationObserver: class { observe() {} disconnect() {} },
  speechSynthesis: speech, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  setInterval: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, delay }); return id; },
  clearInterval: id => timers.delete(id),
  requestAnimationFrame: fn => { const id = ++sequence; frames.set(id, fn); return id; },
  cancelAnimationFrame: id => frames.delete(id),
  performance: { now: () => clock },
});

const { createState, getCreations, getDraft, saveDraft, saveState, loadState } = await import('../src/progress.js');
const { createBandPreset, patternsFor, phraseLength, notesForBeat, renderBandPreview } = await import('../src/audio.js');
const { defaultBandFor, pickEcho, lessonHint } = await import('../src/ui/band.js');
const { withScope } = await import('../src/ui/save.js');
const { createMusicScene, ECHO_LINES } = await import('../src/ui/screens/music.js');
const { createParadeScene } = await import('../src/ui/screens/parade.js');
const { openHelpWindow } = await import('../src/ui/screens/windows.js');
const { closeWindow } = await import('../src/ui/window.js');
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const at = grade => ({ ...createState(), chapter: grade === 0 ? 0 : 1, grade: grade || 1 });
const slot = (ctx, id) => ctx.stage.querySelectorAll('.cmd-slot').find(button => button.dataset.id === id);
const label = (ctx, id) => slot(ctx, id).querySelector('.cmd-slot__label').textContent;
const live = () => contexts.filter(context => !context.offline);
const sounding = () => live().some(context => context.sources.some(source => source.starts.length && !source.stoppedNow));
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };

function mount(state = at(1), { pending = false } = {}) {
  doc.body.children = []; doc._active = null; doc.hidden = false;
  contexts.length = 0; timers.clear(); frames.clear(); mediaCalls = 0; holdResume = pending; clock = 0;
  const stage = doc.createElement('div'); stage.className = 'stage'; doc.body.append(stage);
  let scene;
  const ctx = {
    stage, spoken: [], gone: [], getState: () => state,
    commit(next) { state = next; return state; },
    speak(text) { const utterance = new Target(); ctx.spoken.push({ text, audioStopped: !sounding(), utterance }); return utterance; },
    announce() {}, go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    scenes: { busy: false, pause() { scene.pause(); } },
    open: { help: (title, steps) => openHelpWindow(ctx, title, steps) },
  };
  scene = createMusicScene(ctx); scene.mount();
  return { ctx, scene, cleanup() { closeWindow(stage); scene.destroy(); doc.hidden = false; } };
}
function choosePreset(ctx, id) {
  ctx.stage.querySelector('.music-preset').click();
  ctx.stage.querySelector(`[data-preset="${id}"]`).click();
}
function undoPreset(ctx) {
  ctx.stage.querySelector('.music-preset').click();
  ctx.stage.querySelector('[data-undo-preset]').click();
}
function advance(context, time) {
  context.currentTime = time;
  for (const timer of [...timers.values()]) if (timer.delay === 25) timer.fn();
  const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn());
}
const soundPlan = (context, leadIn) => context.sources.filter(source => source.starts.length).map(source => [source.kind, +(source.starts[0] - leadIn).toFixed(4), source.kind === 'tone' ? +source.frequency.events[0][0].toFixed(4) : null]);

test('fresh grades audition editable Minecraft without completion credit or recording playback', async () => {
  for (const grade of [0, 1, 2, 3, 4, 5]) {
    const state = at(grade), before = structuredClone(state), run = mount(state);
    try {
      await tick();
      assert.equal(run.ctx.stage.querySelector('.music-preset__name').textContent, 'Minecraft');
      assert.equal(label(run.ctx, 'play'), 'Stop');
      assert.equal(slot(run.ctx, 'save').disabled, true);
      assert.deepEqual(run.ctx.getState(), before, 'audition does not save or complete the band');
      assert.equal(mediaCalls, 0);
      assert.ok(sounding(), 'the authored engine is scheduled');
      assert.equal(run.ctx.stage.querySelector('.music-musician[data-id="percussion"]').getAttribute('aria-pressed'), String([1, 2, 4, 5].includes(grade)));
      assert.equal(defaultBandFor(grade).form, grade === 5 ? 'ABA' : grade === 4 ? 'AB' : 'A');
      slot(run.ctx, 'play').click();
      assert.equal(run.ctx.getState().settings.musicAutoplay, false);
      assert.equal(slot(run.ctx, 'save').disabled, true, 'stopping an audition is not playing a creation');
      slot(run.ctx, 'play').click(); await tick();
      assert.equal(slot(run.ctx, 'save').disabled, grade !== 0, 'explicit Play band completes only the K lesson');
      assert.equal(run.ctx.getState().settings.musicAutoplay, true);
      slot(run.ctx, 'play').click();
      assert.equal(run.ctx.stage.querySelector('.dlg__text').textContent, `Band stopped. ${grade === 0 ? 'Your song is safe.' : lessonHint(grade)}`);
    } finally { run.cleanup(); }
  }
});

test('saved legacy and edited Minecraft scores retain notes, zero volumes, form and preset on entry', async () => {
  for (const preset of ['meadow', 'minecraft']) {
    const state = at(3), band = createBandPreset(preset);
    if (preset === 'meadow') delete band.preset;
    band.tempo = 120; band.form = 'AB'; band.masterVolume = 0;
    band.tracks[1].volume = 0;
    band.tracks[2].notes = [4, 3, null, 2, 1, null, 0, 4];
    const saved = saveDraft(state, 'music', withScope(band, state)), target = storage();
    assert.equal(saveState(saved, target), true);
    const reloaded = loadState(target), before = structuredClone(getDraft(reloaded, 'music')), run = mount(reloaded);
    try {
      await tick();
      assert.deepEqual(getDraft(run.ctx.getState(), 'music'), before);
      assert.equal(before.preset, preset);
      assert.deepEqual(before.tracks, band.tracks);
      assert.equal(slot(run.ctx, 'save').disabled, false, 'the saved melody edit already completed the lesson');
      assert.equal(live().length, 0, 'saved zero volume prevents automatic playback');
      assert.equal(run.ctx.stage.querySelector('.music-preset__name').textContent.toLowerCase(), preset);
      run.ctx.stage.querySelector('button.music-lantern[data-beat="0"]').click();
      const edited = getDraft(run.ctx.getState(), 'music');
      assert.equal(edited.preset, preset);
      assert.equal(edited.masterVolume, 0);
      assert.equal(edited.tracks[1].volume, 0);
      assert.equal(edited.form, 'AB');
    } finally { run.cleanup(); }
  }
});

test('preset selection clears an unpublished melody lesson, and Undo restores the edited score', async () => {
  const state = at(5); state.settings.musicAutoplay = false;
  const band = defaultBandFor(5); band.tracks[2].notes[0] = 4;
  const run = mount(saveDraft(state, 'music', withScope(band, state)));
  try {
    const before = structuredClone(getDraft(run.ctx.getState(), 'music'));
    assert.equal(slot(run.ctx, 'save').disabled, false);
    choosePreset(run.ctx, 'minecraft');
    assert.deepEqual(getDraft(run.ctx.getState(), 'music'), before, 'choosing the current template never resets edits');
    choosePreset(run.ctx, 'meadow'); await tick();
    assert.equal(getDraft(run.ctx.getState(), 'music').preset, 'meadow');
    assert.equal(slot(run.ctx, 'save').disabled, true, 'loading or auditioning a template does not change its melody');
    undoPreset(run.ctx);
    assert.deepEqual(getDraft(run.ctx.getState(), 'music'), before);
    assert.equal(slot(run.ctx, 'save').disabled, false, 'Undo restores the completed melody lesson');
    run.ctx.stage.querySelector('.music-preset').click();
    assert.equal(run.ctx.stage.querySelector('[data-undo-preset]').disabled, true, 'Undo is one step');
  } finally { run.cleanup(); }
});

test('preset switches preserve the chosen form and master volume, and Undo restores every instrument edit', async () => {
  const state = at(5); state.settings.musicAutoplay = false;
  const band = defaultBandFor(5); band.form = 'AB'; band.masterVolume = 0;
  band.tracks[0].enabled = false; band.tracks[1].volume = .15; band.tracks[2].notes[0] = 4;
  const run = mount(saveDraft(state, 'music', withScope(band, state)));
  try {
    const before = structuredClone(getDraft(run.ctx.getState(), 'music'));
    choosePreset(run.ctx, 'meadow'); await tick();
    const selected = getDraft(run.ctx.getState(), 'music');
    assert.equal(selected.preset, 'meadow'); assert.equal(selected.form, 'AB'); assert.equal(selected.masterVolume, 0);
    assert.equal(slot(run.ctx, 'save').disabled, true, 'preserved mix and Form edits do not complete the new preset melody');
    assert.equal(live().length, 0, 'switching a silent score stays silent');
    undoPreset(run.ctx);
    assert.deepEqual(getDraft(run.ctx.getState(), 'music'), before);
    assert.equal(slot(run.ctx, 'save').disabled, false);
  } finally { run.cleanup(); }
});

test('Sounds tune choices edit the current preset bank while live mix controls preserve the score', async () => {
  for (const preset of ['minecraft', 'meadow']) {
    const state = at(0); state.settings.musicAutoplay = false;
    const band = defaultBandFor(0, preset), run = mount(saveDraft(state, 'music', withScope(band, state)));
    try {
      slot(run.ctx, 'play').click(); await tick();
      slot(run.ctx, 'tunes').click();
      assert.equal(label(run.ctx, 'play'), 'Stop', 'Sounds keeps the editable band playing');
      run.ctx.stage.querySelector('[data-tab="bass"]').click();
      run.ctx.stage.querySelector('[data-pattern="1"]').click();
      const changed = getDraft(run.ctx.getState(), 'music');
      assert.equal(changed.preset, preset);
      assert.deepEqual(changed.tracks[0].notes, patternsFor(preset).bass[1]);
      assert.deepEqual(changed.tracks.slice(1), band.tracks.slice(1));
      assert.equal(run.ctx.stage.querySelector('[data-pattern="1"]').getAttribute('aria-pressed'), 'true');
      run.ctx.stage.querySelector('[data-level="soft"]').click();
      const volume = run.ctx.stage.querySelector('[data-master]');
      volume.type = 'range'; volume.value = '0';
      volume.dispatchEvent(new Event('input')); volume.dispatchEvent(new Event('change'));
      const mixed = getDraft(run.ctx.getState(), 'music');
      assert.equal(mixed.tracks[0].volume, .45); assert.equal(mixed.masterVolume, 0);
      assert.deepEqual(mixed.tracks[0].notes, patternsFor(preset).bass[1]);
      run.ctx.stage.querySelector('.win__close').click();
      assert.equal(label(run.ctx, 'play'), 'Stop');
      assert.equal(mediaCalls, 0);
    } finally { run.cleanup(); }
  }
});

test('pending automatic band playback is canceled by scene interruptions and never resumes on tab return', async () => {
  const actions = {
    Stop: (ctx, scene) => slot(ctx, 'play').click(),
    Help: ctx => ctx.stage.querySelector('[data-act="help"]').click(),
    presets: ctx => ctx.stage.querySelector('.music-preset').click(),
    'See beat': ctx => slot(ctx, 'quiet').click(),
    hide: () => { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); },
    pagehide: () => win.dispatchEvent(new Event('pagehide')),
    Village: ctx => ctx.stage.querySelector('.music-back').click(),
    pause: (ctx, scene) => scene.pause(),
    destroy: (ctx, scene) => scene.destroy(),
  };
  for (const [name, action] of Object.entries(actions)) {
    const run = mount(at(2), { pending: true });
    try {
      const context = live()[0];
      assert.equal(context.resumes.length, 1);
      action(run.ctx, run.scene);
      context.resumes[0].resolve(); await tick();
      assert.equal(context.sources.length, 0, `${name} prevents a canceled resume from scheduling notes`);
      closeWindow(run.ctx.stage); doc.hidden = false;
      doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('pageshow')); await tick();
      assert.equal(context.resumes.length, 1, `${name} requires explicit playback to restart`);
      assert.equal(mediaCalls, 0);
    } finally { run.cleanup(); }
  }
});

test('Read to me keeps explicit Play and See beat active during narration', async () => {
  const state = at(3); state.settings.autoRead = true;
  const run = mount(state);
  try {
    await tick(); assert.equal(live().length, 0); assert.ok(run.ctx.spoken.length > 0);
    slot(run.ctx, 'play').click(); await tick();
    assert.equal(label(run.ctx, 'play'), 'Stop'); assert.ok(sounding(), 'transport feedback does not cancel explicit playback');
    const master = live()[0].gains[0].gain;
    const fullVolume = master.value;
    run.ctx.stage.querySelector('[data-act="hear"]').click();
    assert.equal(run.ctx.spoken.at(-1).audioStopped, false);
    assert.equal(label(run.ctx, 'play'), 'Stop');
    assert.equal(master.value, fullVolume * .25, 'narration ducks the live band');
    run.ctx.spoken.at(-1).utterance.fire(new Event('end'));
    assert.equal(master.value, fullVolume, 'speech completion restores band volume');
    run.ctx.stage.querySelector('button.music-lantern[data-beat="0"]').click();
    assert.equal(label(run.ctx, 'play'), 'Stop', 'automatic narration after editing keeps playback active');
    slot(run.ctx, 'tunes').click();
    assert.equal(master.value, fullVolume, 'opening Sounds releases canceled narration ducking');
    closeWindow(run.ctx.stage);
    slot(run.ctx, 'quiet').click(); await tick();
    assert.equal(label(run.ctx, 'quiet'), 'Stop', 'Read to me does not cancel the silent beat display');
    assert.equal(sounding(), false);
    run.ctx.stage.querySelector('button.music-lantern[data-beat="1"]').click();
    assert.equal(label(run.ctx, 'quiet'), 'Stop', 'automatic narration keeps the beat display active');
  } finally { run.cleanup(); }
});

test('grade 2 Echo with Read to me finishes eight beats and leaves Minecraft melody editable', async () => {
  const state = at(2); state.settings.autoRead = true;
  const run = mount(state);
  try {
    run.ctx.stage.querySelector('[data-sign="echo"]').click(); await tick();
    assert.ok(run.ctx.stage.querySelector('[data-sign="echo"]').classList.contains('is-busy'));
    advance(live()[0], 8.1);
    assert.equal(run.ctx.stage.querySelector('[data-sign="echo"]').classList.contains('is-busy'), false);
    assert.match(run.ctx.stage.querySelector('.dlg__text').textContent, /Your turn/);
    const copied = getDraft(run.ctx.getState(), 'music');
    assert.equal(copied.preset, 'minecraft');
    assert.deepEqual(copied.tracks.find(track => track.id === 'melody').notes, patternsFor('minecraft').melody[0]);
    const existing = copied.tracks.find(track => track.id === 'percussion').notes;
    assert.deepEqual(existing, defaultBandFor(2).tracks.find(track => track.id === 'percussion').notes);
    assert.equal(slot(run.ctx, 'save').disabled, true, 'listening to Echo does not finish the lesson');
    for (const [beat, on] of pickEcho(0).entries()) if (on !== (existing[beat] !== null)) run.ctx.stage.querySelector(`button.music-lantern[data-beat="${beat}"]`).click();
    assert.equal(run.ctx.stage.querySelector('.dlg__text').textContent, ECHO_LINES.matched);
    assert.equal(slot(run.ctx, 'save').disabled, false);
    assert.equal(sounding(), false);
  } finally { run.cleanup(); }
});

test('explicit quiet preference survives storage reload and a new preset stays editable', async () => {
  const run = mount(at(1)), target = storage();
  let saved;
  try {
    await tick(); slot(run.ctx, 'quiet').click();
    assert.equal(run.ctx.getState().settings.musicAutoplay, false);
    run.ctx.stage.querySelector('button.music-lantern[data-beat="1"]').click();
    assert.equal(saveState(run.ctx.getState(), target), true); saved = loadState(target);
  } finally { run.cleanup(); }
  const reopened = mount(saved);
  try {
    await tick(); assert.equal(live().length, 0);
    assert.equal(getDraft(reopened.ctx.getState(), 'music').preset, 'minecraft');
    assert.equal(getDraft(reopened.ctx.getState(), 'music').tracks.find(track => track.id === 'percussion').notes[1], 0);
    slot(reopened.ctx, 'play').click(); await tick();
    assert.ok(sounding()); assert.equal(reopened.ctx.getState().settings.musicAutoplay, true);
  } finally { reopened.cleanup(); }
});

test('quiet preference and Read to me skip preset audition', async () => {
  for (const setting of ['musicAutoplay', 'autoRead']) {
    const state = at(3); state.settings[setting] = setting === 'autoRead';
    const run = mount(state);
    try {
      await tick(); choosePreset(run.ctx, 'meadow'); await tick();
      assert.equal(getDraft(run.ctx.getState(), 'music').preset, 'meadow');
      assert.equal(live().length, 0, `${setting} prevents preset audio`);
    } finally { run.cleanup(); }
  }
});

test('quiet Echo starts visually without audio and preserves the child rail', async () => {
  const state = at(2); state.settings.musicAutoplay = false;
  const initial = defaultBandFor(2).tracks.find(track => track.id === 'percussion').notes;
  const run = mount(state);
  try {
    run.ctx.stage.querySelector('[data-sign="echo"]').click(); await tick();
    assert.equal(live().length, 0);
    assert.ok(run.ctx.stage.querySelector('[data-sign="echo"]').classList.contains('is-busy'));
    assert.ok(run.ctx.stage.querySelector('button.music-lantern[data-beat="0"]').classList.contains('is-lit'));
    clock = 10000; for (const timer of [...timers.values()]) timer.fn();
    assert.equal(run.ctx.stage.querySelector('[data-sign="echo"]').classList.contains('is-busy'), false);
    assert.deepEqual(getDraft(run.ctx.getState(), 'music').tracks.find(track => track.id === 'percussion').notes, initial);
    assert.equal(live().length, 0);
  } finally { run.cleanup(); }
});

test('published Minecraft edits and B phrase drive the same notes in stage, WAV rendering and parade', async () => {
  const state = at(4); state.settings.musicAutoplay = false;
  const run = mount(state);
  let parade;
  try {
    run.ctx.stage.querySelector('button.music-lantern[data-beat="0"]').click();
    slot(run.ctx, 'play').click(); await tick();
    const stageScore = getDraft(run.ctx.getState(), 'music'), stageContext = live()[0];
    advance(stageContext, (phraseLength(stageScore) - 1) * 60 / stageScore.tempo + .06);
    const stagePlan = soundPlan(stageContext, .055);
    slot(run.ctx, 'play').click();
    slot(run.ctx, 'save').click(); await tick();
    run.ctx.stage.querySelector('.item-get').firstElementChild.click(); await tick();
    const creation = getCreations(run.ctx.getState()).music;
    assert.equal(creation.preset, 'minecraft'); assert.equal(creation.form, 'AB');
    assert.equal(creation.tracks.find(track => track.id === 'melody').notes[0], 3);
    for (let i = 0; i < 8; i++) {
      const notes = notesForBeat(creation, 8 + i);
      for (const track of creation.tracks) {
        const expected = track.id === 'percussion' ? track.notes[i] : patternsFor('minecraft')[track.id][track.pattern ^ 1][i];
        assert.equal(notes.find(note => note.id === track.id)?.pitch ?? null, track.enabled && track.volume > 0 ? expected : null);
      }
    }
    run.scene.destroy();
    await renderBandPreview(creation, { phrases: 1 });
    const offline = contexts.find(context => context.offline), expected = soundPlan(offline, .05);
    assert.deepEqual(stagePlan, expected, 'stage and WAV use matching A/B notes and preset timbre');
    parade = createParadeScene(run.ctx); parade.mount();
    slot(run.ctx, 'play').click(); await tick();
    const context = live().at(-1), step = 60 / creation.tempo;
    advance(context, (phraseLength(creation) - 1) * step + .06);
    assert.deepEqual(soundPlan(context, .055), expected, 'parade and WAV use the saved edited score and matching preset timbre');
    assert.equal(mediaCalls, 0);
  } finally { parade?.destroy(); run.cleanup(); }
});
