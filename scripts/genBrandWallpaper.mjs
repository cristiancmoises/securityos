// One-off generator for the SecurityOS brand wallpaper. Takes the SecurityOS
// emblem (the white "top-hat gentleman" logo) and gives it the Cyber-Neon Glass
// treatment: a cyan glow halo over a deep blue-black gradient with a faint grid,
// HUD ring and wordmark. Output -> Pictures/Wallpapers/Security/securityos-brand.webp.
// This is the default desktop wallpaper. Nothing here ships to the client.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 2560;
const H = 1440;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.BRAND_SRC || "/home/berkeley/wallpapers/sec.png";
const OUT = join(
  ROOT,
  "public/Users/Public/Pictures/Wallpapers/Security/securityos-brand.webp"
);

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="base" cx="50%" cy="46%" r="75%">
      <stop offset="0%" stop-color="#0b1426"/>
      <stop offset="55%" stop-color="#070b16"/>
      <stop offset="100%" stop-color="#04050b"/>
    </radialGradient>
    <radialGradient id="cyan" cx="50%" cy="46%" r="42%">
      <stop offset="0%" stop-color="#10e0ff" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#10e0ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mag" cx="92%" cy="92%" r="55%">
      <stop offset="0%" stop-color="#ff2bd6" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#ff2bd6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#cyan)"/>
  <rect width="${W}" height="${H}" fill="url(#mag)"/>
  <g stroke="#10e0ff" stroke-opacity="0.05" stroke-width="1">
    ${Array.from({ length: 33 }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="${H}"/>`).join("")}
    ${Array.from({ length: 19 }, (_, i) => `<line x1="0" y1="${i * 80}" x2="${W}" y2="${i * 80}"/>`).join("")}
  </g>
  <circle cx="${W / 2}" cy="${H * 0.46}" r="430" fill="none" stroke="#10e0ff" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="2 12"/>
  <circle cx="${W / 2}" cy="${H * 0.46}" r="510" fill="none" stroke="#10e0ff" stroke-opacity="0.08" stroke-width="1"/>
  <text x="${W / 2}" y="${H * 0.86}" text-anchor="middle" font-family="'Orbitron',sans-serif" font-weight="700" font-size="74" letter-spacing="26" fill="#dffaff" opacity="0.92">SECURITY OS</text>
  <text x="${W / 2}" y="${H * 0.905}" text-anchor="middle" font-family="monospace" font-size="26" letter-spacing="10" fill="#10e0ff" opacity="0.7">privacy &#183; anonymity &#183; security</text>
</svg>`;

writeFileSync("/tmp/brandbg.svg", bg);
execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), "/tmp/brandbg.svg", "-o", "/tmp/brandbg.png"]);

const logo = await sharp(SRC)
  .resize(Math.round(W * 0.62), Math.round(H * 0.62), { fit: "contain", background: "#000000" })
  .toBuffer();
const halo = await sharp(logo).tint({ r: 16, g: 224, b: 255 }).blur(28).toBuffer();
const core = await sharp(logo).tint({ r: 225, g: 248, b: 255 }).toBuffer();

const ox = Math.round((W - W * 0.62) / 2);
const oy = Math.round((H - H * 0.62) / 2) - Math.round(H * 0.04);

const info = await sharp("/tmp/brandbg.png")
  .composite([
    { input: halo, left: ox, top: oy, blend: "screen" },
    { input: halo, left: ox, top: oy, blend: "screen" },
    { input: core, left: ox, top: oy, blend: "screen" },
  ])
  .webp({ quality: 90 })
  .toFile(OUT);

console.log("brand wallpaper ->", OUT, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`);
