// Pure parade helpers: who marches, in what order, which band controls make sense, and what the band status says.
import { bandPlaybackMessage } from '../music.js';

export const PARADE_ORDER = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];
export const PARADE_LAPS = 2;   // the line crosses the stage twice, then stops in a line-up

export const PARADE_LINES = {
  opening: 'Your parade! Every idea belongs here.',
  noBand: 'Visit Kiko to make a band first.',
  over: 'The parade is over. Make more, and march again!',
  complete: 'Everyone marched! You made the whole festival.',
};

// creations: getCreations(state), subject id → snapshot. Legacy completions without a creation are
// already left out by getCreations; empty or unknown entries are skipped here too.
export function paradeLineup(creations = {}) {
  const made = creations ?? {};
  return PARADE_ORDER.filter(id => made[id]).map(id => ({ id, creation: made[id] }));
}

// The first line of the parade. Without a band, it says why Play band is grayed out.
export function paradeOpening({ hasBand = false } = {}) {
  return hasBand ? PARADE_LINES.opening : `${PARADE_LINES.opening} ${PARADE_LINES.noBand}`;
}

// When the march stops, and what the unnamed line says then. laps: finished crossings of the stage;
// calm: Calm motion (the setting or the system preference), which shows the line-up at once;
// made: how many creations march. Every subject made means the whole festival is done.
// hasBand: without a band the line keeps saying why Play band is grayed out (the opening is gone by then).
export function paradeEnding({ laps = 0, calm = false, made = 0, hasBand = true } = {}) {
  const over = Boolean(calm) || laps >= PARADE_LAPS;
  if (!over) return { over: false, line: null };
  if (made >= PARADE_ORDER.length) return { over: true, line: PARADE_LINES.complete };   // the band is one of the seven
  return { over: true, line: hasBand ? PARADE_LINES.over : `${PARADE_LINES.over} ${PARADE_LINES.noBand}` };
}

// playing: the band is starting or playing (the playback controller is active).
export function paradeCommands({ hasBand = false, playing = false } = {}) {
  return [
    { id: 'play', label: 'Play band', icon: 'music', disabled: !hasBand || playing },
    { id: 'stop', label: 'Stop', icon: 'stop', disabled: !playing },
    { id: 'march', label: 'March again', icon: 'undo' },
    { id: 'village', label: 'Village', icon: 'home' },
  ];
}

// The music stage's status lines, reworded for the parade, which has no volume or friend controls
// (the same replacements the original parade screen used).
export function paradeStatus(phase, reason, band) {
  if (!band) return PARADE_LINES.noBand;
  if (reason === 'unavailable') return 'Sound could not start. The parade is still yours.';
  if (phase === 'starting') return 'Starting your band…';
  if (phase !== 'playing') return 'Music stopped';
  return bandPlaybackMessage(band)
    .replace('Invite a friend or add a note.', 'Visit Kiko to invite a friend or add a note.')
    .replace('Raise a friend’s volume to listen.', 'Visit Kiko to raise a friend’s volume.')
    .replace('Raise band volume to listen.', 'Visit Kiko to raise the band volume.')
    .replace(' Try a new sound!', '');
}

// The sunset street behind the marchers (960×388): sky, warm glow with a low pixel sun, a row of lit
// houses on the indigo band, the road, and triangle bunting on the lantern string. Flat and static.
const HOUSES = [   // [left, width, wall height, roof color]
  [8, 88, 48, 'vermilion'], [112, 72, 56, 'wood'], [196, 104, 44, 'ink'], [316, 80, 60, 'vermilion'],
  [412, 96, 48, 'wood'], [524, 72, 40, 'ink'], [612, 88, 52, 'vermilion'], [752, 96, 44, 'wood'], [864, 88, 56, 'ink'],
];
const FLAG_COLORS = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];
const rect = (x, y, w, h, attrs = '') => `<rect ${attrs}${attrs && ' '}x="${x}" y="${y}" width="${w}" height="${h}"/>`;

// A pixel disc built from 4px rows, so it stays crisp at any stage scale.
function sunRows(cx, cy, r) {
  const rows = [];
  for (let y = -r; y < r; y += 4) {
    const half = Math.floor(Math.sqrt(r * r - (y + 2) ** 2) / 4) * 4;
    if (half > 0) rows.push(rect(cx - half, cy + y, half * 2, 4));
  }
  return rows.join('');
}

function houseMarkup([x, w, h, roof], i) {
  const base = 120, top = base - h;
  const parts = [rect(x, top, w, h, `style="fill:var(${i % 2 ? '--letterbox' : '--ink-soft'})"`)];
  parts.push(rect(x - 6, top - 8, w + 12, 8, `style="fill:var(--${roof})"`));   // eave
  for (let inset = 8, y = top - 14; w - inset * 2 >= 16; inset += 8, y -= 6) parts.push(rect(x + inset, y, w - inset * 2, 6, `style="fill:var(--${roof})"`));
  const door = x + Math.floor(w / 2 / 4) * 4 - 8;
  parts.push(rect(door, base - 24, 16, 24, 'style="fill:var(--ink)"'));
  for (const wx of [x + 10, x + w - 26]) parts.push(rect(wx, top + 10, 16, 14, 'class="parade-window"'));
  return `<g class="parade-house">${parts.join('')}</g>`;
}

export function paradeBackdropMarkup() {
  const flags = Array.from({ length: 18 }, (_, i) => {
    const x = 52 + i * 52;
    return `<polygon class="parade-flag parade-flag--${i}" points="${x},0 ${x + 16},0 ${x + 8},14" style="fill:var(--${FLAG_COLORS[i % FLAG_COLORS.length]})"/>`;
  }).join('');
  return `<div class="parade-sky"></div><div class="parade-glow"></div>
    <svg class="parade-sun" viewBox="0 0 960 300" width="960" height="300" shape-rendering="crispEdges" aria-hidden="true">${sunRows(720, 214, 52)}</svg>
    <div class="parade-town"></div>
    <svg class="parade-houses" viewBox="0 0 960 120" width="960" height="120" shape-rendering="crispEdges" aria-hidden="true">${HOUSES.map(houseMarkup).join('')}</svg>
    <div class="parade-road"></div>
    <span class="parade-string"></span>
    <svg class="parade-flags" viewBox="0 0 960 16" width="960" height="16" shape-rendering="crispEdges" aria-hidden="true">${flags}</svg>`;
}
