// Read-aloud through the browser's own voices. Return the utterance so callers can watch its end,
// or false when speech is unavailable. The utterance remains truthy for callers checking success.
export function speak(text) {
  const synth = globalThis.speechSynthesis;
  if (!synth || !globalThis.SpeechSynthesisUtterance) return false;
  synth.cancel();
  const words = String(text ?? '').trim();
  if (!words) return false;
  const utterance = new globalThis.SpeechSynthesisUtterance(words);
  synth.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  globalThis.speechSynthesis?.cancel();
}
