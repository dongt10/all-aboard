// Whose tale is this? (reading, grades 3–5). Pure rules and content for Sora's tale cards: the child reads a
// three-line tale about a neighbor, says who it is about, then taps the one line that proves it.
// Imports only palette constants, so it runs under node --test and never cycles with encounters.js or progress.js.
// Every sentence a child can read here is 56 characters or fewer; every tale line is 44 or fewer.
import { INK, PAPER, PAPER_SHADE, LANTERN, GRASS, SUBJECT_THEME } from './ui/palette.js';

export const KIND = 'reading';
export const ACTIVITY = 'tales';
export const GRADES_TALES = [3, 4, 5];
export const DECK_COUNT = 3;
export const STAMP_TALES = 'Clues in the text prove who a tale is about.';

// Names and stall colors of the cast a tale can be about. Kept here (not read from data.js) to avoid a cycle;
// tests assert these match CHARACTERS and the figure sheets.
export const TALE_CAST = {
  math: { name: 'Taro', color: '#c5773b' },
  science: { name: 'Momo', color: '#78ad9b' },
  art: { name: 'Yuki', color: '#a28ac5' },
  reading: { name: 'Sora', color: '#639dc4' },
  writing: { name: 'Fumi', color: '#51a2a2' },
  community: { name: 'Hana', color: '#789b58' },
  music: { name: 'Kiko', color: '#c6a044' },
  pip: { name: 'Pip', color: LANTERN },
  nori: { name: 'Nori', color: GRASS },
};
// Species words no tale line may use: the clue has to be a detail, never the answer.
export const TALE_WORDS = ['tanuki', 'rabbit', 'cat', 'otter', 'fox', 'deer', 'sparrow', 'bird', 'duck', 'turtle'];

// Three decks of three tales. `proof` is the index of the line that gives the species clue; `about` says what
// each other line tells (for the wrong-line reply); `wrong` is what each decoy looks like (for the wrong-pick reply).
export const TALE_DECKS = [
  [
    { id: 'momo-kitchen', who: 'science', choices: ['math', 'science', 'pip'],
      lines: ['Steam rose from a pot of sweet red beans.', 'Long ears twitched when the timer rang.', 'Soon the whole festival smelled of treats.'],
      proof: 1, about: { 0: 'what was cooking', 2: 'how the festival smelled' },
      wrong: { math: 'Taro has a striped tail.', pip: 'Pip has feathers and a beak.' },
      yes: 'Long ears are a rabbit clue. That points to Momo.' },
    { id: 'taro-pier', who: 'math', choices: ['writing', 'community', 'math'],
      lines: ['Before sunrise, a hammer tapped by the pier.', 'By noon the job was done. Time for a nap!', 'A striped, bushy tail swept up the sawdust.'],
      proof: 2, about: { 0: 'when and where it began', 1: 'how the day ended' },
      wrong: { writing: 'Fumi’s tail is red, not striped.', community: 'Hana is a deer with a tiny tail.' },
      yes: 'A striped tail is a tanuki clue. That points to Taro.' },
    { id: 'kiko-stage', who: 'music', choices: ['art', 'music', 'nori'],
      lines: ['Lanterns glowed over the empty stage.', 'Tiny wings beat time to a brand new tune.', 'The song was ready just as the moon rose.'],
      proof: 1, about: { 0: 'where it happened', 2: 'when the song was done' },
      wrong: { art: 'Yuki has paws and whiskers.', nori: 'Nori has a hard shell.' },
      yes: 'Wings are a bird clue. That points to Kiko.' },
  ],
  [
    { id: 'hana-path', who: 'community', choices: ['reading', 'community', 'nori'],
      lines: ['A visitor could not find the music stage.', 'Soft hooves clicked along the stone path.', 'Drums thumped ahead. The stage was found!'],
      proof: 1, about: { 0: 'the visitor’s problem', 2: 'how the search ended' },
      wrong: { reading: 'Sora has webbed paws, not hooves.', nori: 'Nori has stubby legs and a shell.' },
      yes: 'Hooves are a deer clue. That points to Hana.' },
    { id: 'pip-letters', who: 'pip', choices: ['pip', 'writing', 'science'],
      lines: ['Webbed feet waddled from door to door.', 'A sack of letters bounced at every step.', 'Every house got an invitation. Every one!'],
      proof: 0, about: { 1: 'what was carried', 2: 'what each house got' },
      wrong: { writing: 'Fumi has four fox paws.', science: 'Momo hops on long back feet.' },
      yes: 'Waddling webbed feet are a duck clue. That points to Pip.' },
    { id: 'yuki-studio', who: 'art', choices: ['math', 'music', 'art'],
      lines: ['Paint pots lined the studio windowsill.', 'The brush dipped and swept all afternoon.', 'A long purr hummed as the banner dried.'],
      proof: 2, about: { 0: 'what was on the windowsill', 1: 'what the brush did' },
      wrong: { math: 'Taro grunts and hammers.', music: 'Kiko chirps and sings.' },
      yes: 'A purr is a cat clue. That points to Yuki.' },
  ],
  [
    { id: 'fumi-booth', who: 'writing', choices: ['math', 'writing', 'art'],
      lines: ['Ink pots stood in a row by the booth.', 'A red, fluffy tail swished over the page.', 'The welcome sign was done by lunch.'],
      proof: 1, about: { 0: 'where the pots stood', 2: 'when the sign was done' },
      wrong: { math: 'Taro’s tail is striped, not red.', art: 'Yuki purrs and has a thin cat tail.' },
      yes: 'A red, fluffy tail is a fox clue. That points to Fumi.' },
    { id: 'nori-lanterns', who: 'nori', choices: ['community', 'nori', 'science'],
      lines: ['Paper lanterns waited in a tall stack.', 'One by one they went up, slow and steady.', 'A hard shell was last to leave the square.'],
      proof: 2, about: { 0: 'what was waiting', 1: 'how the lanterns went up' },
      wrong: { community: 'Hana has hooves and no shell.', science: 'Momo hops fast on long back feet.' },
      yes: 'A hard shell is a turtle clue. That points to Nori.' },
    { id: 'sora-bay', who: 'reading', choices: ['pip', 'art', 'reading'],
      lines: ['The bay was still before the festival.', 'A whiskered swimmer dove for a shiny shell.', 'The shell became a gift for a friend.'],
      proof: 1, about: { 0: 'how the bay looked', 2: 'what the shell became' },
      wrong: { pip: 'Pip has a beak and no whiskers.', art: 'Yuki has whiskers but hates getting wet.' },
      yes: 'A whiskered swimmer is an otter clue. That’s me, Sora!' },
  ],
];

export const LINES = {
  openingFresh: 'I collect village tales, but the names fell off! Read the tale. Who is it about?',
  openingMid: n => `Tale ${n} of 3. Who is it about?`,
  openingReady: 'Your tale book is ready! Share it or Try another.',
  rightPick: name => (name === 'Sora' ? 'Yes, it’s me, Sora! Which line told you?' : `Yes, it’s ${name}! Which line told you?`),
  wrongPick: why => `${why} Does any line say that?`,
  wrongLine: about => `That line tells ${about}. Which line shows who it is?`,
  proved: yes => `${yes} Choose Next tale.`,
  provedLast: yes => `${yes} All named! Choose Share tales.`,
  nextTale: n => `Tale ${n}. Who is this one about?`,
  startOver: 'New tales! Read the first one. Who is it about?',
  readLine: (n, text) => `Line ${n}: ${text}`,
  review: name => `${name}’s tale. Tap a line to hear it.`,
  clue: (name, text) => `${name}’s clue: ${text}`,
  notReady: 'The tales need names again. Read the tale.',
  allNamed: 'Three tales, three names!',
};

const clamp = (n, a, b, fallback = a) => Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : fallback;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDeck = d => Number.isInteger(d) && d >= 0 && d < DECK_COUNT;

// The deck a fresh start opens on: grade 3 → 0, 4 → 1, 5 → 2 (and any other grade wraps the same way).
export function freshDeck(grade) {
  const g = Math.round(clamp(grade, 0, 5));
  return (((g - 3) % DECK_COUNT) + DECK_COUNT) % DECK_COUNT;
}

// Only ids from this deck, in deck order, once each, at most three.
function cleanSolved(deck, solved) {
  const wanted = Array.isArray(solved) ? solved : [];
  return TALE_DECKS[deck].map(t => t.id).filter(id => wanted.includes(id));
}

const isTales = input => Boolean(input) && typeof input === 'object' && !Array.isArray(input) && input.kind === KIND && input.activity === ACTIVITY;

// The validated snapshot keeps kind 'reading' and found [] for the shared reading save format.
// (shared with K–2's story bag); `activity` tells the frame which module owns it. A legacy K–2 snapshot (no activity
// field) is ignored, so the tale cards start fresh. A saved deck always wins over the grade.
// A missing deck field starts the grade's fresh deck; an invalid saved deck cleans to 0.
// Solved keeps only this deck's ids, in deck order, once each.
export function normalizeTales(input, grade = 3, chapter = 1) {
  const s = isTales(input) ? input : {};
  const c = chapter === 1 ? 1 : 0;
  const g = c === 0 ? 0 : Math.round(clamp(grade, 1, 5, 3));
  const hasDeck = Object.hasOwn(s, 'deck');
  const deck = isDeck(s.deck) ? s.deck : hasDeck ? 0 : freshDeck(g);
  return { kind: KIND, activity: ACTIVITY, grade: g, chapter: c, found: [], request: Number.isInteger(s.request) ? clamp(s.request, 1, 2) : 1, deck,
    solved: hasDeck ? cleanSolved(deck, s.solved) : [] };
}

// The saved shape (what progress.js keeps): the same fields, with chapter and grade read from the input the way
// cleanCreation does, so a round-trip through both normalizers is deepEqual. Junk gives null.
export function cleanTalesCreation(input) {
  if (!isTales(input)) return null;
  const chapter = input.chapter === 1 ? 1 : 0;
  return normalizeTales(input, input.grade, chapter);
}

export const deckOf = s => TALE_DECKS[isDeck(s?.deck) ? s.deck : 0];
export const findTale = (s, taleId) => deckOf(s).find(t => t.id === taleId) ?? null;
export const taleIndex = (s, taleId) => deckOf(s).findIndex(t => t.id === taleId);
// The first unsolved tale of the deck, or null when all three are named.
export function currentTale(s) {
  const solved = Array.isArray(s?.solved) ? s.solved : [];
  return deckOf(s).find(t => !solved.includes(t.id)) ?? null;
}
export const solvedCount = s => cleanSolved(isDeck(s?.deck) ? s.deck : 0, s?.solved).length;

// Ready exactly when every tale of the deck is in solved.
export function talesReady(s) {
  if (!isTales(s) || !GRADES_TALES.includes(s.grade) || !isDeck(s.deck) || !Array.isArray(s.solved)) return false;
  return solvedCount(s) === deckOf(s).length;
}

export function talesOpening(s) {
  if (talesReady(s)) return LINES.openingReady;
  const n = solvedCount(s);
  return n === 0 ? LINES.openingFresh : LINES.openingMid(taleIndex(s, currentTale(s)?.id) + 1);
}

// The proof was found: the tale joins solved, kept in deck order. Anything not in this deck changes nothing.
export function solveTale(s, taleId) {
  const deck = isDeck(s?.deck) ? s.deck : 0;
  if (!TALE_DECKS[deck].some(t => t.id === taleId)) return s;
  const solved = cleanSolved(deck, [...(Array.isArray(s.solved) ? s.solved : []), taleId]);
  return solved.length === solvedCount(s) ? s : { ...s, solved };
}

// Start over: the next deck, nothing solved.
export const nextDeck = s => ({ ...s, deck: ((isDeck(s?.deck) ? s.deck : 0) + 1) % DECK_COUNT, solved: [] });

// A neighbor pick: right → prove next; a decoy → what that neighbor looks like; anyone else → null (ignored).
export function talePick(tale, figureId) {
  if (!tale) return null;
  if (figureId === tale.who) return { right: true, line: LINES.rightPick(TALE_CAST[figureId]?.name ?? '') };
  if (Object.hasOwn(tale.wrong, figureId)) return { right: false, line: LINES.wrongPick(tale.wrong[figureId]) };
  return null;
}

// A line pick while proving: the proof line → the clue explained (and the next command); another → what it tells.
export function taleProof(tale, lineIndex, isLast = false) {
  if (!tale || !Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= tale.lines.length) return null;
  if (lineIndex === tale.proof) return { right: true, line: isLast ? LINES.provedLast(tale.yes) : LINES.proved(tale.yes) };
  return { right: false, line: LINES.wrongLine(tale.about[lineIndex]) };
}

// A 24×24 currentColor badge for the Line 1/2/3 commands.
export function lineBadgeSVG(n) {
  const digit = Math.round(clamp(n, 1, 3));
  return `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="14" font-weight="700" fill="currentColor">${digit}</text></svg>`;
}

// The saved creation drawn small (about 64×42 at 100:65): Sora's tale book with a colored stamp per named tale.
// Ids pass through the deck before anything is drawn and every string is escaped.
export function taleBookSVG(s) {
  const deck = isDeck(s?.deck) ? s.deck : 0;
  const solved = cleanSolved(deck, s?.solved);
  const names = solved.map(id => TALE_CAST[findTale({ deck }, id).who].name);
  const list = names.length === 3 ? `${names[0]}, ${names[1]} and ${names[2]}` : names.join(' and ');
  const label = names.length === 3 ? `Your book of three tales: ${list}` : names.length ? `Your book of tales, ${names.length} of 3 named: ${list}` : 'Your book of tales, nothing named yet';
  const stamps = TALE_DECKS[deck].map((tale, i) => {
    const cx = 30 + i * 24;
    if (!solved.includes(tale.id)) return `<circle cx="${cx}" cy="40" r="11" fill="${PAPER_SHADE}" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2"/>`;
    const cast = TALE_CAST[tale.who];
    return `<circle cx="${cx}" cy="40" r="11" fill="${esc(cast.color)}" stroke="${INK}" stroke-width="2"/><text x="${cx}" y="40" dy=".35em" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="13" font-weight="700" fill="${INK}">${esc(cast.name[0])}</text>`;
  }).join('');
  return `<svg class="creation creation--reading" viewBox="0 0 100 65" aria-label="${esc(label)}"><rect x="1" y="1" width="98" height="63" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><rect x="1" y="1" width="8" height="63" fill="${SUBJECT_THEME.reading.color}"/><text x="54" y="14" text-anchor="middle" font-family="'Pixelify Sans', Andika, sans-serif" font-size="9" fill="${INK}">Tales</text>${stamps}</svg>`;
}
export const talesCreationMarkup = taleBookSVG;
