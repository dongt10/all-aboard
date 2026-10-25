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

function stampShape(shape) {
  if (shape === 'circle') return '<circle r="6"/>';
  if (shape === 'star') return '<path d="m0-8 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z"/>';
  if (shape === 'leaf') return `<g transform="scale(.4) translate(-20 -20)"><path d="M5 35C-1 10 17 0 35 5c5 19-6 36-30 30Z"/><path d="m8 32 20-20" stroke="${INK}" fill="none" stroke-width="2"/></g>`;
  if (shape === 'heart') return '<path d="M0 6-7 0v-5l4-2 3 3 3-3 4 2v5z"/>';
  if (shape === 'flower') return '<g transform="scale(.4) translate(-20 -20)"><path d="M20 12C7-5-4 18 12 20-5 33 18 44 20 28c13 17 24-6 8-8C45 7 22-4 20 12Z"/><circle cx="20" cy="20" r="5" fill="#fff1cf"/></g>';
  return '<path d="m0-7 7 7-7 7-7-7z"/>';
}

export function creationMarkup(id, s = {}) {
  s = s && typeof s === 'object' ? s : {};
  if (id === 'math' && s.activity === 'pizza') return pizzaCreationMarkup(s);
  if (id === 'science' && (s.activity === 'chain' || Array.isArray(s.chain))) return chainCreationMarkup(s);
  if (id === 'community' && s.activity === 'helpday') return helpdayCreationMarkup(s);
  if (id === 'reading' && s.activity === 'tales' && solvedCount(s) > 0) return talesCreationMarkup(s);
  if (id === 'art') {
    const stamps = Array.isArray(s.stamps) ? s.stamps : [];
    return `<svg class="creation creation--art" viewBox="0 0 100 65" aria-label="Your painted festival banner"><path d="M1 1h98v57L88 64 76 58 64 64 52 58 40 64 28 58 16 64 1 58z" fill="${color(s.background, PAPER_SHADE)}" stroke="${INK}" stroke-width="2"/>${stamps.slice(0, 60).map(t => {
      const x = Math.max(5, Math.min(95, Number(t?.x) || 0)), y = Math.max(5, Math.min(52, (Number(t?.y) || 0) * 0.55));
      return `<g transform="translate(${x} ${y}) rotate(${Number(t?.rotation) || 0})" fill="${color(t?.color, LANTERN)}" stroke="${INK}" stroke-width=".8">${stampShape(t?.shape)}</g>`;
    }).join('')}</svg>`;
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
    return `<svg class="creation creation--math" viewBox="0 0 90 45" aria-label="Your festival cart"><path d="M10 14h63v20H10m60-21 10-8h8" fill="none" stroke="${INK}" stroke-width="5"/><path d="M14 16h55v15H14" fill="${SUBJECT_THEME.math.color}"/><circle cx="23" cy="37" r="6" fill="${INK}"/><circle cx="62" cy="37" r="6" fill="${INK}"/><circle cx="23" cy="37" r="2" fill="${PAPER}"/><circle cx="62" cy="37" r="2" fill="${PAPER}"/>${Array.from({ length: count }, (_, i) => `<path d="M${17 + i * 7} 7h5v9h-5z" fill="${i % 2 ? LANTERN : WOOD}" stroke="${INK}" stroke-width="1"/>`).join('')}</svg>`;
  }
  if (id === 'science') {
    const shade = side => s.canopy === side ? ` style="border-top:5px solid ${FINISH}"` : '';
    return `<span class="creation creation--science world-ices" aria-label="Your ice experiment, shade on ${esc(s.canopy || 'none')}"><i${shade('left')}></i><i${shade('right')}></i></span>`;
  }
  if (id === 'reading') return `<span class="creation creation--reading world-book">${esc(s.title || (s.found?.length ? `${s.found.length} things packed` : 'Festival story'))}</span>`;
  // Hana's square as a little map: grass, the path across the middle, the quiet corner top left, and each
  // bench, sign and garden where it was put (x and y run 10–90 on the 100×100 square, as in the activity).
  const at = v => Math.max(10, Math.min(90, Math.round(Number(v)) || 50));
  const items = (Array.isArray(s.placements) ? s.placements : []).slice(0, 12).filter(p => MAP_ITEMS[p?.item]).map(p =>
    `<rect class="map-item map-item--${p.item}" x="${at(p.x) - 8}" y="${at(p.y) - 8}" width="16" height="16" fill="${MAP_ITEMS[p.item]}" stroke="${INK}" stroke-width="2"/>`).join('');
  return `<svg class="creation creation--community" viewBox="0 0 100 100" aria-label="Your welcoming village plan"><rect width="100" height="100" fill="${GRASS}"/><rect width="40" height="40" fill="${GRASS_DARK}"/><rect y="40" width="100" height="20" fill="${PATH}"/><rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="${INK}" stroke-width="3"/>${items}</svg>`;
}
