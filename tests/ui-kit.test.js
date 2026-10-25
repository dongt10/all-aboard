import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE, fitStage } from '../src/ui/stage.js';
import { INK, INK_SOFT, PAPER, FINISH, SUBJECT_THEME, contrastRatio } from '../src/ui/palette.js';
import { CHARACTERS } from '../src/data.js';

test('the stage fits a Chromebook window by height and centers sideways', () => {
  const fit = fitStage(1366, 657);
  assert.deepEqual(STAGE, { width: 960, height: 540 });
  assert.ok(Math.abs(fit.scale - 657 / 540) < 1e-9);
  assert.ok(Math.abs(fit.left - (1366 - 960 * fit.scale) / 2) < 1e-9);
  assert.equal(fit.top, 0); assert.equal(fit.portrait, false);
});
test('the stage fits a tall window by width and flags portrait', () => {
  const fit = fitStage(390, 844);
  assert.ok(Math.abs(fit.scale - 390 / 960) < 1e-9);
  assert.equal(fit.left, 0); assert.equal(fit.portrait, true);
});
test('at native size the stage is unscaled', () => {
  assert.deepEqual(fitStage(960, 540), { scale: 1, width: 960, height: 540, left: 0, top: 0, portrait: false });
});
test('every subject color keeps ink text at 4.5:1 or better and the seven colors differ', () => {
  for (const { id } of CHARACTERS) assert.ok(contrastRatio(INK, SUBJECT_THEME[id].color) >= 4.5, id);
  assert.equal(new Set(CHARACTERS.map(({ id }) => SUBJECT_THEME[id].color)).size, 7);
});
test('core text pairs meet their contrast targets', () => {
  assert.ok(contrastRatio(INK, PAPER) >= 7);
  assert.ok(contrastRatio(INK_SOFT, PAPER) >= 4.5);
  assert.ok(contrastRatio(PAPER, FINISH) >= 4.5);
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
});

import { ICON_NAMES, icon } from '../src/ui/icons.js';
test('every needed icon is a decorative 24×24 currentColor svg', () => {
  const needed = ['math','science','art','reading','writing','community','music','settings','pause','map','help','hear','back','next','check','play','stop','quiet','undo','turn','clock','crate','shade','fill','trash','download','people','star','home'];
  assert.deepEqual([...ICON_NAMES].sort(), [...needed].sort());
  for (const name of ICON_NAMES) assert.match(icon(name), /^<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M[^"]+"\/><\/svg>$/);
  assert.match(icon('play', { size: 32 }), /width="32" height="32"/);
  assert.throws(() => icon('sparkles'), /Unknown icon: sparkles/);
  for (const theme of Object.values(SUBJECT_THEME)) assert.ok(ICON_NAMES.includes(theme.icon));
});

import { readFileSync } from 'node:fs';
import { Doc } from './helpers/dom.js';
import { declarations, controlStyle, resolveVars } from './helpers/css.js';
import { createDialogue } from '../src/ui/dialogue.js';
import { createCommandMenu } from '../src/ui/menu.js';
import sign from '../src/ui/activities/sign.js';
const cssRead = name => readFileSync(new URL(`../src/ui/${name}.css`, import.meta.url), 'utf8');
const tokens = cssRead('tokens');
const controlCSS = [tokens, cssRead('kit'), cssRead('interaction'), cssRead('activities/sign')].join('\n');

const TYPOGRAPHY = {
  normal: { '--text-small': '16px', '--text-field': '20px', '--text-name': '20px', '--text-command': '22px', '--text-body': '24px', '--text-title': '40px' },
  large: { '--text-small': '20px', '--text-field': '24px', '--text-name': '24px', '--text-command': '26px', '--text-body': '30px', '--text-title': '40px' },
};
function assertTypography(css) {
  for (const [mode, selector] of [['normal', ':root'], ['large', '.large-text']]) {
    const actual = Object.fromEntries(Object.entries(declarations(css, selector)).filter(([key]) => key.startsWith('--text-')));
    assert.deepEqual(actual, TYPOGRAPHY[mode], `${mode} complete typography map`);
  }
}

test('normal and Bigger words typography tokens match the complete independent size contract', () => {
  assertTypography(tokens);
  assert.throws(() => assertTypography(tokens.replace('--text-body: 30px', '--text-body: 8px')), /large complete typography map/);
});

test('mounted dialogue, commands, speaker, field and small controls use both typography maps', t => {
  const previous = globalThis.document, observer = globalThis.MutationObserver, doc = new Doc(); globalThis.document = doc;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  t.after(() => { if (observer === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = observer; });
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const stage = doc.createElement('div'); stage.className = 'stage'; doc.body.append(stage);
  const dialogue = createDialogue(stage), menu = createCommandMenu(stage);
  menu.set([{ id: 'play', label: 'Play', icon: 'play' }, { id: 'finish', label: 'Put up sign', icon: 'check', finish: true, disabled: true }]);
  const field = sign.mountField(stage, { grade: 2, dispatch() {} });
  t.after(() => { field.destroy(); menu.destroy(); dialogue.destroy(); });
  for (const [mode, large] of [['normal', false], ['large', true]]) {
    stage.classList.toggle('large-text', large);
    for (const [selector, size] of [
      ['.dlg__text', 'body'], ['.cmd-slot__label', 'command'], ['.dlg__speaker', 'name'],
      ['.sign-input', 'field'], ['.dlg__tab', 'small'],
    ]) {
      const control = stage.querySelector(selector); assert.ok(control, selector);
      assert.equal(controlStyle(control, controlCSS)['font-size'], TYPOGRAPHY[mode][`--text-${size}`], `${mode} ${selector}`);
    }
    const long = stage.querySelectorAll('.cmd-slot')[1].querySelector('.cmd-slot__label');
    assert.equal(controlStyle(long, controlCSS)['font-size'], '22px', 'long command keeps the documented 26-to-22 adjustment');
  }
});

function assertControlContrast(css, control, background, hover = null, minimum = 4.5) {
  const style = controlStyle(control, css, { hover });
  const fill = resolveVars(background, style);
  const ratio = contrastRatio(style.color, fill);
  assert.ok(ratio >= minimum, `${control.className}: ${style.color} on ${fill} is ${ratio.toFixed(3)}:1, needs ${minimum}:1`);
}

for (const finish of [false, true]) for (const disabled of [false, true]) for (const hover of [false, true]) {
  test(`CSS button contrast: finish=${finish}, disabled=${disabled}, hover=${hover}`, () => {
    const doc = new Doc(), stage = doc.createElement('div'); stage.className = 'stage'; doc.body.append(stage);
    const button = doc.createElement('button'); button.className = `px-button${finish ? ' px-button--finish' : ''}`;
    button.disabled = disabled; stage.append(button);
    assert.match(declarations(controlCSS, '.px-button::before').background, /,\s*var\(--fill\)$/,
      'the tested fill is the actual background painted behind button text');
    assertControlContrast(controlCSS, button, 'var(--fill)', hover ? button : null);
  });
}
test('CSS core and subject contrast uses actual tokens and rejects paper-colored ink', () => {
  const doc = new Doc(), stage = doc.createElement('div'); stage.className = 'stage'; doc.body.append(stage);
  const frame = doc.createElement('div'); frame.className = 'px-frame'; stage.append(frame);
  assertControlContrast(controlCSS, frame, 'var(--fill)', null, 7);
  assert.throws(() => assertControlContrast(controlCSS.replace('--ink: #1f2147', '--ink: #fff8e6'), frame, 'var(--fill)', null, 7), /needs 7:1/);
  const chip = doc.createElement('span'); chip.className = 'px-chip'; stage.append(chip);
  for (const id of ['math', 'science', 'art', 'reading', 'writing', 'community', 'music']) assertControlContrast(controlCSS, chip, `var(--${id})`);
  const muted = { ...declarations(tokens, ':root') };
  assert.ok(contrastRatio(muted['--ink-soft'], muted['--paper']) >= 4.5, 'muted text uses the CSS tokens');
});
