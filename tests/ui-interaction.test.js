import test from 'node:test';
import assert from 'node:assert/strict';
import { keyIntent, routeIntent, moveCursor, gridMove } from '../src/ui/input.js';
import { paginate, PAGE_CHARS } from '../src/ui/dialogue.js';
import { readFileSync } from 'node:fs';
import { nextCursorIndex, stepCursor, arrangeCommands } from '../src/ui/menu.js';
import { readinessLine } from '../src/ui/screens/encounter.js';
import { createSceneManager, onceAtATime } from '../src/ui/scenes.js';

const key = (k, tagName = 'DIV') => ({ key: k, target: { tagName, isContentEditable: false }, altKey: false, ctrlKey: false, metaKey: false });

test('keys map to A, B and directions outside text fields', () => {
  for (const k of ['Enter', ' ', 'z', 'Z']) assert.equal(keyIntent(key(k)), 'a');
  for (const k of ['Escape', 'x', 'X', 'Backspace']) assert.equal(keyIntent(key(k)), 'b');
  assert.deepEqual(['ArrowUp', 'w', 'ArrowDown', 's', 'ArrowLeft', 'a', 'ArrowRight', 'D'].map(k => keyIntent(key(k))), ['up', 'up', 'down', 'down', 'left', 'left', 'right', 'right']);
  assert.equal(keyIntent({ ...key('z'), metaKey: true }), null);
});
test('text fields hand only Escape to the game', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) for (const k of ['z', 'x', 'Backspace', ' ', 'a', 'Enter', 'ArrowLeft']) assert.equal(keyIntent(key(k, tag)), null, `${tag} ${k}`);
  assert.equal(keyIntent(key('Escape', 'TEXTAREA')), 'b');
});
test('range sliders hand B to the game and retain their native arrows', () => {
  const rangeKey = k => ({ ...key(k, 'INPUT'), target: { tagName: 'INPUT', type: 'range' } });
  for (const k of ['Escape', 'x', 'X', 'Backspace']) assert.equal(keyIntent(rangeKey(k)), 'b', k);
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'z']) assert.equal(routeIntent(rangeKey(k)), null, k);
});
test('A on a focused button is left to the browser, except Z which clicks it', () => {   // Review Focus 1
  assert.equal(routeIntent(key('Enter', 'BUTTON')), 'native');
  assert.equal(routeIntent(key(' ', 'BUTTON')), 'native');
  assert.equal(routeIntent(key('z', 'BUTTON')), 'click-target');
  assert.equal(routeIntent(key('Enter')), 'scene');
  assert.equal(routeIntent(key('Escape', 'BUTTON')), 'scene');
  assert.equal(routeIntent(key('ArrowDown', 'BUTTON')), 'scene');
  assert.equal(routeIntent(key('q')), null);
});
test('the 2×2 cursor stays on real commands', () => {
  assert.deepEqual([moveCursor(0, 'right', 4), moveCursor(1, 'right', 4), moveCursor(0, 'down', 4), moveCursor(2, 'up', 4), moveCursor(3, 'left', 4)], [1, 1, 2, 0, 2]);
  assert.deepEqual([moveCursor(1, 'down', 3), moveCursor(2, 'right', 3)], [1, 2]);
});
test('field grids move by rows and columns and stop at edges', () => {
  assert.deepEqual([gridMove(0, 'left', 6, 30), gridMove(5, 'right', 6, 30), gridMove(0, 'down', 6, 30), gridMove(27, 'down', 6, 30), gridMove(7, 'up', 6, 30)], [0, 5, 6, 27, 1]);
});
test('dialogue pages break between sentences within the limit', () => {
  assert.deepEqual(paginate('Hello, builder! Will you help me check my cart?', 32), ['Hello, builder!', 'Will you help me check my cart?']);
  assert.deepEqual(paginate('Hello, builder! Will you help me check my cart?', PAGE_CHARS.normal), ['Hello, builder! Will you help me check my cart?']);
  assert.deepEqual(paginate('   ', 96), []);
});
test('Bigger words pages split long sentences between words and keep every word', () => {   // Review Focus 3
  const text = 'Both trays start with equal ice cubes and one tray sits in the shade for ten model minutes.';
  const pages = paginate(text, PAGE_CHARS.large);
  assert.deepEqual(PAGE_CHARS, { normal: 96, large: 56 });
  assert.ok(pages.length === 2 && pages.every(page => page.length <= 56));
  assert.equal(pages.join(' '), text);
});
test('dialogue splits oversized words and respects rendered fit even below the character cap', () => {
  const text = 'W'.repeat(120);
  const pages = paginate(text, PAGE_CHARS.large);
  assert.ok(pages.every(page => page.length <= PAGE_CHARS.large));
  assert.equal(pages.join(''), text);
  const fits = page => Math.ceil(page.length * (1401.6 / 46) / 436) * 35.4 <= 110;
  const wide = paginate('W'.repeat(46), PAGE_CHARS.large, fits);
  assert.ok(wide.length > 1, 'wide letters need More even below 56 characters');
  assert.ok(wide.every(fits));
  assert.equal(wide.join(''), 'W'.repeat(46));
});
test('the menu cursor follows the same command when commands change', () => {   // Review Focus 5
  const a = [{ id: 'load-left' }, { id: 'load-right' }, { id: 'weight' }, { id: 'roll' }];
  const b = [{ id: 'load-left' }, { id: 'load-right' }, { id: 'weight' }, { id: 'finish', finish: true }];
  assert.equal(nextCursorIndex(a, a, 2), 2);
  assert.equal(nextCursorIndex(a, b, 3), 3);
  assert.equal(nextCursorIndex([{ id: 'x' }, { id: 'y' }], [{ id: 'y' }, { id: 'x' }], 0), 1);
  assert.equal(nextCursorIndex(a, [{ id: 'p', disabled: true }, { id: 'q' }], 0), 1);
  assert.equal(nextCursorIndex(a, [{ id: 'p', disabled: true }], 0), -1);
});
test('the finish command always lands in slot 4, last, with empty slots before it', () => {   // plan 1A
  const finish = { id: 'finish', label: 'Share story', icon: 'check', finish: true };
  const again = { id: 'again', label: 'Read again', icon: 'undo' };
  assert.deepEqual(arrangeCommands([again, finish]), [again, null, null, finish]);
  assert.deepEqual(arrangeCommands([finish]), [null, null, null, finish]);
  assert.deepEqual(arrangeCommands([finish, again]), [again, null, null, finish], 'a finish that is not last moves last');
  const four = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, finish];
  assert.deepEqual(arrangeCommands(four), four, 'a full menu with the finish last is untouched');
  assert.deepEqual(arrangeCommands([{ id: 'a' }, finish, { id: 'b' }, { id: 'c' }]), four, 'a full menu with the finish early is reordered');
  const noFinish = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
  assert.deepEqual(arrangeCommands(noFinish), noFinish, 'a menu with no finish is untouched');
  assert.deepEqual(arrangeCommands([]), []);
  assert.throws(() => arrangeCommands([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, finish]), RangeError, 'five commands throw instead of dropping one');
});
test('empty menu slots are skipped by the cursor', () => {
  const menu = [{ id: 'again' }, null, null, { id: 'finish', finish: true }];
  assert.equal(nextCursorIndex([{ id: 'pick-key' }, { id: 'pick-umbrella' }], menu, 1), 3, 'the cursor hops over empty slots');
  assert.equal(nextCursorIndex(menu, menu, 3), 3);
  assert.equal(stepCursor(menu, 0, 'right'), 3, 'right from Read again reaches the finish, not an empty slot');
  assert.equal(stepCursor(menu, 0, 'down'), 3);
  assert.equal(stepCursor(menu, 3, 'left'), 0);
  assert.equal(stepCursor(menu, 3, 'up'), 0);
});
test('a readiness flip with no line gets a short line, and a line from the activity wins', () => {   // plan 1A
  const finish = { id: 'finish', label: 'Hang banner', finish: true };
  const commands = [{ id: 'undo' }, null, null, finish];
  assert.equal(readinessLine({}, commands, true, false), 'Not ready yet. Open Help for the steps.');
  assert.equal(readinessLine({ notReadyLine: 'Nothing on the cloth yet.' }, commands, true, false), 'Nothing on the cloth yet.');
  assert.equal(readinessLine({}, commands, false, true), 'Ready! Choose Hang banner.');
  assert.equal(readinessLine({}, [{ id: 'next' }], false, true), 'Ready!');
  assert.equal(readinessLine({}, commands, true, true), null);
  assert.equal(readinessLine({}, commands, false, false), null);
  assert.ok('Not ready yet. Open Help for the steps.'.length <= 56, 'the fallback fits one Bigger words page');
});
test('Bigger words keeps the picture on long command labels and steps the font down instead', () => {   // plan 1A
  const css = readFileSync(new URL('../src/ui/interaction.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);
  const hidesPicture = rules.some(([selector, body]) => selector.includes('.cmd-slot__pic') && /display:\s*none/.test(body));
  assert.equal(hidesPicture, false, 'no rule hides .cmd-slot__pic');
  const long = rules.find(([selector]) => selector === '.large-text .cmd-slot[data-long]');
  assert.ok(long, 'long labels have a Bigger words rule');
  assert.match(long[1], /font-size:\s*calc\(var\(--text-command\) - 4px\)/, 'the font steps down one size');
  assert.match(long[1], /white-space:\s*normal/, 'a label that still overflows wraps to a second line instead of clipping');
});
test('scene changes destroy the old scene before mounting the next', async () => {   // Review Focus 4
  const log = [];
  const scenes = createSceneManager({ create: name => ({ mount: () => log.push(`mount ${name}`), destroy: () => log.push(`destroy ${name}`) }) });
  await scenes.go('village'); await scenes.go('encounter', { id: 'math' });
  assert.deepEqual(log, ['mount village', 'destroy village', 'mount encounter']);
  assert.equal(scenes.current, 'encounter');
});
test('a second scene change during a transition is ignored', async () => {   // Review Focus 1
  let mounts = 0;
  const scenes = createSceneManager({ create: () => ({ mount: () => { mounts++; }, destroy() {} }), transition: swap => new Promise(resolve => setTimeout(async () => { await swap(); resolve(); }, 5)) });
  const first = scenes.go('village');
  assert.equal(await scenes.go('parade'), false);
  assert.equal(await first, true); assert.equal(mounts, 1); assert.equal(scenes.busy, false);
});
test('pausing reaches only the current scene', async () => {   // Review Focus 4
  const paused = [];
  const scenes = createSceneManager({ create: name => ({ mount() {}, destroy() {}, pause: () => paused.push(name) }) });
  scenes.pause(); await scenes.go('music'); scenes.pause();
  assert.deepEqual(paused, ['music']);
});
test('destroying a manager invalidates a pending swap and all future scene changes', async () => {
  const log = [];
  let swap, finish;
  const manager = createSceneManager({
    create: name => ({ mount: () => log.push(`mount ${name}`), destroy: () => log.push(`destroy ${name}`) }),
    transition: next => { swap = next; return new Promise(resolve => { finish = resolve; }); },
  });
  const pending = manager.go('music');
  assert.equal(typeof manager.destroy, 'function');
  manager.destroy(); manager.destroy();
  await swap(); finish();
  assert.equal(await pending, false);
  assert.equal(await manager.go('title'), false);
  assert.equal(manager.current, null);
  assert.equal(manager.scene, null);
  assert.equal(manager.busy, false);
  assert.deepEqual(log, []);
});

test('the save warning stays above windows and rewards without intercepting clicks', () => {
  const rule = (path, selector) => {
    const css = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, selectors]) => selectors.trim() === selector)?.[2];
  };
  const banner = rule('../src/ui/kit.css', '.save-off');
  const level = body => Number(body.match(/z-index:\s*(\d+)/)?.[1]);
  for (const [path, selector] of [['../src/ui/interaction.css', '.win-backdrop'], ['../src/ui/screens/encounter.css', '.item-get']]) assert.ok(level(banner) > level(rule(path, selector)), selector);
  assert.match(banner, /pointer-events:\s*none/);
});
test('onceAtATime ignores repeat calls until the first settles', async () => {   // Review Focus 1
  let calls = 0, release;
  const run = onceAtATime(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  run(); run(); assert.equal(calls, 1);
  release(); await new Promise(resolve => setTimeout(resolve, 0));
  run(); assert.equal(calls, 2);
});

test('dialogue offers spoken More, replay, skip, and a named focus after completion', async t => {
  const { Doc } = await import('./helpers/dom.js');
  const { createDialogue } = await import('../src/ui/dialogue.js');
  const previous = globalThis.document, observer = globalThis.MutationObserver;
  const doc = new Doc(); globalThis.document = doc;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  t.after(() => { globalThis.document = previous; globalThis.MutationObserver = observer; });
  const host = doc.createElement('div'); doc.body.append(host);
  const spoken = []; let completed = 0;
  const dialogue = createDialogue(host, { extendedControls: true, isLarge: () => true, autoRead: () => true, speak: text => { spoken.push(text); return true; }, onComplete: () => completed++ });
  t.after(() => dialogue.destroy());
  const message = 'First sentence has enough words to fill a page. Second sentence asks the important question. Third sentence gives another clue.';
  dialogue.say('Sora', message);
  assert.match(spoken.at(-1), /More\. Tap to continue\.$/);
  const first = dialogue.current();
  assert.equal(dialogue.focusMore(), true);
  const more = host.querySelector('.dlg__more');
  assert.equal(doc.activeElement, more);
  host.querySelector('[data-act="hear"]').click();
  assert.match(spoken.at(-1), /More\. Tap to continue\.$/);
  dialogue.focusMore();
  while (dialogue.hasMore()) more.click();
  assert.equal(completed, 1);
  assert.equal(doc.activeElement, host.querySelector('[data-act="replay"]'));
  assert.doesNotMatch(spoken.at(-1), /Tap to continue/);
  host.querySelector('[data-act="replay"]').click();
  assert.equal(dialogue.current(), first);
  assert.equal(dialogue.hasMore(), true);
  const skip = host.querySelector('[data-act="skip"]');
  skip.focus(); skip.click();
  assert.equal(dialogue.hasMore(), false);
  assert.equal(completed, 2);
  assert.equal(doc.activeElement, host.querySelector('[data-act="replay"]'));
  assert.equal(dialogue.focusMore(), false);
});


test('repagination transfers focus and signals completion when unread pages merge', async t => {
  const { Doc } = await import('./helpers/dom.js');
  const { createDialogue } = await import('../src/ui/dialogue.js');
  const previous = globalThis.document, observer = globalThis.MutationObserver;
  const doc = new Doc(); globalThis.document = doc;
  let notify; globalThis.MutationObserver = class { constructor(fn) { notify = fn; } observe() {} disconnect() {} };
  t.after(() => { globalThis.document = previous; globalThis.MutationObserver = observer; });
  const host = doc.createElement('div'); doc.body.append(host);
  let large = true, completed = 0;
  const dialogue = createDialogue(host, { extendedControls: true, isLarge: () => large, onComplete: () => completed++ });
  t.after(() => dialogue.destroy());
  dialogue.say('Sora', 'First sentence fills this page. Second sentence asks the question.');
  assert.equal(dialogue.focusMore(), true);
  large = false; notify();
  assert.equal(dialogue.hasMore(), false);
  assert.equal(completed, 1);
  assert.equal(doc.activeElement, host.querySelector('[data-act="replay"]'));
});

test('extra dialogue controls are opt-in', async t => {
  const { Doc } = await import('./helpers/dom.js');
  const { createDialogue } = await import('../src/ui/dialogue.js');
  const previous = globalThis.document, observer = globalThis.MutationObserver;
  const doc = new Doc(); globalThis.document = doc;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  t.after(() => { globalThis.document = previous; globalThis.MutationObserver = observer; });
  const host = doc.createElement('div'); doc.body.append(host);
  const dialogue = createDialogue(host, { isLarge: () => true });
  t.after(() => dialogue.destroy());
  dialogue.say('Sora', 'First sentence fills this page. Second sentence asks the question.');
  assert.equal(host.querySelector('[data-act="skip"]').hidden, true);
  assert.equal(host.querySelector('[data-act="replay"]').hidden, true);
  dialogue.focusMore();
  while (dialogue.hasMore()) host.querySelector('.dlg__more').click();
  assert.equal(doc.activeElement, host.querySelector('[data-act="hear"]'));
  dialogue.say('Sora', 'First sentence fills this page. Second sentence asks the question.');
  dialogue.focusMore();
  dialogue.say('Sora', 'A short new message.');
  assert.equal(doc.activeElement, host.querySelector('[data-act="hear"]'), 'replacing a paged message also keeps named focus');
});
