import { checkSign, DESCRIBING_WORDS, splitSentences, isSentence, hasDescribingWord } from './sign-check.js';
import { scenarioById, tilesFor } from './sign-scenarios.js';
export { DESCRIBING_WORDS, splitSentences, isSentence, hasDescribingWord };
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
  const clean = { text };
  if (typeof source.scenario === 'string') clean.scenario = source.scenario;
  if (Array.isArray(source.kept) && source.kept.every(word => typeof word === 'string')) {
    clean.kept = [...new Set(source.kept.map(word => word.toLowerCase()))].slice(0, 20);
  }
  if (Object.hasOwn(source, 'tiles')) {
    const tiles = Array.isArray(source.tiles) ? source.tiles.slice(-60) : [];
    const scenario = scenarioById(clean.scenario, grade);
    const groups = scenario ? tilesFor(scenario, grade) : signTileGroups(grade);
    // A saved sign may predate its scenario assignment; retain its valid
    // legacy tile history as well as tiles from the current scenario.
    const legacy = signTileGroups(grade);
    const words = [...groups.phrases, ...groups.describing, ...legacy.phrases, ...legacy.describing];
    clean.tiles = tiles.every(tile => words.includes(tile)) ? reconcileTiles(tiles, text) : [];
  }
  return clean;
}

export const SIGN_RULE_LINES = Object.freeze({
  word: 'One more word.',
  capital: 'Start with a capital letter.',
  end: 'End your sentence with . or !',
  sentence: 'One more sentence.',
  describing: 'Add a describing word, like bright.',
  ready: 'Your sign is ready. Add words, or put it up.',
  openingK: 'Tap two words for your welcome sign.',
  openingSentence: 'Write a sentence. Start with a capital. End with . or !',
  openingDescribing: 'Write two sentences. Use a describing word.',
});
export function signReport(text, grade, extra = {}) {
  const words = typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const sentences = splitSentences(text);
  const allComplete = sentences.length > 0 && sentences.every(isSentence);
  const describing = hasDescribingWord(text, extra.describing ?? [], { grade, vocabulary: extra.vocabulary });
  const report = checkSign(text, { grade, vocabulary: extra.vocabulary, kept: extra.kept, goal: extra.goal, describing: extra.describing });
  const missing = [...report.issues].sort((a, b) => Number(b.blocking) - Number(a.blocking)).map(issue => issue.line);
  if (!(grade > 0) && words < 2) missing.unshift(SIGN_RULE_LINES.word);
  return { words, sentences, allComplete, describing, missing };
}
function scenarioOptions(state) {
  const scenario = scenarioById(state?.scenario, state?.grade);
  return { vocabulary: scenario?.vocabulary ?? [], goal: scenario?.goal, kept: state?.kept ?? [], describing: scenario ? tilesFor(scenario, state?.grade).describing : [] };
}
export function signReady(state) {
  if (state?.kind !== 'writing') return false;
  return checkSign(state.text, { grade: state.grade, ...scenarioOptions(state) }).ready;
}
export function signHint(state) {
  return signReport(state?.text, state?.grade, scenarioOptions(state)).missing[0] ?? '';
}
export function signOpening(state) {
  const scenario = scenarioById(state?.scenario, state?.grade);
  if (scenario) return scenario.prompt;
  if (signReady(state)) return SIGN_RULE_LINES.ready;
  return !(state?.grade > 0) ? SIGN_RULE_LINES.openingK
    : state.grade < 3 ? SIGN_RULE_LINES.openingSentence : SIGN_RULE_LINES.openingDescribing;
}
export function signHelp(grade) {
  return [
    grade === 0 ? 'Tap words to add them.' : 'Tap words to add them, or type your own.',
    grade === 0 ? 'Two words make a sign.' : grade < 3 ? 'Start with a capital letter. End with . or !' : 'Write two sentences. Use a describing word.',
    grade === 0 ? 'Remove word takes one tile back. Clear starts over.' : 'Tap a marked word for a hint. Fix it or Keep it.',
    'Choose Put up sign.',
  ];
}
