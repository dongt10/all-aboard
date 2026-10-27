// Paints the seven village stalls as 1× pixel sprites (128×80) into assets/village/stalls/<id>.png.
// Run: node scripts/draw-stalls.js
// Conventions copied from the team's figures: a pure black silhouette outline, darker color-matched
// inner lines, 4 to 6 flat tones per surface, light from the upper left, no gradients, no text.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { INK, INK_SOFT, LETTERBOX, PAPER, PAPER_SHADE, WOOD, LANTERN, VERMILION, SUBJECT_THEME } from '../src/ui/palette.js';

const W = 128, H = 80;
const K = '#000000';
const SHADOW = `${INK}38`;   // the walkers' ground shadow: ink at 22%

// Ramps run dark to light: [inner line, deep shade, shade, base, light, highlight]. Bases are the
// game's palette tokens where one exists; the other steps were sampled from assets/village/background.png
// (road, curb, lamps, trunks, foliage, house walls and doors) and the figure sheets' shading.
const subject = (id, line, deep, shade, light, highlight) => [line, deep, shade, SUBJECT_THEME[id].color, light, highlight];
const R = {
  timber: ['#4a2418', '#713d26', '#94583a', WOOD, '#d69c66', '#efc993'],
  den: ['#2b1410', '#3f1f17', '#55291d', '#6a3624', '#7f452e', '#94583a'],
  steel: ['#2a2624', '#4b4744', '#77726d', '#a29d98', '#c7c0b9', '#e0dad4'],
  iron: ['#13100e', '#2a2624', '#3d3835', '#55504b', '#77726d', '#a29d98'],
  paper: ['#a5835a', '#d5b88b', '#e9cb9e', PAPER_SHADE, PAPER, '#ffffff'],
  red: ['#5e1410', '#8f2119', '#b02622', VERMILION, '#f0694a', '#ffa37f'],
  gold: ['#7a5a10', '#a8791e', '#c28b2c', LANTERN, '#ffe69a', '#fff6cf'],
  leaf: ['#25401a', '#416828', '#56833a', '#6b994e', '#7fa960', '#94c67a'],
  water: ['#1f4a63', '#396b84', '#51819a', '#6698b0', '#9ddade', '#d2f0f0'],
  lacquer: ['#3d0f0c', '#6b1a14', '#8f2a1c', '#b23a24', '#d65a3a', '#f08a60'],
  clay: ['#5e2a14', '#8a4424', '#b0603a', '#d08050', '#e8a070', '#f7c79a'],
  tin: [LETTERBOX, INK_SOFT, '#6f74a3', '#9aa0c8', '#c3c8e6', '#eef0ff'],
  ink: ['#0d0e24', INK, LETTERBOX, INK_SOFT, '#7b80a8', '#b4b8d8'],
  // Subject accents keep the name chip color as their base, so the color coding survives.
  math: subject('math', '#6e2e06', '#a95300', '#d7731f', '#ffcb87', '#ffe6c2'),
  science: subject('science', '#12514d', '#1f7d78', '#2fa99f', '#98ead8', '#dcf8ef'),
  art: subject('art', '#7a2652', '#a8467a', '#d9699f', '#ffc5dc', '#ffe8f2'),
  reading: subject('reading', '#1d3a73', '#3062a8', '#4d8fdb', '#acd9ff', '#e2f2ff'),
  writing: subject('writing', '#3e2f78', '#6750a8', '#8f78db', '#dbcbff', '#f3edff'),
  community: subject('community', '#24502a', '#3f8442', '#5fae52', '#b9ec98', '#e4f8d4'),
  music: subject('music', '#6b4c08', '#a8821f', '#dcb12c', '#ffed9b', '#fff9dc'),
};

/* ---------- A tiny raster ---------- */

function sprite() {
  const px = new Array(W * H).fill(null), soft = new Uint8Array(W * H);
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  return {
    px, soft,
    get: (x, y) => (ok(x, y) ? px[y * W + x] : null),
    set(x, y, c, isSoft = 0) { if (c && ok(x, y)) { px[y * W + x] = c; soft[y * W + x] = isSoft; } },
  };
}

// Shapes are pixel predicates, tested at pixel centers.
const box = (x, y, w, h) => (px, py) => px >= x && px < x + w && py >= y && py < y + h;
const oval = (cx, cy, rx, ry) => (px, py) => ((px + 0.5 - cx) / rx) ** 2 + ((py + 0.5 - cy) / ry) ** 2 <= 1;
const or = (...shapes) => (x, y) => shapes.some(f => f(x, y));
const cut = (a, b) => (x, y) => a(x, y) && !b(x, y);
function poly(...pts) {
  return (px, py) => {
    const x = px + 0.5, y = py + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

// Fill a shape through a shader; its boundary takes the line color (null for no line).
function fill(sp, shape, shade, line = null, isSoft = 0) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && shape(x, y);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (shape(x, y)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const lw = line ? 1 : 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    const s = {
      x, y, x0, y0, x1, y1, lw, i: x - x0, j: y - y0,
      u: (x - x0) / Math.max(1, x1 - x0), v: (y - y0) / Math.max(1, y1 - y0),
      in: (dx, dy) => inside(x + dx, y + dy),
    };
    const edge = line && !(s.in(-1, 0) && s.in(1, 0) && s.in(0, -1) && s.in(0, 1));
    sp.set(x, y, edge ? line : shade(s), isSoft);
  }
}

function stamp(sp, x, y, rows, key, isSoft = 0) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (key[ch]) sp.set(x + i, y + j, key[ch], isSoft); }));
}

function line(sp, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    sp.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const hash = (x, y, seed = 0) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* ---------- Shaders: light from the upper left ---------- */

const flat = c => () => c;
// Highlight under the top line, light inside the left line, shade inside the right and bottom lines.
const bevel = (r, base = 3) => s => {
  const d = 1 + s.lw;
  if (!s.in(0, -d)) return r[Math.min(5, base + 2)];
  if (!s.in(0, d)) return r[base - 2];
  if (!s.in(-d, 0)) return r[base + 1];
  if (!s.in(d, 0)) return r[base - 1];
  return r[base];
};
// Horizontal boards: a lit top row, a dark seam, sparse grain streaks, a shaded right end.
const boardsH = (r, size, seed = 1) => s => {
  const row = s.j - s.lw, k = row % size, band = Math.floor(row / size);
  if (k === size - 1) return r[1];
  if (k === 0) return !s.in(-1 - s.lw, 0) ? r[5] : r[4];
  if (!s.in(1 + s.lw, 0)) return r[2];
  if (hash(Math.floor((s.x + band * 5) / 4), band * 9 + k, seed) > 0.9) return r[2];
  return r[3];
};
// Vertical boards with a lit left column and a dark seam on the right.
const boardsV = (r, size, seed = 1) => s => {
  const col = s.i - s.lw, k = col % size, band = Math.floor(col / size);
  if (k === size - 1) return r[1];
  if (k === 0) return r[4];
  if (!s.in(0, 1 + s.lw)) return r[2];
  if (hash(band * 7 + k, Math.floor((s.y + band * 3) / 5), seed) > 0.88) return r[2];
  return r[3];
};
// A round body across x (pots, drums, rolls, lanterns): a lit band left of center, dark right rim.
const roundX = r => s => {
  const u = s.u;
  return u < 0.12 ? r[3] : u < 0.24 ? r[4] : u < 0.36 ? r[5] : u < 0.6 ? r[3] : u < 0.82 ? r[2] : r[1];
};
// A sphere lit from the upper left.
const ball = r => s => {
  const cx = s.x0 + (s.x1 - s.x0) * 0.32, cy = s.y0 + (s.y1 - s.y0) * 0.3;
  const d = Math.hypot((s.x - cx) / Math.max(1, s.x1 - s.x0), (s.y - cy) / Math.max(1, s.y1 - s.y0));
  return d < 0.1 ? r[5] : d < 0.26 ? r[4] : d < 0.5 ? r[3] : d < 0.68 ? r[2] : r[1];
};

/* ---------- Shared parts ---------- */

// A timber post from top to the ground, lit on its left face.
function post(sp, x, y, w, h, r = R.timber) {
  fill(sp, box(x, y, w, h), s => (s.i === 1 ? r[4] : s.i === w - 2 ? r[2] : s.j === h - 2 ? r[1] : r[3]), r[0]);
  sp.set(x + 1, y + h - 2, r[2]);
}

// A counter seen slightly from above: a lit top board, a front of vertical boards, a dark plinth.
function counter(sp, x, y, w, h, r = R.timber, { top = 4, front = boardsV(r, 7) } = {}) {
  fill(sp, box(x, y + top - 1, w, h - top + 1), front, r[0]);
  fill(sp, box(x + 1, y + h - 3, w - 2, 2), flat(r[1]));
  fill(sp, box(x - 1, y, w + 2, top), s => (s.j === 1 ? r[5] : s.j === top - 2 ? r[3] : r[4]), r[0]);
}

// A roof seen from the front and a little above: its top surface narrows toward the ridge.
// kind 'boards' runs painted boards down the slope; 'tiles' lays rows of round-ended tiles.
function roof(sp, r, { x0 = 0, x1 = 128, top = 1, eave = 13, inset = 8, kind = 'boards', pitch = 9 } = {}) {
  fill(sp, poly([x0 + inset, top], [x1 - inset, top], [x1, eave], [x0, eave]), s => {
    const k = (s.x + 3) % pitch, row = s.j - 1;
    if (row === 0) return r[5];
    if (kind === 'tiles') {
      const band = Math.floor((row - 1) / 4), m = (row - 1) % 4, kx = (s.x + band * 3) % 6;
      if (m === 3) return kx === 0 || kx === 5 ? r[1] : r[2];
      if (kx === 0) return r[1];
      return m === 0 ? r[4] : kx === 1 ? r[4] : kx >= 4 ? r[2] : r[3];
    }
    if (k === 0) return r[1];
    if (k === 1) return row < 5 ? r[5] : r[4];
    if (k >= pitch - 2) return r[2];
    return row >= eave - top - 4 ? r[2] : r[3];
  }, K);
}

// Three commas swirling around a center: the drum crest, as a shape.
function tomoe(cx, cy, r) {
  const marks = [];
  for (let k = 0; k < 3; k++) {
    const a0 = (k * 2 * Math.PI) / 3 - Math.PI / 2;
    marks.push([cx + Math.cos(a0) * r * 0.42, cy + Math.sin(a0) * r * 0.42, r * 0.23]);
    for (let t = 0.05; t <= 1; t += 0.04) {
      const a = a0 + t * 2.2, d = r * (0.42 + t * 0.46);
      marks.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.17 * (1 - t) + 0.3]);
    }
  }
  return (x, y) => marks.some(([mx, my, mr]) => Math.hypot(x + 0.5 - mx, y + 0.5 - my) <= mr);
}

// A paper lantern hanging from y, ribbed, with dark caps and a glowing left side.
function lantern(sp, cx, y, r = R.red, h = 12, w = 9) {
  line(sp, cx, y, cx, y + 1, K);
  fill(sp, box(cx - 2, y + 2, 5, 2), flat(R.ink[2]));
  fill(sp, oval(cx + 0.5, y + 4 + h / 2, w / 2, h / 2), s => {
    const rib = (s.y - s.y0) % 3 === 2;
    const tone = roundX(r)(s);
    return rib ? (tone === r[5] || tone === r[4] ? r[3] : r[1]) : tone;
  }, K);
  fill(sp, box(cx - 2, y + 3 + h, 5, 2), flat(R.ink[2]));
}

// The ground shadow under the stall, only where nothing is drawn.
function shadow(sp, x0, x1, y0 = 76) {
  for (let y = y0; y < H; y++) {
    const inset = Math.max(0, (y - y0) * 2 - 1);
    for (let x = x0 + inset; x <= x1 - inset; x++) if (!sp.get(x, y)) sp.set(x, y, SHADOW, 1);
  }
}

// Every opaque edge against transparency becomes the black silhouette line; soft pixels stay as drawn.
function silhouette(sp) {
  const drawn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && Boolean(sp.px[y * W + x]);
  const edge = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (drawn(x, y) && !sp.soft[y * W + x] && !(drawn(x - 1, y) && drawn(x + 1, y) && drawn(x, y - 1) && drawn(x, y + 1))) edge.push(y * W + x);
  }
  for (const i of edge) sp.px[i] = K;
}

/* ---------- The seven stalls ---------- */

const DRAW = {
  // Taro the carpenter: a plank-roofed workshop, a tool wall, a workbench, a crate of blocks, a cart wheel.
  math(sp) {
    const T = R.timber, O = R.math, D = R.den, S = R.steel;
    // back wall: dark horizontal planks, deepest just under the eave
    fill(sp, box(16, 16, 96, 30), s => (s.j < 4 ? D[1] : boardsH(D, 6, 3)(s)), D[0]);
    post(sp, 12, 14, 6, 64);
    post(sp, 110, 14, 6, 64);
    // tools on the wall: saw, hammer, set square, ruler
    stamp(sp, 19, 21, [
      '..............kkkkkkk',
      'kkkkkkkkkkkkkkhhhhhok',
      'klllllllllllllkhkkkok',
      'kmmmmmmmmmmmmmkok.kOk',
      '.kmmmmmmmmmmmmkokkkOk',
      '..kdmdmdmdmdmdkoOOOOk',
      '...k.k.k.k.k.kkkkkkkk',
    ], { k: K, l: S[5], m: S[3], d: S[2], o: O[3], O: O[2], h: O[4] });
    stamp(sp, 22, 30, [
      'kkkkkkkkk',
      'kllmmmmdk',
      'kmmmmdddk',
      'kkkkkkkkk',
      '...kwk...',
      '...kwk...',
      '...kWk...',
      '...kWk...',
      '...kDk...',
      '...kkk...',
    ], { k: K, l: S[5], m: S[3], d: S[2], w: T[4], W: T[3], D: T[2] });
    fill(sp, cut(poly([44, 19], [44, 37], [62, 37]), poly([47, 26], [47, 34], [54, 34])), bevel(O), K);
    fill(sp, box(64, 20, 24, 4), s => (s.j === 1 ? R.gold[5] : R.gold[3]), K);
    for (let x = 66; x < 86; x += 2) sp.set(x, 22, (x - 66) % 6 === 0 ? R.gold[0] : R.gold[1]);
    // workbench: a dark space below the top, a shelf of planks, two legs
    fill(sp, box(14, 49, 98, 27), s => (s.j < 3 ? D[1] : D[2]), D[0]);
    for (const [x, y, w] of [[20, 63, 70], [24, 59, 62], [18, 67, 84]]) {
      fill(sp, box(x, y, w, 4), s => (s.i === 1 ? T[5] : s.j === 1 ? T[4] : s.i % 13 === 7 ? T[2] : T[3]), T[0]);
    }
    fill(sp, box(16, 70, 94, 3), bevel(T), K);
    post(sp, 17, 50, 5, 27);
    post(sp, 104, 50, 5, 27);
    counter(sp, 14, 43, 98, 8, T, { top: 4, front: boardsH(T, 3, 5) });
    // vise, and a plane trailing curls of shavings on the bench
    fill(sp, box(19, 38, 9, 7), bevel(R.iron), K);
    fill(sp, box(28, 39, 5, 3), flat(S[4]), K);
    fill(sp, poly([86, 39], [100, 39], [100, 44], [84, 44]), bevel(T), K);
    fill(sp, box(90, 36, 5, 4), bevel(O), K);
    stamp(sp, 76, 41, ['.ll..l.', 'l..l..l'], { l: T[5] });
    // roof of painted boards over a timber fascia with rafter ends
    roof(sp, O, { top: 0, eave: 13, inset: 9 });
    fill(sp, box(0, 12, 128, 4), s => (s.j === 1 ? T[4] : T[2]), K);
    for (let x = 6; x < 124; x += 12) fill(sp, box(x, 12, 4, 4), s => (s.i === 1 && s.j === 1 ? T[5] : T[4]), K);
    // a crate of counting blocks on a bigger crate
    for (const [x, y, w, h] of [[0, 57, 22, 21], [3, 46, 17, 12]]) {
      fill(sp, box(x, y, w, h), boardsH(T, 4, 7), K);
      fill(sp, box(x, y, 3, h), bevel(T, 2), K);
      fill(sp, box(x + w - 3, y, 3, h), bevel(T, 2), K);
    }
    fill(sp, box(5, 62, 12, 6), bevel(O), K);
    for (const [x, y, r] of [[4, 41, R.math], [9, 39, R.music], [14, 42, R.science]]) fill(sp, box(x, y, 6, 6), bevel(r), K);
    // cart wheel leaning on the right post: iron tire, felloe, eight spokes, hub
    const cx = 110.5, cy = 61.5;
    fill(sp, oval(cx, cy, 12, 12), s => (s.x < 116 ? D[2] : D[1]));
    fill(sp, cut(oval(cx, cy, 16, 16), oval(cx, cy, 11, 11)), s => {
      const d = Math.hypot(s.x + 0.5 - cx, s.y + 0.5 - cy), a = Math.atan2(s.y + 0.5 - cy, s.x + 0.5 - cx);
      const lit = a < -0.6 && a > -2.6, dark = a > 0.5 && a < 2.6;
      if (d > 13.7) return lit ? R.iron[5] : dark ? R.iron[2] : R.iron[3];
      if (d < 12) return T[1];
      return lit ? T[5] : dark ? T[2] : T[3];
    }, K);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8, c = Math.cos(a), n = Math.sin(a), w = 1.1;
      fill(sp, poly([cx + c * 3 - n * w, cy + n * 3 + c * w], [cx + c * 12 - n * w, cy + n * 12 + c * w],
        [cx + c * 12 + n * w, cy + n * 12 - c * w], [cx + c * 3 + n * w, cy + n * 3 - c * w]), flat(n < 0 ? T[5] : T[3]));
    }
    fill(sp, oval(cx, cy, 4, 4), ball(T), K);
    sp.set(Math.floor(cx), Math.floor(cy), R.iron[1]);
    lantern(sp, 4, 16, O, 11, 8);
  },

  // Momo the chef: a festival kitchen under a teal noren, syrup jars, shaved ice, a steaming pot, strawberries.
  science(sp) {
    const T = R.timber, C = R.science, D = R.den, P = R.paper;
    // back wall and a shelf of syrup jars
    fill(sp, box(8, 14, 112, 36), s => (s.j < 5 ? D[1] : boardsH(D, 7, 11)(s)), D[0]);
    fill(sp, box(54, 34, 44, 3), bevel(T), K);
    for (const [x, r] of [[57, R.red], [66, R.gold], [75, C], [84, R.art]]) {
      fill(sp, box(x, 28, 7, 7), s => (s.j < 2 ? P[4] : s.i === 1 ? r[5] : s.i >= 4 ? r[2] : r[3]), K);
      fill(sp, box(x + 1, 26, 5, 3), bevel(T), K);
    }
    post(sp, 4, 12, 5, 66);
    post(sp, 119, 12, 5, 66);
    // counter: a lit top, teal-striped front cloth over boards
    counter(sp, 6, 49, 116, 28, T, { top: 4, front: s => {
      const k = (s.i - 1) % 12;
      if (s.j < 13) return k < 6 ? (s.j === 1 ? C[5] : k === 0 ? C[4] : k === 5 ? C[2] : C[3]) : (s.j === 1 ? P[5] : k === 6 ? P[5] : k === 11 ? P[2] : P[4]);
      if (s.j === 13) return D[1];
      return boardsV(T, 8, 6)(s);
    } });
    // shaved ice in striped paper cups: a white mound, syrup poured over its top
    for (const [x, r] of [[58, R.red], [70, C], [82, R.gold]]) {
      fill(sp, poly([x, 44], [x + 10, 44], [x + 9, 51], [x + 1, 51]), s => (s.j === 1 ? P[5] : (s.i + 1) % 3 === 0 ? r[2] : P[4]), K);
      fill(sp, cut(oval(x + 5, 44.5, 6, 6.5), box(0, 45, W, H)), s => {
        const syrup = s.y < 41 + (s.i % 3 === 1 ? 1 : 0);
        if (syrup) return s.i < 4 && s.y < 40 ? r[4] : r[3];
        return s.i < 3 ? P[5] : s.i > 8 ? '#c9e2ea' : '#ffffff';
      }, K);
    }
    // a clay brazier with glowing coals under a round iron pot
    fill(sp, box(100, 40, 19, 10), s => (s.j === 1 ? R.clay[4] : bevel(R.clay)(s)), K);
    fill(sp, box(104, 43, 11, 4), s => (s.j === 1 ? R.gold[4] : s.i % 3 === 1 ? R.red[4] : R.red[2]), R.clay[0]);
    fill(sp, oval(109.5, 36, 12, 6.5), roundX(R.iron), K);
    fill(sp, box(96, 34, 3, 3), flat(R.iron[4]), K);
    fill(sp, box(120, 34, 3, 3), flat(R.iron[2]), K);
    fill(sp, box(98, 29, 23, 3), s => (s.i < 6 ? R.steel[5] : s.i > 17 ? R.steel[2] : R.steel[4]), K);
    fill(sp, oval(109.5, 29, 8, 3.5), s => (s.y > 28 ? null : s.x < 108 ? R.steel[5] : R.steel[3]), K);
    fill(sp, box(108, 24, 4, 3), bevel(T), K);
    // roof of natural boards, a fascia, then the noren with a white wave hem
    roof(sp, T, { top: 0, eave: 11, inset: 10, pitch: 8 });
    fill(sp, box(0, 10, 128, 4), s => (s.j === 1 ? T[4] : T[2]), K);
    for (let i = 0; i < 5; i++) {
      const x = 9 + i * 22;
      fill(sp, box(x, 13, 21, 14), s => {
        if (s.j === 1) return C[2];
        const wave = s.j >= 9 && ((s.i + (s.j % 2 ? 0 : 2)) % 4 === 0 || (s.j === 10 && s.i % 4 !== 2));
        if (wave) return P[5];
        return s.i === 1 ? C[4] : s.i >= 18 ? C[2] : s.j > 10 ? C[2] : C[3];
      }, C[0]);
    }
    for (let i = 0; i < 5; i++) {   // strawberries printed on the outer panels
      if (i !== 0 && i !== 3) continue;
      const x = 16 + i * 22;
      stamp(sp, x, 15, ['..gg..', '.rggr.', 'rrrrrr', 'rwrrwr', '.rrrr.', '..rr..'], { g: R.leaf[4], r: R.red[3], w: P[5] });
    }
    lantern(sp, 3, 14, R.red, 12, 9);
    // a crate of strawberries on the ground
    fill(sp, box(100, 63, 24, 15), boardsH(T, 5, 13), K);
    for (const [x, y] of [[102, 59], [107, 60], [112, 59], [117, 60], [105, 56], [111, 56]]) {
      stamp(sp, x, y, ['.gg.', 'rRRr', 'rRrr', '.rr.'], { g: R.leaf[5], r: R.red[3], R: R.red[4] });
    }
    // steam: soft wisps rising from the lid, white over the noren, never outlined in black
    stamp(sp, 102, 12, [
      '......ww.......',
      '.....ww....ww..',
      '....ww....ww...',
      '....ww.....ww..',
      '.....ww.....ww.',
      '..ww..ww...ww..',
      '.ww....ww.ww...',
      '.ww...ww..ww...',
      '..ww.ww....ww..',
      '...www......w..',
      '....ww.........',
      '....w..........',
    ], { w: '#ffffffd8' }, 1);
  },

  // Yuki the designer: a bright studio under a striped awning, folded cloth, a cloth roll, swatches, paint pots, a nobori.
  art(sp) {
    const T = R.timber, A = R.art, P = R.paper;
    // a light back wall: this studio is the airy one
    fill(sp, box(8, 16, 98, 34), s => (s.j < 4 ? P[1] : s.j < 6 ? P[2] : (s.i + s.j * 3) % 9 === 0 && s.j % 3 === 0 ? A[4] : P[3]), P[0]);
    post(sp, 4, 14, 5, 64);
    post(sp, 101, 14, 5, 64);
    // cubbies stacked with folded cloth
    fill(sp, box(12, 20, 46, 28), flat(R.den[2]), K);
    const cloths = [A, R.writing, R.music, R.science, R.reading, R.math, R.community, R.red, A];
    for (let n = 0; n < 6; n++) {
      const x = 15 + (n % 3) * 15, base = n < 3 ? 33 : 46;
      for (let k = 0; k < 3; k++) {
        const r = cloths[(n * 2 + k) % cloths.length], w = [11, 12, 10][(n + k) % 3], y = base - 4 * (k + 1);
        fill(sp, box(x + (12 - w) / 2, y, w, 4), s => (s.j === 1 ? r[5] : s.i === 1 ? r[4] : s.i === w - 2 ? r[2] : r[3]), r[0]);
      }
    }
    for (const y of [20, 33, 46]) fill(sp, box(12, y, 46, 3), bevel(T), K);
    for (const x of [12, 27, 42, 55]) fill(sp, box(x, 20, 3, 28), bevel(T), K);
    // pinked fabric swatches on a rod
    line(sp, 61, 20, 99, 20, K);
    for (const [x, r, pat] of [[63, R.writing, 'dot'], [72, R.science, 'stripe'], [81, R.music, 'check'], [90, R.math, 'dot']]) {
      fill(sp, poly([x, 21], [x + 8, 21], [x + 8, 33], [x + 6, 35], [x + 4, 33], [x + 2, 35], [x, 33]), s => {
        if (pat === 'dot' && s.i % 3 === 1 && s.j % 3 === 2) return P[5];
        if (pat === 'stripe' && s.i % 3 === 0) return P[5];
        if (pat === 'check' && (Math.floor(s.i / 2) + Math.floor(s.j / 2)) % 2 === 0) return r[2];
        return s.i === 1 ? r[4] : r[3];
      }, r[0]);
    }
    // counter, a bolt of dotted pink cloth unrolled down its front
    counter(sp, 6, 48, 98, 29, T, { top: 4, front: boardsV(T, 8, 21) });
    fill(sp, poly([16, 51], [42, 51], [42, 68], [38, 70], [34, 68], [29, 71], [24, 68], [20, 70], [16, 68]), s => {
      if (s.i % 5 === 2 && s.j % 5 === 2) return P[5];
      return s.i === 1 ? A[4] : s.i >= s.x1 - s.x0 - 1 ? A[2] : s.j > 14 ? A[2] : A[3];
    }, K);
    fill(sp, box(12, 42, 34, 8), s => {
      if (s.i % 5 === 2 && s.j === 3) return P[5];
      return s.j === 1 ? A[5] : s.j === 2 ? A[4] : s.j >= 6 ? A[2] : A[3];
    }, K);
    fill(sp, oval(46, 46, 3, 4), s => (s.x < 46 ? P[2] : P[1]), K);
    // paint pots with drips, and brushes in a jar
    for (const [x, r] of [[56, R.red], [67, R.music], [78, R.reading]]) {
      fill(sp, box(x, 42, 9, 8), roundX(R.tin), K);
      fill(sp, box(x + 1, 43, 7, 2), s => (s.i < 3 ? r[4] : r[3]));
      for (const [dx, len] of [[2, 3], [5, 2]]) line(sp, x + dx, 45, x + dx, 44 + len, r[3]);
    }
    fill(sp, box(89, 42, 7, 8), roundX(R.water), K);
    for (const [x, top, r] of [[90, 33, R.red], [92, 31, R.music], [94, 34, A]]) {
      line(sp, x, top + 3, x, 42, T[4]);
      sp.set(x, top + 2, R.steel[4]);
      fill(sp, box(x - 1, top - 1, 3, 3), s => (s.j === 0 && s.i !== 1 ? null : s.i === 0 ? r[4] : r[3]));
    }
    // the awning: pink and white stripes, one cloth down to a scalloped hem
    const hem = or(...Array.from({ length: 13 }, (_, i) => oval(4 + i * 8 + 4, 16, 4, 3.6)));
    fill(sp, or(poly([10, 1], [100, 1], [106, 17], [4, 17]), (x, y) => x >= 4 && x < 106 && hem(x, y)), s => {
      const k = Math.floor((s.x - 4) / 8) % 2, r = k ? P : A, c = (s.x - 4) % 8;
      if (s.j === 1) return r[5];
      if (s.y >= 14) return s.y === 14 ? r[4] : c === 7 || s.y >= 18 ? r[2] : r[3];
      return c === 0 ? r[4] : c === 7 ? r[2] : s.j > 9 ? r[2] : r[3];
    }, K);
    line(sp, 5, 13, 104, 13, A[1]);
    // a nobori banner on its pole: a white edge and no lettering
    fill(sp, box(119, 0, 3, 78), s => (s.i === 1 ? T[4] : T[2]), K);
    fill(sp, box(104, 2, 18, 3), bevel(T), K);
    fill(sp, poly([106, 4], [120, 4], [120, 64], [113, 60], [106, 64]), s => {
      if (s.i <= 2) return P[s.i === 1 ? 5 : 4];
      if (s.j % 9 === 4 && s.i % 4 === 1) return A[5];
      return s.i === 3 ? A[4] : s.i >= 11 ? A[2] : A[3];
    }, K);
    // a painter's palette and a brush printed on the banner
    fill(sp, cut(oval(113, 22, 5.5, 4.6), oval(115.5, 24.5, 1.2, 1.2)), s => (s.y < 20 && s.x < 113 ? '#ffffff' : P[4]), A[0]);
    for (const [x, y, r] of [[110, 20, R.red], [113, 19, R.music], [116, 21, R.reading], [111, 24, R.community]]) sp.set(x, y, r[3]);
    line(sp, 109, 47, 116, 36, A[0]);
    line(sp, 110, 47, 117, 36, P[5]);
    fill(sp, poly([115, 37], [118, 33], [119, 35], [117, 38]), flat(R.reading[3]), A[0]);
  },

  // Sora the storyteller: a reading nook under a blue wagasa, a full bookshelf, a paper lamp, a cushion.
  reading(sp) {
    const T = R.timber, B = R.reading, P = R.paper, D = R.den;
    // a three-panel folding screen behind the platform, plain so the badge reads over it
    for (let i = 0; i < 3; i++) {
      const x = 16 + i * 23;
      fill(sp, box(x, 24, 23, 34), s => {
        if (s.i <= 2 || s.i >= 20 || s.j <= 2) return s.j === 1 || s.i === 1 ? B[4] : B[2];
        if (s.j >= 27) return (s.i + (s.j % 2 ? 0 : 2)) % 4 === 0 || (s.j === 28 && s.i % 4 !== 2) ? B[4] : B[3];
        return i === 1 ? P[4] : s.i <= 4 ? P[3] : P[4];
      }, B[0]);
    }
    // a low reading platform
    counter(sp, 12, 56, 76, 21, T, { top: 4, front: boardsH(T, 5, 31) });
    // a plump cushion with corner tassels
    fill(sp, poly([18, 52], [21, 46], [45, 46], [48, 52], [45, 57], [21, 57]), s => {
      if (s.x === 33 && s.y === 51) return B[1];
      if (s.y === 51 && (s.x === 26 || s.x === 40)) return B[2];
      return s.j <= 1 ? B[5] : s.j <= 3 && s.i <= 20 ? B[4] : s.j >= 9 ? B[1] : s.x > 41 ? B[2] : B[3];
    }, K);
    for (const [x, y] of [[17, 45], [46, 45]]) stamp(sp, x, y, ['.g', 'gG'], { g: R.gold[3], G: R.gold[2] });
    // books stacked by the shelf, an open one on top
    for (const [y, w, r] of [[51, 16, R.red], [47, 14, R.community], [43, 15, R.music]]) {
      fill(sp, box(68, y, w, 5), s => (s.i === 1 ? P[4] : s.j === 1 ? r[4] : s.j === 3 ? r[2] : r[3]), K);
    }
    fill(sp, poly([67, 42], [75, 39], [83, 42], [83, 44], [75, 42], [67, 44]), s => (s.x === 75 ? P[1] : s.x < 75 ? P[5] : P[3]), K);
    // the bookshelf
    fill(sp, box(86, 18, 38, 59), flat(D[1]), K);
    const colors = [R.red, B, R.music, R.writing, R.community, R.math, R.science, R.art, P];
    for (const [y0, y1] of [[21, 36], [39, 54], [57, 72]]) {
      let x = 89, n = Math.floor(y0 / 3);
      while (x < 121) {   // spines with a lit left edge and two bands, a dark gap between books
        const w = 3 + Math.floor(hash(n, y0, 5) * 2), h = y1 - y0 - Math.floor(hash(n, y0, 9) * 5), r = colors[Math.floor(hash(n, y0, 2) * colors.length)];
        if (x + w > 121) break;
        fill(sp, box(x, y1 - h, w, h), s => (s.i === 0 ? r[4] : s.i === w - 1 ? r[2] : s.j === 2 || s.j === h - 3 ? r[1] : s.j === 0 ? r[5] : r[3]));
        x += w + 1; n++;
      }
    }
    for (const y of [18, 36, 54, 72]) fill(sp, box(85, y, 40, 3), bevel(T), K);
    fill(sp, box(85, 17, 3, 61), bevel(T), K);
    fill(sp, box(121, 17, 4, 61), bevel(T), K);
    // a standing paper lamp, glowing
    fill(sp, box(9, 36, 3, 40), flat(T[3]), K);
    fill(sp, box(5, 74, 12, 3), bevel(T), K);
    fill(sp, box(4, 20, 14, 17), s => {
      if (s.i === 7 || s.j === 6 || s.j === 11) return T[2];
      return s.i < 4 ? R.gold[5] : s.i > 10 ? R.gold[4] : '#fffbe8';
    }, K);
    fill(sp, box(3, 18, 16, 3), bevel(T), K);
    fill(sp, box(3, 36, 16, 2), flat(T[2]));
    // the umbrella pole
    fill(sp, box(62, 16, 3, 9), s => (s.i === 1 ? T[4] : T[2]), K);
    // the wagasa: a wide blue umbrella, ribbed, with a cream ring near the rim
    const dome = (x, y) => y <= 18 && ((x + 0.5 - 63.5) / 63) ** 2 + ((y + 0.5 - 19) / 19) ** 2 <= 1;
    fill(sp, dome, s => {
      const dx = s.x + 0.5 - 63.5, dy = 19 - (s.y + 0.5), a = Math.atan2(dy, dx), e = (dx / 63) ** 2 + ((s.y + 0.5 - 19) / 19) ** 2;
      const rib = Math.abs(((a / Math.PI) * 8) % 1) < 0.07;
      if (s.y >= 17) return s.y === 17 ? B[2] : B[1];
      if (e > 0.62 && e < 0.74) return rib ? P[2] : s.x < 64 ? P[5] : P[4];
      if (rib) return B[1];
      const panel = Math.floor((a / Math.PI) * 8) % 2, left = s.x < 64;
      if (s.y < 5 && left) return B[5];
      return panel ? (left ? B[4] : B[3]) : (left ? B[3] : B[2]);
    }, K);
    fill(sp, box(61, 0, 5, 3), bevel(B), K);
    stamp(sp, 3, 18, ['k', 'g', 'G'], { k: K, g: R.gold[3], G: R.gold[2] });
    stamp(sp, 123, 18, ['k', 'g', 'G'], { k: K, g: R.gold[3], G: R.gold[2] });
  },

  // Fumi the writer: a tiled booth under a wooden sign, paper strips, a shoji wall, brushes, ink and a giant brush.
  writing(sp) {
    const T = R.timber, V = R.writing, P = R.paper, I = R.ink;
    // shoji back wall: paper panes in a light frame
    fill(sp, box(10, 18, 108, 30), s => (s.i % 12 === 0 || s.j % 10 === 0 ? T[4] : s.j % 10 === 1 || s.i % 12 === 1 ? P[3] : s.j < 4 ? P[3] : P[4]), T[0]);
    post(sp, 6, 15, 5, 63);
    post(sp, 117, 15, 5, 63);
    // counter: a lavender cloth with a white top band and soft folds
    counter(sp, 8, 47, 112, 30, T, { top: 4, front: s => {
      if (s.j > 21) return bevel(T)(s);
      if (s.j <= 3) return s.j === 1 ? P[5] : s.j === 3 ? P[2] : P[4];
      if (s.j === 20 || s.j === 21) return V[1];
      const k = s.i % 9;
      return k === 0 ? V[2] : k === 1 ? V[4] : k >= 7 ? V[2] : V[3];
    } });
    // brush pot with brushes, an ink stone and a round ink pot
    for (const [x, top, tip] of [[23, 30, V], [26, 28, I], [29, 31, R.red], [31, 29, I]]) {
      line(sp, x, top + 4, x, 42, T[4]);
      fill(sp, box(x - 1, top, 3, 4), s => (s.j === 3 ? T[2] : s.i === 0 ? tip[4] : tip[2]));
    }
    fill(sp, box(20, 40, 14, 9), s => (s.j === 3 ? R.reading[3] : roundX(P)(s)), K);
    fill(sp, box(35, 45, 12, 4), s => (s.j === 1 ? I[3] : I[2]), K);
    fill(sp, box(37, 46, 3, 1), flat(I[0]));
    fill(sp, oval(43.5, 42.5, 3.5, 3.5), ball(I), K);
    // paper: a stack of sheets and a rolled scroll on the right
    for (let k = 0; k < 4; k++) fill(sp, box(96 - k, 45 - k * 2, 20, 3), s => (s.j === 1 ? P[5] : P[3]), P[0]);
    fill(sp, box(98, 38, 18, 4), roundX(P), K);
    fill(sp, box(96, 38, 3, 4), bevel(V), K);
    fill(sp, box(115, 38, 3, 4), bevel(V), K);
    // a tiled roof with a ridge cap
    roof(sp, V, { top: 7, eave: 17, inset: 8, kind: 'tiles' });
    fill(sp, box(10, 6, 108, 3), s => (s.j === 1 ? V[4] : V[2]), K);
    fill(sp, box(0, 16, 128, 3), s => (s.j === 1 ? T[4] : T[2]), K);
    // paper strips hung from the eave
    [[40, R.art], [47, R.music], [54, R.science], [61, P], [68, V], [75, R.math]].forEach(([x, r], n) => {
      sp.set(x + 1, 19, K);
      fill(sp, box(x, 20, 4, 11 + (n % 3) * 2), s => (s.i === 0 ? r[4] : s.i === 3 ? r[2] : r[3]), r[0]);
    });
    // the wooden sign board on the ridge: lavender frame, plain boards, left blank
    fill(sp, box(44, 6, 3, 4), bevel(T), K);
    fill(sp, box(77, 6, 3, 4), bevel(T), K);
    fill(sp, box(40, 0, 44, 9), s => {
      if (s.i < 3 || s.i > 40 || s.j < 2 || s.j > 6) return s.j === 1 || s.i === 1 ? V[4] : s.j === 7 || s.i === 41 ? V[1] : V[3];
      return s.j === 2 ? T[5] : (s.i + s.j * 7) % 13 === 0 ? T[3] : T[4];
    }, K);
    // a giant calligraphy brush leaning on the counter, bristles up, the tip dipped in ink
    fill(sp, poly([0, 77], [5, 77], [16, 37], [12, 36]), s => (s.x - s.x0 < 2 ? T[5] : T[3]), K);
    fill(sp, poly([10, 37], [17, 39], [18, 34], [11, 32]), s => (s.y < 35 ? R.gold[5] : R.gold[3]), K);
    fill(sp, poly([9, 33], [18, 35], [20, 28], [18, 23], [15, 19], [11, 22], [9, 27]), s => {
      if (s.y < 25) return s.x < 15 ? I[2] : I[1];
      return s.x < 12 ? P[5] : s.x > 16 ? P[2] : P[4];
    }, K);
  },

  // Hana the guide: a green-roofed map kiosk, a big map board with a compass rose, a signpost of arrows.
  community(sp) {
    const T = R.timber, G = R.community, P = R.paper, Wt = R.water, L = R.leaf;
    // back cloth under the roof
    fill(sp, box(18, 12, 106, 40), s => (s.j < 3 ? G[2] : s.j < 5 ? G[3] : s.i % 8 === 0 ? G[3] : s.i % 8 === 1 ? G[5] : G[4]), G[0]);
    post(sp, 16, 10, 5, 68);
    post(sp, 120, 10, 5, 68);
    // the map board: land, a river and a lake, paths, houses, trees, a pin, a compass rose
    fill(sp, box(66, 12, 54, 42), bevel(T), K);
    const river = (x, y) => Math.abs(y - (17 + (x - 70) * 0.55 + Math.sin(x / 5) * 3)) < 2.2;
    const lake = oval(108, 46, 9, 5);
    fill(sp, box(70, 17, 46, 33), s => {
      if (lake(s.x, s.y) || river(s.x, s.y)) return river(s.x, s.y - 1) && !lake(s.x, s.y) ? Wt[4] : Wt[3];
      if (s.y === 33 || s.x === 84 || (s.y === 24 && s.x > 96)) return P[3];
      if (hash(Math.floor(s.x / 3), Math.floor(s.y / 3), 4) > 0.86) return L[2];
      return s.y < 20 || s.x < 72 ? G[4] : G[3];
    }, T[0]);
    for (const [x, y] of [[74, 26], [90, 37], [78, 41]]) stamp(sp, x, y, ['.r.', 'rrr', 'ppp'], { r: R.red[3], p: P[4] });
    for (const [x, y] of [[96, 28], [100, 31], [76, 35]]) stamp(sp, x, y, ['.g.', 'ggg', '.t.'], { g: L[1], t: T[1] });
    stamp(sp, 87, 24, ['.kk.', 'krrk', 'krrk', '.kk.', '..k.', '..k.'], { k: K, r: R.red[4] });
    stamp(sp, 104, 17, [
      '....k....',
      '...krk...',
      '...krk...',
      '.kkkrkkk.',
      'kwwwkwwwk',
      '.kkkwkkk.',
      '...kwk...',
      '...kwk...',
      '....k....',
    ], { k: K, r: R.red[3], w: P[5] });
    fill(sp, box(70, 53, 4, 24), bevel(T), K);
    fill(sp, box(112, 53, 4, 24), bevel(T), K);
    // counter with a compass rose plaque on its front
    counter(sp, 18, 52, 48, 25, T, { top: 4, front: boardsV(T, 8, 41) });
    fill(sp, oval(52, 65, 8.5, 8.5), bevel(R.gold), K);
    stamp(sp, 46, 59, [
      '.....k.....',
      '....kRk....',
      '....kRk....',
      '..k.kRk.k..',
      '.kkkkRkkkk.',
      'kwwwwkwwwwk',
      '.kkkkwkkkk.',
      '..k.kwk.k..',
      '....kwk....',
      '....kwk....',
      '.....k.....',
    ], { k: K, R: R.red[3], w: P[5] });
    // a roll of maps on the counter
    fill(sp, box(22, 47, 16, 5), roundX(P), K);
    fill(sp, box(37, 47, 3, 5), bevel(G), K);
    // green tiled roof
    roof(sp, G, { x0: 12, top: 0, eave: 11, inset: 6, kind: 'tiles' });
    fill(sp, box(12, 10, 116, 3), s => (s.j === 1 ? T[4] : T[2]), K);
    // the signpost: three arrows pointing out of town
    fill(sp, box(7, 3, 4, 75), s => (s.i === 1 ? T[4] : s.i === 2 ? T[3] : T[2]), K);
    fill(sp, box(6, 1, 6, 3), bevel(T), K);
    for (const [y, dir, r] of [[6, -1, P], [15, 1, Wt], [24, -1, R.math]]) {
      const x0 = dir < 0 ? 0 : 3, x1 = dir < 0 ? 26 : 30;
      const shape = dir < 0 ? poly([x1, y], [x0 + 5, y], [x0, y + 3.5], [x0 + 5, y + 7], [x1, y + 7])
        : poly([x0, y], [x1 - 5, y], [x1, y + 3.5], [x1 - 5, y + 7], [x0, y + 7]);
      fill(sp, shape, s => (s.j === 1 ? r[5] : s.j >= 5 ? r[2] : r[3]), K);
    }
  },

  // Kiko the musician: a little stage under a string of lanterns, a yellow curtain, a taiko and a small drum.
  music(sp) {
    const T = R.timber, Y = R.music, P = R.paper, V = R.red;
    // yellow curtain with soft folds, tied back at both sides
    fill(sp, box(8, 12, 112, 44), s => {
      const k = (s.i + 1) % 8;
      return s.j < 3 ? Y[2] : k === 0 ? Y[1] : k === 1 ? Y[4] : k >= 6 ? Y[2] : Y[3];
    }, Y[0]);
    for (const [x, dir] of [[8, 1], [119, -1]]) {
      fill(sp, poly([x, 12], [x + dir * 16, 12], [x + dir * 4, 36], [x + dir * 5, 56], [x, 56]), s => (s.y > 34 && s.y < 38 ? V[3] : (s.x + s.y) % 5 === 0 ? Y[2] : Y[4]), Y[0]);
    }
    // vermilion posts
    fill(sp, box(3, 4, 5, 52), s => (s.i === 1 ? V[5] : s.i === 3 ? V[2] : V[3]), K);
    fill(sp, box(120, 4, 5, 52), s => (s.i === 1 ? V[5] : s.i === 3 ? V[2] : V[3]), K);
    // the stage: lit floorboards over a yellow and white striped skirt
    fill(sp, box(0, 55, 128, 23), s => {
      const k = Math.floor(s.i / 8) % 2, r = k ? P : Y, c = s.i % 8;
      if (s.j < 2) return s.j === 1 ? T[5] : T[3];
      return c === 0 ? r[4] : c === 7 ? r[2] : s.j > 18 ? r[2] : r[3];
    }, K);
    fill(sp, box(0, 52, 128, 5), s => (s.j === 1 ? T[5] : s.j === 3 ? T[2] : T[4]), K);
    // the taiko on its stand: a lacquered barrel, a cream head ringed with studs, a three-comma tomoe
    fill(sp, poly([34, 54], [44, 42], [48, 42], [40, 54]), bevel(T), K);
    fill(sp, poly([60, 54], [52, 42], [56, 42], [66, 54]), bevel(T), K);
    fill(sp, oval(56, 35, 13, 13), s => {
      if (Math.abs(s.x - 57) <= 1 || Math.abs(s.x - 64) <= 0) return R.gold[s.y < 30 ? 4 : 3];
      return s.x > 64 ? R.lacquer[1] : s.y < 28 ? R.lacquer[4] : R.lacquer[3];
    }, K);
    fill(sp, oval(48.5, 35, 11.5, 13), s => {
      const d = Math.hypot((s.x + 0.5 - 48.5) / 11.5, (s.y + 0.5 - 35) / 13);
      if (d > 0.8) return (s.x + s.y) % 3 === 0 ? K : R.lacquer[2];
      return s.x < 44 && s.y < 30 ? '#ffffff' : s.x > 53 || s.y > 42 ? P[3] : P[4];
    }, K);
    fill(sp, tomoe(48, 35.5, 8), flat(V[2]));
    // a small drum and crossed sticks
    fill(sp, box(86, 40, 18, 13), s => (s.j % 3 === 0 && s.i % 4 < 2 ? P[4] : roundX(V)(s)), K);
    fill(sp, oval(95, 40, 9, 3), s => (s.x < 93 ? '#ffffff' : P[4]), K);
    fill(sp, poly([88, 53], [92, 50], [98, 50], [102, 53]), bevel(T), K);
    fill(sp, poly([73, 52], [76, 52], [87, 39], [84, 38]), s => (s.x - s.x0 < 2 ? T[5] : T[4]), K);
    fill(sp, poly([84, 52], [87, 52], [76, 38], [73, 39]), s => (s.x - s.x0 < 2 ? T[5] : T[3]), K);
    // the lantern string: a sagging rope with six lanterns
    for (let x = 5; x <= 122; x++) {
      const y = Math.round(4 + 4 * (1 - ((x - 63.5) / 58.5) ** 2));
      sp.set(x, y, K);
    }
    [[16, Y], [34, V], [52, P], [74, Y], [92, V], [110, P]].forEach(([x, r]) => {
      const y = Math.round(4 + 4 * (1 - ((x - 63.5) / 58.5) ** 2));
      lantern(sp, x, y, r, 8, 8);
    });
  },
};

/* ---------- PNG out ---------- */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}
function encode(sp) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = sp.px[y * W + x];
    if (!c) continue;
    const n = parseInt(c.slice(1, 7), 16), at = y * (W * 4 + 1) + 1 + x * 4;
    raw[at] = n >> 16; raw[at + 1] = (n >> 8) & 255; raw[at + 2] = n & 255; raw[at + 3] = c.length > 7 ? parseInt(c.slice(7), 16) : 255;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(W, 0); header.writeUInt32BE(H, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../assets/village/stalls/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [id, draw] of Object.entries(DRAW)) {
  const sp = sprite();
  draw(sp);
  silhouette(sp);
  shadow(sp, 2, 125);
  writeFileSync(new URL(`${id}.png`, out), encode(sp));
}
console.log(`Painted ${Object.keys(DRAW).length} stalls into assets/village/stalls/`);
