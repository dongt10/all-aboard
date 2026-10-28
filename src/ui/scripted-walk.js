const STEP_CYCLE = [1, 0, 2, 0];
const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);

/** Create an independent walking state from a position and remaining waypoints. */
export function createScriptedWalk(pos, path, speed = 240) {
  const valid = validPoint(pos) && Array.isArray(path) && path.every(validPoint);
  const position = validPoint(pos) ? { x: pos.x, y: pos.y } : { x: 0, y: 0 };
  const remaining = valid ? path.map(({ x, y }) => ({ x, y })) : [];
  while (remaining.length && remaining[0].x === position.x && remaining[0].y === position.y) remaining.shift();
  return { pos: position, path: remaining, speed, facing: 'front', step: 0, clock: 0, arrived: remaining.length === 0 };
}

/** Advance by elapsed milliseconds, carrying unused distance through corners. */
export function stepScriptedWalk(walk, dt) {
  const next = { ...walk, pos: { ...walk.pos }, path: walk.path.map(point => ({ ...point })) };
  if (next.arrived || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(next.speed) || next.speed <= 0) return next;
  let distance = next.speed * dt / 1000;
  let travelled = 0;
  while (next.path.length) {
    const target = next.path[0];
    const dx = target.x - next.pos.x, dy = target.y - next.pos.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) { next.path.shift(); continue; }
    if (distance <= 0) break;
    next.facing = dx < 0 ? 'left' : dx > 0 ? 'right' : 'front';
    const amount = Math.min(distance, length);
    if (amount === length) {
      next.pos = { ...target };
      next.path.shift();
    } else {
      next.pos = { x: next.pos.x + dx * amount / length, y: next.pos.y + dy * amount / length };
    }
    distance -= amount;
    travelled += amount;
  }
  next.arrived = next.path.length === 0;
  next.clock += travelled / next.speed * 1000;
  const period = Math.min(120, 80 * 240 / next.speed);
  next.step = next.arrived ? 0 : STEP_CYCLE[Math.floor(next.clock / period) % STEP_CYCLE.length];
  return next;
}
