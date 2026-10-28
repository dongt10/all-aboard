import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageScene } from '../src/ui/screens/village.js';
import { createState, getCreations, publishCreation, saveDraft } from '../src/progress.js';
import { reactionLine } from '../src/reactions.js';
import { CHARACTERS } from '../src/data.js';
import { HELP_FITS } from '../src/helpday.js';
import { TALE_DECKS } from '../src/tales.js';
import { creationLabel } from '../src/ui/creations.js';
import { keyIntent, routeIntent } from '../src/ui/input.js';
import { EASELS, ROAD_MASK } from '../src/ui/village-layout.js';
import { hotspotRect, overlaps, setRoad } from '../src/ui/village-map.js';
import { createWalkable, maskFromRGBA } from '../src/ui/walkable.js';
import { Doc, Event, pressKey } from './helpers/dom.js';
import { readPNG } from './helpers/png.js';
import { cssRules, declarations, controlStyle } from './helpers/css.js';

const realRoad = createWalkable(maskFromRGBA(readPNG(new URL(`../${ROAD_MASK}`, import.meta.url))));
const read = name => readFileSync(new URL(`../src/ui/${name}.css`, import.meta.url), 'utf8');
const villageCSS = read('screens/village');
const css = cssRules(['tokens', 'kit', 'screens/village', 'phone'].map(read).join('\n'))
  .filter(rule => !/[>+~]/.test(rule.selector))
  .map(({ selector, declarations: rules }) => `${selector} { ${Object.entries(rules).map(([key, value]) => `${key}: ${value}`).join('; ')} }`).join('\n');

function saved(id, grade = 0, fields = {}) {
  const state = { ...createState(), chapter: grade ? 1 : 0, grade: grade || 1 };
  return publishCreation(state, id, { kind: id, chapter: state.chapter, grade, ...fields });
}

function fixture(t, { state = saved('math', 0, { left: [1], right: [1], rolled: true }), calm = false, large = false, phone = false, ...params } = {}) {
  const doc = new Doc(), frames = new Map(), commits = [], gone = [], spoken = [], restore = [];
  let frameId = 0, time = 0;
  for (const [key, value] of Object.entries({
    document: doc, MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id), matchMedia: () => ({ matches: false }),
  })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    restore.push(() => before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key]);
  }
  const stage = doc.createElement('div');
  stage.className = `stage${calm ? ' calm' : ''}${large ? ' large-text' : ''}${phone ? ' phone' : ''}`;
  doc.body.append(stage);
  const scene = createVillageScene({ stage, walkable: realRoad, getState: () => state,
    commit: next => { commits.push(next); state = next; }, go: (...args) => gone.push(args),
    speak: words => { spoken.push(words); return false; },
  }, params);
  scene.mount();
  const root = stage.querySelector('.village');
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  // Use the app's intent routing; pressKey supplies native button default actions.
  doc.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    const route = routeIntent(event);
    if (route === 'click-target') { event.preventDefault(); event.target.click(); }
    if (route === 'scene' && scene.handleIntent(keyIntent(event))) event.preventDefault();
  });
  const tick = () => {
    time += 100;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(time));
  };
  const pos = () => {
    const player = root.querySelector('.village-player');
    return [player.style.left, player.style.top];
  };
  t.after(() => { scene.destroy(); restore.forEach(reset => reset()); setRoad(null); });
  return { doc, root, scene, commits, gone, spoken, tick, pos, state: () => state,
    easel: id => root.querySelector(`[data-easel="${id}"]`),
    box: root.querySelector('.village-dialogue'),
    speaker: () => root.querySelector('.dlg__speaker').textContent,
    words: () => root.querySelector('.dlg__text').textContent,
  };
}

test('every saved subject has a labelled, focusable easel that replays without changing the save', t => {
  let state = saved('writing', 0, { scenario: 'thank-pip', text: 'Thank you!' });
  for (const { id } of CHARACTERS.filter(c => c.id !== 'writing')) state = publishCreation(state, id, { kind: id });
  const before = JSON.stringify(state), f = fixture(t, { state });
  assert.equal(f.root.querySelectorAll('.village-easel').length, 7);
  for (const { id } of CHARACTERS) {
    const easel = f.easel(id), creation = getCreations(state)[id], reaction = reactionLine(id, creation, 0);
    const speaker = reaction.id === 'pip' ? 'Pip' : CHARACTERS.find(c => c.id === reaction.id).name;
    assert.equal(easel.tagName, 'BUTTON'); assert.equal(easel.type, 'button'); assert.equal(easel.tabIndex, 0);
    assert.equal(easel.closest('.village-actor'), null);
    assert.equal(easel.getAttribute('aria-label'), `Your ${creationLabel(id, creation).toLowerCase()}. Tap to hear ${speaker} again.`);
    easel.focus(); assert.equal(f.doc.activeElement, easel);
    const beforePos = f.pos();
    easel.firstElementChild.click(); // The creation itself, including SVG/span children, owns the tap.
    assert.equal(f.box.hidden, false); assert.equal(f.speaker(), speaker); assert.equal(f.words(), reaction.words);
    f.tick(); assert.deepEqual(f.pos(), beforePos, 'replay starts no walk');
    assert.equal(f.doc.activeElement, easel, 'dialogue does not steal focus');
    assert.equal(f.root.querySelector('.village-stall--sparkle'), null, 'replay adds no celebration');
    f.root.querySelector('[data-act="hear"]').click();
    assert.equal(f.spoken.at(-1), reaction.words);
    f.scene.handleIntent('b'); assert.equal(f.box.hidden, true);
  }
  assert.equal(JSON.stringify(f.state()), before); assert.deepEqual(f.commits, []); assert.deepEqual(f.gone, []);
});

const jobs = [
  ['community', 2, { activity: 'compass', request: 2, done: ['east', 'south', 'north'] }, 'Pip', 'delivery map'],
  ['community', 3, { activity: 'helpday', crew: Object.entries(HELP_FITS).map(([job, helper]) => ({ job, helper })) }, 'Nori', 'help day team'],
  ['reading', 4, { activity: 'tales', deck: 1, solved: TALE_DECKS[1].map(t => t.id) }, 'Pip', 'tale book'],
  ['reading', 5, { activity: 'tales', deck: 2, solved: TALE_DECKS[2].map(t => t.id) }, 'Nori', 'tale book'],
  ['writing', 0, { scenario: 'thank-pip', text: 'Thank you!' }, 'Pip', 'festival sign'],
  ['writing', 0, { scenario: 'welcome-nori', text: 'Welcome Nori!' }, 'Nori', 'festival sign'],
];
for (const [id, grade, fields, speaker, label] of jobs) test(`${speaker} speaks at the ${label} easel in grade ${grade}`, t => {
  const state = saved(id, grade, fields), f = fixture(t, { state, focus: id, celebrate: id });
  const actor = f.root.querySelector(`.village-actor[data-id="${id}"]`), stall = f.root.querySelector(`.village-stall[data-id="${id}"]`);
  assert.equal(f.speaker(), speaker, 'Add to town reaction uses the worker');
  assert.equal(f.doc.activeElement, actor, 'the original neighbor keeps focus');
  assert.equal(stall.classList.contains('village-stall--sparkle'), true);
  stall.dispatchEvent(new Event('animationend')); // Finish the original celebration before replay.
  f.scene.handleIntent('b');
  const easel = f.easel(id);
  assert.equal(easel.getAttribute('aria-label'), `Your ${label}. Tap to hear ${speaker} again.`);
  easel.click();
  assert.equal(f.speaker(), speaker);
  assert.equal(f.words(), reactionLine(id, getCreations(state)[id], grade).words);
  assert.equal(stall.classList.contains('village-stall--sparkle'), false);
  assert.deepEqual(f.commits, []); assert.deepEqual(f.gone, []);
});

for (const key of ['Enter', ' ']) test(`native ${key === ' ' ? 'Space' : key} on an easel replays, without walking to the neighbor`, t => {
  const f = fixture(t), easel = f.easel('math'), before = f.pos();
  easel.focus();
  assert.equal(pressKey(easel, 'keydown', key).defaultPrevented, false);
  if (key === ' ') assert.equal(f.box.hidden, true, 'Space waits for release');
  assert.equal(pressKey(easel, 'keyup', key).defaultPrevented, false);
  assert.equal(f.box.hidden, false); assert.equal(f.speaker(), 'Taro');
  f.tick(); assert.deepEqual(f.pos(), before); assert.deepEqual(f.gone, []);
});

for (const calm of [false, true]) for (const via of ['Escape', 'b', 'walk', 'ground']) {
  test(`${via} closes a replay with Calm motion ${calm ? 'on' : 'off'}`, t => {
    const f = fixture(t, { calm });
    f.easel('math').focus(); f.easel('math').click();
    if (via === 'Escape') pressKey(f.doc.activeElement, 'keydown', 'Escape');
    if (via === 'b') f.scene.handleIntent('b');
    if (via === 'walk') pressKey(f.doc.activeElement, 'keydown', 'ArrowUp');
    if (via === 'ground') f.root.querySelector('.village-map').dispatchEvent(new Event('click', { clientX: 500, clientY: 320 }));
    assert.equal(f.box.hidden, true);
    f.easel('math').click(); assert.equal(f.box.hidden, false, 'the same creation can be replayed again');
    assert.deepEqual(f.commits, []);
  });
}

test('a Bigger-words replay waits for unread pages and gives four seconds after the last page', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { large: true, state: saved('community', 2, jobs[0][2]) });
  f.easel('community').click();
  assert.equal(f.words(), 'I carried your lantern east and flour south and north.');
  t.mock.timers.tick(60000); assert.equal(f.box.hidden, false);
  const more = f.root.querySelector('.dlg__more');
  more.focus(); pressKey(more, 'keydown', 'Enter');
  assert.equal(f.words(), 'Thank you!');
  t.mock.timers.tick(3999); assert.equal(f.box.hidden, false);
  t.mock.timers.tick(1); assert.equal(f.box.hidden, true);
  assert.equal(f.doc.activeElement, f.root, 'auto-close restores focus from Hear to the village');
});

test('a new replay replaces the previous closing deadline', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.easel('math').click(); t.mock.timers.tick(3000);
  f.easel('math').click(); t.mock.timers.tick(1000);
  assert.equal(f.box.hidden, false);
  t.mock.timers.tick(3000); assert.equal(f.box.hidden, true);
});

test('drafts and other grades do not gain replay easels', t => {
  let state = saved('reading', 4, jobs[2][2]);
  state = saveDraft({ ...state, grade: 5 }, 'writing', { kind: 'writing', chapter: 1, grade: 5, text: 'A draft.' });
  const f = fixture(t, { state });
  assert.equal(f.root.querySelectorAll('.village-easel').length, 0);
});

for (const large of [false, true]) test(`phone easels retain a 56px target and the music easel outranks Momo (Bigger words ${large})`, t => {
  const f = fixture(t, { phone: true, large, state: saved('music') });
  const easel = f.easel('music'), style = controlStyle(easel, css);
  assert.equal(style['pointer-events'], 'auto'); assert.equal(style.appearance, 'none');
  assert.deepEqual([parseFloat(style.width), parseFloat(style.height)], [EASELS.music.w, EASELS.music.h]);
  assert.ok(parseFloat(style['min-width']) >= 56 && parseFloat(style['min-height']) >= 56);
  assert.ok(overlaps(EASELS.music, hotspotRect('science')), 'test the actual Momo overlap');
  for (const actor of f.root.querySelectorAll('.village-actor')) assert.ok(Number(style['z-index']) > Number(actor.style.zIndex));
  for (const wrapper of ['.village-stalls', '.village-actors']) {
    const rules = declarations(villageCSS, wrapper);
    assert.equal(rules['pointer-events'], 'none');
    for (const property of ['z-index', 'transform', 'isolation', 'opacity']) assert.equal(rules[property], undefined, 'wrappers do not isolate the easel below actors');
  }
  for (const above of ['.village-dialogue', '.village-hud', '.village-board']) {
    assert.ok(Number(style['z-index']) < Number(declarations(villageCSS, above)['z-index']));
  }
  easel.click(); assert.equal(f.speaker(), 'Kiko'); assert.deepEqual(f.gone, []);
  assert.deepEqual(declarations(villageCSS, '.village-easel:focus-visible'), declarations(read('kit'), ':focus-visible'));
  assert.equal(parseFloat(style.width) - 2 * (parseFloat(style.padding) + parseFloat(style.border)), 64);
  assert.equal(parseFloat(style.height) - 2 * (parseFloat(style.padding) + parseFloat(style.border)), 40);
});

test('sign previews still measure the saved words inside the easel button', t => {
  const observers = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    constructor(fit) { this.fit = fit; observers.push(this); }
    observe(sign) { this.sign = sign; sign.offsetWidth = 240; sign.offsetHeight = 160; }
    disconnect() {}
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'ResizeObserver', original) : delete globalThis.ResizeObserver);
  const f = fixture(t, { large: true, state: saved('writing', 0, { scenario: 'thank-pip', text: 'Thank you!' }) });
  const sign = f.easel('writing').querySelector('.world-sign');
  assert.equal(sign.textContent, 'Thank you!');
  assert.equal(Number(sign.style['--sign-scale']), .25);
  sign.offsetHeight = 320; observers.find(observer => observer.sign === sign).fit();
  assert.equal(Number(sign.style['--sign-scale']), .125);
  const style = declarations(villageCSS, '.village-easel > .world-sign');
  assert.match(style.transform, /scale\(var\(--sign-scale/);
  assert.equal(style['max-height'], 'none'); assert.equal(style.overflow, 'visible');
});
