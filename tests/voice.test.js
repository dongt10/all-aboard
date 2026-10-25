import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('remote voices including defaults are excluded; missing locality counts as local', () => {
  assert.equal(ALLOW_REMOTE_VOICES, false);
  const remote = [voice('Microsoft Jenny Online (Natural)', { localService: false, default: true }),
    voice('Samantha (Premium)', { localService: false }), voice('Google US English', { localService: false })];
  const local = voice('Other'), unknown = voice('Samantha', { localService: undefined });
  assert.equal(pickVoice([...remote, local]), local);
  assert.equal(pickVoice([...remote, local, unknown]), unknown);
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
  assert.equal(f.reads, 1, 'selection is cached between inventory events');
});

for (const property of [false, true]) test(`first Hear is synchronous; every inventory event refreshes selection (property=${property})`, async t => {
  const f = await fixture(t, { property });
  const first = f.speak('Hello');
  assert.deepEqual(f.calls, [['cancel'], ['speak', first]], 'no timer, promise, or voiceschanged wait');
  assert.equal(first.lang, 'en-US');
  assert.equal(first.voice, null);
  const samantha = voice('Samantha'), ava = voice('Ava');
  f.change([ava, samantha]);
  assert.equal(f.reads, 2);
  assert.equal(f.calls.length, 2, 'inventory changes never replay speech');
  assert.equal(f.speak('Hello again').voice, samantha);
  assert.equal(first.voice, null, 'existing utterance stays intact');
  f.change([ava]);
  assert.equal(f.speak('New inventory').voice, ava);
  f.change([]);
  assert.equal(f.speak('Empty again').voice, null);
  assert.equal(f.reads, 4);
  if (property) assert.equal(f.previousEvents, 3, 'fallback preserves the previous property handler');
  else assert.equal(typeof f.synth.onvoiceschanged, 'function', 'event registration preserves the property handler');
});

test('minimal synth without discovery methods still speaks and stops', async t => {
  const f = await fixture(t, { minimal: true });
  assert.equal(f.speak('Hello').lang, 'en-US');
  assert.equal(f.stopSpeaking(), undefined);
  assert.deepEqual(f.calls.map(call => call[0]), ['cancel', 'speak', 'cancel']);
});

test('empty and nullish inputs return false after cancelling; string conversion is unchanged', async t => {
  const f = await fixture(t);
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
  const f = await fixture(t);
  f.stopSpeaking();
  f.speak('Hello');
  f.stopSpeaking();
  f.change([voice('Samantha')]);
  assert.deepEqual(f.calls.map(call => call[0]), ['cancel', 'cancel', 'speak', 'cancel']);
});
