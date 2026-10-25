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
  const ranked = voices.filter(voice => /^en/i.test(voice.lang)
    && !NOVELTY.test(voice.name)
    && (ALLOW_REMOTE_VOICES || voice.localService !== false)).map(voice => {
    const local = voice.localService !== false;
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
const discoverySynth = globalThis.speechSynthesis;
if (discoverySynth) {
  const refresh = () => { chosenVoice = pickVoice(discoverySynth.getVoices?.() ?? []); };
  refresh();
  if (discoverySynth.addEventListener) discoverySynth.addEventListener('voiceschanged', refresh);
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
  const synth = globalThis.speechSynthesis;
  if (!synth || !globalThis.SpeechSynthesisUtterance) return false;
  synth.cancel();
  const words = String(text ?? '').trim();
  if (!words) return false;
  const utterance = new globalThis.SpeechSynthesisUtterance(words);
  if (chosenVoice && synth === discoverySynth) utterance.voice = chosenVoice;
  utterance.lang = utterance.voice?.lang || 'en-US';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  synth.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  globalThis.speechSynthesis?.cancel();
}
