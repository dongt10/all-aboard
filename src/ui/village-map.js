// Willow Bay's layout and art, drawn natively for the 960×540 stage. Everything here is pure.
import { INK, INK_SOFT, PAPER, PAPER_SHADE, SKY, SEA, GRASS, GRASS_DARK, PATH, WOOD, VERMILION, LANTERN, LETTERBOX, FINISH, SUBJECT_THEME } from './palette.js';

// The HUD strip across the top and the festival board in the bottom-left corner.
export const HUD_ZONES = [{ x: 0, y: 0, w: 960, h: 72 }, { x: 0, y: 452, w: 440, h: 88 }];
// Home spots are feet positions. Reading sits below Math, clear of the top dialogue.
export const VILLAGE_SPOTS = {
  community: { x: 180, y: 168 }, reading: { x: 112, y: 410 }, writing: { x: 780, y: 168 },
  math: { x: 140, y: 290 }, art: { x: 820, y: 300 },
  science: { x: 330, y: 416 }, music: { x: 630, y: 416 },
};
export const SIDE_SPOTS = { pip: { x: 330, y: 280 }, nori: { x: 640, y: 280 } };
export const WANDER = { x: 36, y: 4 };
export const PLAYER_START = { x: 480, y: 500 };
// Reserve the 64×64 figure and the 44×36 Find chip beside it, even when Find is off.
const WALK_SHAPE = { left: 32, right: 70, top: 57, bottom: 7 };
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

// Project a destination (or an animation frame) onto the nearest clear edge of the HUD.
export function clampWalk(point, fixedAxis = null) {
  let pos = {
    x: clamp(point.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX),
    y: clamp(point.y, WALK_BOUNDS.minY, WALK_BOUNDS.maxY),
  };
  const rect = p => ({ x: p.x - WALK_SHAPE.left, y: p.y - WALK_SHAPE.top, w: WALK_SHAPE.left + WALK_SHAPE.right, h: WALK_SHAPE.top + WALK_SHAPE.bottom });
  const clear = p => p.x >= WALK_BOUNDS.minX && p.x <= WALK_BOUNDS.maxX && p.y >= WALK_BOUNDS.minY && p.y <= WALK_BOUNDS.maxY
    && HUD_ZONES.every(zone => !overlaps(rect(p), zone));
  for (const zone of HUD_ZONES) {
    if (!overlaps(rect(pos), zone)) continue;
    pos = [
      { x: zone.x - WALK_SHAPE.right, y: pos.y },
      { x: zone.x + zone.w + WALK_SHAPE.left, y: pos.y },
      { x: pos.x, y: zone.y - WALK_SHAPE.bottom },
      { x: pos.x, y: zone.y + zone.h + WALK_SHAPE.top },
    ].filter(p => clear(p) && (!fixedAxis || p[fixedAxis] === pos[fixedAxis]))
      .sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))[0];
  }
  return pos;
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

function tree(x, y) {   // (x, y) is the base of the trunk
  return rect(x - 4, y - 14, 8, 14, WOOD) + rect(x - 18, y - 40, 36, 26, GRASS_DARK) + rect(x - 12, y - 50, 24, 10, GRASS_DARK)
    + rect(x - 12, y - 38, 12, 8, GRASS) + rect(x - 6, y - 46, 8, 6, GRASS) + rect(x - 18, y - 16, 36, 2, INK_SOFT);
}
const flower = (x, y, color) => rect(x, y - 3, 3, 3, color) + rect(x - 3, y, 3, 3, color) + rect(x + 3, y, 3, 3, color) + rect(x, y + 3, 3, 3, color) + rect(x, y, 3, 3, LANTERN);

// A stepped string of lanterns hanging between two posts, sagging in the middle.
function lanternString(x1, x2, y, sag, colors) {
  let out = '';
  const span = x2 - x1;
  for (let x = x1; x < x2; x += 4) {
    const t = (x - x1) / span;
    out += rect(x, Math.round(y + sag * 4 * t * (1 - t)), 4, 2, INK);
  }
  const count = Math.floor(span / 40);
  for (let i = 1; i < count; i++) {
    const x = x1 + Math.round(i * span / count), t = (x - x1) / span, top = Math.round(y + sag * 4 * t * (1 - t)) + 2;
    const fill = colors[i % colors.length];
    out += rect(x - 6, top + 2, 12, 14, INK) + rect(x - 4, top + 4, 8, 10, fill) + rect(x - 2, top + 6, 4, 4, PAPER) + rect(x - 1, top, 2, 2, INK) + rect(x - 1, top + 16, 2, 4, INK);
  }
  return out + rect(x1 - 3, y - 4, 6, 60, WOOD) + rect(x2 - 3, y - 4, 6, 60, WOOD);
}

function yagura(cx, base) {   // the festival tower, feet of its legs at y = base
  const x = cx - 50;
  return rect(x + 6, base - 2, 88, 6, INK_SOFT)
    + rect(x + 8, base - 70, 8, 70, WOOD) + rect(x + 84, base - 70, 8, 70, WOOD) + rect(x + 46, base - 70, 8, 70, WOOD)
    + rect(x + 16, base - 40, 68, 4, WOOD) + rect(x + 16, base - 20, 68, 4, WOOD)
    + rect(x, base - 78, 100, 10, INK) + rect(x + 2, base - 76, 96, 6, VERMILION)
    + rect(x + 10, base - 100, 80, 22, INK) + rect(x + 12, base - 98, 76, 18, PAPER)
    + Array.from({ length: 6 }, (_, i) => rect(x + 18 + i * 12, base - 96, 6, 14, i % 2 ? LANTERN : VERMILION)).join('')
    + rect(x - 8, base - 108, 116, 10, INK) + rect(x - 4, base - 106, 108, 6, VERMILION)
    + rect(x + 14, base - 116, 72, 8, INK) + rect(x + 16, base - 114, 68, 4, VERMILION) + rect(cx - 2, base - 128, 4, 12, INK)
    + rect(cx - 6, base - 128, 12, 4, LANTERN);
}

export function villageMapSVG() {
  const ground = rect(0, 0, 960, 540, GRASS)
    // distant rooftops and hills under the HUD
    + rect(0, 0, 960, 40, SKY) + rect(0, 40, 960, 32, GRASS_DARK)
    + Array.from({ length: 12 }, (_, i) => rect(i * 84 + 8, 28, 40, 12, i % 2 ? VERMILION : WOOD) + rect(i * 84 + 12, 40, 32, 12, PAPER_SHADE) + rect(i * 84 + 24, 44, 8, 8, INK_SOFT)).join('')
    // grass speckles
    + Array.from({ length: 60 }, (_, i) => rect((i * 157) % 940 + 10, (i * 89) % 360 + 80, 4, 4, GRASS_DARK)).join('');
  const paths = [
    [100, 176, 760, 24], [80, 308, 800, 24], [290, 424, 380, 24],   // three streets under the three rows
    [168, 176, 24, 156], [768, 176, 24, 156], [468, 176, 24, 300],   // side lanes and the main avenue
    [318, 308, 24, 140], [618, 308, 24, 140],
  ].map(([x, y, w, h]) => rect(x - 2, y - 2, w + 4, h + 4, PAPER_SHADE) + rect(x, y, w, h, PATH)).join('');
  const square = rect(388, 214, 184, 104, PAPER_SHADE) + rect(392, 218, 176, 96, PATH)
    + Array.from({ length: 11 }, (_, i) => rect(400 + i * 16, 226 + (i % 2) * 40, 8, 4, PAPER_SHADE)).join('');
  const shore = rect(0, 456, 960, 34, PATH) + rect(0, 486, 960, 54, SEA)
    + Array.from({ length: 14 }, (_, i) => rect(i * 70 + 12, 500 + (i % 3) * 12, 24, 3, SKY)).join('')
    + rect(0, 484, 960, 4, PAPER);
  const pier = rect(440, 470, 80, 70, INK_SOFT) + rect(444, 470, 72, 70, WOOD)
    + Array.from({ length: 8 }, (_, i) => rect(444, 478 + i * 8, 72, 2, INK_SOFT)).join('')
    + rect(436, 488, 8, 52, INK) + rect(516, 488, 8, 52, INK);
  const boat = rect(560, 512, 64, 12, INK) + rect(564, 512, 56, 8, VERMILION) + rect(588, 488, 4, 24, INK) + rect(592, 490, 20, 16, PAPER);
  const trees = [[24, 128], [60, 200], [28, 396], [70, 440], [932, 128], [900, 210], [930, 400], [890, 444], [328, 128], [632, 128], [252, 260], [708, 260], [416, 400], [544, 400]].map(([x, y]) => tree(x, y)).join('');
  const flowers = [[96, 250, VERMILION], [112, 262, LANTERN], [860, 252, SUBJECT_THEME.art.color], [878, 262, VERMILION], [210, 440, SUBJECT_THEME.art.color], [752, 440, LANTERN], [400, 160, VERMILION], [560, 160, SUBJECT_THEME.art.color], [36, 300, LANTERN], [928, 300, VERMILION]].map(([x, y, c]) => flower(x, y, c)).join('');
  const lanterns = lanternString(276, 456, 214, 22, [VERMILION, LANTERN]) + lanternString(504, 684, 214, 22, [LANTERN, VERMILION]);
  const welcome = rect(526, 448, 52, 24, INK) + rect(528, 450, 48, 20, PAPER) + rect(536, 456, 32, 2, INK_SOFT) + rect(536, 462, 24, 2, INK_SOFT) + rect(550, 472, 4, 12, WOOD);
  return `<svg class="village-map" viewBox="0 0 960 540" width="960" height="540" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${ground}${paths}${square}${shore}${pier}${boat}${trees}${flowers}${yagura(480, 312)}${lanterns}${welcome}</svg>`;
}

// One stall, 128×80, drawn in the subject color: an awning, posts, and a counter.
export function stallSVG(id) {
  const color = SUBJECT_THEME[id]?.color ?? LANTERN;
  const stripes = Array.from({ length: 8 }, (_, i) => rect(8 + i * 14, 6, 7, 18, i % 2 ? PAPER : color)).join('');
  const scallops = Array.from({ length: 8 }, (_, i) => rect(8 + i * 14, 24, 14, 4, i % 2 ? PAPER : color) + rect(10 + i * 14, 28, 10, 2, i % 2 ? PAPER : color)).join('');
  return `<svg viewBox="0 0 128 80" width="128" height="80" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
    + rect(4, 2, 120, 4, INK) + rect(4, 2, 4, 30, INK) + rect(120, 2, 4, 30, INK) + rect(6, 28, 116, 4, INK)
    + stripes + scallops
    + rect(14, 32, 6, 30, WOOD) + rect(108, 32, 6, 30, WOOD)
    + rect(20, 36, 88, 26, PAPER_SHADE)
    + rect(6, 56, 116, 22, INK) + rect(8, 58, 112, 18, WOOD) + rect(8, 58, 112, 4, PAPER_SHADE)
    + rect(30, 44, 10, 12, color) + rect(46, 46, 12, 10, LANTERN) + rect(88, 42, 10, 14, FINISH) + rect(70, 48, 12, 8, LETTERBOX)
    + '</svg>';
}
