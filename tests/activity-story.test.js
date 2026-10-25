import test from 'node:test';
import assert from 'node:assert/strict';
import story from '../src/ui/activities/story.js';
import { READING_ITEMS, readingStep } from '../src/reading.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';

const cmd = id => ({ type: 'command', id });
const GRADES = [0, 1, 2, 3, 4, 5];
const PAGE = 56;                                   // one dialogue page with Bigger words on
const sentences = text => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const fitsOnePage = (text, at) => { for (const s of sentences(text)) assert.ok(s.length <= PAGE, `${at}: "${s}" is ${s.length} chars, over ${PAGE}`); };

test('opening and Next part put the current passage before its question in spoken dialogue', () => {
  for (const grade of GRADES) {
    let s = story.start(null, { grade, chapter: grade ? 1 : 0 });
    for (const id of READING_ITEMS) {
      const part = readingStep(s.state.found, grade);
      const line = id === 'key' ? story.opening(s.state, s.ui, grade) : s.line;
      assert.ok(line.includes(part.passage), `grade ${grade}, ${id}: missing passage`);
      assert.ok(line.indexOf(part.passage) < line.indexOf(part.question));
      for (const limit of Object.values(PAGE_CHARS)) {
        assert.deepEqual(paginate(line, limit).join(' '), line);
        assert.ok(paginate(line, limit).every(page => page.length <= limit));
      }
      s = story.act(s.state, s.ui, cmd(`pick-${id}`), grade);
      if (id !== 'book') s = story.act(s.state, s.ui, cmd('next'), grade);
    }
  }
});

test('the four pictures are the commands, and the opening asks the first question', () => {
  const { state, ui } = story.start(null, { chapter: 1, grade: 2 });
  const commands = story.commands(state, ui, 2);
  assert.deepEqual(commands.map(c => c.label), ['Key', 'Umbrella', 'Book', 'Cup']);
  assert.ok(commands.every(c => c.art.startsWith('<svg')));
  assert.match(story.opening(state, ui, 2), /What does Sora pack to lock her door\?$/);
});

test('a right pick explains why, then Next moves to the next part', () => {
  const s = story.start(null, { chapter: 1, grade: 2 });
  const picked = story.act(s.state, s.ui, cmd('pick-key'), 2);
  assert.deepEqual([picked.state.found, picked.line], [['key'], 'Key packed! The key fits the lock on Sora’s door.']);
  assert.deepEqual(story.commands(picked.state, picked.ui, 2).map(c => c.id), ['next']);
  const next = story.act(picked.state, picked.ui, cmd('next'), 2);
  assert.equal(next.line, 'Rain is coming. Sora packs an umbrella to stay dry. What does Sora pack to stay dry?');
  assert.equal(story.commands(next.state, next.ui, 2).find(c => c.id === 'pick-key').disabled, true);
});

test('a wrong pick keeps progress and gives a hint', () => {
  const s = story.start(null, { chapter: 1, grade: 3 });
  const wrong = story.act(s.state, s.ui, cmd('pick-cup'), 3);
  assert.deepEqual([wrong.state.found, wrong.line], [[], 'A cup holds a drink. Look for the thing that fits a door lock.']);
  assert.equal(story.commands(wrong.state, wrong.ui, 3).length, 4);
});

test('grades 3–5 read a clue that never names the item', () => {
  const { state, ui } = story.start(null, { chapter: 1, grade: 4 });
  const opening = story.opening(state, ui, 4);
  assert.match(opening, /What should Sora pack\?$/);
  assert.doesNotMatch(opening, /\bkey\b/i);
});

test('K says the word the way the buttons spell it', () => {                              // plan 1B: "Key", not "KEY"
  const { state, ui } = story.start(null, { chapter: 0, grade: 0 });
  assert.equal(story.opening(state, ui, 0), 'Help me pack three things for the festival. Key. Put the Key in the bag.');
  const wrong = story.act(state, ui, cmd('pick-cup'), 0);
  assert.equal(wrong.line, 'That says Cup. Look for Key.');
  const right = story.act(state, ui, cmd('pick-key'), 0);
  assert.equal(right.line, 'Key packed! This says Key. Key is in the bag!');
});

test('packing all three offers Start over and Share story, with the finish last', () => {   // plan 1A/1B
  const s = story.start({ kind: 'reading', found: ['key', 'umbrella'] }, { chapter: 0, grade: 0 });
  const done = story.act(s.state, s.ui, cmd('pick-book'), 0);
  assert.match(done.line, /All three are packed\. Your story is ready to share\.$/);
  const commands = story.commands(done.state, done.ui, 0);
  assert.deepEqual(commands.map(c => [c.id, c.label, c.icon]), [['again', 'Start over', 'undo'], ['finish', 'Share story', 'check']]);
  assert.ok(commands.at(-1).finish && !commands.at(-1).disabled, 'Share story is the enabled finish, last');
  assert.ok(commands.every(c => c.label.length <= 12));
});

test('Start over empties the bag and says so, then the first question is back', () => {
  const s = story.start({ kind: 'reading', found: READING_ITEMS }, { chapter: 1, grade: 2 });
  const again = story.act(s.state, s.ui, cmd('again'), 2);
  assert.deepEqual(again.state.found, []);
  assert.equal(again.line, 'The bag is empty again. Let’s read! Sora will lock her door. She packs a key. What does Sora pack to lock her door?');
  assert.deepEqual(story.commands(again.state, again.ui, 2).map(c => c.id), ['pick-key', 'pick-umbrella', 'pick-book', 'pick-cup']);
  assert.match(story.opening(again.state, again.ui, 2), /lock her door\?$/);
});

test('Help names every command and ends with the finish', () => {
  assert.deepEqual(story.help, ['Read the story page.', 'Choose the picture that fits.', 'Read why it belongs.', 'Choose Next part, then Share story.']);
  for (const step of story.help) fitsOnePage(step, 'help');
});

test('every line at every grade fits one Bigger words page, sentence by sentence', () => {
  for (const grade of GRADES) {
    const chapter = grade === 0 ? 0 : 1;
    let { state, ui } = story.start(null, { chapter, grade });
    fitsOnePage(story.opening(state, ui, grade), `opening grade ${grade}`);
    for (const id of READING_ITEMS) {
      // One wrong pick first (the cup), then the right one, then Next part.
      fitsOnePage(story.act(state, ui, cmd('pick-cup'), grade).line, `wrong pick ${id} grade ${grade}`);
      const right = story.act(state, ui, cmd(`pick-${id}`), grade);
      fitsOnePage(right.line, `right pick ${id} grade ${grade}`);
      ({ state, ui } = right);
      if (story.commands(state, ui, grade).some(c => c.id === 'next')) {
        const next = story.act(state, ui, cmd('next'), grade);
        fitsOnePage(next.line, `next after ${id} grade ${grade}`);
        ({ state, ui } = next);
      }
    }
    fitsOnePage(story.opening(state, ui, grade), `ready opening grade ${grade}`);
    fitsOnePage(story.act(state, ui, cmd('again'), grade).line, `start over grade ${grade}`);
  }
});

// A few lines of fake DOM so the field can be mounted without a browser.
function fakeDocument() {
  const make = tag => {
    const el = {
      tagName: tag, children: [], attrs: {}, classes: new Set(), _text: '', _html: '',
      get className() { return [...el.classes].join(' '); }, set className(v) { el.classes = new Set(v.split(/\s+/).filter(Boolean)); },
      classList: { toggle: (c, on) => { on ? el.classes.add(c) : el.classes.delete(c); } },
      get textContent() { return el._text; }, set textContent(v) { el._text = String(v); el.children = []; },
      get innerHTML() { return el._html; }, set innerHTML(v) { el._html = String(v); el.children = parse(String(v)); },
      setAttribute: (k, v) => { el.attrs[k] = String(v); }, getAttribute: k => el.attrs[k] ?? null,
      append: (...kids) => el.children.push(...kids), remove() {},
      querySelector: sel => el.querySelectorAll(sel)[0] ?? null,
      querySelectorAll: sel => all(el).filter(n => n !== el && n.classes.has(sel.slice(1))),
    };
    return el;
  };
  const all = el => [el, ...el.children.flatMap(all)];
  // Builds the element tree from the markup the field writes: a flat set of class names is all the test needs.
  function parse(html) {
    const stack = [{ children: [] }];
    for (const m of html.matchAll(/<(\/?)([a-z]+)([^>]*)>([^<]*)/g)) {
      const [, close, tag, attrs, text] = m;
      if (close) { stack.pop(); if (text.trim()) stack.at(-1).children.at(-1)._text += text; continue; }
      const el = make(tag);
      const cls = /class="([^"]*)"/.exec(attrs);
      if (cls) el.className = cls[1];
      el._text = text;
      stack.at(-1).children.push(el);
      stack.push(el);
    }
    return stack[0].children;
  }
  return { createElement: make };
}

test('the field shows Part N of 3, the K word as Key, and the bag count', () => {
  globalThis.document = fakeDocument();
  try {
    const host = globalThis.document.createElement('div');
    const field = story.mountField(host, { grade: 0 });
    const root = host.children[0];
    const text = cls => root.querySelector(cls).textContent;
    const { state, ui } = story.start(null, { chapter: 0, grade: 0 });
    field.update(state, ui);
    assert.equal(text('.story-part'), 'Part 1 of 3');
    assert.equal(text('.story-passage'), 'Key');
    assert.equal(text('.story-bag__title'), 'Bag 0/3');
    assert.deepEqual(root.querySelectorAll('.story-slot__label').map(el => el.textContent), ['Empty', 'Empty', 'Empty']);
    const picked = story.act(state, ui, cmd('pick-key'), 0);
    field.update(picked.state, picked.ui);
    assert.equal(text('.story-part'), 'Part 1 of 3 · ✓ Packed');
    assert.equal(text('.story-bag__title'), 'Bag 1/3');
    assert.equal(root.querySelectorAll('.story-slot--packed').length, 1);
    const ready = story.start({ kind: 'reading', found: READING_ITEMS }, { chapter: 0, grade: 0 });
    field.update(ready.state, ready.ui);
    assert.equal(text('.story-part'), 'The whole story');
    assert.equal(text('.story-passage'), 'Ready for the festival!');
    assert.equal(text('.story-bag__title'), 'Bag 3/3');
    const again = story.act(ready.state, ready.ui, cmd('again'), 0);
    field.update(again.state, again.ui);
    assert.deepEqual(root.querySelectorAll('.story-slot__label').map(el => el.textContent), ['Empty', 'Empty', 'Empty']);
    field.destroy();
  } finally { delete globalThis.document; }
});
