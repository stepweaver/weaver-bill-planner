/**
 * Rasterize the λledger home-screen mark to PNG.
 * Run: node scripts/generate-pwa-icons.mjs
 * No image libraries — Node zlib writes the PNG files.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BG = [0x0d, 0x12, 0x11];
const FG = [0x00, 0xff, 0x41];

/**
 * Stroke centers in a 0–1 box.
 * The long stroke is the right leg; the left leg branches from it, which is λ rather than Λ.
 */
const RIGHT_START = [0.44, 0.14];
const RIGHT_END = [0.78, 0.9];
const LEFT_START = [0.52, 0.34];
const LEFT_END = [0.2, 0.72];
const STROKE = 0.078;
const STROKES = [
  [RIGHT_START, RIGHT_END],
  [LEFT_START, LEFT_END],
];

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const start = y * (1 + width * 4);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function place(point, size, scale) {
  const [nx, ny] = point;
  return [(0.5 + (nx - 0.5) * scale) * size, (0.5 + (ny - 0.5) * scale) * size];
}

function render(size, scale) {
  const ss = 4;
  const big = size * ss;
  const mask = new Uint8Array(big * big);
  const radius = big * STROKE * scale;
  for (const [from, to] of STROKES) {
    const [x1, y1] = place(from, big, scale);
    const [x2, y2] = place(to, big, scale);
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 1));
    const maxX = Math.min(big - 1, Math.ceil(Math.max(x1, x2) + radius + 1));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 1));
    const maxY = Math.min(big - 1, Math.ceil(Math.max(y1, y2) + radius + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (distToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2) <= radius) {
          mask[y * big + x] = 1;
        }
      }
    }
  }

  const rgba = Buffer.alloc(size * size * 4);
  const samples = ss * ss;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      for (let oy = 0; oy < ss; oy++) {
        for (let ox = 0; ox < ss; ox++) {
          covered += mask[(y * ss + oy) * big + (x * ss + ox)];
        }
      }
      const a = covered / samples;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(BG[0] + (FG[0] - BG[0]) * a);
      rgba[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
      rgba[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["apple-touch-icon.png", 180, 1],
  ["icon-maskable-192.png", 192, 0.72],
  ["icon-maskable-512.png", 512, 0.72],
];

for (const [name, size, scale] of files) {
  const png = render(size, scale);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name} ${png.length} bytes`);
}
