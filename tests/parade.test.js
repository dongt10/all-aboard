import test from 'node:test';
import assert from 'node:assert/strict';
import { paradeLineup, paradeCommands, paradeStatus, paradeOpening, paradeEnding, PARADE_LINES, PARADE_LAPS, PARADE_ORDER } from '../src/ui/parade-lineup.js';
import { PAGE_CHARS } from '../src/ui/dialogue.js';
import { createDefaultBand } from '../src/audio.js';

const sentences = text => text.split(/(?<=[.!?])\s+/);
const fitsPage = (text, label = text) => {
  assert.ok(text.length <= PAGE_CHARS.normal, label);
  for (const sentence of sentences(text)) assert.ok(sentence.length <= PAGE_CHARS.large, sentence);
};

test('the parade marches made creations in subject order', () => {   // Review Focus 2
  assert.deepEqual(paradeLineup({ music: { kind: 'music' }, art: { kind: 'art' }, math: { kind: 'math' } }).map(m => m.id), ['math', 'art', 'music']);
  assert.deepEqual(paradeLineup({}), []);
});
test('the lineup keeps each creation and skips empty or unknown entries', () => {
  const art = { kind: 'art' };
  assert.deepEqual(paradeLineup({ art, pip: { kind: 'x' }, science: null }), [{ id: 'art', creation: art }]);
  assert.deepEqual(paradeLineup(undefined), []);
});
test('band controls enable only what makes sense', () => {
  assert.deepEqual(paradeCommands({ hasBand: false, playing: false }).map(c => [c.label, Boolean(c.disabled)]), [['Play band', true], ['Stop', true], ['March again', false], ['Village', false]]);
  assert.deepEqual(paradeCommands({ hasBand: true, playing: true }).map(c => Boolean(c.disabled)), [true, false, false, false]);
  assert.deepEqual(paradeCommands({ hasBand: true, playing: false }).map(c => Boolean(c.disabled)), [false, true, false, false]);
});
test('parade commands are short and each has an icon', () => {
  const commands = paradeCommands({ hasBand: true, playing: false });
  assert.deepEqual(commands.map(c => c.icon), ['music', 'stop', 'undo', 'home']);
  assert.equal(new Set(commands.map(c => c.id)).size, 4);
  assert.ok(commands.every(c => c.label.length <= 12));
});
test('band status lines point back to Kiko instead of to controls the parade does not have', () => {
  const band = createDefaultBand();
  assert.equal(paradeStatus('starting', 'starting', band), 'Starting your band…');
  assert.equal(paradeStatus('playing', 'playing', band), 'Your band is playing.');
  assert.equal(paradeStatus('stopped', 'stopped', band), 'Music stopped.');
  assert.equal(paradeStatus('stopped', 'unavailable', band), 'Sound could not start. The parade is still yours.');
  const resting = { ...band, tracks: band.tracks.map(track => ({ ...track, enabled: false })) };
  const muted = { ...band, tracks: band.tracks.map(track => ({ ...track, volume: 0 })) };
  assert.equal(paradeStatus('playing', 'playing', resting), 'Everyone is resting. Visit Kiko to add a note.');
  assert.equal(paradeStatus('playing', 'playing', muted), 'Friends are muted. Visit Kiko to turn them up.');
  assert.equal(paradeStatus('playing', 'playing', { ...band, masterVolume: 0 }), 'Sound is off. Visit Kiko to turn it up.');
  for (const item of [band, resting, muted, { ...band, masterVolume: 0 }]) assert.ok(paradeStatus('playing', 'playing', item).length <= PAGE_CHARS.large);
});

test('without a band, the status line and the opening say to visit Kiko first', () => {
  assert.equal(paradeStatus('playing', 'playing', null), 'Visit Kiko to make a band first.');
  assert.equal(paradeStatus('stopped', 'stopped', undefined), 'Visit Kiko to make a band first.');
  assert.equal(paradeOpening({ hasBand: true }), 'Your parade! Every idea belongs here.');
  assert.equal(paradeOpening({ hasBand: false }), 'Your parade! Every idea belongs here. Visit Kiko to make a band first.');
  assert.equal(paradeOpening(), paradeOpening({ hasBand: false }));
});
test('the parade ends after two laps and stops in a line-up', () => {
  assert.equal(PARADE_LAPS, 2);
  assert.deepEqual(paradeEnding({ laps: 0, made: 3 }), { over: false, line: null });
  assert.deepEqual(paradeEnding({ laps: 1, made: 3 }), { over: false, line: null });
  assert.deepEqual(paradeEnding({ laps: 2, made: 3 }), { over: true, line: 'The parade is over. Make more, and march again!' });
  assert.equal(paradeEnding({ laps: 5, made: 1 }).over, true);
  assert.deepEqual(paradeEnding(), { over: false, line: null });
});
test('with Calm motion the line-up shows at once with the same line', () => {
  assert.deepEqual(paradeEnding({ laps: 0, calm: true, made: 2 }), { over: true, line: PARADE_LINES.over });
  assert.deepEqual(paradeEnding({ laps: 0, calm: true, made: PARADE_ORDER.length }), { over: true, line: PARADE_LINES.complete });
});
test('without a band, the ending keeps saying why Play band is grayed out', () => {
  const line = 'The parade is over. Make more, and march again! Visit Kiko to make a band first.';
  assert.deepEqual(paradeEnding({ laps: 2, made: 2, hasBand: false }), { over: true, line });
  assert.deepEqual(paradeEnding({ laps: 0, calm: true, made: 2, hasBand: false }), { over: true, line });
  assert.deepEqual(paradeEnding({ laps: 2, made: 2, hasBand: true }), { over: true, line: PARADE_LINES.over });
  assert.equal(paradeEnding({ laps: 1, made: 2, hasBand: false }).over, false);
  fitsPage(line);
});
test('when every subject is made, the ending celebrates the whole festival', () => {
  assert.equal(PARADE_ORDER.length, 7);
  assert.equal(paradeEnding({ laps: 2, made: 7 }).line, 'Everyone marched! You made the whole festival.');
  assert.equal(paradeEnding({ laps: 2, made: 6 }).line, PARADE_LINES.over);
});
test('every parade line fits one dialogue page sentence by sentence, even with Bigger words', () => {
  for (const line of Object.values(PARADE_LINES)) fitsPage(line);
  fitsPage(paradeOpening({ hasBand: false }));
});

// ---- The scene and the windows, mounted under a tiny fake DOM (the same harness as tests/fixes-behavior.test.js,
// plus replaceWith, which the Guide header uses). Focus follows browser rules: hidden, inert, disabled or
// detached elements lose it. ----
import { Doc, El, Event } from './helpers/dom.js';

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

const { createState, publishCreation, getCreations, STORAGE_KEY } = await import('../src/progress.js');
const { createApp } = await import('../src/ui/app.js');
const { createParadeScene, HELP_STEPS } = await import('../src/ui/screens/parade.js');
const { openPauseWindow, openGuideWindow, RECORDING_LINES } = await import('../src/ui/screens/windows.js');
const { guideEntries } = await import('../src/ui/guide.js');

function fakeCtx(state = createState()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div');
  stage.className = 'stage';
  doc.body.append(stage);
  const ctx = {
    stage, gone: [], opened: [], spoken: [],
    getState: () => state,
    commit(next) { state = next; return state; },
    go(name, params) { ctx.gone.push([name, params]); return Promise.resolve(true); },
    speak(text) { ctx.spoken.push(text); }, announce() {},
    open: { help: (title, steps) => ctx.opened.push([title, steps]) },
    scenes: { busy: false, pause() {} },
  };
  return ctx;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(b => b.dataset.id === id);
const withBand = (state = createState()) => publishCreation(state, 'music', createDefaultBand());
const withArt = (state = createState()) => publishCreation(state, 'art', { kind: 'art', tiles: ['a'] });
const dialogueText = stage => stage.querySelector('.parade-dialogue .dlg__text').textContent;
const lap = (stage, name = 'parade-march', type = 'animationiteration') =>
  stage.querySelector('.parade-line').dispatchEvent(new Event(type, { animationName: name }));

test('parade Help: every step is a sentence a dialogue page can hold, and it names the commands', () => {
  assert.equal(HELP_STEPS.length, 4);
  for (const step of HELP_STEPS) for (const sentence of sentences(step)) assert.ok(sentence.length <= PAGE_CHARS.large, sentence);
  const all = HELP_STEPS.join(' ');
  for (const word of ['March again', 'Play band', 'Kiko', 'Village']) assert.ok(all.includes(word), word);
  assert.ok(all.includes('cross the street. Then they line up.'));
  assert.ok(!/\blaps?\b/i.test(all), 'no "laps" for the kindergarteners');
});

test('parade scene: band status does not replace the completion message', async () => {
  let state = withBand();
  for (const id of PARADE_ORDER.filter(id => id !== 'music')) state = publishCreation(state, id, { kind: id });
  const ctx = fakeCtx({ ...state, settings: { reducedMotion: true } });
  const scene = createParadeScene(ctx);
  scene.mount();
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.complete);
  const status = ctx.stage.querySelector('.parade [role="status"]');
  assert.equal(status.hidden, true);
  slot(ctx.stage, 'play').click();
  assert.equal(status.textContent, 'Starting your band…');
  await tick();
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.complete);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'Sound could not start. The parade is still yours.');
  ctx.stage.querySelector('.parade-dialogue').querySelectorAll('.dlg__tab').find(b => b.dataset.act === 'hear').click();
  assert.equal(ctx.spoken.at(-1), `${PARADE_LINES.complete} ${status.textContent}`);
  scene.destroy();
  assert.equal(ctx.stage.querySelector('.parade'), null);
});

test('parade scene: successful playback keeps completion and reads each status', async () => {
  const oldAudio = globalThis.AudioContext;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { ...node(), gain: param() }; }
    createDynamicsCompressor() { return { ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
    createOscillator() { return { ...node(), frequency: param(), start() {}, stop() {}, addEventListener() {} }; }
  };
  let state = createState();
  const band = createDefaultBand();
  band.tracks.forEach(track => { track.enabled = track.id === 'bass'; });
  state = publishCreation(state, 'music', band);
  for (const id of PARADE_ORDER.filter(id => id !== 'music')) state = publishCreation(state, id, { kind: id });
  const ctx = fakeCtx({ ...state, settings: { reducedMotion: true, largeText: true, autoRead: true } });
  const scene = createParadeScene(ctx);
  try {
    scene.mount();
    const status = ctx.stage.querySelector('.parade [role="status"]');
    const verify = expected => {
      assert.equal(dialogueText(ctx.stage), PARADE_LINES.complete);
      assert.equal(status.textContent, expected);
      assert.equal(ctx.spoken.at(-1), expected, 'auto-read announces the status');
      ctx.stage.querySelector('.parade-dialogue').querySelectorAll('.dlg__tab').find(b => b.dataset.act === 'hear').click();
      assert.equal(ctx.spoken.at(-1), `${PARADE_LINES.complete} ${expected}`);
    };
    slot(ctx.stage, 'play').click();
    verify('Starting your band…');
    await tick();
    verify('Your band is playing.');
    slot(ctx.stage, 'stop').click();
    verify('Music stopped.');
  } finally {
    scene.destroy();
    if (oldAudio === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = oldAudio;
  }
});

test('parade scene: two laps, then the marchers halt in the line-up and the ending line shows', async () => {
  const ctx = fakeCtx(withBand(withArt()));
  const scene = createParadeScene(ctx);
  scene.mount();
  const line = ctx.stage.querySelector('.parade-line');
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.opening);
  assert.ok(line.classList.contains('is-marching'));
  lap(ctx.stage);   // first lap done: the last lap walks in and halts
  assert.ok(!line.classList.contains('is-marching') && line.classList.contains('is-last-lap'), 'last lap animation');
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.opening, 'still marching');
  lap(ctx.stage, 'parade-last-lap', 'animationend');
  const root = ctx.stage.querySelector('.parade');
  assert.ok(root.classList.contains('is-over') && root.classList.contains('is-still'));
  assert.ok(!line.classList.contains('is-marching') && !line.classList.contains('is-last-lap'));
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.over);
  lap(ctx.stage, 'parade-last-lap', 'animationend');   // a stray event after the end changes nothing
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.over);
  // March again restarts from the left with the opening line.
  slot(ctx.stage, 'march').click();
  await tick();
  assert.ok(!root.classList.contains('is-over') && line.classList.contains('is-marching'));
  assert.equal(dialogueText(ctx.stage), PARADE_LINES.opening);
  assert.equal(slot(ctx.stage, 'play').disabled, false, 'Play band is enabled with a band');
  scene.destroy();
});

test('parade scene: without a band, Play band stays disabled and the ending still says to visit Kiko', async () => {
  const ctx = fakeCtx(withArt());
  const scene = createParadeScene(ctx);
  scene.mount();
  assert.equal(slot(ctx.stage, 'play').disabled, true);
  assert.equal(dialogueText(ctx.stage), paradeOpening({ hasBand: false }));
  lap(ctx.stage); lap(ctx.stage, 'parade-last-lap', 'animationend');
  assert.equal(dialogueText(ctx.stage), `${PARADE_LINES.over} ${PARADE_LINES.noBand}`);
  assert.equal(slot(ctx.stage, 'play').disabled, true);
  scene.destroy();
});

test('parade scene: with Calm motion the line-up shows at once, and Help opens the parade steps', () => {
  const state = { ...withArt(), settings: { reducedMotion: true } };
  const ctx = fakeCtx(state);
  const scene = createParadeScene(ctx);
  scene.mount();
  const root = ctx.stage.querySelector('.parade');
  assert.ok(root.classList.contains('is-over') && root.classList.contains('is-still'));
  assert.ok(!root.querySelector('.parade-line').classList.contains('is-marching'));
  assert.equal(dialogueText(ctx.stage), `${PARADE_LINES.over} ${PARADE_LINES.noBand}`);
  ctx.stage.querySelector('.parade-dialogue').querySelectorAll('.dlg__tab').find(b => b.dataset.act === 'help').click();
  assert.deepEqual(ctx.opened, [['Parade', HELP_STEPS]]);
  scene.destroy();
});

test('pause window: Keep playing closes it, Title screen closes it and goes to the title scene', async () => {
  const ctx = fakeCtx();
  const handle = openPauseWindow(ctx);
  assert.ok(handle);
  const actions = ctx.stage.querySelectorAll('[data-action]');
  assert.deepEqual(actions.map(b => b.dataset.action), ['resume', 'title']);
  assert.match(ctx.stage.querySelector('.pause-window').innerHTML, /data-action="title">.*<span>Title screen<\/span>/s);
  assert.ok(doc.activeElement === actions[0], 'focus starts on Keep playing');
  actions[1].click();
  await tick();
  assert.equal(ctx.stage.querySelector('.win-backdrop'), null, 'the window closed');
  assert.deepEqual(ctx.gone, [['title', undefined]]);
  const again = openPauseWindow(ctx);
  ctx.stage.querySelector('[data-action="resume"]').click();
  assert.equal(ctx.stage.querySelector('.win-backdrop'), null);
  assert.deepEqual(ctx.gone, [['title', undefined]], 'Keep playing goes nowhere');
  again?.close();
});

test('guide window: the subtitle sits under the title, which keeps its id for the dialog label', () => {
  const ctx = fakeCtx();
  openGuideWindow(ctx);
  const win = ctx.stage.querySelector('.win');
  const heading = win.querySelector('.win__head .guide__heading');
  assert.ok(heading, 'heading wrapper in the header');
  const [title, subtitle] = heading.children;
  assert.ok(title.classList.contains('win__title') && subtitle.classList.contains('guide__subtitle'));
  assert.equal(subtitle.textContent, 'the town’s character book');
  assert.equal(title.getAttribute('id'), win.getAttribute('aria-labelledby'));
  assert.ok(win.querySelector('.guide__count'), 'stamp count beside it');
  ctx.stage.querySelector('.win__close').click();
});

test('guide window: Kiko gets a short Save song button with an icon only once a band is made', async () => {
  const kikoIndex = ctx => guideEntries(ctx.getState()).findIndex(entry => entry.id === 'music');
  const without = fakeCtx(withArt());
  openGuideWindow(without, { id: 'music' });
  assert.equal(Number(without.stage.querySelector('.guide-tile[aria-pressed="true"]').dataset.index), kikoIndex(without), 'Kiko is the open page');
  assert.equal(without.stage.querySelector('[data-action="record"]'), null, 'no band, no button');
  without.stage.querySelector('.win__close').click();

  const ctx = fakeCtx(withBand());
  assert.ok(getCreations(ctx.getState()).music);
  openGuideWindow(ctx, { id: 'music' });
  const button = ctx.stage.querySelector('[data-action="record"]');
  assert.ok(button, 'the band is made, so the button shows');
  const label = ctx.stage.querySelector('.guide-page').innerHTML.match(/data-action="record">.*?<span>([^<]+)<\/span>/s)?.[1];
  assert.equal(label, 'Save song');
  assert.ok(label.length <= 12);
  assert.ok(button.querySelector('svg.icon'), 'the recording action keeps its download icon');
  const status = ctx.stage.querySelector('.guide-record__status');
  assert.ok(ctx.stage.querySelector('.guide-page').innerHTML.includes(`role="status">${RECORDING_LINES.idle}<`), 'idle line shows before a tap');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), null, 'one live region: the page itself');
  button.click();
  assert.equal(status.textContent, RECORDING_LINES.making);
  await tick();
  assert.equal(status.textContent, RECORDING_LINES.failed, 'node has no offline audio, so the kid sees why');
  assert.deepEqual(ctx.gone, [], 'the window stays open');
  ctx.stage.querySelector('.win__close').click();
  assert.equal(ctx.stage.querySelector('.win-backdrop'), null);
});

for (const closeEarly of [true, false]) {
  test(`guide window: a real pending recording ${closeEarly ? 'is dropped after close' : 'downloads while open'}`, async () => {
    const ctx = fakeCtx(withBand()), recording = deferredRecording();
    let handle;
    try {
      handle = openGuideWindow(ctx, { id: 'music' });
      const status = ctx.stage.querySelector('.guide-record__status');
      ctx.stage.querySelector('[data-action="record"]').click();
      assert.equal(status.textContent, RECORDING_LINES.making);
      assert.equal(recording.renderCalls, 1, 'rendering started before the window can close');
      assert.equal(recording.canFinish, true, 'a completion resolver exists');
      assert.ok(recording.notesStarted > 0, 'the published band scheduled real notes');
      if (closeEarly) ctx.stage.querySelector('.win__close').click();
      await recording.finish();
      assert.equal(recording.urls.length, closeEarly ? 0 : 1);
      assert.equal(recording.downloads, closeEarly ? 0 : 1);
      assert.equal(status.textContent, closeEarly ? RECORDING_LINES.making : RECORDING_LINES.ready);
      if (!closeEarly) {
        assert.equal(recording.blobs[0].type, 'audio/wav');
        const wav = new Uint8Array(await recording.blobs[0].arrayBuffer());
        assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
        assert.deepEqual(recording.filenames, ['my-festival-band.wav']);
      }
    } finally { handle?.close(); recording.restore(); }
  });
}

test('recording lines fit a dialogue page and avoid grown-up words', () => {
  for (const line of Object.values(RECORDING_LINES)) {
    assert.ok(line.length <= PAGE_CHARS.normal, line);
    assert.ok(!/phrase|sound file|WAV/i.test(line), line);
  }
  assert.equal(RECORDING_LINES.idle, 'Save your band to listen to later.');
});

function recordingApp() {
  doc.body.children = []; doc._active = null;
  const host = doc.createElement('div'); doc.body.append(host);
  const band = createDefaultBand();
  band.tracks.forEach(track => { track.enabled = false; }); // no notes, but a real offline render and WAV
  const state = publishCreation(createState(), 'music', band);
  return createApp(host, { storage: { getItem: key => key === STORAGE_KEY ? JSON.stringify(state) : null } });
}
function deferredRecording() {
  const originals = { OfflineAudioContext: globalThis.OfflineAudioContext, create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: El.prototype.click, setTimeout, clearTimeout };
  const urls = [], revoked = [], blobs = [], filenames = [], timers = new Set();
  let render, downloads = 0, renderCalls = 0, notesStarted = 0;
  const node = () => ({ connect() {}, disconnect() {} });
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  globalThis.OfflineAudioContext = class {
    constructor(channels, length, sampleRate) { this.sampleRate = sampleRate; }
    destination = {};
    createGain() { return { ...node(), gain: param() }; }
    createOscillator() { return { ...node(), frequency: param(), start() { notesStarted++; }, stop() {} }; }
    createBiquadFilter() { return { ...node(), frequency: param(), Q: param() }; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { ...node(), start() { notesStarted++; }, stop() {} }; }
    createDynamicsCompressor() { return { ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
    startRendering() { renderCalls++; return new Promise(resolve => { render = resolve; }); }
  };
  URL.createObjectURL = blob => { blobs.push(blob); const url = `blob:recording-${urls.length}`; urls.push(url); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  El.prototype.click = function () { if (this.tagName === 'A') { downloads++; filenames.push(this.download); } return originals.click.call(this); };
  globalThis.setTimeout = (fn, ms, ...args) => { const timer = originals.setTimeout(fn, ms, ...args); if (ms === 30000) timers.add(timer); return timer; };
  globalThis.clearTimeout = timer => { timers.delete(timer); originals.clearTimeout(timer); };
  return {
    urls, revoked, timers, blobs, filenames,
    get renderCalls() { return renderCalls; },
    get canFinish() { return typeof render === 'function'; },
    get notesStarted() { return notesStarted; },
    get downloads() { return downloads; },
    async finish() {
      assert.equal(typeof render, 'function', 'the offline render actually started');
      render({ numberOfChannels: 2, length: 0, sampleRate: 44100, getChannelData: () => new Float32Array(0) });
      await tick();
    },
    restore() {
      for (const timer of timers) originals.clearTimeout(timer);
      Object.assign(globalThis, { OfflineAudioContext: originals.OfflineAudioContext, setTimeout: originals.setTimeout, clearTimeout: originals.clearTimeout });
      URL.createObjectURL = originals.create; URL.revokeObjectURL = originals.revoke; El.prototype.click = originals.click;
    },
  };
}

test('Guide: a recording finishing after app destruction or detachment never downloads', async () => {
  for (const teardown of ['destroy', 'detach']) {
    const app = recordingApp(), recording = deferredRecording();
    try {
      app.open.guide('music');
      app.stage.querySelector('[data-action="record"]').click();
      if (teardown === 'destroy') app.destroy(); else app.stage.remove();
      assert.equal(app.stage.isConnected, false);
      await recording.finish();
      assert.equal(recording.downloads, 0, teardown);
      assert.equal(recording.urls.length, 0, teardown);
      assert.equal(recording.timers.size, 0, teardown);
    } finally { app.destroy(); recording.restore(); }
  }
});

test('Guide: app teardown disposes an existing recording URL and its timer exactly once', async () => {
  const app = recordingApp(), recording = deferredRecording();
  try {
    app.open.guide('music');
    app.stage.querySelector('[data-action="record"]').click();
    await recording.finish();
    assert.equal(recording.downloads, 1);
    assert.equal(recording.urls.length, 1);
    assert.equal(recording.timers.size, 1);
    app.destroy(); app.destroy();
    assert.deepEqual(recording.revoked, recording.urls);
    assert.equal(recording.timers.size, 0);
    assert.equal(app.stage.querySelector('.win-backdrop'), null);
  } finally { app.destroy(); recording.restore(); }
});
