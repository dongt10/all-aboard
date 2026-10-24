// A saved creation drawn small for its stall, the parade, and the item-get card.
// Every saved value is either validated (colors, numbers, shapes) or escaped (text) before it is written.
import { INK, PAPER, PAPER_SHADE, WOOD, LANTERN, FINISH, SUBJECT_THEME } from './palette.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (v, fallback) => /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;

function stampShape(shape) {
  if (shape === 'circle') return '<circle r="6"/>';
  if (shape === 'star') return '<path d="m0-8 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z"/>';
  if (shape === 'leaf') return `<g transform="scale(.4) translate(-20 -20)"><path d="M5 35C-1 10 17 0 35 5c5 19-6 36-30 30Z"/><path d="m8 32 20-20" stroke="${INK}" fill="none" stroke-width="2"/></g>`;
  if (shape === 'heart') return '<path d="M0 6-7 0v-5l4-2 3 3 3-3 4 2v5z"/>';
  if (shape === 'flower') return '<path d="M-3-7h6v4h4v6H3v4h-6V3h-4v-6h4z"/>';
  return '<path d="m0-7 7 7-7 7-7-7z"/>';
}

export function creationMarkup(id, s = {}) {
  s = s && typeof s === 'object' ? s : {};
  if (id === 'art') {
    const stamps = Array.isArray(s.stamps) ? s.stamps : [];
    return `<svg class="creation creation--art" viewBox="0 0 100 65" aria-label="Your painted festival banner"><path d="M1 1h98v57L88 64 76 58 64 64 52 58 40 64 28 58 16 64 1 58z" fill="${color(s.background, PAPER_SHADE)}" stroke="${INK}" stroke-width="2"/>${stamps.slice(0, 60).map(t => {
      const x = Math.max(5, Math.min(95, Number(t?.x) || 0)), y = Math.max(5, Math.min(52, (Number(t?.y) || 0) * 0.55));
      return `<g transform="translate(${x} ${y}) rotate(${Number(t?.rotation) || 0})" fill="${color(t?.color, LANTERN)}" stroke="${INK}" stroke-width=".8">${stampShape(t?.shape)}</g>`;
    }).join('')}</svg>`;
  }
  if (id === 'music') {
    const tracks = Array.isArray(s.tracks) ? s.tracks : [];
    const notes = Array.from({ length: 8 }, (_, i) => tracks.some(t => t?.enabled && (t.notes?.[i] != null || (Array.isArray(t.pattern) && t.pattern[i]))));
    return `<span class="creation creation--music world-score" aria-label="Your eight beat song on display">${notes.map(n => `<i class="${n ? 'world-note-on' : ''}"></i>`).join('')}</span>`;
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
  const placements = Array.isArray(s.placements) ? s.placements : [{ item: 'sign' }, { item: 'bench' }, { item: 'quiet' }];
  return `<span class="creation creation--community world-mini-map" aria-label="Your welcoming village plan">${placements.map(p => `<i>${p?.item === 'bench' ? '▰' : p?.item === 'quiet' ? '❋' : '↗'}</i>`).join('')}</span>`;
}
