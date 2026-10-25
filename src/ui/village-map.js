// Village furniture and movement on the shared crossroads layout.
import { INK, INK_SOFT, PAPER, PAPER_SHADE, WOOD, LANTERN, LETTERBOX, FINISH, SUBJECT_THEME } from './palette.js';
import { VILLAGE_SPOTS, SIDE_SPOTS, WANDER, PLAYER_START, HUD_ZONES, EASELS, ROAD_MASK, STAGE } from './village-layout.js';
import { maskFromRGBA, createWalkable } from './walkable.js';
export { VILLAGE_SPOTS, SIDE_SPOTS, WANDER, PLAYER_START, HUD_ZONES } from './village-layout.js';

let current = null, playerRoad = null, loading = null;
export const road = () => current;
export function setRoad(walkable) {
  if (current === walkable) return;
  current = walkable;
  playerRoad = null;
}

export async function loadRoad(src = ROAD_MASK) {
  if (current) return current;
  if (!loading) loading = new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (error, walkable) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (error) reject(error);
      else { setRoad(walkable); resolve(walkable); }
    };
    const timer = setTimeout(() => finish(new Error('The village map took too long to load.')), 3000);
    img.onload = () => {
      if (settled) return;
      try {
        if (img.naturalWidth !== STAGE.width || img.naturalHeight !== STAGE.height) throw new Error('The village map has the wrong size.');
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(img, 0, 0);
        const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);
        if (width !== STAGE.width || height !== STAGE.height) throw new Error('The village map has the wrong size.');
        const walkable = createWalkable(maskFromRGBA({ width, height, rgba: data }));
        if (![PLAYER_START, ...Object.values(VILLAGE_SPOTS), ...Object.values(SIDE_SPOTS)].every(walkable.isWalkable)) {
          throw new Error('The village map has no safe starting places.');
        }
        finish(null, walkable);
      } catch (error) { finish(error); }
    };
    img.onerror = () => finish(new Error('The village road could not be loaded.'));
    img.src = src;
  }).finally(() => { loading = null; });
  return loading;
}

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

// Keep the entire moving hotspot and actor inside the stage. Very high neighbors'
// badges are lowered in drawActor so their status marks stay below the HUD too.
export function wanderBounds(id) {
  const home = homeSpot(id), hot = hotspotRect(id, home);
  const bounds = {
    minX: Math.max(home.x - WANDER.x, home.x - hot.x),
    maxX: Math.min(home.x + WANDER.x, STAGE.width - Math.max(60, hot.x + hot.w - home.x)),
    minY: Math.max(home.y - WANDER.y, HUD_ZONES[0].h + home.y - hot.y),
    maxY: Math.min(home.y + WANDER.y, STAGE.height - (hot.y + hot.h - home.y)),
  };
  // Split each gap between home hotspots at its midpoint. Prefer the axis with
  // the most spare wander room, so separated rows can still roam sideways.
  for (const other of Object.keys({ ...VILLAGE_SPOTS, ...SIDE_SPOTS })) {
    if (other === id) continue;
    const box = hotspotRect(other), gaps = [];
    if (hot.x + hot.w <= box.x) gaps.push({ axis: 'X', high: true, gap: box.x - hot.x - hot.w, range: WANDER.x });
    if (box.x + box.w <= hot.x) gaps.push({ axis: 'X', high: false, gap: hot.x - box.x - box.w, range: WANDER.x });
    if (hot.y + hot.h <= box.y) gaps.push({ axis: 'Y', high: true, gap: box.y - hot.y - hot.h, range: WANDER.y });
    if (box.y + box.h <= hot.y) gaps.push({ axis: 'Y', high: false, gap: hot.y - box.y - box.h, range: WANDER.y });
    gaps.sort((a, b) => b.gap / b.range - a.gap / a.range);
    const gap = gaps[0];
    if (!gap) continue;
    const coordinate = home[gap.axis.toLowerCase()];
    if (gap.high) bounds[`max${gap.axis}`] = Math.min(bounds[`max${gap.axis}`], coordinate + gap.gap / 2);
    else bounds[`min${gap.axis}`] = Math.max(bounds[`min${gap.axis}`], coordinate - gap.gap / 2);
  }
  return bounds;
}

// The union of the hotspot over the complete allowed wander range.
export function roamRect(id) {
  const bounds = wanderBounds(id);
  const low = hotspotRect(id, { x: bounds.minX, y: bounds.minY });
  return { x: low.x, y: low.y, w: low.w + bounds.maxX - bounds.minX, h: low.h + bounds.maxY - bounds.minY };
}

export const talkPoint = (id, feet = homeSpot(id)) => ({ x: feet.x, y: feet.y + TALK_OFFSET });

export const easelRect = id => EASELS[id];

// `positions` maps id → current feet. The player talks from a point just below the feet.
export function nearestNeighbor(player, positions = VILLAGE_SPOTS, maxDistance = 72) {
  let best = null, bestDistance = maxDistance;
  for (const [id, feet] of Object.entries(positions)) {
    const d = Math.hypot(player.x - feet.x, player.y - (feet.y + TALK_OFFSET));
    if (d <= bestDistance) { best = id; bestDistance = d; }
  }
  return best;
}

const walkRect = p => ({ x: p.x - WALK_SHAPE.left, y: p.y - WALK_SHAPE.top, w: WALK_SHAPE.left + WALK_SHAPE.right, h: WALK_SHAPE.top + WALK_SHAPE.bottom });
const hudClear = p => p.x >= WALK_BOUNDS.minX && p.x <= WALK_BOUNDS.maxX && p.y >= WALK_BOUNDS.minY && p.y <= WALK_BOUNDS.maxY
  && HUD_ZONES.every(zone => !overlaps(walkRect(p), zone));

function clampHUD(point, fixedAxis = null) {
  const pos = { x: clamp(point.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX), y: clamp(point.y, WALK_BOUNDS.minY, WALK_BOUNDS.maxY) };
  if (hudClear(pos)) return pos;
  const xs = fixedAxis === 'x' ? [pos.x] : [pos.x, ...HUD_ZONES.flatMap(z => [z.x - WALK_SHAPE.right, z.x + z.w + WALK_SHAPE.left])];
  const ys = fixedAxis === 'y' ? [pos.y] : [pos.y, ...HUD_ZONES.flatMap(z => [z.y - WALK_SHAPE.bottom, z.y + z.h + WALK_SHAPE.top])];
  return xs.flatMap(x => ys.map(y => ({ x, y }))).filter(hudClear)
    .sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))[0];
}

// Keyboard steps and paths use identical footprint and HUD clearance.
function playerWalkable() {
  if (!current) return null;
  if (!playerRoad) {
    const { width, height } = STAGE, bits = new Uint8Array(Math.ceil(width * height / 8));
    for (let y = WALK_BOUNDS.minY; y <= WALK_BOUNDS.maxY; y++) for (let x = WALK_BOUNDS.minX; x <= WALK_BOUNDS.maxX; x++) {
      const p = { x, y }, i = y * width + x;
      if (!hudClear(p) || HUD_ZONES.some(zone => overlaps(walkRect({ x: x + 0.999, y: y + 0.999 }), zone))) continue;
      if (current.isWalkable(p)) bits[i >> 3] |= 1 << (i & 7);
    }
    playerRoad = createWalkable({ width, height, bits }, { footprint: [[0, 0]], bounds: hudClear });
  }
  return playerRoad;
}

// Never present an off-road point as a usable projection.
export function clampWalk(point, fixedAxis = null) {
  const clamped = clampHUD(point, fixedAxis);
  const walkable = playerWalkable();
  if (!walkable) return null;
  return walkable.nearest(clamped, 96) ?? (current.nearest(point, 96)
    ? walkable.nearest(clamped, Math.hypot(STAGE.width, STAGE.height)) : null);
}

export function roadPath(from, point, maxRadius = 96) {
  const walkable = playerWalkable();
  if (!walkable) return null;
  const goal = walkable.nearest(clampHUD(point), maxRadius);
  if (!goal || !walkable.isWalkable(from)) return null;
  return walkable.findPath(from, goal, { maxRadius: 0 });
}

export function talkGoal(id, feet = homeSpot(id)) {
  if (!current) return null;
  const point = talkPoint(id, feet), goal = playerWalkable().nearest(clampHUD(point), 96);
  return goal && current.isWalkable(goal) && hudClear(goal) && Math.hypot(goal.x - point.x, goal.y - point.y) <= 72 ? goal : null;
}

export function stepPlayer(player, intent) {
  const move = MOVES[intent];
  if (!move || !current) return { x: player.x, y: player.y };
  const to = clampHUD({ x: player.x + move[0] * STEP, y: player.y + move[1] * STEP }, move[0] ? 'y' : 'x');
  return playerWalkable().step(player, to);
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
  const bounds = wanderBounds(id);
  const contains = p => p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
  return current ? current.randomWalkableNear(home, WANDER, random, 12, { bounds: contains }) : { ...home };
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
