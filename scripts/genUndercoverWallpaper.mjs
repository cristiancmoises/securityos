// One-off generator for the "Undercover" (Windows 11 disguise) wallpaper: a light
// blue "bloom" gradient that reads as a stock Win11 background, so Undercover mode
// (dark neon -> light Win11) stays visually coherent (dark text on a light desktop).
// Output -> public/Users/Public/Pictures/Wallpapers/Undercover/win11.webp.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 2560;
const H = 1440;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "public/Users/Public/Pictures/Wallpapers/Undercover");
const OUT = join(DIR, "win11.webp");
mkdirSync(DIR, { recursive: true });

const petal = (a, dist, len, wid, grad) => {
  const r = (a * Math.PI) / 180;
  const cx = W / 2 + Math.cos(r) * dist;
  const cy = H * 0.52 + Math.sin(r) * dist;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${len}" ry="${wid}" fill="url(#${grad})" transform="rotate(${a} ${cx} ${cy})"/>`;
};
const layer = (count, off, dist, len, wid, grad) =>
  Array.from({ length: count }, (_, i) =>
    petal(off + (i / count) * 360, dist, len, wid, grad)
  ).join("");

// Layered translucent petals form an abstract "bloom" — original art in the spirit
// of a light Windows 11 wallpaper (NOT Microsoft's copyrighted Bloom image).
const petals =
  layer(8, 0, 250, 440, 150, "g2") +
  layer(8, 22.5, 380, 560, 120, "g3") +
  layer(6, 11, 130, 300, 190, "g2");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="b" cx="50%" cy="52%" r="62%">
      <stop offset="0%" stop-color="#eef4fd"/>
      <stop offset="55%" stop-color="#d7e6f7"/>
      <stop offset="100%" stop-color="#b6cdea"/>
    </radialGradient>
    <radialGradient id="g1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6fa8f0" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#6fa8f0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9ec7fb" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#9ec7fb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#b)"/>
  ${petals}
  <ellipse cx="${W / 2}" cy="${H * 0.52}" rx="620" ry="620" fill="url(#g1)"/>
</svg>`;

writeFileSync("/tmp/uc.svg", svg);
execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), "/tmp/uc.svg", "-o", "/tmp/uc.png"]);
const info = await sharp("/tmp/uc.png").webp({ quality: 88 }).toFile(OUT);
console.log("undercover wallpaper ->", OUT, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`);
