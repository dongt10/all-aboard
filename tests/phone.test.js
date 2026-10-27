import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cssRules, declarations, controlStyle } from './helpers/css.js';
import { Doc } from './helpers/dom.js';
import { createTitleScene } from '../src/ui/screens/title.js';
import { createState } from '../src/progress.js';
import { createCommandMenu } from '../src/ui/menu.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const phone = read('src/ui/phone.css');
const rawCss = ['tokens', 'kit', 'interaction', 'screens/title', 'screens/windows', 'screens/village', 'phone']
  .map(name => read(`src/ui/${name}.css`)).join('\n');
// The fake DOM supports simple descendant selectors; retain those for cascade checks.
const css = cssRules(rawCss).filter(rule => !/[>+~]/.test(rule.selector)).map(({ selector, declarations }) => `${selector} { ${Object.entries(declarations).map(([k, v]) => `${k}: ${v}`).join('; ')} }`).join('\n');

test('phone stylesheet is last and all rules are scoped', () => {
  const styles = [...read('index.html').matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(styles.at(-1), './src/ui/phone.css');
  for (const { selector } of cssRules(phone)) assert.match(selector, /^\.phone(?:\b|[.#:[\s])/);
});

test('phone reading tokens keep a 20px floor and Bigger words enlarges body and name', () => {
  const normal = declarations(phone, '.phone'), large = declarations(phone, '.phone.large-text');
  for (const token of ['--text-small', '--text-field', '--text-name', '--text-command', '--text-body', '--text-title']) {
    assert.ok(parseFloat(normal[token]) >= 20, token);
    assert.ok(parseFloat(large[token]) >= 20, token);
  }
  for (const token of ['--text-body', '--text-name']) assert.ok(parseFloat(large[token]) > parseFloat(normal[token]), token);
});

test('explicit phone text sizes remain at least 20px', () => {
  for (const { selector, declarations: values } of cssRules(phone)) {
    const size = values['font-size'];
    if (size && /^\d+(?:\.\d+)?px$/.test(size)) assert.ok(parseFloat(size) >= 20, `${selector}: ${size}`);
  }
});

test('phone overrides do not move scene regions', () => {
  const regions = /\.(?:stage(?:-viewport)?|enc__(?:field|dialogue|menu|plate)|music-(?:dialogue|menu|lanterns?))(?:\b|[.#:[\s])/;
  const forbidden = /^(?:position|left|right|top|bottom|width|height|inset(?:-.+)?|transform)$/;
  for (const { selector, declarations: values } of cssRules(phone)) {
    if (regions.test(selector)) for (const property of Object.keys(values)) assert.doesNotMatch(property, forbidden, `${selector}: ${property}`);
  }
});

test('real title controls receive phone sizing', t => {
  const doc = new Doc(), before = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = doc;
  t.after(() => { if (before) Object.defineProperty(globalThis, 'document', before); else delete globalThis.document; });
  doc.body.classList.add('phone');
  let state = createState();
  const scene = createTitleScene({ stage: doc.body, getState: () => state, commit: next => { state = next; }, go() {}, announce() {}, speak() {} });
  scene.mount();
  const credits = doc.body.querySelector('.title-credits');
  const toggle = doc.body.querySelector('.title__comfort .px-toggle');
  for (const el of [credits, toggle]) {
    assert.ok(el);
    assert.ok(parseFloat(controlStyle(el, css)['min-height']) >= 64);
  }
  const word = doc.body.querySelector('.grade-tile__word');
  assert.ok(parseFloat(controlStyle(word, css)['font-size']) >= 20);
  scene.destroy();
});

test('command cells fit the existing 136px frame', () => {
  const frame = declarations(phone, '.phone .cmd-frame');
  const slot = declarations(phone, '.phone .cmd-slot');
  const menu = declarations(read('src/ui/interaction.css'), '.cmd-menu');
  const outer = declarations(read('src/ui/interaction.css'), '.cmd-frame');
  const border = parseFloat(declarations(read('src/ui/kit.css'), '.px-frame').border ?? '4');
  assert.ok(2 * parseFloat(slot['min-height']) + parseFloat(menu.gap) + parseFloat(frame['padding-top']) + parseFloat(frame['padding-bottom']) + 2 * border <= parseFloat(outer.height));
});

test('real command menu buttons receive the 56px phone target', t => {
  const doc = new Doc(), before = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = doc;
  t.after(() => { if (before) Object.defineProperty(globalThis, 'document', before); else delete globalThis.document; });
  doc.body.classList.add('phone');
  createCommandMenu(doc.body);
  const button = doc.body.querySelector('.cmd-slot');
  assert.ok(button);
  assert.ok(parseFloat(controlStyle(button, css)['min-height']) >= 56);
});

test('festival pips remain below the title beside the spanning parade button', () => {
  const title = declarations(phone, '.phone .village-board__title');
  const pips = declarations(phone, '.phone .village-board__pips');
  const parade = declarations(phone, '.phone .village-parade');
  assert.equal(title['grid-column'], '1');
  assert.equal(pips['grid-column'], '1');
  assert.equal(pips['grid-row'], '2');
  assert.equal(parade['grid-column'], '2');
  assert.equal(parade['grid-row'], '1 / 3');
});

test('item card actions retain compact horizontal spacing', () => {
  assert.equal(declarations(phone, '.phone .item-get__actions').gap, '8px');
  assert.equal(declarations(phone, '.phone .item-get__actions button')['padding-inline'], '8px');
  assert.equal(declarations(phone, '.phone .item-get__card button')['min-height'], '64px');
});

test('phone dialogue probe matches visible height, fits two lines and keeps bottom controls in bounds', () => {
  const interaction = read('src/ui/interaction.css');
  const encounter = read('src/ui/screens/encounter.css');
  const dlg = declarations(interaction, '.dlg');
  const inset = declarations(interaction, '.dlg__measure').inset.split(/\s+/).map(parseFloat);
  const border = 4; // .px-frame has a 4px border; its absolutely positioned child uses the padding box.
  const height = parseFloat(dlg.height);
  const outer = declarations(encounter, '.enc__dialogue');
  const tabs = declarations(interaction, '.dlg__tabs');
  const replay = declarations(encounter, '.enc .dlg__tabs [data-act="replay"]');
  const extra = declarations(phone, '.phone .enc .dlg__tabs [data-act="replay"]');
  const replayY = parseFloat(outer.top) + parseFloat(tabs.top) + parseFloat(replay.top);
  assert.equal(replayY, 512);
  assert.ok(replayY + parseFloat(extra['min-height']) <= 540);
  for (const area of ['enc', 'music', 'parade']) {
    const frame = declarations(phone, `.phone .${area} .dlg__frame`);
    const measure = declarations(phone, `.phone .${area} .dlg__measure`);
    const text = declarations(phone, `.phone .${area} .dlg__text`);
    const more = declarations(phone, `.phone .${area} .dlg__more`);
    const visibleHeight = height - 2 * border - parseFloat(frame['padding-top']) - parseFloat(frame['padding-bottom']);
    const probeHeight = height - 2 * border - inset[0] - inset[2] - parseFloat(measure['margin-top']) - parseFloat(measure['margin-bottom']);
    assert.equal(visibleHeight, probeHeight, area);
    assert.ok(visibleHeight >= 2 * parseFloat(declarations(phone, '.phone.large-text')['--text-body']) * parseFloat(text['line-height']), area);
    const moreBottom = height - border - parseFloat(declarations(interaction, '.dlg__more').bottom);
    const moreTop = moreBottom - parseFloat(more['min-height']);
    const textBottom = border + parseFloat(frame['padding-top']) + visibleHeight;
    assert.ok(textBottom <= moreTop, `${area}: More must not overlap text`);
  }
});
