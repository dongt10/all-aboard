import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Doc } from './helpers/dom.js';
import { ALLOW_REMOTE_VOICES, pickVoice } from '../src/ui/voice.js';

const voice = (name, extra = {}) => ({ name, lang: 'en-US', localService: true, ...extra });
const preferred = ['Samantha', 'Ava', 'Zoe', 'Allison', 'Evan', 'Nathan', 'Tom', 'Karen', 'Daniel', 'Moira', 'Tessa',
  'Microsoft Zira Desktop - English (United States)', 'Microsoft David Desktop - English (United States)',
  'Microsoft Mark - English (United States)', 'Google US English'];

test('pickVoice accepts English only and prefers en-US over other English', () => {
  const us = voice('Other'), gb = voice('Samantha', { lang: 'en-GB' });
  assert.equal(pickVoice([voice('Samantha', { lang: 'fr-FR', default: true }), gb, us]), us);
  assert.equal(pickVoice([gb]), gb);
  assert.equal(pickVoice([voice('Samantha', { lang: 'de-DE', default: true })]), null);
});

test('pickVoice follows the complete name preference order without mutating inventory', () => {
  const voices = Object.freeze(preferred.map(name => Object.freeze(voice(name))).reverse());
  for (let i = 0; i < preferred.length; i++) {
    const remaining = voices.filter(item => preferred.indexOf(item.name) >= i);
    assert.equal(pickVoice(remaining).name, preferred[i]);
  }
  assert.equal(voices[0].name, preferred.at(-1));
});

test('Premium and Enhanced variants beat compact voices; names break quality-tier ties', () => {
  const compact = voice('Samantha'), enhanced = voice('Samantha (Enhanced)'), premium = voice('Samantha (Premium)');
  assert.equal(pickVoice([compact, enhanced]), enhanced);
  assert.equal(pickVoice([compact, enhanced, premium]), premium);
  assert.equal(pickVoice([voice('Ava (Premium)'), enhanced]), enhanced);
  const ava = voice('Ava (Enhanced)');
  assert.equal(pickVoice([compact, ava]), ava);
});

test('name matching is case insensitive and respects word boundaries', () => {
  const samantha = voice('sAmAnThA (eNhAnCeD)', { lang: 'EN-us' });
  assert.equal(pickVoice([voice('Ava'), samantha]), samantha);
  const ava = voice('Ava');
  assert.equal(pickVoice([voice('Samanthabelle'), ava]), ava);
});

test('remote voices and voices with unknown locality are excluded', () => {
  assert.equal(ALLOW_REMOTE_VOICES, false);
  const remote = [voice('Microsoft Jenny Online (Natural)', { localService: false, default: true }),
    voice('Samantha (Premium)', { localService: false }), voice('Google US English', { localService: false })];
  const local = voice('Other'), unknown = voice('Samantha', { localService: undefined });
  assert.equal(pickVoice([...remote, local]), local);
  assert.equal(pickVoice([...remote, local, unknown]), local);
  assert.equal(pickVoice([unknown]), null);
  assert.equal(pickVoice(remote), null);
});

test('all listed novelty voices and their variants are excluded even when default', () => {
  const names = ['Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Eddy',
    'Flo', 'Fred', 'Good News', 'Grandma', 'Grandpa', 'Hysterical', 'Jester', 'Junior', 'Kathy', 'Organ',
    'Ralph', 'Reed', 'Rocko', 'Sandy', 'Shelley', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox'];
  for (const name of names) {
    for (const suffix of ['', ' (Enhanced)', ' (English (United States))']) {
      assert.equal(pickVoice([voice(name + suffix, { default: true })]), null, name + suffix);
    }
  }
  const safe = voice('Unlisted narrator');
  assert.equal(pickVoice([...names.map(name => voice(name)), safe]), safe);
});

test('fallback uses remaining local English, English default for ties, then null', () => {
  const other = voice('Other'), fallback = voice('System narrator', { default: true });
  assert.equal(pickVoice([other]), other);
  assert.equal(pickVoice([other, fallback]), fallback);
  assert.equal(pickVoice([fallback, voice('Samantha')]).name, 'Samantha');
  assert.equal(pickVoice([]), null);
  assert.equal(pickVoice([voice('French', { lang: 'fr-FR' }), voice('Boing')]), null);
});

test('enabling remote voices promotes Microsoft Natural above compact, below enhanced local', async () => {
  // Exercise the opt-in build policy without adding a runtime setting or changing the shipped constant.
  const source = await readFile(new URL('../src/ui/voice.js', import.meta.url), 'utf8');
  assert.ok(source.includes('ALLOW_REMOTE_VOICES = false;'));
  const enabled = await import(`data:text/javascript;base64,${Buffer.from(source.replace(
    'ALLOW_REMOTE_VOICES = false;', 'ALLOW_REMOTE_VOICES = true;')).toString('base64')}`);
  const natural = ['Jenny', 'Aria', 'Guy', 'Ana'].map(name => voice(`Microsoft ${name} Online (Natural) - English (United States)`, { localService: false }));
  const compact = voice('Samantha'), enhanced = voice('Ava (Enhanced)');
  for (let i = 0; i < natural.length; i++) {
    assert.equal(enabled.pickVoice([compact, ...natural.slice(i).reverse()]), natural[i]);
  }
  assert.equal(enabled.pickVoice([...natural, enhanced]), enhanced);
  assert.equal(enabled.pickVoice([voice('Google US English', { localService: false }), compact]), compact);
  assert.equal(enabled.pickVoice([voice('Unlisted', { localService: false, default: true })]).name, 'Unlisted');
  assert.equal(enabled.pickVoice([voice('Boing', { localService: false, default: true })]), null);
});

class Utterance extends EventTarget {
  constructor(text) { super(); this.text = text; this.voice = null; }
}
let imports = 0;
async function fixture(t, { voices = [], property = false, minimal = false, synthMissing = false, utteranceMissing = false } = {}) {
  const calls = [], listeners = new Map();
  let reads = 0, previousEvents = 0;
  const synth = {
    cancel() { calls.push(['cancel']); },
    speak(utterance) { calls.push(['speak', utterance]); },
  };
  if (!minimal) {
    synth.getVoices = () => { reads++; return voices; };
    synth.onvoiceschanged = () => { previousEvents++; };
    if (!property) synth.addEventListener = (type, callback) => listeners.set(type, callback);
  }
  for (const [key, value] of Object.entries({ speechSynthesis: synthMissing ? undefined : synth,
    SpeechSynthesisUtterance: utteranceMissing ? undefined : Utterance })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const api = await import(`../src/ui/voice.js?test=${++imports}`);
  return { ...api, calls, synth, get reads() { return reads; }, get previousEvents() { return previousEvents; },
    change(next) { voices = next; (listeners.get('voiceschanged') ?? synth.onvoiceschanged).call(synth, new Event('voiceschanged')); } };
}

test('module discovers voices immediately; speak returns the actual configured event target synchronously', async t => {
  const chosen = voice('Daniel', { lang: 'en-GB' }), f = await fixture(t, { voices: [chosen] });
  assert.equal(f.reads, 1);
  const result = f.speak('  Hello, friend!  ');
  assert.ok(result instanceof Utterance);
  assert.deepEqual(f.calls, [['cancel'], ['speak', result]]);
  assert.equal(result.text, 'Hello, friend!');
  assert.equal(result.voice, chosen);
  assert.equal(result.lang, 'en-GB');
  assert.equal(result.rate, 0.95);
  assert.equal(result.pitch, 1.0);
  assert.equal(result.volume, 1.0);
  for (const type of ['end', 'error']) {
    let events = 0;
    const listener = () => events++;
    result.addEventListener(type, listener);
    result.dispatchEvent(new Event(type));
    result.removeEventListener(type, listener);
    result.dispatchEvent(new Event(type));
    assert.equal(events, 1);
  }
  f.speak('Next page');
  assert.deepEqual(f.calls.map(call => call[0]), ['cancel', 'speak', 'cancel', 'speak']);
  assert.equal(f.reads, 3, 'each request refreshes the inventory');
});

for (const property of [false, true]) test(`first Hear is synchronous; every inventory event refreshes selection (property=${property})`, async t => {
  const f = await fixture(t, { property });
  const first = f.speak('Hello');
  assert.equal(first, false);
  assert.deepEqual(f.calls, [['cancel']]);
  const samantha = voice('Samantha'), ava = voice('Ava');
  f.change([ava, samantha]);
  assert.equal(f.reads, 3);
  assert.equal(f.calls.length, 1, 'inventory changes never replay speech');
  assert.equal(f.speak('Hello again').voice, samantha);
  f.change([ava]);
  assert.equal(f.speak('New inventory').voice, ava);
  f.change([]);
  assert.equal(f.speak('Empty again'), false);
  assert.equal(f.reads, 8);
  if (property) assert.equal(f.previousEvents, 3, 'fallback preserves the previous property handler');
  else assert.equal(typeof f.synth.onvoiceschanged, 'function', 'event registration preserves the property handler');
});

test('minimal synth without discovery methods does not speak and can stop', async t => {
  const f = await fixture(t, { minimal: true });
  assert.equal(f.speak('Hello'), false);
  assert.equal(f.stopSpeaking(), undefined);
  assert.deepEqual(f.calls.map(call => call[0]), ['cancel', 'cancel']);
});

test('empty and nullish inputs return false after cancelling; string conversion is unchanged', async t => {
  const f = await fixture(t, { voices: [voice('Samantha')] });
  for (const input of ['', ' \n\t ', null, undefined]) assert.equal(f.speak(input), false);
  assert.deepEqual(f.calls, Array.from({ length: 4 }, () => ['cancel']));
  assert.equal(f.speak(0).text, '0');
  assert.equal(f.speak(false).text, 'false');
});

for (const missing of ['synthMissing', 'utteranceMissing']) test(`unavailable speech returns false (${missing})`, async t => {
  const f = await fixture(t, { [missing]: true });
  assert.equal(f.speak('Hello'), false);
  assert.deepEqual(f.calls, []);
  assert.equal(f.stopSpeaking(), undefined);
  assert.deepEqual(f.calls, missing === 'synthMissing' ? [] : [['cancel']]);
});

test('stopSpeaking cancels before and after speech and never schedules a restart', async t => {
  const f = await fixture(t, { voices: [voice('Samantha')] });
  f.stopSpeaking();
  f.speak('Hello');
  f.stopSpeaking();
  f.change([voice('Samantha')]);
  assert.deepEqual(f.calls.map(call => call[0]), ['cancel', 'cancel', 'speak', 'cancel']);
});


function withDocument(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new Doc();
  doc.body.style.removeProperty = function (name) { delete this[name]; };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  return doc;
}

test('failure notice persists, discovery updates it, and Hear retries without replaying', async t => {
  const doc = withDocument(t);
  const f = await fixture(t);
  assert.equal(f.speak('Hello'), false);
  const notice = doc.body.querySelector('.voice-status');
  assert.equal(notice.getAttribute('role'), 'status');
  assert.match(notice.textContent, /unavailable.*English voice on this device.*press Hear/i);
  assert.equal(notice.children.length, 0);
  f.change([voice('Samantha')]);
  assert.match(notice.textContent, /ready.*press Hear/i);
  assert.equal(f.calls.filter(([call]) => call === 'speak').length, 0);
  f.change([]);
  assert.match(notice.textContent, /Voice unavailable/);
  f.change([voice('Samantha')]);
  const spoken = f.speak('Hello');
  spoken.dispatchEvent(new Event('error'));
  assert.match(notice.textContent, /Voice failed/);
  f.speak('Hello').dispatchEvent(new Event('end'));
  assert.equal(notice.isConnected, false);
});

for (const options of [{ synthMissing: true }, { utteranceMissing: true }, { voices: [voice('Remote', { localService: false })] }, { voices: [voice('Unknown', { localService: undefined })] }]) {
  test('unavailable APIs or unconfirmed voices show status and never speak ' + JSON.stringify(options), async t => {
    const doc = withDocument(t);
    const f = await fixture(t, options);
    assert.equal(f.speak('Hello'), false);
    assert.match(doc.body.querySelector('.voice-status').textContent, /Voice unavailable/);
    assert.equal(f.calls.some(([call]) => call === 'speak'), false);
  });
}

test('thrown and asynchronous synthesis errors show status; canceled errors do not', async t => {
  const doc = withDocument(t);
  const f = await fixture(t, { voices: [voice('Samantha')] });
  f.synth.speak = () => { throw new Error('failed'); };
  assert.equal(f.speak('Hello'), false);
  assert.match(doc.body.querySelector('.voice-status').textContent, /Voice failed/);
  f.synth.speak = () => {};
  const ok = f.speak('Next');
  ok.dispatchEvent(new Event('end'));
  for (const error of ['canceled', 'interrupted']) {
    const spoken = f.speak('Next');
    const event = new Event('error'); event.error = error;
    spoken.dispatchEvent(event);
    assert.equal(doc.body.querySelector('.voice-status'), null);
  }
  f.speak('Next').dispatchEvent(new Event('error'));
  assert.match(doc.body.querySelector('.voice-status').textContent, /Voice failed/);
});

test('events from superseded or stopped requests do not change the notice', async t => {
  const doc = withDocument(t);
  const f = await fixture(t, { voices: [voice('Samantha')] });
  const old = f.speak('Old'), current = f.speak('Current');
  current.dispatchEvent(new Event('error'));
  const notice = doc.body.querySelector('.voice-status');
  old.dispatchEvent(new Event('end'));
  assert.equal(notice.isConnected, true);
  const next = f.speak('Next');
  next.dispatchEvent(new Event('end'));
  old.dispatchEvent(new Event('error'));
  assert.equal(doc.body.querySelector('.voice-status'), null);
  f.stopSpeaking();
  next.dispatchEvent(new Event('error'));
  assert.equal(doc.body.querySelector('.voice-status'), null);
});

test('Hear refreshes voices even when no discovery event arrives', async t => {
  const f = await fixture(t, { voices: [] });
  assert.equal(f.speak('Hello'), false);
  const local = voice('Samantha');
  f.synth.getVoices = () => [local];
  assert.equal(f.speak('Hello').voice, local);
});

test('notice height reserves stage space and resize observer tracks wrapping', async t => {
  const doc = withDocument(t);
  let height = 40, observer, resizes = 0;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent(event) { if (event.type === 'resize') resizes++; } } });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(el) { el.getBoundingClientRect = () => ({ height }); }
    disconnect() { this.disconnected = true; }
  } });
  t.after(() => {
    originalWindow ? Object.defineProperty(globalThis, 'window', originalWindow) : delete globalThis.window;
    originalObserver ? Object.defineProperty(globalThis, 'ResizeObserver', originalObserver) : delete globalThis.ResizeObserver;
  });
  const f = await fixture(t);
  f.speak('Hello');
  assert.equal(doc.body.style['--voice-status-height'], '40px');
  assert.equal(resizes, 1);
  height = 72;
  observer.callback();
  assert.equal(doc.body.style['--voice-status-height'], '72px');
  assert.equal(resizes, 2);
  f.change([voice('Samantha')]);
  f.speak('Hello').dispatchEvent(new Event('end'));
  assert.equal(doc.body.style['--voice-status-height'], undefined);
  assert.equal(observer.disconnected, true);
  assert.equal(resizes, 3);
});
