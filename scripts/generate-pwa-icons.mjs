/**
 * Resize public/icons/ledger-icon.png into the PWA icon set.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SOURCE = join(ICONS_DIR, "ledger-icon.png");
const BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };

/** Maskable icons keep important pixels inside the center 80% safe zone. */
const MASKABLE_SCALE = 0.8;

async function cover(size) {
  return sharp(SOURCE).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function maskable(size) {
  const inner = Math.round(size * MASKABLE_SCALE);
  const mark = await sharp(SOURCE).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
}

mkdirSync(ICONS_DIR, { recursive: true });

const files = [
  ["icon-192.png", () => cover(192)],
  ["icon-512.png", () => cover(512)],
  ["apple-touch-icon.png", () => cover(180)],
  ["icon-maskable-192.png", () => maskable(192)],
  ["icon-maskable-512.png", () => maskable(512)],
];

for (const [name, render] of files) {
  const png = await render();
  writeFileSync(join(ICONS_DIR, name), png);
  console.log(`${name} ${png.length} bytes`);
}
