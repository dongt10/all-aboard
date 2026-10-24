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
  'Andika for everything a child reads (single-story a and g). Pixelify Sans only for names, titles, and numbers.');

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
