// Road pixels and feet positions share the mask's stage coordinates (960×540 in the village).
// After a same-origin <img> loads: canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
// const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
// const { width, height, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
// const walk = createWalkable(maskFromRGBA({ width, height, rgba: data }));
// footprint overrides use [{ x: 0, y: 0 }, ...] or [[0, 0], ...]; fractional feet use their containing pixel.
export function maskFromRGBA({ width, height, rgba }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || rgba.length !== width * height * 4) throw new RangeError('Expected a complete RGBA image.');
  const bits = new Uint8Array(Math.ceil(width * height / 8));
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4] >= 128 && rgba[i * 4 + 3] >= 128) bits[i >> 3] |= 1 << (i & 7);
  }
  return { width, height, bits };
}

const FOOTPRINT = Array.from({ length: 52 }, (_, i) => ({ x: i % 13 - 6, y: Math.floor(i / 13) - 3 }));
const validPoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const same = (a, b) => a.x === b.x && a.y === b.y;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createWalkable(mask, options = {}) {
  const { width, height, bits } = mask;
  const footprint = (options.footprint ?? FOOTPRINT).map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
  // Erode once by every footprint pixel. All movement queries share this bitset.
  const clearance = new Uint8Array(Math.ceil(width * height / 8));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (footprint.every(offset => {
      const px = x + offset.x, py = y + offset.y, i = py * width + px;
      return px >= 0 && py >= 0 && px < width && py < height && (bits[i >> 3] & (1 << (i & 7)));
    })) {
      const i = y * width + x;
      clearance[i >> 3] |= 1 << (i & 7);
    }
  }
  const clearPixel = (x, y) => {
    const i = y * width + x;
    return x >= 0 && y >= 0 && x < width && y < height && Boolean(clearance[i >> 3] & (1 << (i & 7)));
  };
  function isWalkable(point) {
    return validPoint(point) && (!options.bounds || options.bounds(point)) && clearPixel(Math.floor(point.x), Math.floor(point.y));
  }

  // Visit every pixel crossed by the feet, including thin obstacles between samples.
  function straightClear(a, b) {
    if (!isWalkable(a) || !isWalkable(b)) return false;
    let x = Math.floor(a.x), y = Math.floor(a.y);
    const endX = Math.floor(b.x), endY = Math.floor(b.y);
    const dx = b.x - a.x, dy = b.y - a.y, sx = Math.sign(dx), sy = Math.sign(dy);
    const stepX = dx ? 1 / Math.abs(dx) : Infinity, stepY = dy ? 1 / Math.abs(dy) : Infinity;
    let tx = dx ? (sx > 0 ? x + 1 - a.x : a.x - x) * stepX : Infinity;
    let ty = dy ? (sy > 0 ? y + 1 - a.y : a.y - y) * stepY : Infinity;
    while (x !== endX || y !== endY) {
      const crossX = x !== endX && (y === endY || tx <= ty + 1e-12);
      const crossY = y !== endY && (x === endX || ty <= tx + 1e-12);
      if (crossX && crossY && (!clearPixel(x + sx, y) || !clearPixel(x, y + sy))) return false;
      if (crossX) { x += sx; tx += stepX; }
      if (crossY) { y += sy; ty += stepY; }
      if (!clearPixel(x, y)) return false;
    }
    return true;
  }

  // Search integer pixel positions in 2px rings; choose distance before the y/x tie break.
  function nearest(point, maxRadius = 96) {
    if (!validPoint(point) || !Number.isFinite(maxRadius) || maxRadius < 0) return null;
    if (isWalkable(point)) return { ...point };
    for (let inner = 0; inner < maxRadius; inner += 2) {
      const radius = Math.min(inner + 2, maxRadius);
      let best = null, bestD = Infinity;
      for (let y = Math.max(0, Math.ceil(point.y - radius)); y <= Math.min(height - 1, Math.floor(point.y + radius)); y++) {
        const dy = y - point.y, span = Math.sqrt(radius * radius - dy * dy);
        for (let x = Math.max(0, Math.ceil(point.x - span)); x <= Math.min(width - 1, Math.floor(point.x + span)); x++) {
          const d = (x - point.x) ** 2 + dy * dy;
          if (d <= inner * inner || d > bestD || !isWalkable({ x, y })) continue;
          if (d < bestD) { best = { x, y }; bestD = d; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Keep the last clear 2px sample, including a shorter final step to the endpoint.
  function trace(from, to) {
    if (!isWalkable(from) || !validPoint(to)) return from;
    const length = distance(from, to);
    let last = from;
    for (let d = 2; d < length + 2; d += 2) {
      const p = d >= length ? to : { x: from.x + (to.x - from.x) * d / length, y: from.y + (to.y - from.y) * d / length };
      if (!straightClear(last, p)) break;
      last = p;
      if (d >= length) break;
    }
    return last;
  }
  function step(from, to) {
    const end = trace(from, to);
    if (!isWalkable(from) || !validPoint(to) || same(end, to)) return { ...end };
    if (from.x === to.x || from.y === to.y) {
      // Ease around corners with the smallest sideways nudge, only across a clear segment.
      const axis = from.x === to.x ? 'x' : 'y';
      for (let nudge = 2; nudge <= 12; nudge += 2) {
        for (const offset of [nudge, -nudge]) {
          const destination = { ...to, [axis]: to[axis] + offset };
          if (straightClear(from, destination)) return destination;
        }
      }
      return { ...end };
    }
    if (!same(end, from)) return { ...end };
    // Only an immediately blocked diagonal slides; partial moves stop before the corner.
    const slides = [trace(from, { x: to.x, y: from.y }), trace(from, { x: from.x, y: to.y })];
    slides.sort((a, b) => distance(from, b) - distance(from, a) || a.y - b.y || a.x - b.x);
    return { ...slides[0] };
  }

  function snapStart(from, cell = 4, radius = 24) {
    if (!validPoint(from)) return null;
    let best = null, bestD = Infinity;
    for (let y = Math.max(0, Math.ceil((from.y - radius) / cell - 0.5)); y < height / cell && (y + 0.5) * cell <= from.y + radius; y++) {
      for (let x = Math.max(0, Math.ceil((from.x - radius) / cell - 0.5)); x < width / cell && (x + 0.5) * cell <= from.x + radius; x++) {
        const p = { x: (x + 0.5) * cell, y: (y + 0.5) * cell }, d = distance(from, p);
        if (d <= radius && d < bestD && straightClear(from, p)) { best = p; bestD = d; }
      }
    }
    return best;
  }

  function findPath(from, to, options = {}) {
    const cell = options.cell ?? 4;
    if (!Number.isFinite(cell) || cell < 1) throw new RangeError('Grid cells must be at least 1px.');
    const start = nearest(from, options.maxRadius ?? 48), end = nearest(to, options.maxRadius);
    if (!start || !end) return null;
    if (same(start, end)) return [start];
    if (straightClear(start, end)) return [start, end];
    const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell), count = cols * rows;
    const open = new Int8Array(count), scores = new Float64Array(count + 1), parents = new Int32Array(count + 1);
    scores.fill(Infinity); parents.fill(-1);
    const point = id => ({ x: (id % cols + 0.5) * cell, y: (Math.floor(id / cols) + 0.5) * cell });
    const clear = id => open[id] || (open[id] = isWalkable(point(id)) ? 1 : -1);
    // Join exact feet positions to nearby centers only across a clear segment.
    function links(p, arriving = false) {
      const out = [], cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
      for (let y = Math.max(0, cy - 1); y <= Math.min(rows - 1, cy + 1); y++) {
        for (let x = Math.max(0, cx - 1); x <= Math.min(cols - 1, cx + 1); x++) {
          const id = y * cols + x, q = point(id);
          if (clear(id) === 1 && (arriving ? straightClear(q, p) : straightClear(p, q))) out.push({ id, x, y, cost: distance(p, q) });
        }
      }
      return out;
    }
    const snapped = snapStart(start, cell) ?? snapStart(nearest(start, 48), cell, 48);
    const starts = snapped ? [{ id: Math.floor(snapped.y / cell) * cols + Math.floor(snapped.x / cell), cost: distance(start, snapped) }] : [];
    const goals = links(end, true), goalCost = new Map(goals.map(g => [g.id, g.cost]));
    if (!starts.length || !goals.length) return null;
    const heuristic = id => {
      if (id === count) return 0;
      const x = id % cols, y = Math.floor(id / cols);
      let h = Infinity;
      for (const g of goals) {
        const dx = Math.abs(x - g.x), dy = Math.abs(y - g.y);
        h = Math.min(h, cell * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) + g.cost);
      }
      return h;
    };
    // A binary heap avoids sorting the frontier after every move.
    const heap = [], before = (a, b) => a.f < b.f || (a.f === b.f && (a.g > b.g || (a.g === b.g && a.id < b.id)));
    function offer(id, g, parent) {
      if (g >= scores[id]) return;
      scores[id] = g; parents[id] = parent;
      const item = { id, g, f: g + heuristic(id) };
      let i = heap.length;
      heap.push(item);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!before(item, heap[p])) break;
        heap[i] = heap[p]; i = p;
      }
      heap[i] = item;
    }
    function take() {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && before(heap[c + 1], heap[c])) c++;
          if (!before(heap[c], last)) break;
          heap[i] = heap[c]; i = c;
        }
        heap[i] = last;
      }
      return first;
    }
    for (const s of starts) offer(s.id, s.cost, -1);
    while (heap.length) {
      const { id, g } = take();
      if (g !== scores[id]) continue;
      if (id === count) {
        const path = [end];
        for (let p = parents[id]; p !== -1; p = parents[p]) path.push(point(p));
        path.push(start); path.reverse();
        // Pull a string to the farthest visible waypoint, keeping each corner clear.
        const pulled = [start];
        for (let i = 0; i < path.length - 1;) {
          let j = path.length - 1;
          while (j > i + 1 && !straightClear(path[i], path[j])) j--;
          if (!same(pulled[pulled.length - 1], path[j])) pulled.push(path[j]);
          i = j;
        }
        return pulled;
      }
      if (goalCost.has(id)) offer(count, g + goalCost.get(id), id);
      const x = id % cols, y = Math.floor(id / cols), a = point(id);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= cols || y + dy >= rows) continue;
        const next = id + dy * cols + dx, cost = cell * (dx && dy ? Math.SQRT2 : 1);
        if (g + cost >= scores[next] || clear(next) !== 1) continue;
        if (dx && dy && (clear(id + dx) !== 1 || clear(id + dy * cols) !== 1)) continue;
        if (straightClear(a, point(next))) offer(next, g + cost, id);
      }
    }
    return null;
  }

  function randomWalkableNear(home, range, random = Math.random, tries = 12, options = {}) {
    for (let i = 0; i < tries; i++) {
      const p = { x: home.x + (random() * 2 - 1) * range.x, y: home.y + (random() * 2 - 1) * range.y };
      if ((!options.bounds || options.bounds(p)) && straightClear(home, p)) return p;
    }
    return { ...home };
  }
  return { isWalkable, nearest, step, findPath, snapStart, randomWalkableNear, straightClear };
}
