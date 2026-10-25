import test from 'node:test';
import assert from 'node:assert/strict';
import sign, { signWords, signHelp, reactionLine, reconcileTiles, SIGN_LINES } from '../src/ui/activities/sign.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';

const field = (s, action, grade) => sign.act(s.state, s.ui, { type: 'field', ...action }, grade);
const command = (s, id, grade) => sign.act(s.state, s.ui, { type: 'command', id }, grade);
const sentences = text => text.split(/(?<=[.!?…])\s+/);

test('word tiles grow with the grade', () => {
  assert.deepEqual(signWords(0), ['Hello', 'friend!', 'Welcome', '♡']);
  assert.deepEqual(signWords(2), ['Welcome', 'to', 'our', 'festival!', 'Come', 'play', 'with', 'us.']);
  assert.deepEqual(signWords(5), ['Welcome, neighbors!', 'Come explore', 'our summer festival.', 'Everyone belongs here.', 'Please keep the path clear.']);
});

test('tiles build the sign and say what was added; the first tile also says the sign is ready', () => {
  let s = sign.start(null, { chapter: 0, grade: 0 });
  assert.deepEqual(s.ui, { tiles: [] });
  s = field(s, { word: 'Hello' }, 0);
  assert.equal(s.state.text, 'Hello');
  assert.equal(s.line, 'Added: Hello. Ready! Choose Put up sign.');
  s = field(s, { word: 'friend!' }, 0);
  assert.equal(s.state.text, 'Hello friend!');
  assert.equal(s.line, 'Added: friend!');
  assert.deepEqual(s.ui.tiles, ['Hello', 'friend!']);
});

test('Remove word takes a whole tile back at every grade, newest first', () => {
  for (const [chapter, grade, words] of [[0, 0, ['Welcome', '♡']], [1, 2, ['Come', 'play']], [1, 4, ['Welcome, neighbors!', 'Come explore', 'our summer festival.']]]) {
    let s = sign.start(null, { chapter, grade });
    for (const word of words) s = field(s, { word }, grade);
    assert.equal(s.state.text, words.join(' '));
    s = command(s, 'remove', grade);
    assert.equal(s.state.text, words.slice(0, -1).join(' '), `grade ${grade} removes the last tile whole`);
    assert.equal(s.line, reactionLine('Removed', words.at(-1)));
    assert.deepEqual(s.ui.tiles, words.slice(0, -1));
  }
  // Grade 3–5 phrases: three words come off in one tap, not one.
  let s = sign.start(null, { chapter: 1, grade: 3 });
  s = field(s, { word: 'Please keep the path clear.' }, 3);
  s = command(s, 'remove', 3);
  assert.equal(s.state.text, '');
  assert.equal(s.line, 'Removed: Please keep the path clear. The sign is empty.');
});

test('typed text removes its last word, and typing over a tile run forgets the tiles it broke', () => {
  let s = sign.start(null, { chapter: 1, grade: 1 });
  s = field(s, { typed: 'Come  play ' }, 1);
  assert.equal(s.line, SIGN_LINES.typed, 'a new typed word gets one reaction line');
  s = command(s, 'remove', 1);
  assert.equal(s.state.text, 'Come');
  assert.equal(s.line, 'Removed: play.');
  // Tiles after typed text come off whole; then the typed words come off one at a time.
  s = field(s, { word: 'festival!' }, 1);
  assert.deepEqual(s.ui.tiles, ['festival!']);
  s = field(s, { typed: `${s.state.text} now` }, 1);
  assert.deepEqual(s.ui.tiles, [], 'typing at the end breaks the tile run');
  s = command(s, 'remove', 1);
  assert.equal(s.state.text, 'Come festival!');
  s = command(s, 'remove', 1);
  assert.equal(s.state.text, 'Come');
  // A saved sign loads with no tile history, so Remove word takes the last word.
  const loaded = sign.start({ kind: 'writing', text: 'Everyone belongs here.' }, { chapter: 1, grade: 5 });
  assert.equal(command(loaded, 'remove', 5).state.text, 'Everyone belongs');
});

test('Remove word never cuts a typed word in half when a tile is its tail', () => {
  let s = sign.start(null, { chapter: 1, grade: 1 });
  s = field(s, { word: 'us.' }, 1);
  s = field(s, { typed: 'Come bus.' }, 1);
  assert.deepEqual(s.ui.tiles, [], 'the tile "us." is now the tail of "bus.", not a word of its own');
  s = command(s, 'remove', 1);
  assert.equal(s.state.text, 'Come');
  assert.equal(s.line, 'Removed: bus.');
});

test('typing says one line per new word, not per keystroke, and nothing when the sign empties', () => {
  let s = sign.start(null, { chapter: 1, grade: 2 });
  s = field(s, { typed: 'W' }, 2);
  assert.equal(s.line, SIGN_LINES.typed);
  s = field(s, { typed: 'We' }, 2);
  assert.equal(s.line, undefined, 'more letters in the same word say nothing');
  s = field(s, { typed: 'We ' }, 2);
  assert.equal(s.line, undefined, 'a trailing space is not a new word yet');
  s = field(s, { typed: 'We c' }, 2);
  assert.equal(s.line, SIGN_LINES.typed);
  s = field(s, { typed: '' }, 2);
  assert.equal(s.line, undefined, 'the frame says the flip to empty');
  assert.equal(SIGN_LINES.typed, 'You wrote it. Add more, or choose Put up sign.');
});

test('reconcileTiles keeps only the newest tiles the sign still ends with', () => {
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Welcome to'), ['Welcome', 'to']);
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Hi Welcome to  '), ['Welcome', 'to']);
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Welcome tomorrow'), []);
  assert.deepEqual(reconcileTiles(['Welcome', 'to'], 'Hello to'), ['to']);
  assert.deepEqual(reconcileTiles([], 'anything'), []);
  // The run must start at a word boundary: "us." is the tail of "bus.", not a tile on the sign.
  assert.deepEqual(reconcileTiles(['us.'], 'Come bus.'), []);
  assert.deepEqual(reconcileTiles(['us.'], 'us.'), ['us.']);
  assert.deepEqual(reconcileTiles(['play', 'us.'], 'Come play bus.'), []);
  assert.deepEqual(reconcileTiles(['play', 'with'], 'Comeplay with'), ['with']);
});

test('a tile that would pass 120 characters is refused whole, and the state does not change', () => {
  let s = sign.start(null, { chapter: 1, grade: 4 });
  s = field(s, { typed: 'y'.repeat(118) }, 4);
  const refused = field(s, { word: 'Come explore' }, 4);
  assert.equal(refused.state, s.state, 'same state object, so nothing is saved');
  assert.equal(refused.line, SIGN_LINES.full);
  assert.equal(refused.line, 'The sign is full. Remove a word first.');
  // A tile that just fits still goes on.
  s = sign.start(null, { chapter: 1, grade: 4 });
  s = field(s, { typed: 'y'.repeat(107) }, 4);
  s = field(s, { word: 'Come explore' }, 4);
  assert.equal(s.state.text.length, 120);
  assert.equal(s.state.text, `${'y'.repeat(107)} Come explore`);
  // Typed text is still capped (a guard for programmatic input; the textarea's maxLength stops real typing first).
  const typed = field(sign.start(null, { chapter: 1, grade: 1 }), { typed: 'x'.repeat(200) }, 1);
  assert.equal(typed.state.text.length, 120);
  assert.equal(typed.line, SIGN_LINES.full);
});

test('Clear sign empties the sign, forgets the tiles and says what to do next', () => {
  let s = sign.start(null, { chapter: 0, grade: 0 });
  s = field(s, { word: 'Hello' }, 0);
  s = field(s, { word: '♡' }, 0);
  s = command(s, 'clear', 0);
  assert.equal(s.state.text, '');
  assert.deepEqual(s.ui.tiles, []);
  assert.equal(s.line, 'The sign is empty. Tap words to add them.');
  assert.equal(sign.notReadyLine, 'The sign is empty.');
});

test('the sign goes up only when it has visible words; the finish is last and present from the start', () => {
  let s = sign.start(null, { chapter: 1, grade: 3 });
  const commandsNow = () => sign.commands(s.state, s.ui, 3);
  const finish = () => commandsNow().find(c => c.finish);
  assert.equal(commandsNow().at(-1).id, 'finish');
  assert.equal(finish().disabled, true);
  s = field(s, { typed: '   ' }, 3); assert.equal(finish().disabled, true);
  assert.equal(commandsNow().find(c => c.id === 'remove').disabled, true, 'nothing visible to remove');
  assert.equal(commandsNow().find(c => c.id === 'clear').disabled, false, 'spaces can still be cleared');
  s = field(s, { word: 'Everyone belongs here.' }, 3); assert.equal(finish().disabled, false);
  s = command(s, 'clear', 3); assert.equal(finish().disabled, true);
});

test('the activity names, commands, help and lines follow the brief', () => {
  assert.deepEqual([sign.kind, sign.title], ['writing', 'A sign from you']);
  assert.deepEqual(signHelp(0), ['Tap words to add them.', 'Remove word takes one tile back.', 'Clear sign starts again.', 'Choose Put up sign.']);
  for (const grade of [1, 2, 3, 4, 5]) assert.deepEqual(signHelp(grade), ['Tap words to add them, or type your own.', 'Remove word takes one tile back.', 'Clear sign starts again.', 'Choose Put up sign.']);
  assert.ok(signHelp(0).every(step => !/typ/i.test(step)), 'K help never mentions typing');
  assert.equal(sign.helpFor, signHelp);
  // `help` follows the grade of the last start, since the help window has no grade of its own.
  sign.start(null, { chapter: 0, grade: 0 }); assert.deepEqual(sign.help, signHelp(0));
  sign.start(null, { chapter: 1, grade: 2 }); assert.deepEqual(sign.help, signHelp(2));
  const s = sign.start(null, { chapter: 1, grade: 2 });
  assert.equal(sign.opening(s.state, s.ui, 2), 'Choose words for your welcome sign.');
  const ready = sign.start({ kind: 'writing', text: 'Welcome' }, { chapter: 1, grade: 2 });
  assert.equal(sign.opening(ready.state, ready.ui, 2), 'Your sign is ready. Add words, or put it up.');
  assert.deepEqual(sign.commands(s.state, s.ui, 2).map(c => [c.id, c.label, c.icon, Boolean(c.finish)]),
    [['remove', 'Remove word', 'back', false], ['clear', 'Clear sign', 'trash', false], ['finish', 'Put up sign', 'check', true]]);
  for (const c of sign.commands(s.state, s.ui, 2)) assert.ok(c.label.length <= 12, `${c.label} fits a command slot`);
});

test('every line fits one Bigger words page per sentence', () => {
  const lines = [...Object.values(SIGN_LINES), ...signHelp(0), ...signHelp(3)];
  for (const grade of [0, 2, 5]) for (const word of signWords(grade)) lines.push(reactionLine('Added', word), reactionLine('Removed', word));
  lines.push(reactionLine('Added', 'a'.repeat(200)));
  for (const line of lines) {
    for (const sentence of sentences(line)) assert.ok(sentence.length <= PAGE_CHARS.large, `"${sentence}" is ${sentence.length} characters`);
    assert.deepEqual(paginate(line, PAGE_CHARS.large).join(' '), line, `"${line}" pages between sentences`);
  }
  assert.equal(reactionLine('Added', 'Welcome, neighbors!'), 'Added: Welcome, neighbors!');
  assert.equal(reactionLine('Added', 'Hello'), 'Added: Hello.');
  assert.ok(reactionLine('Added', 'a'.repeat(200)).endsWith('…'));
});

test('tiles join with one space and act stays pure', () => {
  let s = sign.start({ kind: 'writing', text: '  Hi  ' }, { chapter: 1, grade: 4 });
  const before = s.state;
  s = field(s, { word: 'there' }, 4);
  assert.equal(s.state.text, 'Hi there');
  assert.equal(before.text, '  Hi  ');
  assert.deepEqual(before, { kind: 'writing', grade: 4, chapter: 1, text: '  Hi  ' });
});

test('Remove word and Clear sign on an empty sign keep it empty; unknown actions change nothing', () => {
  const s = sign.start(null, { chapter: 1, grade: 1 });
  assert.equal(command(s, 'remove', 1).state, s.state);
  assert.equal(command(s, 'remove', 1).line, undefined);
  assert.equal(command(s, 'clear', 1).state, s.state);
  const same = command(s, 'nope', 1);
  assert.equal(same.state, s.state);
  const retyped = field(s, { typed: '' }, 1);
  assert.equal(retyped.state, s.state, 'typing the same text changes nothing');
});

// A tiny stand-in for the DOM: enough of createElement/classList/attributes for mountField and update().
function stubDocument() {
  const make = tag => {
    const classes = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      tagName: tag.toUpperCase(), children: [], parent: null, textContent: '', value: '',
      get ownerDocument() { return doc; },
      get className() { return [...classes].join(' '); },
      set className(v) { classes.clear(); v.split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
      classList: {
        toggle(c, on) { if (on === undefined) on = !classes.has(c); on ? classes.add(c) : classes.delete(c); return on; },
        contains: c => classes.has(c),
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: k => attrs.has(k),
      removeAttribute: k => attrs.delete(k),
      addEventListener: (type, fn) => listeners.set(type, fn),
      click() { listeners.get('click')?.(); },
      append(...kids) { for (const kid of kids) { kid.parent = el; el.children.push(kid); } },
      remove() { if (el.parent) el.parent.children = el.parent.children.filter(k => k !== el); },
      querySelectorAll(selector) {
        const cls = selector.slice(1);
        const out = [];
        const walk = n => { for (const k of n.children) { if (k.classList.contains(cls)) out.push(k); walk(k); } };
        walk(el);
        return out;
      },
    };
    return el;
  };
  const doc = { createElement: make };
  return doc;
}

test('the field marks tiles on the sign with a class and a spoken description, and clears them on Remove word', () => {
  const doc = stubDocument();
  const host = doc.createElement('div');
  let s = sign.start(null, { chapter: 1, grade: 4 });
  const dispatch = action => { s = sign.act(s.state, s.ui, action, 4); mounted.update(s.state, s.ui); };
  const mounted = sign.mountField(host, { grade: 4, dispatch });
  mounted.update(s.state, s.ui);
  const tiles = host.querySelectorAll('.sign-tile');
  assert.equal(tiles.length, 5);
  assert.ok(host.children[0].classList.contains('sign-field--phrases'), 'grades 3-5 use the phrase layout');
  assert.ok(tiles.every(t => !t.classList.contains('sign-tile--used') && !t.hasAttribute('aria-description')));
  tiles[0].click();   // Welcome, neighbors!
  tiles[2].click();   // our summer festival.
  assert.equal(s.state.text, 'Welcome, neighbors! our summer festival.');
  assert.deepEqual(tiles.map(t => t.classList.contains('sign-tile--used')), [true, false, true, false, false]);
  assert.equal(tiles[0].getAttribute('aria-description'), 'On the sign');
  assert.equal(tiles[2].getAttribute('aria-description'), 'On the sign');
  assert.equal(tiles[1].getAttribute('aria-description'), null);
  dispatch({ type: 'command', id: 'remove' });
  assert.equal(s.state.text, 'Welcome, neighbors!');
  assert.deepEqual(tiles.map(t => t.classList.contains('sign-tile--used')), [true, false, false, false, false]);
  assert.equal(tiles[2].getAttribute('aria-description'), null, 'a tile taken back no longer says it is on the sign');
  assert.ok(host.querySelectorAll('.sign-board--ready').length === 1);
  dispatch({ type: 'command', id: 'clear' });
  assert.ok(tiles.every(t => !t.classList.contains('sign-tile--used')));
  mounted.destroy();
  assert.equal(host.children.length, 0);
});
