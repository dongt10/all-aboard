import { scenariosFor, tilesFor } from './sign-scenarios.js';

const words = text => text.trim().split(/\s+/);

// Public-domain sight-word data, grouped so each grade includes earlier lists.
// Dolch: readwritethink.org/sites/default/files/resources/lesson_images/lesson301/dolchwordlist.pdf
const DOLCH = [
  words(`a and away big blue can come down find for funny go help here I in is it jump little
    look make me my not one play red run said see the three to two up we where yellow you`),
  words(`all am are at ate be black brown but came did do eat four get good have he into like must
    new no now on our out please pretty ran ride saw say she so soon that there they this too under
    want was well went what white who will with yes`),
  words(`after again an any as ask by could every fly from give giving had has her him his how just
    know let live may of old once open over put round some stop take thank them then think walk were when`),
  words(`always around because been before best both buy call cold does don't fast first five found
    gave goes green its made many off or pull read right sing sit sleep tell their these those upon
    us use very wash which why wish work would write your`),
  words(`about better bring carry clean cut done draw drink eight fall far full got grow hold hot hurt
    if keep kind laugh light long much myself never only own pick seven shall show six small start
    ten today together try warm`),
];

// Fry's first, second and third hundreds, in frequency order.
const FRY = [
  words(`the of and a to in is you that it he was for on are as with his they I at be this have from
    or one had by word but not what all were we when your can said there use an each which she do how
    their if will up other about out many then them these so some her would make like him into time
    has look two more write go see number no way could people my than first water been call who oil
    its now find long down day did get come made may part`),
  words(`over new sound take only little work know place year live me back give most very after thing
    our just name good sentence man think say great where help through much before line right too
    mean old any same tell boy follow came want show also around form three small set put end does
    another well large must big even such because turn here why ask went men read need land different
    home us move try kind hand picture again change off play spell air away animal house point page
    letter mother answer found study still learn should America world`),
  words(`high every near add food between own below country plant last school father keep tree never start city earth eye light thought
    head under story saw left don't few while along might close something seem next hard open example
    begin life always those both paper together got group often run important until children side feet
    car mile night walk white sea began grow took river four carry state once book hear stop without
    second later miss idea enough eat face watch far Indian real almost let above girl sometimes mountain
    cut young talk soon list song being leave family it's`),
];

const CAST_NAMES = words('Taro Momo Sora Fumi Yuki Hana Kiko Pip Nori Cricket');
export const DESCRIBING_WORDS = Object.freeze(['bright', 'warm', 'kind', 'happy', 'big', 'loud']);
const FESTIVAL_WORDS = words(`hello hi hey welcome friend friends neighbor neighbors neighbour neighbours
  Hanabi Bay lantern lanterns parade festival festivals drum drums banner banners sign signs stall stalls
  cart carts crate crates pizza pizzas stew ice map maps square bench benches garden gardens bay village
  villages summer matsuri tanuki rabbit otter fox cat deer sparrow duck turtle cricket carpenter chef
  storyteller writer designer guide musician courier helper kiosk band music song songs dance dancing
  bean beans bowl bowls soup menu invitation invite invites invited inviting thank thanks goodbye greeting
  greetings lost found warning careful safe danger hot warm cold cool quiet loud soft bright colorful
  colourful shiny sunny cozy cosy sweet tasty yummy delicious beautiful happy kind fun clear cheerful
  little big tiny friendly amazing busy calm peaceful welcome welcome's together everyone everybody
  explore exploring belongs belong path road turn left right straight behind beside next near across
  join joins joined help helps helped helping share sharing build building make making made play playing
  come coming cook cooking eat eating drink drinking carry carrying bring bringing walk walking stop
  wait waiting watch watching listen listening sing singing clap clapping cheer cheering light lights
  glow glowing shine shining sparkle sparkling ready open closed free clean pick up welcome home`);
const COMMON_WORDS = words(`apple apples baby babies back ball balls bear bed bell bird birthday boat box
  boxes boy bread brother cake car cat chair chicken child children coat corn cow day dog doll door duck
  egg eye eyes farm farmer father feet fire fish floor flower flowers game games girl grass ground hand
  head hill horse house kitty leg letter man men milk money morning mother name nest night paper party
  picture pig rabbit rain ring robin school seed sheep shoe sister snow squirrel stick street sun table
  thing time top toy toys tree trees watch water way wind window wood grown grownup grownups adult adults
  kid kids parent parents family families teacher teachers student students lesson lessons question
  questions love loved loves loving like likes liked liking want wants wanted need needs needed look
  looks looked thank thanked thanking you please sorry yes no visit visits visited visiting
  really almost very today tomorrow yesterday here there nearby somewhere anything everything someone
  anyone nothing something nobody everybody everyone another each either both else enough more most
  best better first last many much also always never now then soon early late because so since but and
  or yet still while before after during about around from toward towards inside outside front back
  beside between above below over under through without within beside beyond once twice again far
  morning afternoon evening night day week weekend month year spring summer autumn winter fall
  comes goes works worked working keeps kept feels felt starts started starting ends ended ending
  turns turned turning opens opened opening closes closing closed makes sends send sending sent
  builds built brings carries carried cooks cooked eats ate eaten drinks drank drunk shares shared
  shows showed showing uses used using moves moved moving hopes hoped hoping tries tried trying
  plays played enjoys enjoyed enjoying enjoy stays stayed staying stay explores explored welcomes
  welcomed welcoming dances danced touches touched touching touch hands stove remember remembers
  remembered remembering forget forgets forgetting forgot forgotten stops stopped
  red orange yellow green blue purple pink black white brown gray grey gold silver color colors colour
  colours shape shapes circle circles star stars heart hearts line lines dot dots round long short tall
  wide narrow small large huge strong gentle slow fast easy hard nice good great special wonderful
  funny sad glad excited scared proud silly sleepy tired thirsty hungry hurt sick wet dry full empty
  fresh deep dark light right wrong new old young older younger different same favorite favourite
  tasty smell smells taste tastes feel feels feels sound sounds see sees saw seen hearing hear heard
  read reading reads wrote written writing write writes tell telling tells story stories book books
  draw drawing draws paint painting paints art picture pictures listen song singing rhythm beat beats
  music musical sing sang dance dances drum drumming bell bells clap claps cheer cheers smiling smile
  smiled laugh laughing laughs hug hugs sits sitting standing stand stands seat seats sit rest resting
  wait waits row rows run runs running ran jump jumps jumping hop hopping skips skip fly flying flies
  swim swims swimming climb climbing climbs ride rides riding bike bikes boat boats train trains bus
  pick picks picking bring brings brought take takes taking took taken give gives gave giving get gets
  got getting find finds finding found lost lose loses losing ask asks asked asking answer answers
  answered answering learn learns learning learned teach teaches teaching help helper helpers friend
  friends pet pets bunny kitten puppy puppy's kitten's doggy doggies bag bags hat hats cap caps scarf
  coat coats dress dresses shirt shirts shorts pants sock socks shoe shoes umbrella umbrellas towel
  cup cups plate plates spoon spoons fork forks napkin napkins basket baskets bottle bottles lunch
  dinner breakfast snack snacks fruit fruits banana bananas apple apples orange oranges peach peaches
  pear pears berry berries grape grapes melon lemon rice noodle noodles bread sandwich sandwiches
  cookie cookies candy candies cake cakes cupcake cupcakes ice cream chocolate cheese egg eggs milk
  juice tea lemonade peanut peanuts nut nuts soup pot pots pan pans oven table tables stool stools
  fence gate gates bridge bridges park playground beach lake river pond stream forest woods mountain
  mountains grass bush bushes leaf leaves branch branches root roots seed seeds plant plants flower
  flowers bloom blooms blossom blossoms butterfly butterflies bug bugs ant ants bee bees worm worms
  rock rocks stone stones shell shells sand dirt mud sky cloud clouds moon stars rainbow snow rain
  sun sunlight sunshine wind breeze air nature earth space planet dinosaur dinosaurs dragon dragons
  unicorn unicorns robot robots rocket rockets treasure treasures magic magical ticket tickets shop
  shops store stores signpost way welcome greetings greeting dear wow hooray yay hooray bravo let's
  ok okay sure super perfect important useful careful slowly gently safely loudly quietly beautifully
  softly happily neatly friendly kindness brightest warmer nicest biggest loudest colorful colourful
  centre center colour color favourite favorite realise realize maths math practise practice theatre
  theater neighbour neighbor aluminium aluminum travelled traveled cancelled canceled`);
const NUMBERS = words(`zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen
  fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety
  hundred thousand million first second third fourth fifth sixth seventh eighth ninth tenth half halves
  quarter quarters whole double triple plus minus equal equals more less`);
const CONTRACTIONS = words(`I'm you're he's she's it's we're they're I've you've we've they've I'll you'll
  he'll she'll it'll we'll they'll I'd you'd he'd she'd we'd they'd isn't aren't wasn't weren't don't
  doesn't didn't can't couldn't won't wouldn't shouldn't haven't hasn't hadn't mustn't needn't let's
  that's there's here's what's who's where's when's why's how's that's who'll what'll could've would've
  should've might've must've y'all o'clock`);

const lower = word => word.normalize('NFC').replace(/[’‘]/g, "'").toLowerCase();
const gradeOf = grade => Number.isInteger(grade) ? Math.max(0, Math.min(5, grade)) : 0;
const wordMatches = text => [...text.matchAll(/[\p{L}\p{M}]+(?:['’‘][\p{L}\p{M}]+)*|\p{N}+/gu)];
const wordList = text => wordMatches(text).map(match => lower(match[0]));
const strings = list => Array.isArray(list) ? list.filter(item => typeof item === 'string') : [];
const tileWords = (scenario, grade) => {
  const tiles = tilesFor(scenario, grade);
  return [...tiles.phrases, ...tiles.describing].flatMap(wordList);
};

export function knownWords(grade, vocabulary = []) {
  const level = gradeOf(grade);
  return new Set([
    ...DOLCH.slice(0, Math.min(level + 2, 5)).flat(), ...FRY.slice(0, Math.min(level, 3)).flat(),
    ...CAST_NAMES, ...FESTIVAL_WORDS, ...COMMON_WORDS, ...NUMBERS, ...CONTRACTIONS,
    ...scenariosFor(level).flatMap(scenario => tileWords(scenario, level)),
    ...strings(vocabulary).flatMap(wordList),
  ].map(lower));
}

function inDictionary(word, dictionary, kept) {
  const key = lower(word);
  if (dictionary.has(key) || kept.has(key) || /^\p{N}+$/u.test(key)) return true;
  // Possessives keep the base word's spelling; arbitrary plurals are not invented.
  return key.endsWith("'s") && (dictionary.has(key.slice(0, -2)) || kept.has(key.slice(0, -2)));
}

export function isKnown(word, grade, vocabulary = [], kept = []) {
  return typeof word === 'string' && inDictionary(word, knownWords(grade, vocabulary), new Set(strings(kept).map(lower)));
}

export function splitSentences(text) {
  return typeof text === 'string' ? (text.match(/[^.!?]+[.!?]*|[.!?]+/g) ?? []).map(part => part.trim()).filter(Boolean) : [];
}

export function isSentence(text) {
  if (typeof text !== 'string') return false;
  const sentence = text.trim();
  return /^[\p{Lu}\p{Lt}]/u.test(sentence) && /[.!]$/.test(sentence) && !sentence.includes('?') && splitSentences(sentence).length === 1;
}

export function hasDescribingWord(text, extraDescribing = [], { grade, vocabulary = [] } = {}) {
  const supplied = new Set(strings(vocabulary).flatMap(wordList));
  const scenarioWords = scenariosFor(gradeOf(grade)).flatMap(scenario => tilesFor(scenario, gradeOf(grade)).describing.flatMap(wordList)).filter(word => supplied.has(word));
  const accepted = new Set([...DESCRIBING_WORDS, ...strings(extraDescribing).flatMap(wordList), ...scenarioWords]);
  return typeof text === 'string' && wordList(text).some(word => accepted.has(word));
}

function distance(a, b) {
  a = [...a]; b = [...b];
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
      rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

// Ties between equally close words go to the scenario's own words, then the shared start of the word
// ("sqare" is square, not share, on a sign about the square), then to other festival words.
function suggestionFor(word, dictionary, preferred, scenarioWords = new Set()) {
  const key = lower(word), size = [...key].length, limit = size <= 4 ? 1 : 2;
  const sharedStart = candidate => { let n = 0; while (n < key.length && key[n] === candidate[n]) n++; return n; };
  let best, bestRank;
  for (const candidate of dictionary) {
    if (Math.abs([...candidate].length - size) > limit) continue;
    const edits = distance(key, candidate);
    if (edits > limit) continue;
    const doubled = key.replace(/(.)\1+/g, '$1') === candidate.replace(/(.)\1+/g, '$1');
    const swapped = key.length === candidate.length && [...key].sort().join('') === [...candidate].sort().join('');
    const apostrophe = key.replace(/'/g, '') === candidate.replace(/'/g, '');
    const rank = [edits, doubled || swapped || apostrophe ? 0 : 1, scenarioWords.has(candidate) ? 0 : 1, -sharedStart(candidate), preferred.has(candidate) ? 0 : 1, Math.abs(candidate.length - key.length)];
    if (!bestRank || rank.some((part, i) => part < bestRank[i] && rank.slice(0, i).every((value, j) => value === bestRank[j]))) {
      best = candidate; bestRank = rank;
    }
  }
  return best;
}

function shown(word, prefix, suffix) {
  const room = 56 - prefix.length - suffix.length;
  let short = word;
  if (word.length > room) {
    short = '';
    for (const letter of word) {
      if (short.length + letter.length > room - 1) break;
      short += letter;
    }
    short += '…';
  }
  return `${prefix}${short}${suffix}`;
}

function spellingHints(suggestion) {
  const letters = [...suggestion];
  const full = letters.join('-');
  return [
    `It starts with ${letters.slice(0, 3).join('-')}.`,
    full.length <= 55 ? `${full}.` : `First letters: ${letters.slice(0, 18).join('-')}.`,
    shown(suggestion, 'Fix it to ', '?'),
  ];
}

const issue = (kind, line, hints, details = {}) => ({ kind, blocking: true, line, hints, ...details });

export function checkSign(input, { grade, vocabulary = [], kept = [], goal, describing = [] } = {}) {
  const text = typeof input === 'string' ? input : '';
  const level = gradeOf(grade), sentences = splitSentences(text);
  const tokens = wordMatches(text).map(match => ({ word: match[0], start: match.index, end: match.index + match[0].length, ok: true }));
  if (!level) return { tokens, issues: [], ready: text.trim().split(/\s+/).filter(Boolean).length >= 2, sentences };

  const dictionary = knownWords(level, vocabulary), preserved = new Set(strings(kept).map(lower));
  // Capitalized tile beginnings are often ordinary words, not names. Use
  // the grade dictionary and lowercase variants to distinguish them from
  // custom proper names, independently of vocabulary ordering.
  const baseWords = knownWords(level);
  const supplied = strings(vocabulary);
  const lowercaseWords = new Set(supplied.filter(word => /^[\p{Ll}]/u.test(word)).map(lower));
  const customNames = supplied.filter(word => /^[\p{Lu}\p{Lt}][\p{L}\p{M}]*$/u.test(word)
    && !baseWords.has(lower(word)) && !lowercaseWords.has(lower(word)));
  const names = new Map([...customNames, ...CAST_NAMES].map(name => [lower(name), name]));
  const scenarioWords = new Set(strings(vocabulary).flatMap(wordList).map(lower));
  const preferred = new Set([...scenarioWords, ...CAST_NAMES.map(lower), ...FESTIVAL_WORDS.map(lower)]);
  const issues = [];
  for (const token of tokens) {
    const { word, start, end } = token, key = lower(word), base = key.endsWith("'s") ? key.slice(0, -2) : key;
    if (preserved.has(key)) continue;
    const name = names.get(base), suffix = key.endsWith("'s") ? word.slice(-2) : '';
    if (name && word !== name + suffix) {
      const suggestion = name + suffix;
      token.ok = false;
      issues.push(issue('name', shown(name, '', ' starts with a capital.'), [
        shown(name, 'Start ', ` with ${[...name][0]}.`), ...spellingHints(suggestion).slice(1),
      ], { word, start, end, suggestion, fix: { start, end, text: suggestion } }));
    } else if (!inDictionary(word, dictionary, preserved)) {
      const match = suggestionFor(word, dictionary, preferred, scenarioWords);
      token.ok = false;
      if (match) {
        const first = [...match][0];
        const suggestion = names.get(match) ?? (/^\p{Lu}/u.test(word) ? first.toUpperCase() + match.slice(first.length) : match);
        issues.push(issue('spelling', shown(word, 'Check this word: ', '.'), spellingHints(suggestion), { word, start, end, suggestion, fix: { start, end, text: suggestion } }));
      } else {
        issues.push(issue('unknown', shown(word, 'Is ', ' a name? Names start with a capital.'), [
          'Names start with a capital letter.', 'Read your word. You can choose Keep it.',
        ], { blocking: false, word, start, end }));
      }
    }
  }

  let offset = 0;
  for (const sentence of sentences.length ? sentences : ['']) {
    const start = text.indexOf(sentence, offset), end = start + sentence.length;
    offset = end;
    if (!/^[\p{Lu}\p{Lt}]/u.test(sentence)) {
      const letter = tokens.find(token => token.start >= start && token.end <= end);
      const first = letter ? [...letter.word][0] : '';
      const details = /^\p{Ll}/u.test(first) ? { fix: { start: letter.start, end: letter.start + first.length, text: first.toUpperCase() } } : {};
      issues.push(issue('capital', 'Start with a capital letter.', ['The first letter starts your sentence.', 'Make that first letter a capital.'], details));
    }
    if (sentence.includes('?')) {
      const first = start + sentence.indexOf('?');
      issues.push(issue('question', 'End your sentence with . or !', ['A sign tells the reader something.', 'Use . or ! instead of a question mark.'], { fix: { start: first, end: first + 1, text: '.' } }));
    } else if (!/[.!]$/.test(sentence)) {
      issues.push(issue('end', 'End your sentence with . or !', ['A full stop is a little dot: .', 'An excited sign can end with !'], { fix: { start: end, end, text: '.' } }));
    }
  }

  for (const match of text.matchAll(/\s+[,.!?;:]|[^\S\r\n]{2,}/g)) {
    const start = match.index, end = start + match[0].length, punct = match[0].trim();
    issues.push(issue('space', punct ? 'Keep the mark next to the word.' : 'One space between words is plenty.', [
      punct ? 'The mark goes right after the last letter.' : 'Tap Fix it to leave one space.',
    ], { blocking: false, start, end, fix: { start, end, text: punct || ' ' } }));
  }

  const target = goal ?? (level >= 3 ? 'two-sentences-describing' : 'sentence');
  if (level >= 3 && ['two-sentences-describing', 'reason'].includes(target)) {
    if (sentences.filter(sentence => wordMatches(sentence).length).length < 2) {
      issues.push(issue('sentence', 'One more sentence.', ['Tell your reader one more thing.', 'Start with a capital. End with . or !']));
    }
    if (!hasDescribingWord(text, describing, { grade: level, vocabulary })) {
      issues.push(issue('describing', 'Add a describing word, like bright.', ['Tell how something looks, feels, or sounds.', 'Try a word like bright, warm, or kind.']));
    }
    if (target === 'reason' && !tokens.some(token => ['because', 'so'].includes(lower(token.word)))) {
      issues.push(issue('reason', 'Tell why. Use because or so.', ['Why should your reader come or help?', 'Join your idea to a reason with because or so.']));
    }
  }
  // Keep the sentence goal first while a child is still typing a word.
  issues.sort((a, b) => Number(b.blocking) - Number(a.blocking) || Number(Boolean(a.word)) - Number(Boolean(b.word)));
  return { tokens, issues, ready: tokens.length > 0 && !issues.some(item => item.blocking), sentences };
}

export function applyFix(text, item) {
  if (typeof text !== 'string') return '';
  const fix = item?.fix;
  if (!fix || !Number.isInteger(fix.start) || !Number.isInteger(fix.end) || fix.start < 0 || fix.end < fix.start || fix.end > text.length || typeof fix.text !== 'string') return text;
  // A stale word chip must not replace different words after the child types.
  if (typeof item.word === 'string' && text.slice(fix.start, fix.end) !== item.word) return text;
  return text.slice(0, fix.start) + fix.text + text.slice(fix.end);
}
