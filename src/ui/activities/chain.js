import {
  normalizeChain, chainReady, chainOpening, chainComplete, CHAIN_CARDS,
  CARD_WORDS, CARD_GLYPHS, ENERGY_TILES, chainFor, energyTiles,
  placeCard, placeEnergy, LINES, nextNeedLine, tenthWord, cardLine, energyLine,
} from '../../chain.js';
import { icon } from '../icons.js';
import { keyIntent, gridMove } from '../input.js';
import { INK, PAPER, PAPER_SHADE, SKY, SEA, GRASS, GRASS_DARK, WOOD, LANTERN } from '../palette.js';

export { LINES, nextNeedLine, tenthWord, cardLine, energyLine };
export const CARDS = CHAIN_CARDS.map(id => ({ id, ...CARD_WORDS[id], glyph: CARD_GLYPHS[id] }));
export const cardsFor = grade => chainFor(grade).cards.map(id => ({ id, ...CARD_WORDS[id], glyph: CARD_GLYPHS[id] }));
export const helpFor = grade => [
  'Tap a card: who gets the sun’s energy next?',
  `For this example, use ${tenthWord(grade)} each step.`,
  'Fill every plate, then choose Shine!',
  'Choose Pin chart.',
];
export const HELP = helpFor(3);
// Small field-card illustrations, independent of the cast's sprite sheets.
// The nested viewport keeps the existing 24px SVG contract while painting on the
// actual 16px rail / 36px plate grid, including a one-pixel exterior ink outline.
export const CARD_PIXELS = {
  plant: [
    '................', '.......h........', '......hbs.......', '......hbs.......',
    '..hb..hbs.......', '..hbs.hbs..hb...', '...hbsbbs..hbs..', '...hbbbbshhbs...',
    '....hbbbsbbs....', '..hb.hbbshbs....', '..hbsbbbbbs.....', '...hbbbbbs......',
    '.....hbbbs......', '....hbbbbss.....', '................', '................',
  ],
  fish: [
    '................', '................', '.......hh.......', '......hbb.......',
    '.....hbbbbbb....', '.hb..hbbbbhbb...', '.hbbhbbbbbpnbb..', '..hbbbbbbbbbbb..',
    '..hbbbbbbbbbs...', '.hbbhbbbbbbss...', '.bs..hbbsss.....', '......bss.......',
    '.......s........', '................', '................', '................',
  ],
  otter: [
    '................', '....hh...hb.....', '....hbbhhbb.....', '....hbbbbbb.....',
    '....hnbbbnb.....', '.....ppnppb.....', '.....pqqqbs.....', '....hbbbbbs.....',
    '...hbbpqqbss....', '...bbbpqqbbs....', '....bbqqrbs..bs.', '....hbqqrbs.bbs.',
    '....hbbbbbsbbs..', '....bss.bsssss..', '................', '................',
  ],
  gull: [
    '................', '................', '.........hh.....', '........hbnb....',
    '........hbbttt..', '...hh...hbbb....', '..hbbh.hbbbb....', '.hbbbbhbbbbbs...',
    '...hbsbbbbbs....', '....bbsssss.....', '.....bbsss......', '......t..t......',
    '.....tt.tt......', '................', '................', '................',
  ],
  pondweed: [
    '................', '.......hb.......', '..hhh..hbs......', '..hbbb.hbs......',
    '...hbbbbbs......', '....hbbbbs.hh...', '.......hbshbb...', '.......hbbbbb...',
    '..hhhh.hbbbs....', '..hbbbbhbs......', '...hbbbbbs......', '.....hbbbs.hh...',
    '.......hbshbbs..', '.......hbbbbs...', '.......hbss.....', '................',
  ],
  snail: [
    '................', '................', '....hhhh........', '...hbbbbh.......',
    '..hbbssbbh......', '..hbshhsbb......', '..hbshbsbb......', '..hbbsssbb......',
    '...hbbbbbs..n.n.', '....bssss...h.h.', '..hhhhhhhhhhhbh.', '.hbbbbbbbbbbbbh.',
    '..bsssssssssss..', '................', '................', '................',
  ],
  koi: [
    '................', '................', '.......hh.......', '......hpp.......',
    '.....hpppbbb....', '.hp..hppbbbpp...', '.hpphppbbbpnpp..', '..hppppbpppppp..',
    '..hppbbppppps...', '.hpphppppbbss...', '.ps..hppbss.....', '......bss.......',
    '.......s........', '................', '................', '................',
  ],
  frog: [
    '................', '...hhh...hhh....', '..hpnpb.hpnph...', '..hbbbhhbbbbh...',
    '...hbbbbbbbh....', '...hbbnbnbbh....', '....hbbbbbbs....', '..hhhbpppbhhh...',
    '.hbbbhpppbhbbh..', '.hbbbhpppbhbbh..', '..bbbhpppbbbbs..', '...bbhbbbbsbs...',
    '..hbbb...hbbb...', '.hbbbs...hbbbs..', '................', '................',
  ],
};
const CARD_TONES = {
  plant: { h: '#b1e895', b: GRASS, s: GRASS_DARK },
  fish: { h: SKY, b: SEA, s: '#26789e' },
  otter: { h: '#dda074', b: WOOD, s: '#895236' },
  gull: { h: '#ffffff', b: PAPER, s: PAPER_SHADE },
  pondweed: { h: '#b1e895', b: GRASS, s: GRASS_DARK },
  snail: { h: '#dda074', b: WOOD, s: '#895236' },
  koi: { h: '#ffffff', b: '#e96163', s: '#b53b42' },
  frog: { h: '#b1e895', b: GRASS, s: GRASS_DARK },
};
const glyphCache = new Map();
function glyph(id, size = 24) {
  const key = `${id}/${size}`;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const pixels = size === 36 ? 36 : 16;
  const colors = { n: INK, p: PAPER, q: PAPER_SHADE, r: '#d6c39d', t: LANTERN, ...CARD_TONES[id] };
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x >= pixels || y >= pixels) return null;
    const mark = CARD_PIXELS[id][Math.floor(y * 16 / pixels)]?.[Math.floor(x * 16 / pixels)];
    return colors[mark] ?? null;
  };
  const paths = {};
  for (let y = 0; y < pixels; y++) {
    let start = 0, previous = null;
    for (let x = 0; x <= pixels; x++) {
      const fill = x === pixels ? null : sample(x, y) ??
        ([sample(x - 1, y), sample(x + 1, y), sample(x, y - 1), sample(x, y + 1)].some(Boolean) ? INK : null);
      if (fill === previous) continue;
      if (previous) paths[previous] = (paths[previous] ?? '') + `M${start} ${y}h${x - start}v1H${start}z`;
      start = x; previous = fill;
    }
  }
  const art = `<svg class="chain-glyph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><svg viewBox="0 0 ${pixels} ${pixels}" width="24" height="24">${Object.entries(paths).map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('')}</svg></svg>`;
  glyphCache.set(key, art);
  return art;
}
const ARROW_ART = `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><svg viewBox="0 0 20 20" width="24" height="24">
  <path d="M10 3h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2h-2v-4H2V7h8z" fill="${INK}"/>
  <path d="M11 4h1v2h2v2h2v2h1v1h-2v2h-2v2h-2v1h-1v-4H3V8h8z" fill="${SEA}"/>
  <path d="M3 8h8V4h1v5H3z" fill="${SKY}"/>
  <path d="M3 11h8v3h1v-2h2v-2h2v1h-1v2h-2v2h-2v1h-1v-4H3z" fill="#26789e"/>
</svg></svg>`;
const SUN_ART = `<svg viewBox="0 0 40 40" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true">
  <path d="M17 0h6v6h-6zM17 34h6v6h-6zM0 17h6v6H0zM34 17h6v6h-6zM4 4h6v6H4zM30 4h6v6h-6zM4 30h6v6H4zM30 30h6v6h-6z" fill="${INK}"/>
  <path d="M18 1h4v4h-4zM18 35h4v4h-4zM1 18h4v4H1zM35 18h4v4h-4zM5 5h4v4H5zM31 5h4v4h-4zM5 31h4v4H5zM31 31h4v4h-4z" fill="${LANTERN}"/>
  <path d="M18 1h4v1h-4zM1 18h4v1H1zM5 5h4v1H5zM31 5h4v1h-4z" fill="#ffe6a0"/>
  <path d="M18 38h4v1h-4zM35 21h4v1h-4zM5 34h4v1H5zM31 34h4v1h-4z" fill="#d9a532"/>
</svg>`;
const fieldWord = id => ({ plant: 'Plant', fish: 'Fish' }[id] ?? CARD_WORDS[id]?.word ?? '?');

function act(state, ui, action) {
  if (action?.type === 'field') {
    if ('card' in action) {
      const result = placeCard(state, action.card);
      return { state: result.state, ui, line: cardLine(action.card, state) };
    }
    if ('energy' in action) {
      const result = placeEnergy(state, action.energy);
      return { state: result.state, ui, line: energyLine(result) };
    }
  }
  if (action?.type === 'command') {
    if (action.id === 'needs') return { state, ui, line: nextNeedLine(state) };
    if (action.id === 'shine') {
      if (!chainComplete(state)) return { state, ui, line: nextNeedLine(state) };
      return {
        state: state.shone ? state : { ...state, shone: true },
        ui: { shine: ui.shine + 1 },
        line: state.shone ? LINES.ready : LINES.shine(tenthWord(state.grade)),
      };
    }
    if (action.id === 'reset' && state.chain[0] !== null) {
      return { state: normalizeChain(null, state.grade, state.chapter), ui, line: LINES.reset };
    }
  }
  return { state, ui };
}

function mountField(host, { grade = 3, dispatch = () => {} } = {}) {
  const contentCards = cardsFor(grade);
  const node = (tag, cls, parent) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (parent) parent.append(el);
    return el;
  };
  const root = node('div', 'chain-field', host);
  const row = node('div', 'chain-row', root);
  // All cards, glyphs and blocks are built once. Updates change text and visibility only.
  const plates = Array.from({ length: 4 }, (_, i) => {
    if (i > 1) {
      const arrow = node('span', 'chain-arrow', row);
      arrow.innerHTML = ARROW_ART;
      node('span', 'chain-step', arrow).textContent = '÷10';
      arrow.setAttribute('role', 'img');
      arrow.setAttribute('aria-label', 'Divide by 10.');
    } else if (i === 1) {
      const arrow = node('span', 'chain-source-gap', row);
      // Keep the arrow inside the existing 16px gap; sunlight is labeled on the Sun card.
      arrow.innerHTML = ARROW_ART.replace('width="20" height="20"', 'width="16" height="16"');
      arrow.setAttribute('role', 'img');
      arrow.setAttribute('aria-label', 'Sunlight to plant.');
    }
    const plate = node('div', i ? 'chain-plate chain-plate--empty' : 'chain-sun-card', row);
    plate.setAttribute('role', 'group');
    if (i) plate.dataset.plate = String(i - 1);
    const picture = node('div', 'chain-picture', plate);
    const pictures = {};
    let empty;
    if (!i) {
      const sun = node('span', 'chain-sun', picture);
      sun.innerHTML = SUN_ART;
      node('i', 'chain-sun-core', sun);
      sun.setAttribute('aria-hidden', 'true');
    } else {
      empty = node('span', 'chain-empty', picture);
      empty.textContent = '?';
      for (const card of contentCards) {
        const art = node('span', 'chain-creature', picture);
        art.innerHTML = glyph(card.id, 36);
        art.hidden = true;
        pictures[card.id] = art;
      }
    }
    const word = node('span', 'chain-word', plate);
    if (!i) {
      node('span', 'chain-source', plate).textContent = 'sunlight';
      return { plate, word };
    }
    const energy = node('span', 'chain-energy px-chip', plate);
    const bar = node('span', 'chain-bar', plate);
    bar.setAttribute('aria-hidden', 'true');
    const blocks = Array.from({ length: 4 }, () => node('i', 'chain-block', bar));
    return { plate, pictures, empty, word, energy, blocks };
  });
  const cardsRail = node('div', 'chain-cards', root);
  cardsRail.setAttribute('role', 'group');
  cardsRail.setAttribute('aria-label', 'Who eats what');
  const cards = contentCards.map(card => {
    const b = node('button', 'chain-card', cardsRail);
    b.type = 'button';
    b.dataset.card = card.id;
    const pic = node('span', 'chain-card-pic', b);
    pic.innerHTML = glyph(card.id);
    const label = node('span', 'chain-card-word', b);
    label.textContent = fieldWord(card.id);
    label.classList.toggle('chain-word--long', label.textContent.length > 7);
    const check = node('span', 'chain-card-check', b);
    check.innerHTML = icon('check', { size: 12 });
    check.hidden = true;
    return b;
  });
  const tilesRail = node('div', 'chain-tiles', root);
  tilesRail.setAttribute('role', 'group');
  tilesRail.setAttribute('aria-label', 'How much energy moves up');
  const tiles = energyTiles(grade).map(value => {
    const b = node('button', 'chain-tile', tilesRail);
    b.type = 'button';
    b.dataset.energy = String(value);
    b.textContent = String(value);
    b.setAttribute('aria-label', `${value} energy`);
    return b;
  });
  let cardCursor = cards[0], tileCursor = tiles[0], shine = null;
  const mark = () => {
    cards.forEach(b => { b.tabIndex = b === cardCursor && !b.disabled ? 0 : -1; });
    tiles.forEach(b => { b.tabIndex = b === tileCursor ? 0 : -1; });
  };
  mark();
  const onClick = event => {
    const card = event.target.closest?.('.chain-card');
    if (card && !card.disabled) {
      cardCursor = card;
      mark();
      dispatch({ type: 'field', card: card.dataset.card });
    }
    const tile = event.target.closest?.('.chain-tile');
    if (tile) {
      tileCursor = tile;
      mark();
      dispatch({ type: 'field', energy: Number(tile.dataset.energy) });
    }
  };
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['left', 'right'].includes(intent)) return;
    const card = event.target.closest?.('.chain-card');
    const tile = event.target.closest?.('.chain-tile');
    if (!card && !tile) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = card ? cards.filter(b => !b.disabled) : tiles;
    const next = buttons[gridMove(buttons.indexOf(card || tile), intent, buttons.length, buttons.length)];
    if (!next) return;
    if (card) cardCursor = next; else tileCursor = next;
    mark();
    next.focus();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  return {
    update(state, ui) {
      const focusedCard = cards.includes(document.activeElement) ? document.activeElement : null;
      cards.forEach((b, i) => {
        const used = state.chain.includes(contentCards[i].id);
        b.disabled = used;
        b.classList.toggle('chain-card--placed', used);
        b.setAttribute('aria-label', `${contentCards[i].word}${used ? ', placed' : ''}`);
        b.querySelector('.chain-card-check').hidden = !used;
      });
      if (cardCursor.disabled) cardCursor = cards.find(b => !b.disabled);
      mark();
      if (focusedCard?.disabled) cardCursor?.focus();
      plates.forEach((parts, i) => {
        const card = i ? state.chain[i - 1] : null;
        parts.word.textContent = i ? fieldWord(card) : 'Sun';
        parts.word.classList.toggle('chain-word--long', parts.word.textContent.length > 7);
        parts.plate.setAttribute('aria-label', i ? (CARD_WORDS[card]?.word ?? 'Empty plate') : 'Sun. Sunlight.');
        if (!i) return;
        const value = state.energy[i - 1];
        parts.energy.textContent = ENERGY_TILES.includes(value) ? String(value) : '—';
        if (i) {
          parts.plate.classList.toggle('chain-plate--empty', !card);
          parts.empty.hidden = Boolean(card);
          for (const [id, art] of Object.entries(parts.pictures)) art.hidden = card !== id;
        }
        const count = ENERGY_TILES.includes(value) && card ? String(value).length : 0;
        parts.blocks.forEach((block, j) => {
          block.hidden = j >= count;
          block.classList.toggle('chain-block--lit', state.shone);
        });
      });
      if (shine !== null && ui.shine !== shine && state.shone) {
        root.classList.remove('chain-field--shine');
        void root.offsetWidth;
        root.classList.add('chain-field--shine');
      }
      if (!state.shone) root.classList.remove('chain-field--shine');
      shine = ui.shine;
    },
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

export default {
  kind: 'science',
  title: 'Momo’s sunbeam chart', rewardLabel: 'Sunbeam chart',
  help: HELP, helpFor,
  notReadyLine: LINES.notReady,
  start(snapshot, { grade = 3, chapter = 1 } = {}) {
    return { state: normalizeChain(snapshot, grade, chapter), ui: { shine: 0 } };
  },
  opening: chainOpening,
  commands(state) {
    return [
      { id: 'shine', label: 'Shine!', icon: 'star' },
      { id: 'needs', label: 'Next step', icon: 'help' },
      { id: 'reset', label: 'Start over', icon: 'undo', disabled: state.chain[0] === null },
      { id: 'finish', label: 'Pin chart', icon: 'check', finish: true, disabled: !chainReady(state) },
    ];
  },
  act,
  mountField,
};
