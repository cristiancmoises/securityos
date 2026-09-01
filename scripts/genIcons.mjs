// One-off generator for SecurityOS "Cyber-Neon Glass" app/system icons.
// Authors transparent-background SVGs and rasterizes them (rsvg-convert) to the
// five icon sizes the OS uses, writing lossless WEBP into
// public/System/Icons/<size>x<size>/<name>.webp. Nothing here ships to the client.
//
// Generated icons:
//   vaptvupt      — quantum-secure: a keyhole nucleus inside three electron orbits
//   folder        — futuristic glass folder (closed)
//   folder_back   — the back panel (behind file thumbnails)
//   folder_front  — the front pocket (overlays thumbnails; leaves the top open)
//   emacs         — neon lambda "editor" tile (generic, trademark-free placeholder)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/System/Icons");
const SIZES = [16, 32, 48, 96, 144];
const TMP = "/tmp/icongen";

const CYAN = "#10e0ff";
const CYAN_SOFT = "#7df7ff";
const MAGENTA = "#ff2bd6";

// Soft neon glow filter (cyan) reused across icons.
const glow = (id, color = CYAN, dev = 1.6) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
     <feDropShadow dx="0" dy="0" stdDeviation="${dev}" flood-color="${color}" flood-opacity="0.9"/>
   </filter>`;

const wrap = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
     <defs>${defs}</defs>${body}
   </svg>`;

// ---------- Vaptvupt: quantum-secure (orbits + keyhole nucleus) ----------
const vaptvupt = () => {
  const orbits = [0, 60, 120]
    .map(
      (a) =>
        `<ellipse cx="48" cy="48" rx="40" ry="15" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-opacity="0.85" transform="rotate(${a} 48 48)" filter="url(#g)"/>`
    )
    .join("");
  // electrons riding the orbits
  const electrons = [
    [`88`, `48`, CYAN_SOFT],
    [`28`, `15`, MAGENTA],
    [`30`, `80`, MAGENTA],
  ]
    .map(
      ([x, y, c]) =>
        `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}" filter="url(#g)"/>`
    )
    .join("");
  const defs =
    glow("g") +
    `<radialGradient id="nuc" cx="50%" cy="42%" r="65%">
       <stop offset="0%" stop-color="#0a1a26"/>
       <stop offset="70%" stop-color="#06121d"/>
       <stop offset="100%" stop-color="#03070d"/>
     </radialGradient>`;
  const body =
    `<circle cx="48" cy="48" r="44" fill="${CYAN}" fill-opacity="0.05"/>` +
    orbits +
    // nucleus
    `<circle cx="48" cy="48" r="17" fill="url(#nuc)" stroke="${CYAN}" stroke-width="2.5" filter="url(#g)"/>` +
    // keyhole (security)
    `<circle cx="48" cy="44" r="4.6" fill="${CYAN_SOFT}"/>` +
    `<path d="M45.6 47 L50.4 47 L52 56 L44 56 Z" fill="${CYAN_SOFT}"/>` +
    electrons;
  return wrap(defs, body);
};

// ---------- Folder geometry (shared) ----------
const FOLDER_DEFS =
  `<linearGradient id="fbody" x1="0" y1="0" x2="0.4" y2="1">
     <stop offset="0%" stop-color="#1a2c4e"/>
     <stop offset="100%" stop-color="#070d1a"/>
   </linearGradient>
   <linearGradient id="ffront" x1="0" y1="0" x2="0.3" y2="1">
     <stop offset="0%" stop-color="#21406e"/>
     <stop offset="100%" stop-color="#0a1830"/>
   </linearGradient>
   <linearGradient id="fedge" x1="0" y1="0" x2="1" y2="0">
     <stop offset="0%" stop-color="${CYAN}"/>
     <stop offset="100%" stop-color="${MAGENTA}"/>
   </linearGradient>` + glow("fg", CYAN, 1.3);

// back panel + tab silhouette
const folderBackBody = (topEdge = true) =>
  `<path d="M10 30 Q10 23 17 23 L36 23 Q40 23 43 27 L46 31 L80 31 Q86 31 86 37 L86 78 Q86 84 80 84 L16 84 Q10 84 10 78 Z"
     fill="url(#fbody)" stroke="${CYAN}" stroke-width="2" stroke-opacity="0.9" filter="url(#fg)"/>` +
  (topEdge
    ? `<path d="M14 33 L82 33" stroke="url(#fedge)" stroke-width="1.8"/>`
    : "");

// front pocket (covers lower body; top edge is the visible flap)
const folderFront = () =>
  `<path d="M10 50 L86 50 Q86 50 86 56 L86 78 Q86 84 80 84 L16 84 Q10 84 10 78 Z"
     fill="url(#ffront)" stroke="${CYAN}" stroke-width="2" stroke-opacity="0.95" filter="url(#fg)"/>` +
  `<path d="M12 52 L84 52" stroke="url(#fedge)" stroke-width="1.8"/>`;

const folder = () =>
  wrap(FOLDER_DEFS, folderBackBody(false) + folderFrontClosed());
// closed: front face flush near the top so it reads as one shut folder, with a
// cyan->magenta neon edge, faint circuit traces and glowing nodes (futuristic).
function folderFrontClosed() {
  return (
    `<path d="M10 38 L86 38 Q86 38 86 44 L86 78 Q86 84 80 84 L16 84 Q10 84 10 78 Z"
       fill="url(#ffront)" stroke="${CYAN}" stroke-width="2" stroke-opacity="0.95" filter="url(#fg)"/>` +
    `<path d="M12 40 L84 40" stroke="url(#fedge)" stroke-width="1.8"/>` +
    `<g stroke="${CYAN_SOFT}" stroke-opacity="0.22" stroke-width="1" fill="none">
       <path d="M20 58 H40 V68"/>
       <path d="M66 52 V62 H78"/>
     </g>` +
    `<circle cx="40" cy="68" r="2.4" fill="${MAGENTA}"/>` +
    `<circle cx="78" cy="62" r="2" fill="${CYAN_SOFT}"/>`
  );
}
const folderBack = () => wrap(FOLDER_DEFS, folderBackBody(true));
const folderFrontIcon = () => wrap(FOLDER_DEFS, folderFront());

// ---------- Emacs: neon lambda editor tile (generic placeholder) ----------
const emacs = () => {
  const defs =
    glow("eg", "#b388ff", 1.6) +
    `<linearGradient id="etile" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#1a1430"/>
       <stop offset="100%" stop-color="#0a0716"/>
     </linearGradient>`;
  const body =
    `<rect x="10" y="10" width="76" height="76" rx="16" fill="url(#etile)" stroke="#b388ff" stroke-width="2.5" filter="url(#eg)"/>` +
    // lambda
    `<path d="M34 30 Q40 30 44 38 L58 68 M52 52 L38 70" fill="none" stroke="${CYAN_SOFT}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#eg)"/>` +
    // cursor block
    `<rect x="62" y="60" width="9" height="11" rx="1.5" fill="${MAGENTA}" fill-opacity="0.9"/>`;
  return wrap(defs, body);
};

// ---------- Undercover: Windows 11 logo (the disguise toggle) ----------
const undercover = () => {
  const defs = `<linearGradient id="win" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b8ef0"/>
      <stop offset="100%" stop-color="#1a5fc0"/>
    </linearGradient>`;
  const sq = (x, y) =>
    `<rect x="${x}" y="${y}" width="30" height="30" rx="4" fill="url(#win)"/>`;
  return wrap(defs, sq(14, 14) + sq(52, 14) + sq(14, 52) + sq(52, 52));
};

// ---------- Matrix: neon chat bubble (generic, no trademark) ----------
const matrix = () => {
  const defs =
    glow("mg") +
    `<linearGradient id="mtile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1a26"/>
      <stop offset="100%" stop-color="#040a12"/>
    </linearGradient>`;
  const body =
    `<path d="M22 18 H74 Q86 18 86 30 V54 Q86 66 74 66 H40 L26 80 V66 H22 Q10 66 10 54 V30 Q10 18 22 18 Z" fill="url(#mtile)" stroke="${CYAN}" stroke-width="2.5" filter="url(#mg)"/>` +
    `<circle cx="34" cy="42" r="4" fill="${CYAN_SOFT}"/>` +
    `<circle cx="48" cy="42" r="4" fill="${CYAN_SOFT}"/>` +
    `<circle cx="62" cy="42" r="4" fill="${MAGENTA}"/>`;
  return wrap(defs, body);
};

const ICONS = {
  vaptvupt: vaptvupt(),
  folder: folder(),
  folder_back: folderBack(),
  folder_front: folderFrontIcon(),
  emacs: emacs(),
  undercover: undercover(),
  matrix: matrix(),
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let count = 0;
for (const [name, svg] of Object.entries(ICONS)) {
  const svgPath = join(TMP, `${name}.svg`);
  writeFileSync(svgPath, svg);
  for (const size of SIZES) {
    const png = join(TMP, `${name}-${size}.png`);
    execFileSync("rsvg-convert", [
      "-w",
      String(size),
      "-h",
      String(size),
      svgPath,
      "-o",
      png,
    ]);
    const dir = join(OUT, `${size}x${size}`);
    mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    await sharp(png)
      .webp({ lossless: true })
      .toFile(join(dir, `${name}.webp`));
    count += 1;
  }
  console.log("icon ->", name, `(${SIZES.length} sizes)`);
}
console.log(`done: ${count} webp files written under ${OUT}`);
