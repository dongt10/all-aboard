// Paint two 16x16 lamp-head frames, unlit then lit. Run: node scripts/draw-lamp-glow.js
// As in draw-stalls.js: black one-pixel outline, flat tones and upper-left light.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { LANTERN, VERMILION } from '../src/ui/palette.js';

const W = 32, H = 16, px = Array(W * H).fill(null);
const set = (frame, x, y, color) => { px[y * W + frame * 16 + x] = color; };
// A stepped, translucent halo; each pixel has one flat color, with no blur.
for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
  const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
  if (d <= 8) set(1, x, y, `${LANTERN}35`);
  if (d <= 6) set(1, x, y, `${LANTERN}70`);
}
const shape = [
  '...kk...', '..krrk..', '.krrrrk.', '.kggggk.', '.kggggk.', '.kggggk.', '..kkkk..', '...kk...',
];
for (let frame = 0; frame < 2; frame++) for (let y = 0; y < shape.length; y++) for (let x = 0; x < 8; x++) {
  const c = shape[y][x];
  if (c === '.') continue;
  const color = c === 'k' ? '#000000' : c === 'r' ? (y === 1 && x < 4 ? '#f0694a' : VERMILION)
    : frame === 0 ? (x < 4 ? '#d5b88b' : '#a8791e') : (x < 4 ? '#fff6cf' : LANTERN);
  set(frame, x + 4, y + 4, color);
}
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(data.length);
  let crc = 0xffffffff; for (const b of Buffer.concat([name, data])) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
  sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0); return Buffer.concat([size, name, data, sum]);
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = px[y * W + x]; if (!c) continue;
  const n = parseInt(c.slice(1, 7), 16), at = y * (W * 4 + 1) + 1 + x * 4;
  raw[at] = n >> 16; raw[at + 1] = n >> 8 & 255; raw[at + 2] = n & 255; raw[at + 3] = c.length > 7 ? parseInt(c.slice(7), 16) : 255;
}
const header = Buffer.alloc(13); header.writeUInt32BE(W, 0); header.writeUInt32BE(H, 4); header[8] = 8; header[9] = 6;
writeFileSync(new URL('../assets/village/lamp-glow.png', import.meta.url), Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
