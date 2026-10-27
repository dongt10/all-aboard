import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { readPNG } from '../tests/helpers/png.js';

// Pip's front standing frame is column 1, row 0 of the 64px sprite sheet.
const { width, rgba } = readPNG(new URL('../assets/figures/pip.png', import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}
function makeIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = 64 + Math.floor(x * 64 / size), sy = Math.floor(y * 64 / size);
      const source = (sy * width + sx) * 4, target = y * (size * 4 + 1) + 1 + x * 4;
      const alpha = rgba[source + 3] / 255;
      for (let c = 0; c < 3; c++) raw[target + c] = Math.round(rgba[source + c] * alpha + [159, 220, 255][c] * (1 - alpha));
      raw[target + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), makeIcon(size));
}
