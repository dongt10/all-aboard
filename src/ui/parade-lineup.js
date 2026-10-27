// Pure parade helpers: who marches, in what order, which band controls make sense, and what the band status says.
import { bandPlaybackMessage } from '../music.js';

export const PARADE_ORDER = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];
export const PARADE_LAPS = 2;   // one full crossing, then a second pass stops in a line-up

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

// When the march stops, and what the unnamed line says then. laps: finished animation passes;
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
  if (phase !== 'playing') return 'Music stopped.';
  return bandPlaybackMessage(band)
    .replace('Everyone is resting. Invite a friend or add a note.', 'Everyone is resting. Visit Kiko to add a note.')
    .replace('Your friends are muted. Raise a friend’s volume to listen.', 'Friends are muted. Visit Kiko to turn them up.')
    .replace('Band is playing with sound off. Raise band volume to listen.', 'Sound is off. Visit Kiko to turn it up.')
    .replace(' Try a new sound!', '');
}

// The sunset street behind the marchers (960×388). All silhouettes use filled, integer-aligned
// pixels: a one-pixel ink edge, a top-left highlight and a darker lower edge.
const HOUSES = [   // [left, width, wall height, roof color]
  [8, 88, 48, 'vermilion'], [112, 72, 56, 'wood'], [196, 104, 44, 'ink'], [316, 80, 60, 'vermilion'],
  [412, 96, 48, 'wood'], [524, 72, 40, 'ink'], [612, 88, 52, 'vermilion'], [752, 96, 44, 'wood'], [864, 88, 56, 'ink'],
];
const FLAG_COLORS = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];
const FLAG_SHADES = ['#c96d2c', '#26998d', '#c75c90', '#367394', '#8166bc', 'var(--grass-dark)', '#ca9231'];
const rect = (x, y, w, h, attrs = '') => `<rect ${attrs}${attrs && ' '}x="${x}" y="${y}" width="${w}" height="${h}"/>`;

// A disc with 4px steps in its silhouette and a 1px ink boundary, including at each step.
function sunRows(cx, cy, r) {
  const rows = [];
  const halfAt = y => Math.abs(y) >= r ? 0 : Math.floor(Math.sqrt(r * r - (Math.floor(y / 4) * 4 + 2) ** 2) / 4) * 4;
  for (let y = -r; y < r; y++) {
    const half = halfAt(y);
    if (!half) continue;
    rows.push(rect(cx - half, cy + y, half * 2, 1, 'fill="var(--ink)"'));
    const inner = Math.min(half - 1, halfAt(y - 1), halfAt(y + 1));
    if (inner > 0) {
      const tone = y < -24 ? '--paper' : y < 0 ? '--lantern' : '--math';
      rows.push(rect(cx - inner, cy + y, inner * 2, 1, `fill="var(${tone})"`));
      if (y >= -24 && y < 0) rows.push(rect(cx - inner, cy + y, Math.min(4, inner * 2), 1, 'fill="var(--paper)"'));
    }
  }
  return rows.join('');
}

function houseMarkup([x, w, h, roof], i) {
  const base = 120, top = base - h;
  const wall = i % 2 ? '--letterbox' : '--ink-soft';
  const roofTones = {
    vermilion: ['var(--vermilion)', '#f77752', '#9f382f'],
    wood: ['var(--wood)', '#dda475', '#855034'],
    ink: ['var(--ink-soft)', '#7278a3', 'var(--letterbox)'],
  };
  const [roofBase, roofLight, roofShade] = roofTones[roof];
  const parts = [rect(x, top, w, h, 'fill="var(--ink)"'), rect(x + 1, top + 1, w - 2, h - 2, `fill="var(${wall})"`),
    rect(x + 1, top + 1, 3, h - 2, 'fill="#7278a3"'), rect(x + 4, base - 5, w - 5, 4, 'fill="var(--letterbox)"')];
  const tileRow = (left, y, width, height) => {
    parts.push(rect(left, y, width, height, 'fill="var(--ink)"'), rect(left + 1, y + 1, width - 2, height - 2, `fill="${roofBase}"`),
      rect(left + 1, y + 1, width - 2, 1, `fill="${roofLight}"`), rect(left + 1, y + height - 3, width - 2, 2, `fill="${roofShade}"`));
    for (let seam = left + 12; seam < left + width - 4; seam += 16) parts.push(rect(seam, y + 2, 1, height - 3, `fill="${roofShade}"`));
  };
  tileRow(x - 6, top - 8, w + 12, 8);
  for (let inset = 8, y = top - 14; w - inset * 2 >= 16; inset += 8, y -= 6) tileRow(x + inset, y, w - inset * 2, 6);
  const door = x + Math.floor(w / 2 / 4) * 4 - 8;
  parts.push(rect(door, base - 24, 16, 24, 'fill="var(--ink)"'), rect(door + 1, base - 23, 14, 22, 'fill="var(--wood)"'),
    rect(door + 1, base - 23, 2, 22, 'fill="#dda475"'), rect(door + 12, base - 21, 3, 20, 'fill="#855034"'),
    rect(door + 7, base - 21, 1, 20, 'fill="#855034"'), rect(door + 10, base - 13, 2, 2, 'fill="var(--lantern)"'));
  for (const wx of [x + 10, x + w - 26]) {
    parts.push(rect(wx, top + 10, 16, 14, 'class="parade-window"'), rect(wx + 1, top + 11, 14, 12, 'fill="var(--lantern)"'),
      rect(wx + 1, top + 11, 14, 2, 'fill="var(--paper)"'), rect(wx + 1, top + 13, 2, 8, 'fill="var(--paper)"'),
      rect(wx + 3, top + 21, 12, 2, 'fill="#ca9231"'), rect(wx + 7, top + 11, 1, 12, 'fill="var(--ink)"'),
      rect(wx + 1, top + 17, 14, 1, 'fill="var(--ink)"'), rect(wx - 1, top + 24, 18, 2, 'fill="var(--ink)"'));
  }
  for (const by of [base - 9, base - 5]) parts.push(rect(x + 8, by, 12, 1, 'fill="#7278a3"'), rect(x + w - 20, by, 8, 1, 'fill="var(--ink)"'));
  return `<g class="parade-house">${parts.join('')}</g>`;
}

export function paradeBackdropMarkup() {
  const flags = Array.from({ length: 18 }, (_, i) => {
    const x = 52 + i * 52;
    const fill = `var(--${FLAG_COLORS[i % FLAG_COLORS.length]})`;
    const rows = Array.from({ length: 7 }, (_, step) => {
      const inset = step, y = step * 2, width = 16 - step * 2;
      return rect(inset, y, width, 2, 'fill="var(--ink)"')
        + rect(inset + 1, y + (step === 0 ? 1 : 0), width - 2, step === 0 || step === 6 ? 1 : 2, `fill="${fill}"`)
        + rect(inset + width - 2, y + (step === 0 ? 1 : 0), 1, step === 0 || step === 6 ? 1 : 2, `fill="${FLAG_SHADES[i % FLAG_SHADES.length]}"`)
        + (step < 5 ? rect(inset + 1, y + 1, 1, 1, 'fill="var(--paper)"') : '');
    }).join('');
    return `<g class="parade-flag parade-flag--${i}" transform="translate(${x} 0)">${rows}</g>`;
  }).join('');
  return `<div class="parade-sky"></div><div class="parade-glow"></div>
    <svg class="parade-sun" viewBox="0 0 960 300" width="960" height="300" shape-rendering="crispEdges" aria-hidden="true">${sunRows(720, 214, 52)}</svg>
    <div class="parade-town"></div>
    <svg class="parade-houses" viewBox="0 0 960 120" width="960" height="120" shape-rendering="crispEdges" aria-hidden="true">${HOUSES.map(houseMarkup).join('')}</svg>
    <div class="parade-road"></div>
    <span class="parade-string"></span>
    <svg class="parade-flags" viewBox="0 0 960 16" width="960" height="16" shape-rendering="crispEdges" aria-hidden="true">${flags}</svg>`;
}
