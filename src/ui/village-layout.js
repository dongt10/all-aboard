// The hand-drawn crossroads, kept at three stage pixels per drawn pixel.
export const BACKGROUND = 'assets/village/background.png';

export const ROAD_MASK = 'assets/village/road.png';

export const STAGE = { width: 960, height: 540 };

export const HUD_ZONES = [
  { x: 0, y: 0, w: 960, h: 72 },
  { x: 0, y: 452, w: 440, h: 88 },
];

// Feet stay on stone; the full wander range reserves sprite, badge and status space.
// Reading and Music use the upper junction and the approach above the lower lamps.
export const VILLAGE_SPOTS = {
  community: { x: 420, y: 172 },
  reading: { x: 536, y: 268 },
  writing: { x: 104, y: 350 },
  math: { x: 314, y: 350 },
  art: { x: 648, y: 274 },
  science: { x: 844, y: 350 },
  music: { x: 690, y: 386 },
};

// Lamp-safe furniture; rectangles plus a two-pixel border are carved from the road.
// Upper stalls sit between the lamp silhouettes; neighbors remain within 24px.
export const STALLS = {
  community: { x: 400, y: 72, w: 128, h: 80, side: 'above' },
  reading: { x: 510, y: 164, w: 128, h: 80, side: 'above' },
  writing: { x: 40, y: 254, w: 128, h: 80, side: 'above' },
  math: { x: 256, y: 264, w: 128, h: 80, side: 'above' },
  art: { x: 659, y: 244, w: 128, h: 80, side: 'right' },
  science: { x: 832, y: 248, w: 128, h: 80, side: 'above' },
  music: { x: 702, y: 364, w: 128, h: 80, side: 'right' },
};

// Easels stay within 100px of their stalls, outside lamp metal and the junction.
// Unusable gaps are closed in the mask; all feet positions share a 28px-clear core.
export const EASELS = {
  community: { x: 270, y: 72, w: 80, h: 56 },
  reading: { x: 550, y: 72, w: 80, h: 56 },
  writing: { x: 172, y: 254, w: 80, h: 56 },
  math: { x: 260, y: 180, w: 80, h: 56 },
  art: { x: 715, y: 170, w: 80, h: 56 },
  science: { x: 715, y: 100, w: 80, h: 56 },
  music: { x: 880, y: 340, w: 80, h: 56 },
};

export const SIDE_SPOTS = {
  pip: { x: 475, y: 372 },
  nori: { x: 583, y: 475 },
};

export const WANDER = { x: 36, y: 4 };

export const PLAYER_START = { x: 490, y: 510 };

// Visible lamp bases. Three other bases are hidden by a tree or below the drawing.
export const NEAR_LAMPS = [
  { x: 8, y: 238 },
  { x: 195, y: 238 },
  { x: 369, y: 238 },
  { x: 384, y: 97 },
  { x: 645, y: 94 },
  { x: 663, y: 238 },
  { x: 909, y: 235 },
  { x: 210, y: 472 },
  { x: 384, y: 472 },
  { x: 678, y: 472 },
  { x: 885, y: 469 },
];
