// The hand-drawn crossroads, kept at three stage pixels per drawn pixel.
export const BACKGROUND = 'assets/village/background.png';

export const ROAD_MASK = 'assets/village/road.png';

export const STAGE = { width: 960, height: 540 };

export const HUD_ZONES = [
  { x: 0, y: 0, w: 960, h: 72 },
  { x: 0, y: 452, w: 440, h: 88 },
];

// Feet stay on stone. Neighbors leave room for each other and the festival board.
export const VILLAGE_SPOTS = {
  community: { x: 420, y: 156 },
  reading: { x: 610, y: 157 },
  writing: { x: 104, y: 350 },
  math: { x: 314, y: 350 },
  art: { x: 631, y: 315 },
  science: { x: 896, y: 350 },
  music: { x: 715, y: 440 },
};

// Furniture hugs the road edges; its two-pixel border is cut out of the walk mask.
export const STALLS = {
  community: { x: 270, y: 72, w: 128, h: 80, side: 'left' },
  reading: { x: 581, y: 72, w: 128, h: 80, side: 'above' },
  writing: { x: 40, y: 254, w: 128, h: 80, side: 'above' },
  math: { x: 250, y: 264, w: 128, h: 80, side: 'above' },
  art: { x: 640, y: 254, w: 128, h: 80, side: 'right' },
  science: { x: 832, y: 254, w: 128, h: 80, side: 'above' },
  music: { x: 724, y: 362, w: 128, h: 80, side: 'right' },
};

// Creations sit beside the stalls, with clear passages between all furniture.
export const EASELS = {
  community: { x: 310, y: 180, w: 80, h: 56 },
  reading: { x: 536, y: 180, w: 80, h: 56 },
  writing: { x: 168, y: 372, w: 80, h: 56 },
  math: { x: 317, y: 372, w: 80, h: 56 },
  art: { x: 733, y: 170, w: 80, h: 56 },
  science: { x: 880, y: 362, w: 80, h: 56 },
  music: { x: 880, y: 446, w: 80, h: 56 },
};

export const SIDE_SPOTS = {
  pip: { x: 475, y: 300 },
  nori: { x: 583, y: 425 },
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
