import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Decodes 8-bit RGB/RGBA, non-interlaced PNGs (what pixel editors export) into { width, height, rgba }.
export function readPNG(path) {
  const data = readFileSync(path);
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const kind = data.toString('ascii', pos + 4, pos + 8);
    const body = data.subarray(pos + 8, pos + 8 + length);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || ![2, 6].includes(type) || body[12] !== 0) throw new Error(`${path}: unsupported PNG`);
    } else if (kind === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      out[i] = (line[i] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      rgba.set([out[x * bpp], out[x * bpp + 1], out[x * bpp + 2], bpp === 4 ? out[x * bpp + 3] : 255], (y * width + x) * 4);
    }
    prev = out;
  }
  return { width, height, rgba };
}
