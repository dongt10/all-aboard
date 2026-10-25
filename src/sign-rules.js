// The same word, sentence and describing-word goals guide play and completion.
export const DESCRIBING_WORDS = Object.freeze(['bright', 'warm', 'kind', 'happy', 'big', 'loud']);
export function signTileGroups(grade) {
  const phrases = grade === 0 ? ['Hello', 'friend!', 'Welcome', '♡']
    : grade < 3 ? ['Welcome', 'Come', 'to', 'our', 'play', 'with', 'festival!', 'us.']
    : ['Welcome, neighbors!', 'Come explore our festival.', 'The lanterns are', 'Everyone here is'];
  return { phrases, describing: grade >= 3 ? DESCRIBING_WORDS.map(word => `${word}.`) : [] };
}
export function signWords(grade) {
  const { phrases, describing } = signTileGroups(grade);
  return [...phrases, ...describing];
}

// Keep the newest whole tiles that still form a suffix at a word boundary.
export function reconcileTiles(tiles, text) {
  const end = typeof text === 'string' ? text.trimEnd() : '';
  let kept = Array.isArray(tiles) ? tiles.slice(-60) : [];
  if (kept.some(tile => typeof tile !== 'string' || !tile.trim())) return [];
  while (kept.length) {
    const run = kept.join(' ');
    if (end === run || (end.endsWith(run) && /\s$/.test(end.slice(0, -run.length)))) break;
    kept = kept.slice(1);
  }
  return kept;
}
export function normalizeSign(input, grade) {
  const source = input && typeof input === 'object' ? input : {};
  const text = typeof source.text === 'string' ? source.text.slice(0, 120) : '';
  if (!Object.hasOwn(source, 'tiles')) return { text };
  const tiles = Array.isArray(source.tiles) ? source.tiles.slice(-60) : [];
  const words = signWords(grade);
  // Retired phrase tiles are forgotten; the child's actual words are kept.
  return { text, tiles: tiles.every(tile => words.includes(tile)) ? reconcileTiles(tiles, text) : [] };
}

export function splitSentences(text) {
  return typeof text === 'string' ? (text.match(/[^.!?]+[.!?]*|[.!?]+/g) ?? []).map(part => part.trim()).filter(Boolean) : [];
}
export function isSentence(text) {
  if (typeof text !== 'string') return false;
  const sentence = text.trim();
  return /^[A-Z]/.test(sentence) && /[.!]$/.test(sentence) && !sentence.includes('?') && splitSentences(sentence).length === 1;
}
export function hasDescribingWord(text) {
  return typeof text === 'string' && (text.toLowerCase().match(/[a-z]+/g) ?? []).some(word => DESCRIBING_WORDS.includes(word));
}
export const SIGN_RULE_LINES = Object.freeze({
  word: 'One more word.',
  capital: 'Start with a capital letter.',
  end: 'End your sentence with . or !',
  sentence: 'One more sentence.',
  describing: 'Add a describing word, like bright.',
  ready: 'Your sign is ready. Add words, or put it up.',
  openingK: 'Tap two words for your welcome sign.',
  openingSentence: 'Write one whole sentence for your sign. Start with a capital. End with . or !',
  openingDescribing: 'Write two sentences. Use a describing word.',
});
export function signReport(text, grade) {
  const words = typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const sentences = splitSentences(text);
  const allComplete = sentences.length > 0 && sentences.every(isSentence);
  const describing = hasDescribingWord(text);
  const missing = [];
  if (!(grade > 0)) {
    if (words < 2) missing.push(SIGN_RULE_LINES.word);
  } else {
    if (!sentences.length || sentences.some(sentence => !/^[A-Z]/.test(sentence))) missing.push(SIGN_RULE_LINES.capital);
    if (!sentences.length || sentences.some(sentence => !/[.!]$/.test(sentence) || sentence.includes('?'))) missing.push(SIGN_RULE_LINES.end);
    if (grade >= 3 && sentences.length < 2) missing.push(SIGN_RULE_LINES.sentence);
    if (grade >= 3 && !describing) missing.push(SIGN_RULE_LINES.describing);
  }
  return { words, sentences, allComplete, describing, missing };
}
export function signReady(state) {
  if (state?.kind !== 'writing') return false;
  const report = signReport(state.text, state.grade);
  if (!(state.grade > 0)) return report.words >= 2;
  return report.allComplete && (state.grade < 3 || (report.sentences.length >= 2 && report.describing));
}
export function signHint(state) {
  return signReport(state?.text, state?.grade).missing[0] ?? '';
}
export function signOpening(state) {
  if (signReady(state)) return SIGN_RULE_LINES.ready;
  return !(state?.grade > 0) ? SIGN_RULE_LINES.openingK
    : state.grade < 3 ? SIGN_RULE_LINES.openingSentence : SIGN_RULE_LINES.openingDescribing;
}
export function signHelp(grade) {
  return [
    grade === 0 ? 'Tap words to add them.' : 'Tap words to add them, or type your own.',
    grade === 0 ? 'Two words make a sign.' : grade < 3 ? 'Start with a capital letter. End with . or !' : 'Write two sentences. Use a describing word.',
    'Remove word takes one tile back. Clear sign starts again.',
    'Choose Put up sign.',
  ];
}
