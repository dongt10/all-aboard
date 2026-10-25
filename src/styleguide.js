import * as palette from './ui/palette.js';
import { CHARACTERS } from './data.js';

const { INK, PAPER, SUBJECT_THEME, contrastRatio } = palette;
const guide = document.querySelector('#guide');

export function addSection(title, html, note = '') {
  const node = document.createElement('section');
  node.className = 'guide-section';
  node.innerHTML = `<h2 class="px-title guide-heading">${title}</h2>${note ? `<p class="guide-note">${note}</p>` : ''}${html}`;
  guide.append(node);
  return node;
}

const swatch = (name, hex, against = INK, label = 'ink') => `<figure class="guide-swatch"><span style="background:${hex}"></span><figcaption><strong>${name}</strong> ${hex}<br>${label} ${contrastRatio(against, hex).toFixed(2)}:1</figcaption></figure>`;
const TOKENS = ['INK_SOFT', 'PAPER', 'PAPER_SHADE', 'SKY', 'SEA', 'GRASS', 'GRASS_DARK', 'PATH', 'WOOD', 'VERMILION', 'LANTERN', 'LETTERBOX'];
addSection('Palette',
  `<div class="guide-row">${swatch('ink', INK, PAPER, 'on paper')}${TOKENS.map(name => swatch(name.toLowerCase().replace('_', '-'), palette[name])).join('')}${swatch('finish', palette.FINISH, PAPER, 'paper text')}</div>
   <div class="guide-row">${CHARACTERS.map(({ id }) => swatch(SUBJECT_THEME[id].label, SUBJECT_THEME[id].color)).join('')}</div>`,
  'Contrast is against ink text unless noted. Vermilion is decoration only and never sits behind text.');

const typeColumn = (title, extra = '') => `<div class="guide-type ${extra}"><small>${title}</small>
  <p class="px-title">Willow Bay</p><p class="px-name">TARO · Grade 2</p>
  <p style="font-size:var(--text-body)">Make both sides of my cart weigh the same.</p>
  <p style="font-size:var(--text-command);font-weight:700">Load left</p>
  <p style="font-size:var(--text-field)">Lots of ice · 3 of 3 packed</p>
  <p style="font-size:var(--text-small)">A 1 l I · a g · smallest readable text</p></div>`;
addSection('Type', `<div class="guide-row">${typeColumn('Default')}${typeColumn('Bigger words', 'large-text')}</div>`,
  'Pixelify Sans for everything, so the words match the pixel art. Andika stays loaded as the fallback.');

const kit = `<div class="px-frame" style="max-width:420px">A pixel window. One short sentence at a time.</div>
  <button class="px-button" type="button">Load left</button>
  <button class="px-button" type="button" disabled>Undo</button>
  <button class="px-button px-button--finish" type="button">Send cart</button>
  <button class="px-icon-button" type="button">Map</button>
  <button class="px-toggle" type="button" aria-pressed="true">Bigger words <span class="px-toggle__state">On</span></button>
  <button class="px-toggle" type="button" aria-pressed="false">Calm motion <span class="px-toggle__state">Off</span></button>`;
const chips = CHARACTERS.map(({ id, name }) => `<span class="px-chip" style="--chip:${SUBJECT_THEME[id].color}">${name} · ${SUBJECT_THEME[id].label}</span>`).join('');
addSection('Windows, buttons, chips',
  `<div class="guide-specimen" style="background:var(--paper)">${kit}</div>
   <div class="guide-specimen guide-specimen--grass">${kit}</div>
   <div class="guide-specimen guide-specimen--ink">${kit}</div>
   <div class="guide-specimen guide-specimen--sky">${chips}</div>`,
  'Tab through these to check the focus ring: paper inside ink, on every background.');

import { ICON_NAMES, icon } from './ui/icons.js';
import { allFigures, figureMarkup } from './ui/figures/index.js';

const style = document.createElement('style');
style.textContent = `.guide-icon{margin:0;display:grid;justify-items:center;gap:4px;width:96px;font-size:13px}
.guide-sheet{max-width:100%;height:auto;image-rendering:pixelated;border:4px solid var(--ink);background:repeating-conic-gradient(#e9dfc8 0 25%,#f6efe0 0 50%) 0 0/32px 32px}
.guide-figure{margin:0;display:grid;gap:8px;max-width:100%;min-width:0}.guide-walk{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;min-height:128px}`;
document.head.append(style);

addSection('Icons', `<div class="guide-row">${ICON_NAMES.map(name => `<figure class="guide-icon">${icon(name)}${icon(name, { size: 48 })}<figcaption>${name}</figcaption></figure>`).join('')}</div>`,
  'pixelarticons 2.4.2 (MIT). Icons take the color of the text beside them.');

const castCard = figure => `<figure class="guide-figure"><img class="guide-sheet" src="${figure.sheet}" width="512" height="512" alt="${figure.id} sprite sheet">
  <figcaption><strong>${figure.id}</strong> · ${figure.species}</figcaption><div class="guide-walk" data-figure="${figure.id}"></div></figure>`;
addSection('Cast', `<div class="guide-row">${allFigures().map(castCard).join('')}</div>`,
  'Each sheet is 4×4 frames of 64×64: rows front, left, right, back; columns step A, stand, step B, joy. The loops below play the walk in every direction, then the joy face.');
const WALK = [1, 0, 2, 0];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let tick = 0;
const drawWalks = () => {
  document.querySelectorAll('.guide-walk').forEach(node => {
    const id = node.dataset.figure, step = reducedMotion.matches ? 0 : WALK[tick % WALK.length];
    node.innerHTML = ['front', 'left', 'right', 'back'].map(facing => figureMarkup(id, { facing, step, scale: 2 })).join('') + figureMarkup(id, { pose: 'joy', scale: 2 });
  });
  if (!reducedMotion.matches) tick++;
};
drawWalks();
reducedMotion.addEventListener('change', drawWalks);
setInterval(() => { if (!reducedMotion.matches) drawWalks(); }, 180);
