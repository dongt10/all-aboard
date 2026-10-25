import { pizzaCreationMarkup } from '../pizza.js';
import { chainCreationMarkup } from '../chain.js';
import { helpdayCreationMarkup } from '../helpday.js';
import { talesCreationMarkup, solvedCount } from '../tales.js';
import { CHARACTERS } from '../data.js';
import pizza from './activities/pizza.js';
import chain from './activities/chain.js';
import tales from './activities/tales.js';
import helpday from './activities/helpday.js';
// A saved creation drawn small for its stall, the parade, and the item-get card.
// Every saved value is either validated (colors, numbers, shapes) or escaped (text) before it is written.
import { INK, PAPER, PAPER_SHADE, WOOD, LANTERN, FINISH, SKY, GRASS, GRASS_DARK, PATH, SUBJECT_THEME } from './palette.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (v, fallback) => /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
const MAP_ITEMS = { bench: LANTERN, sign: SKY, quiet: GRASS };   // the same tile colors as Hana's square
const ACTIVITIES = { pizza, chain, tales, helpday };

export function creationLabel(id, creation) {
  const activity = ACTIVITIES[creation?.activity];
  return activity?.kind === id ? activity.rewardLabel : CHARACTERS.find(c => c.id === id)?.reward.label ?? '';
}

// Measure the whole sign before shrinking it into a fixed thumbnail. ResizeObserver also handles
// Bigger words and font loading; transforms never change the observed layout size.
export function fitSignPreviews(host, width, height) {
  const signs = [...host.querySelectorAll('.world-sign')];
  let active = true;
  const fit = () => {
    if (!active) return;
    for (const sign of signs) {
      if (sign.offsetWidth && sign.offsetHeight) {
        sign.style.setProperty('--sign-scale', String(Math.min(1, width / sign.offsetWidth, height / sign.offsetHeight)));
      }
    }
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  for (const sign of signs) observer?.observe(sign);
  fit();
  host.ownerDocument.fonts?.ready?.then(fit);
  return () => { active = false; observer?.disconnect(); };
}

const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
// Hand-picked steps for the saved cloth/paint colors. Older custom colors still keep their base color.
const PAINT_STEPS = {
  '#e96163': ['#ffaaa3', '#b83f48'], '#f4bf4f': ['#ffe08f', '#c08b30'],
  '#6dbea0': ['#a5e1c4', '#43876c'], '#559fc7': ['#9fdcff', '#367394'],
  '#9d7fbd': ['#d0b8ec', '#70568f'], '#fff1cf': [PAPER, '#d5bc89'],
  [PAPER_SHADE]: [PAPER, '#d5bc89'], [LANTERN]: ['#ffe8a3', '#ca9231'],
};
const paintSteps = fill => PAINT_STEPS[fill.toLowerCase()] ?? [PAPER, '#4a4e7a'];

// One row per pixel. Rotation is sampled back onto this grid so a 45-degree saved stamp never
// introduces diagonal strokes or fractional coordinates. The border is one filled pixel, not a stroke.
const STAMPS = {
  circle: ['....#####....', '..#########..', '.###########.', '.###########.', '#############', '#############', '#############', '#############', '#############', '.###########.', '.###########.', '..#########..', '....#####....'],
  star: ['......#......', '.....###.....', '.....###.....', '....#####....', '#############', '.###########.', '..#########..', '...#######...', '...#######...', '..#########..', '..####.####..', '.###.....###.', '.##.......##.'],
  leaf: ['......######.', '....########.', '...#########.', '..##########.', '.###########.', '.###########.', '.##########..', '.##########..', '.#########...', '.########....', '.#######.....', '.#####.......', '###..........'],
  heart: ['..###...###..', '.#####.#####.', '#############', '#############', '#############', '#############', '.###########.', '..#########..', '...#######...', '....#####....', '.....###.....', '......#......', '.............'],
  flower: ['.....###.....', '....#####....', '....#####....', '.##.#####.##.', '#############', '#############', '#############', '#############', '#############', '.##.#####.##.', '....#####....', '....#####....', '.....###.....'],
  diamond: ['......#......', '.....###.....', '....#####....', '...#######...', '..#########..', '.###########.', '#############', '.###########.', '..#########..', '...#######...', '....#####....', '.....###.....', '......#......'],
};
function stampShape(shape, fill, rotation) {
  const rows = STAMPS[shape] ?? STAMPS.diamond, [light, shade] = paintSteps(fill);
  const angle = (Number.isFinite(rotation) ? rotation % 360 : 0) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const inside = (x, y) => rows[Math.round(-x * sin + y * cos) + 6]?.[Math.round(x * cos + y * sin) + 6] === '#';
  const toneAt = (x, y) => {
    if (!inside(x, y)) return null;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const tone = edge ? INK : !inside(x - 2, y) || !inside(x, y - 2) ? light
      : !inside(x + 2, y) || !inside(x, y + 2) ? shade : fill;
    return shape === 'flower' && Math.abs(x) <= 1 && Math.abs(y) <= 1 ? LANTERN : tone;
  };
  const pixels = [];
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9;) {
    const tone = toneAt(x, y), start = x++;
    while (x <= 9 && toneAt(x, y) === tone) x++;
    if (tone) pixels.push(rect(start, y, x - start, 1, tone));
  }
  return pixels.join('');
}

export function creationMarkup(id, s = {}) {
  s = s && typeof s === 'object' ? s : {};
  if (id === 'math' && s.activity === 'pizza') return pizzaCreationMarkup(s);
  if (id === 'science' && (s.activity === 'chain' || Array.isArray(s.chain))) return chainCreationMarkup(s);
  if (id === 'community' && s.activity === 'helpday') return helpdayCreationMarkup(s);
  if (id === 'reading' && s.activity === 'tales' && solvedCount(s) > 0) return talesCreationMarkup(s);
  if (id === 'art') {
    // Yuki's starting row belongs to the grade, never to the saved stamps.
    const pattern = s.grade === 1 ? [{ shape: 'star', color: '#e96163' }, { shape: 'circle', color: '#e96163' }]
      : s.grade === 2 ? [{ shape: 'flower', color: '#e96163' }, { shape: 'flower', color: '#559fc7' }] : null;
    const yuki = pattern ? [0, 1, 2].map(cell => ({ ...pattern[cell % 2], x: 8.33 + cell * 16.66, y: 10, rotation: 0 })) : [];
    const stamps = [...yuki, ...(Array.isArray(s.stamps) ? s.stamps : [])];
    const fold = s.grade >= 3 ? `<g class="creation-banner-fold">${Array.from({ length: 9 }, (_, i) => rect(49, 3 + i * 6, 2, 3, INK)).join('')}</g>` : '';
    const fill = color(s.background, PAPER_SHADE), [light, shade] = paintSteps(fill);
    // A stepped, sewn hem: each 12px pennant ends at the same height as the original cloth.
    const hem = Array.from({ length: 100 }, (_, x) => 58 + Math.floor((6 - Math.abs(((x - 10 + 108) % 12) - 6)) / 2) * 2);
    const cloth = rect(0, 0, 100, 58, INK) + rect(1, 1, 98, 56, fill)
      + rect(1, 1, 98, 2, light) + rect(1, 3, 2, 54, light) + rect(96, 3, 3, 54, shade)
      + [24, 48, 72].map(x => rect(x, 4, 1, 51, shade) + rect(x + 1, 4, 1, 51, light)).join('')
      + hem.map((bottom, x) => rect(x, 56, 1, bottom - 55, INK)
        + (x > 0 && x < 99 ? rect(x, 56, 1, Math.max(1, Math.min(bottom, hem[x - 1], hem[x + 1]) - 56), shade) : '')).join('')
      + Array.from({ length: 16 }, (_, i) => rect(3 + i * 6, 54, 3, 1, light)).join('');
    return `<svg class="creation creation--art" viewBox="0 0 100 65" shape-rendering="crispEdges" aria-label="Your painted festival banner">${cloth}${fold}${stamps.slice(0, 60).map(t => {
      const x = Math.round(Math.max(5, Math.min(95, Number(t?.x) || 0))), y = Math.round(Math.max(5, Math.min(52, (Number(t?.y) || 0) * 0.55)));
      return `<g transform="translate(${x} ${y})">${stampShape(t?.shape, color(t?.color, LANTERN), Number(t?.rotation) || 0)}</g>`;
    }).join('')}${rect(0, 0, 100, 1, INK)}${rect(0, 1, 1, 57, INK)}${rect(99, 1, 1, 57, INK)}</svg>`;
  }
  if (id === 'music') {
    // Eight bars: a melody note stands at a height by pitch (Do low, La high), so the lantern staircase
    // carries to the stall and the parade; a beat with only other friends playing is a short bar.
    const tracks = Array.isArray(s.tracks) ? s.tracks : [];
    const melody = tracks.find(t => t?.enabled && t.id === 'melody');
    const pitch = i => (Number.isInteger(melody?.notes?.[i]) && melody.notes[i] >= 0 && melody.notes[i] <= 4 ? melody.notes[i] : null);
    const on = i => tracks.some(t => t?.enabled && (t.notes?.[i] != null || (Array.isArray(t.pattern) && t.pattern[i])));
    const bars = Array.from({ length: 8 }, (_, i) => {
      const p = pitch(i);
      if (p !== null) return `<i class="world-note-on" data-pitch="${p}" style="height:${8 + p * 3}px"></i>`;
      return on(i) ? '<i class="world-note-on" style="height:6px"></i>' : '<i></i>';
    });
    return `<span class="creation creation--music world-score" aria-label="Your eight beat song on display">${bars.join('')}</span>`;
  }
  if (id === 'writing') return `<span class="creation creation--writing world-sign">${esc(s.text || s.sentence || s.message || 'Hello, friend!')}</span>`;
  if (id === 'math') {
    const count = Math.min(7, ((Array.isArray(s.left) ? s.left.length : 0) + (Array.isArray(s.right) ? s.right.length : 0)) || 4);
    const loads = Array.from({ length: count }, (_, i) => {
      const x = 17 + i * 7;
      return rect(x, 7, 5, 10, INK) + rect(x + 1, 8, 3, 8, i % 2 ? LANTERN : WOOD)
        + rect(x + 1, 8, 2, 2, i % 2 ? '#ffe8a3' : '#dda475') + rect(x + 3, 10, 1, 6, i % 2 ? '#ca9231' : '#855034');
    }).join('');
    const wheels = [23, 62].map(x => `<g transform="translate(${x - 6} 31)">
      <path d="M3 0h6v1h2v2h1v6h-1v2H9v1H3v-1H1V9H0V3h1V1h2Z" fill="${INK}"/>
      <path d="M3 1h6v1h1v1h1v6h-1v1H3V9H2V3h1Z" fill="#4a4e7a"/>
      ${rect(3, 2, 5, 1, PAPER_SHADE)}${rect(2, 3, 1, 4, PAPER_SHADE)}${rect(4, 4, 4, 4, INK)}${rect(5, 5, 2, 2, LANTERN)}
    </g>`).join('');
    return `<svg class="creation creation--math" viewBox="0 0 90 45" shape-rendering="crispEdges" aria-label="Your festival cart">
      <path d="M68 14h3v-3h4V8h4V4h10v4h-9v3h-4v3h-4v4h-4Z" fill="${INK}"/>
      <path d="M70 14h2v-2h4V9h4V5h8v1h-9v4h-4v3h-4v4h-1Z" fill="${WOOD}"/>${rect(81, 5, 7, 1, '#dda475')}
      ${loads}${rect(10, 14, 63, 20, INK)}${rect(11, 15, 61, 18, SUBJECT_THEME.math.color)}
      ${rect(11, 15, 61, 3, '#ffc27b')}${rect(11, 18, 2, 12, '#ffc27b')}${rect(69, 18, 3, 15, '#c96d2c')}${rect(11, 29, 61, 4, '#c96d2c')}
      ${rect(12, 24, 58, 1, '#c96d2c')}${rect(16, 21, 14, 1, '#c96d2c')}${rect(40, 27, 18, 1, '#ffc27b')}
      ${[15, 67].map(x => rect(x, 19, 1, 1, INK) + rect(x, 27, 1, 1, INK)).join('')}
      ${rect(12, 33, 59, 2, INK)}${wheels}</svg>`;
  }
  if (id === 'science') {
    const shade = side => s.canopy === side ? ` style="border-top:5px solid ${FINISH}"` : '';
    return `<span class="creation creation--science world-ices" aria-label="Your ice experiment, shade on ${esc(s.canopy || 'none')}"><i${shade('left')}></i><i${shade('right')}></i></span>`;
  }
  if (id === 'reading') return `<span class="creation creation--reading world-book">${esc(s.title || (s.found?.length ? `${s.found.length} things packed` : 'Festival story'))}</span>`;
  // Hana's square as a little map: grass, the path across the middle, the quiet corner top left, and each
  // bench, sign and garden where it was put (x and y run 10–90 on the 100×100 square, as in the activity).
  const at = v => Math.max(10, Math.min(90, Math.round(Number(v)) || 50));
  const items = (Array.isArray(s.placements) ? s.placements : []).slice(0, 12).filter(p => MAP_ITEMS[p?.item]).map(p => {
    const x = at(p.x) - 8, y = at(p.y) - 8;
    const tile = `<rect class="map-item map-item--${p.item}" x="${x}" y="${y}" width="16" height="16" fill="${INK}"/>`
      + rect(x + 1, y + 1, 14, 14, MAP_ITEMS[p.item]) + rect(x + 1, y + 1, 14, 2, p.item === 'quiet' ? '#b4e397' : PAPER)
      + rect(x + 13, y + 3, 2, 12, p.item === 'quiet' ? GRASS_DARK : p.item === 'sign' ? '#367394' : '#ca9231')
      + rect(x + 1, y + 13, 12, 2, p.item === 'quiet' ? GRASS_DARK : p.item === 'sign' ? '#367394' : '#ca9231');
    const detail = p.item === 'bench'
      ? rect(x + 3, y + 6, 10, 2, WOOD) + rect(x + 3, y + 10, 10, 1, INK) + rect(x + 4, y + 11, 1, 2, INK) + rect(x + 11, y + 11, 1, 2, INK)
      : p.item === 'sign' ? rect(x + 7, y + 7, 2, 6, INK) + rect(x + 3, y + 4, 10, 5, INK) + rect(x + 4, y + 5, 8, 3, PAPER)
        : rect(x + 7, y + 5, 2, 8, FINISH) + rect(x + 4, y + 7, 3, 3, FINISH) + rect(x + 9, y + 4, 3, 3, FINISH);
    return tile + detail;
  }).join('');
  return `<svg class="creation creation--community" viewBox="0 0 100 100" shape-rendering="crispEdges" aria-label="Your welcoming village plan">
    ${rect(0, 0, 100, 100, INK)}${rect(1, 1, 98, 98, GRASS)}${rect(1, 1, 39, 39, GRASS_DARK)}
    ${rect(1, 1, 39, 2, '#79c96a')}${rect(40, 1, 59, 2, '#b4e397')}${rect(1, 3, 2, 36, '#79c96a')}
    ${rect(1, 39, 98, 22, INK)}${rect(1, 40, 98, 20, PATH)}${rect(1, 40, 98, 3, PAPER_SHADE)}${rect(1, 57, 98, 3, '#d5b47c')}
    ${[8, 28, 48, 68, 88].map(x => rect(x, 49, 8, 2, '#d5b47c') + rect(x + 2, 47, 4, 2, PAPER_SHADE)).join('')}
    ${rect(96, 61, 3, 38, GRASS_DARK)}${rect(1, 96, 95, 3, GRASS_DARK)}${items}</svg>`;
}
