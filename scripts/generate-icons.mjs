// Generates logo, favicon, apple-touch-icon and PWA icons in public/ from src/logo.png.
// The favicon is cropped to the heart (trimming the flat background) so it stays readable at
// tab size; the other icons keep the master's padding, which doubles as the maskable safe zone.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const src = "src/logo.png";
mkdirSync("public", { recursive: true });
const out = [
  ["public/logo.png", 512, false],
  ["public/favicon.png", 48, true],
  ["public/apple-touch-icon.png", 180, false],
  ["public/icon-192.png", 192, false],
  ["public/icon-512.png", 512, false],
];

async function tightSource() {
  const { data, info } = await sharp(src).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true });
  const pad = Math.round(Math.max(info.width, info.height) * 0.06);
  return sharp(data)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .toBuffer();
}

const tight = await tightSource();
for (const [file, size, crop] of out) {
  await sharp(crop ? tight : src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: crop ? 1 : 0 } })
    .png()
    .toFile(file);
  console.log("generated", file);
}
