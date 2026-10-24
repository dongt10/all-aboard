// Read-aloud through the browser's own voices. Speech is optional: callers get false when there is none.
export function speak(text) {
  const synth = globalThis.speechSynthesis;
  if (!synth || !globalThis.SpeechSynthesisUtterance) return false;
  synth.cancel();
  const words = String(text ?? '').trim();
  if (words) synth.speak(new globalThis.SpeechSynthesisUtterance(words));
  return true;
}

export function stopSpeaking() {
  globalThis.speechSynthesis?.cancel();
}
