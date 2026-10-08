// Generates logo, favicon, apple-touch-icon and PWA icons in public/ from src/logo.png.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const src = "src/logo.png";
mkdirSync("public", { recursive: true });
const out = [
  ["public/logo.png", 512],
  ["public/favicon.png", 48],
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
];
for (const [file, size] of out) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
  console.log("generated", file);
}
