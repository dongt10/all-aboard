// Willow Bay's layout and art, drawn natively for the 960×540 stage. Everything here is pure.
import { INK, INK_SOFT, PAPER, PAPER_SHADE, SKY, SEA, GRASS, GRASS_DARK, PATH, WOOD, VERMILION, LANTERN, LETTERBOX, FINISH, SUBJECT_THEME } from './palette.js';

// The HUD strip across the top and the festival board in the bottom-left corner.
export const HUD_ZONES = [{ x: 0, y: 0, w: 960, h: 72 }, { x: 0, y: 452, w: 440, h: 88 }];
const SHORE_Y = 486;
// Centered on x=480; wide enough for the player and the Find chip at PLAYER_START.
const PIER = { x: 408, y: 470, w: 144, h: 70 };
export const WATER_ZONES = [
  { x: 0, y: SHORE_Y, w: PIER.x, h: 540 - SHORE_Y },
  { x: PIER.x + PIER.w, y: SHORE_Y, w: 960 - PIER.x - PIER.w, h: 540 - SHORE_Y },
];
const BLOCKED_ZONES = [...HUD_ZONES, ...WATER_ZONES];
// Home spots are feet positions.
export const VILLAGE_SPOTS = {
  community: { x: 180, y: 168 }, reading: { x: 480, y: 168 }, writing: { x: 780, y: 168 },
  math: { x: 140, y: 300 }, art: { x: 820, y: 300 },
  science: { x: 330, y: 416 }, music: { x: 630, y: 416 },
};
export const SIDE_SPOTS = { pip: { x: 330, y: 280 }, nori: { x: 640, y: 280 } };
export const WANDER = { x: 36, y: 4 };
export const PLAYER_START = { x: 480, y: 500 };
// Reserve the 64×64 figure and the 44×36 Find chip beside it, even when Find is off.
export const WALK_SHAPE = { left: 32, right: 70, top: 57, bottom: 7 };
export const WALK_BOUNDS = { minX: 40, maxX: 960 - WALK_SHAPE.right, minY: HUD_ZONES[0].h + WALK_SHAPE.top, maxY: 510 };
export const STEP = 24;
export const TALK_OFFSET = 40;

const MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const homeSpot = id => VILLAGE_SPOTS[id] ?? SIDE_SPOTS[id];

export function hotspotRect(id, feet = homeSpot(id)) {
  const { x, y } = feet;
  return VILLAGE_SPOTS[id] ? { x: x - 56, y: y - 80, w: 112, h: 112 } : { x: x - 36, y: y - 72, w: 72, h: 88 };
}

// The union of the hotspot over every place the character may wander.
export function roamRect(id) {
  const home = homeSpot(id);
  const low = hotspotRect(id, { x: home.x - WANDER.x, y: home.y - WANDER.y });
  return { x: low.x, y: low.y, w: low.w + 2 * WANDER.x, h: low.h + 2 * WANDER.y };
}

export const talkPoint = (id, feet = homeSpot(id)) => ({ x: feet.x, y: feet.y + TALK_OFFSET });

// A creation's 80×56 easel stands 4px beside its stall, on the side toward the middle of the map.
export function easelRect(id) {
  const { x, y } = VILLAGE_SPOTS[id];
  return { x: x > 480 ? x - 64 - 84 : x + 64 + 4, y: y - 70, w: 80, h: 56 };
}

// `positions` maps id → current feet. The player talks from a point just below the feet.
export function nearestNeighbor(player, positions = VILLAGE_SPOTS, maxDistance = 72) {
  let best = null, bestDistance = maxDistance;
  for (const [id, feet] of Object.entries(positions)) {
    const d = Math.hypot(player.x - feet.x, player.y - (feet.y + TALK_OFFSET));
    if (d <= bestDistance) { best = id; bestDistance = d; }
  }
  return best;
}

// Project a destination (or an animation frame) onto the nearest clear HUD/water edge.
export function clampWalk(point, fixedAxis = null) {
  const pos = {
    x: clamp(point.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX),
    y: clamp(point.y, WALK_BOUNDS.minY, WALK_BOUNDS.maxY),
  };
  const rect = p => ({ x: p.x - WALK_SHAPE.left, y: p.y - WALK_SHAPE.top, w: WALK_SHAPE.left + WALK_SHAPE.right, h: WALK_SHAPE.top + WALK_SHAPE.bottom });
  const clear = p => p.x >= WALK_BOUNDS.minX && p.x <= WALK_BOUNDS.maxX && p.y >= WALK_BOUNDS.minY && p.y <= WALK_BOUNDS.maxY
    && BLOCKED_ZONES.every(zone => !overlaps(rect(p), zone));
  if (clear(pos)) return pos;
  // Include corners: an edge of the water may itself be behind the festival board.
  const xs = fixedAxis === 'x' ? [pos.x] : [pos.x, ...BLOCKED_ZONES.flatMap(z => [z.x - WALK_SHAPE.right, z.x + z.w + WALK_SHAPE.left])];
  const ys = fixedAxis === 'y' ? [pos.y] : [pos.y, ...BLOCKED_ZONES.flatMap(z => [z.y - WALK_SHAPE.bottom, z.y + z.h + WALK_SHAPE.top])];
  return xs.flatMap(x => ys.map(y => ({ x, y }))).filter(clear)
    .sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))[0];
}

// Round the pier's corner on land, so a diagonal tap walk cannot stick against the water.
export function walkWaypoint(from, to) {
  const shore = SHORE_Y - WALK_SHAPE.bottom;
  const onPier = x => x >= PIER.x + WALK_SHAPE.left && x <= PIER.x + PIER.w - WALK_SHAPE.right;
  if (from.y > shore && !onPier(to.x)) return { x: from.x, y: shore };
  if (to.y > shore && !onPier(from.x)) return { x: to.x, y: Math.min(from.y, shore) };
  return to;
}

export function stepPlayer(player, intent) {
  const move = MOVES[intent];
  if (!move) return { x: player.x, y: player.y };
  return clampWalk({ x: player.x + move[0] * STEP, y: player.y + move[1] * STEP }, move[0] ? 'y' : 'x');
}

// 'made': a creation stands at the stall. 'visited': an older save finished it without a creation.
// 'started': a draft exists but nothing is finished, so the stall looks started rather than new.
export function stallState(id, creations = {}, completed = [], drafts = {}) {
  if (creations?.[id]) return 'made';
  if (completed.includes(id)) return 'visited';
  return drafts?.[id] ? 'started' : 'new';
}

// The badge mark and the words a screen reader hears for every stall state except 'made'
// (a made stall shows a check and names what was made, which the scene knows).
export const STALL_BADGE = {
  new: { mark: '!', said: 'Something new to make.' },
  started: { mark: '...', said: 'Started. Tap to continue.' },
  visited: { mark: 'Visited', said: 'Visited.' },
};
export const stallBadge = status => STALL_BADGE[status] ?? null;

// The festival board's visible label: how many of the seven are made in this grade.
export const BOARD_TOTAL = 7;
export function boardLabel(count, total = BOARD_TOTAL) {
  const made = Math.max(0, Math.min(total, Math.floor(Number(count) || 0)));
  return made >= total ? `${total} of ${total} · Festival complete!` : `Festival board · ${made} of ${total}`;
}

export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function wanderTarget(id, random = Math.random) {
  const home = homeSpot(id);
  const offset = range => clamp(Math.round((random() * 2 - 1) * range), -range, range);
  return { x: home.x + offset(WANDER.x), y: home.y + offset(WANDER.y) };
}

export function stepToward(pos, target, maxStep) {
  const dx = target.x - pos.x, dy = target.y - pos.y, distance = Math.hypot(dx, dy);
  const facing = dx > 0 ? 'right' : dx < 0 ? 'left' : 'front';
  if (distance <= maxStep) return { pos: { x: target.x, y: target.y }, facing, arrived: true };
  const k = maxStep / distance;
  return { pos: { x: pos.x + dx * k, y: pos.y + dy * k }, facing, arrived: false };
}

const ARROWS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
export function guideArrow(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);   // screen y points down
  return ARROWS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

/* ---------- Art ---------- */

const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// Hand-picked steps of the festival tokens: light always comes from the upper left.
const TIMBER = { base: WOOD, light: '#dca372', shade: '#885036' };
const RED = { base: VERMILION, light: '#ff8a61', shade: '#a72f35' };
const GOLD = { base: LANTERN, light: '#ffe69a', shade: '#c28b2c' };
const SHEET = { base: PAPER, light: '#ffffff', shade: PAPER_SHADE };
const CLOTH = {
  math: { base: SUBJECT_THEME.math.color, light: '#ffcb87', shade: '#bd672e' },
  science: { base: SUBJECT_THEME.science.color, light: '#98ead8', shade: '#258e89' },
  art: { base: SUBJECT_THEME.art.color, light: '#ffc5dc', shade: '#bc568a' },
  reading: { base: SUBJECT_THEME.reading.color, light: '#acd9ff', shade: '#3977b8' },
  writing: { base: SUBJECT_THEME.writing.color, light: '#dbcbff', shade: '#7961b4' },
  community: { base: SUBJECT_THEME.community.color, light: '#b9ec98', shade: '#4f934a' },
  music: { base: SUBJECT_THEME.music.color, light: '#ffed9b', shade: '#b9932d' },
};

// Nested fills, never strokes: every outer edge occupies exactly one logical pixel.
function panel(x, y, w, h, { base, light, shade }) {
  return rect(x, y, w, h, INK) + rect(x + 1, y + 1, w - 2, h - 2, base)
    + rect(x + 1, y + 1, w - 2, 1, light) + rect(x + 1, y + 2, 1, h - 3, light)
    + rect(x + w - 2, y + 2, 1, h - 3, shade) + rect(x + 2, y + h - 2, w - 3, 1, shade);
}

function post(x, y, w, h) {
  return panel(x, y, w, h, TIMBER) + rect(x + 2, y + h - 4, w - 3, 2, TIMBER.shade)
    + rect(x + 2, y + 4, 1, 1, INK) + rect(x + w - 3, y + 10, 1, Math.min(8, h - 12), TIMBER.shade)
    + rect(x + 2, y + h - 8, 1, 1, INK);
}

function tree(x, y) {   // (x, y) is the base of the trunk
  return post(x - 4, y - 18, 8, 18) + rect(x - 3, y - 4, 6, 3, TIMBER.shade)
    // Four closed tiers keep the original 36×50 silhouette and trunk position.
    + rect(x - 12, y - 50, 24, 6, INK) + rect(x - 16, y - 46, 32, 8, INK)
    + rect(x - 18, y - 40, 36, 20, INK) + rect(x - 14, y - 22, 28, 8, INK)
    + rect(x - 11, y - 49, 22, 6, GRASS) + rect(x - 15, y - 45, 30, 8, GRASS)
    + rect(x - 17, y - 39, 34, 18, GRASS) + rect(x - 13, y - 22, 26, 7, GRASS)
    + rect(x + 9, y - 44, 6, 6, GRASS_DARK) + rect(x + 11, y - 38, 6, 16, GRASS_DARK)
    + rect(x + 5, y - 28, 8, 12, GRASS_DARK) + rect(x - 12, y - 19, 24, 4, GRASS_DARK)
    + rect(x - 10, y - 48, 12, 3, '#a1df7e') + rect(x - 14, y - 44, 8, 4, '#a1df7e')
    + rect(x - 16, y - 38, 6, 6, '#a1df7e') + rect(x - 6, y - 40, 6, 4, '#a1df7e')
    + rect(x - 11, y - 28, 4, 2, '#a1df7e') + rect(x + 2, y - 35, 4, 2, GRASS_DARK);
}
const flower = (x, y, color) => rect(x, y - 3, 3, 9, INK) + rect(x - 3, y, 9, 3, INK)
  + rect(x + 1, y - 2, 1, 7, color) + rect(x - 2, y + 1, 7, 1, color)
  + rect(x, y, 3, 3, LANTERN) + rect(x, y, 1, 1, PAPER);

// A stepped string of lanterns hanging between two posts, sagging in the middle.
function lanternString(x1, x2, y, sag, colors) {
  let out = '';
  const span = x2 - x1;
  let previousY = y;
  for (let x = x1; x < x2; x += 4) {
    const t = (x - x1) / span;
    const nextY = Math.round(y + sag * 4 * t * (1 - t));
    out += rect(x, nextY, 4, 1, INK) + rect(x, Math.min(previousY, nextY), 1, Math.abs(nextY - previousY) + 1, INK);
    previousY = nextY;
  }
  const count = Math.floor(span / 40);
  for (let i = 1; i < count; i++) {
    const x = x1 + Math.round(i * span / count), t = (x - x1) / span, top = Math.round(y + sag * 4 * t * (1 - t)) + 2;
    const tone = colors[i % colors.length] === VERMILION ? RED : GOLD;
    out += rect(x - 1, top - 1, 2, 4, INK)
      + rect(x - 4, top + 2, 8, 14, INK) + rect(x - 6, top + 4, 12, 10, INK)
      + rect(x - 3, top + 3, 6, 12, tone.base) + rect(x - 5, top + 5, 10, 8, tone.base)
      + rect(x - 3, top + 4, 2, 8, tone.light) + rect(x - 4, top + 5, 6, 2, tone.light)
      + rect(x + 3, top + 6, 2, 7, tone.shade) + rect(x - 2, top + 13, 5, 2, tone.shade)
      + rect(x + 1, top + 7, 1, 6, tone.shade) + rect(x - 3, top + 9, 6, 1, tone.shade)
      + rect(x - 2, top + 2, 4, 1, INK) + rect(x - 2, top + 15, 4, 1, INK)
      + rect(x - 1, top + 16, 2, 4, INK) + rect(x, top + 16, 1, 3, tone.base);
  }
  return out + post(x1 - 3, y - 4, 6, 60) + post(x2 - 3, y - 4, 6, 60);
}

function yagura(cx, base) {   // the festival tower, feet of its legs at y = base
  const x = cx - 50;
  return panel(x + 6, base - 2, 88, 6, TIMBER)
    + [8, 46, 84].map(dx => post(x + dx, base - 70, 8, 70)).join('')
    + panel(x + 16, base - 40, 68, 4, TIMBER) + panel(x + 16, base - 20, 68, 4, TIMBER)
    + rect(x + 22, base - 39, 2, 1, INK) + rect(x + 76, base - 19, 2, 1, INK)
    + panel(x, base - 78, 100, 10, RED) + rect(x + 3, base - 71, 94, 2, RED.shade)
    + panel(x + 10, base - 100, 80, 22, SHEET)
    + Array.from({ length: 6 }, (_, i) => {
      const sx = x + 18 + i * 12, tone = i % 2 ? GOLD : RED;
      return rect(sx, base - 98, 6, 19, tone.base) + rect(sx, base - 97, 1, 15, tone.light)
        + rect(sx + 4, base - 96, 2, 16, tone.shade) + rect(sx, base - 82, 4, 2, tone.shade);
    }).join('')
    + rect(x + 12, base - 81, 76, 1, TIMBER.shade)
    + panel(x - 8, base - 108, 116, 10, RED) + rect(x - 6, base - 101, 112, 2, RED.shade)
    + panel(x + 14, base - 116, 72, 8, RED)
    + rect(x + 18, base - 115, 40, 2, RED.light) + rect(x + 18, base - 110, 64, 1, RED.shade)
    + [28, 44, 60, 76].map(dx => rect(x + dx, base - 113, 1, 4, RED.shade)).join('')
    + panel(cx - 2, base - 128, 4, 12, TIMBER) + panel(cx - 6, base - 128, 12, 4, GOLD);
}

export function villageMapSVG() {
  const ground = rect(0, 0, 960, 540, GRASS)
    // distant rooftops and hills under the HUD
    + rect(0, 0, 960, 40, SKY) + rect(0, 40, 960, 32, GRASS_DARK)
    + Array.from({ length: 12 }, (_, i) => panel(i * 84 + 8, 28, 40, 12, i % 2 ? RED : TIMBER) + panel(i * 84 + 12, 40, 32, 12, SHEET) + rect(i * 84 + 24, 44, 8, 8, INK_SOFT)).join('')
    // grass speckles
    + Array.from({ length: 60 }, (_, i) => rect((i * 157) % 940 + 10, (i * 89) % 360 + 80, 4, 4, GRASS_DARK)).join('');
  const paths = [
    [100, 176, 760, 24], [80, 308, 800, 24], [290, 424, 380, 24],   // three streets under the three rows
    [168, 176, 24, 156], [768, 176, 24, 156], [468, 176, 24, 300],   // side lanes and the main avenue
    [318, 308, 24, 140], [618, 308, 24, 140],
  ].map(([x, y, w, h]) => rect(x - 2, y - 2, w + 4, h + 4, PAPER_SHADE) + rect(x, y, w, h, PATH)).join('');
  const square = rect(388, 214, 184, 104, PAPER_SHADE) + rect(392, 218, 176, 96, PATH)
    + Array.from({ length: 11 }, (_, i) => rect(400 + i * 16, 226 + (i % 2) * 40, 8, 4, PAPER_SHADE)).join('');
  const shore = rect(0, 456, 960, 34, PATH) + rect(0, SHORE_Y, 960, 540 - SHORE_Y, SEA)
    + Array.from({ length: 14 }, (_, i) => rect(i * 70 + 12, 500 + (i % 3) * 12, 24, 3, SKY)).join('')
    + rect(0, 484, 960, 4, PAPER);
  const pier = panel(PIER.x, PIER.y, PIER.w, PIER.h, TIMBER)
    + Array.from({ length: 8 }, (_, i) => {
      const y = 472 + i * 8;
      return panel(PIER.x + 4, y, PIER.w - 8, 8, TIMBER) + rect(PIER.x + 7, y + 3, 1, 1, INK) + rect(PIER.x + PIER.w - 8, y + 3, 1, 1, INK)
        + rect(454 + (i % 3) * 8, y + 4, 16, 1, TIMBER.shade) + rect(478 + (i % 2) * 8, y + 2, 10, 1, TIMBER.light);
    }).join('')
    + [PIER.x - 4, PIER.x + PIER.w - 4].map(x => post(x, 488, 8, 52)
      + panel(x, 488, 8, 6, TIMBER) + rect(x + 1, 504, 6, 2, PAPER_SHADE)).join('');
  const boat = panel(588, 488, 4, 24, TIMBER)
    + rect(592, 490, 16, 16, INK) + rect(608, 494, 4, 8, INK)
    + rect(593, 491, 14, 14, PAPER) + rect(607, 495, 4, 6, PAPER)
    + rect(593, 491, 12, 2, '#ffffff') + rect(593, 493, 2, 10, '#ffffff')
    + rect(605, 493, 2, 12, PAPER_SHADE) + rect(607, 499, 4, 2, PAPER_SHADE) + rect(595, 503, 10, 2, PAPER_SHADE)
    + rect(598, 494, 1, 8, PAPER_SHADE)
    + rect(560, 512, 64, 4, INK) + rect(562, 516, 60, 4, INK) + rect(566, 520, 52, 4, INK)
    + rect(561, 513, 62, 2, RED.light) + rect(563, 515, 58, 4, RED.base) + rect(567, 519, 50, 4, RED.base)
    + rect(568, 521, 48, 2, RED.shade) + rect(614, 516, 6, 3, RED.shade)
    + rect(568, 515, 22, 1, RED.light) + rect(576, 517, 2, 2, INK) + rect(602, 517, 2, 2, INK);
  const trees = [[24, 128], [60, 200], [28, 396], [70, 440], [932, 128], [900, 210], [930, 400], [890, 444], [328, 128], [632, 128], [252, 260], [708, 260], [416, 400], [544, 400]].map(([x, y]) => tree(x, y)).join('');
  const flowers = [[96, 250, VERMILION], [112, 262, LANTERN], [860, 252, SUBJECT_THEME.art.color], [878, 262, VERMILION], [210, 440, SUBJECT_THEME.art.color], [752, 440, LANTERN], [400, 160, VERMILION], [560, 160, SUBJECT_THEME.art.color], [36, 300, LANTERN], [928, 300, VERMILION]].map(([x, y, c]) => flower(x, y, c)).join('');
  const lanterns = lanternString(276, 456, 214, 22, [VERMILION, LANTERN]) + lanternString(504, 684, 214, 22, [LANTERN, VERMILION]);
  const welcome = panel(550, 470, 4, 14, TIMBER) + panel(526, 448, 52, 24, TIMBER) + panel(529, 451, 46, 18, SHEET)
    + rect(536, 456, 32, 2, INK_SOFT) + rect(536, 462, 24, 2, INK_SOFT)
    + rect(527, 450, 1, 1, INK) + rect(576, 469, 1, 1, INK);
  return `<svg class="village-map" viewBox="0 0 960 540" width="960" height="540" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${ground}${paths}${square}${shore}${pier}${boat}${trees}${flowers}${yagura(480, 312)}${lanterns}${welcome}</svg>`;
}

// One stall, 128×80, drawn in the subject color: an awning, posts, and a counter.
export function stallSVG(id) {
  const cloth = CLOTH[id] ?? GOLD;
  const stripes = Array.from({ length: 8 }, (_, i) => {
    const x = 8 + i * 14, tone = i % 2 ? SHEET : cloth;
    return rect(x, 6, 14, 19, tone.base) + rect(x, 6, 14, 2, tone.light)
      + rect(x + 1, 8, 2, 14, tone.light) + rect(x + 12, 8, 2, 17, tone.shade)
      + rect(x, 23, 12, 2, tone.shade);
  }).join('');
  const scallops = Array.from({ length: 8 }, (_, i) => {
    const x = 8 + i * 14, tone = i % 2 ? SHEET : cloth;
    return rect(x, 25, 14, 4, INK) + rect(x + 2, 29, 10, 3, INK)
      + rect(x + 1, 25, 12, 3, tone.base) + rect(x + 3, 28, 8, 3, tone.shade)
      + rect(x + 1, 25, 10, 1, tone.light) + rect(x + 3, 29, 6, 1, tone.base);
  }).join('');
  return `<svg viewBox="0 0 128 80" width="128" height="80" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
    + panel(20, 36, 88, 26, SHEET) + rect(22, 54, 84, 4, PAPER_SHADE)
    + [28, 48, 76, 98].map(x => rect(x, 38, 2, 18, PAPER_SHADE)).join('')
    + post(14, 30, 6, 32) + post(108, 30, 6, 32)
    + panel(4, 2, 120, 30, TIMBER) + rect(7, 5, 114, 21, INK) + stripes + scallops
    + panel(4, 2, 120, 4, TIMBER)
    // Tiny wares read as a crate, a jar, a bottle and a folded cloth at village scale.
    + panel(30, 44, 10, 12, cloth) + rect(34, 46, 1, 8, cloth.shade) + rect(32, 49, 6, 1, INK)
    + panel(46, 46, 12, 10, GOLD) + panel(48, 44, 8, 4, TIMBER)
    + panel(88, 45, 10, 11, { base: FINISH, light: '#3f9a72', shade: '#155c40' }) + panel(90, 42, 6, 5, TIMBER)
    + panel(70, 48, 12, 8, { base: LETTERBOX, light: INK_SOFT, shade: INK }) + rect(72, 52, 8, 1, INK_SOFT)
    + panel(6, 56, 116, 22, TIMBER) + panel(6, 56, 116, 7, TIMBER)
    + rect(8, 74, 112, 3, TIMBER.shade)
    + [34, 62, 90].map(x => rect(x, 63, 1, 12, TIMBER.shade) + rect(x + 1, 63, 1, 10, TIMBER.light)).join('')
    + [12, 40, 68, 96].map(x => rect(x, 65, 1, 1, INK) + rect(x + 16, 72, 1, 1, INK)
      + rect(x + 3, 68, 12, 1, TIMBER.shade) + rect(x + 6, 69, 6, 1, TIMBER.light)).join('')
    + '</svg>';
}
