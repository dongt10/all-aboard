// Remote voices send text to a vendor, and one activity can echo a word a child typed.
export const ALLOW_REMOTE_VOICES = false;

const PREFERRED = [
  'Samantha', 'Ava', 'Zoe', 'Allison', 'Evan', 'Nathan', 'Tom', 'Karen', 'Daniel', 'Moira', 'Tessa',
  'Zira', 'David', 'Mark', 'Google US English',
];
const NATURAL = ['Jenny', 'Aria', 'Guy', 'Ana'];
const NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Eddy|Flo|Fred|Good News|Grandma|Grandpa|Hysterical|Jester|Junior|Kathy|Organ|Ralph|Reed|Rocko|Sandy|Shelley|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
const matches = (name, family) => new RegExp(`\\b${family}\\b`, 'i').test(name);

// English locale, quality/locality tier, name preference, variant, then default.
// Return an original voice object without changing the browser's inventory.
export function pickVoice(voices) {
  const ranked = voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)
    && !NOVELTY.test(voice.name)
    && (voice.localService === true || (ALLOW_REMOTE_VOICES && voice.localService === false))).map(voice => {
    const local = voice.localService === true;
    const family = PREFERRED.findIndex(name => matches(voice.name, name));
    const natural = /\bMicrosoft\b.*\bNatural\b/i.test(voice.name)
      ? NATURAL.findIndex(name => matches(voice.name, name)) : -1;
    const quality = /\bPremium\b/i.test(voice.name) ? 0 : /\bEnhanced\b/i.test(voice.name) ? 1 : 2;
    const tier = local ? (family >= 0 && quality < 2 ? 0 : 2) : natural >= 0 ? 1 : 3;
    return { voice, rank: [
      /^en[-_]US$/i.test(voice.lang) ? 0 : 1,
      tier,
      !local && natural >= 0 ? natural : family < 0 ? PREFERRED.length : family,
      quality,
      voice.default ? 0 : 1,
    ] };
  });
  ranked.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) {
      if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    }
    return 0; // Keep inventory order for equally ranked voices.
  });
  return ranked[0]?.voice ?? null;
}

let chosenVoice = null;
let notice = null;
let noticeObserver = null;
let noticeHeight = null;
let request = 0;

function measureNotice() {
  if (!notice?.isConnected) return;
  const height = notice.getBoundingClientRect().height;
  if (height === noticeHeight) return;
  noticeHeight = height;
  document.body.style.setProperty('--voice-status-height', `${height}px`);
  if (globalThis.window?.dispatchEvent && globalThis.Event) window.dispatchEvent(new Event('resize'));
}

function showNotice(failed = false) {
  if (!globalThis.document?.body) return;
  if (!notice || !notice.isConnected) {
    noticeObserver?.disconnect();
    noticeHeight = null;
    notice = document.createElement('aside');
    notice.className = 'voice-status';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.append(notice);
    if (globalThis.ResizeObserver) {
      noticeObserver = new ResizeObserver(measureNotice);
      noticeObserver.observe(notice);
    }
  }
  notice.textContent = (failed ? 'Voice failed. ' : 'Voice unavailable. ')
    + 'Ask a grown-up to add an English voice on this device. '
    + 'Then press Hear. Pictures and text still work.';
  measureNotice();
}
function clearNotice() {
  if (!notice) return;
  noticeObserver?.disconnect();
  noticeObserver = null;
  notice.remove();
  notice = null;
  noticeHeight = null;
  document.body.style.removeProperty('--voice-status-height');
  if (globalThis.window?.dispatchEvent && globalThis.Event) window.dispatchEvent(new Event('resize'));
}
const discoverySynth = globalThis.speechSynthesis;
function refresh(synth = discoverySynth) {
  chosenVoice = pickVoice(synth?.getVoices?.() ?? []);
  if (notice?.isConnected) {
    if (chosenVoice && globalThis.SpeechSynthesisUtterance) {
      notice.textContent = 'Voice ready. Press Hear again. Pictures and text still work.';
      measureNotice();
    } else showNotice();
  }
  return chosenVoice;
}
if (discoverySynth) {
  refresh();
  if (discoverySynth.addEventListener) discoverySynth.addEventListener('voiceschanged', () => refresh());
  else {
    const previous = discoverySynth.onvoiceschanged;
    discoverySynth.onvoiceschanged = function (event) {
      refresh();
      previous?.call(this, event);
    };
  }
}

// Read-aloud through the browser's own voices. Return the utterance so callers can watch its end,
// or false when speech is unavailable. The utterance remains truthy for callers checking success.
export function speak(text) {
  const current = ++request;
  const synth = globalThis.speechSynthesis;
  if (!synth || !globalThis.SpeechSynthesisUtterance) { showNotice(); return false; }
  synth.cancel();
  const words = String(text ?? '').trim();
  if (!words) return false;
  const selected = refresh(synth);
  if (!selected) { showNotice(); return false; }
  const utterance = new globalThis.SpeechSynthesisUtterance(words);
  utterance.voice = selected;
  utterance.lang = utterance.voice?.lang || 'en-US';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.addEventListener('end', () => { if (current === request) clearNotice(); });
  utterance.addEventListener('error', event => {
    if (current === request && event.error !== 'canceled' && event.error !== 'interrupted') showNotice(true);
  });
  try { synth.speak(utterance); } catch { showNotice(true); return false; }
  return utterance;
}

export function stopSpeaking() {
  ++request;
  globalThis.speechSynthesis?.cancel();
}
