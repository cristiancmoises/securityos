// One-off generator for SecurityOS "Cyber-Neon Glass" app/system icons.
// Authors transparent-background SVGs and rasterizes them (rsvg-convert) to the
// five icon sizes the OS uses, writing lossless WebP into
// public/System/Icons/<size>x<size>/<name>.webp plus a 96px root fallback.
//
// Generated icons:
//   vaptvupt      — quantum-secure: a keyhole nucleus inside three electron orbits
//   zupt          — current user-facing name for the quantum-secure app
//   irc           — first-party chat bubble with an IRC channel mark
//   godseye       — observability eye with a radar iris
//   wiki          — open knowledge book with a circuit-styled W
//   pinball       — neon pinball table with bumpers, ball, and flippers
//   v86           — virtual x86 CPU rendered as a luminous microchip
//   folder        — futuristic glass folder (closed)
//   folder_back   — the back panel (behind file thumbnails)
//   folder_front  — the front pocket (overlays thumbnails; leaves the top open)
//   emacs         — neon lambda "editor" tile (generic, trademark-free placeholder)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// ---------- Undercover: original neutral enterprise workspace mark ----------
const undercover = () => {
  const defs =
    glow("ug", "#65b8ff", 1.4) +
    `<linearGradient id="uc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#163c67"/>
      <stop offset="100%" stop-color="#081622"/>
    </linearGradient>`;
  const body =
    `<rect x="9" y="10" width="78" height="76" rx="18" fill="url(#uc)" stroke="#65b8ff" stroke-width="2.5" filter="url(#ug)"/>` +
    `<path d="M23 29 H73 V64 H23 Z" fill="#dff3ff" fill-opacity="0.13" stroke="#b8e2ff" stroke-width="2.3"/>` +
    `<path d="M23 39 H73 M34 29 V64" stroke="#65b8ff" stroke-width="2" opacity="0.82"/>` +
    `<path d="M46 48 L58 42 L70 48 V58 C70 67 64 73 58 76 C52 73 46 67 46 58 Z" fill="#0d2943" stroke="#8bd0ff" stroke-width="2.4"/>` +
    `<path d="M53 58 L57 62 L64 53" fill="none" stroke="#dff8ff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;

  return wrap(defs, body);
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

// ---------- IRC: first-party channel chat ----------
const irc = () => {
  const defs =
    glow("ig", "#70e6a1", 1.5) +
    `<linearGradient id="itile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#102b2a"/>
      <stop offset="100%" stop-color="#071012"/>
    </linearGradient>`;
  const body =
    `<rect x="8" y="9" width="80" height="76" rx="19" fill="url(#itile)" stroke="#70e6a1" stroke-width="2.5" filter="url(#ig)"/>` +
    `<path d="M23 26 H73 Q80 26 80 33 V56 Q80 63 73 63 H45 L32 74 V63 H23 Q16 63 16 56 V33 Q16 26 23 26 Z" fill="#071918" stroke="#b0ffd0" stroke-width="2.4"/>` +
    `<g stroke="#70e6a1" stroke-width="4.5" stroke-linecap="round">
       <path d="M39 35 L35 55 M56 35 L52 55 M30 42 H62 M28 49 H60"/>
     </g>`;

  return wrap(defs, body);
};

// ---------- GODS EYE: observability / radar iris ----------
const godsEye = () => {
  const defs =
    glow("gg", "#36e89b", 1.7) +
    `<radialGradient id="giris" cx="45%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#d8fff0"/>
      <stop offset="26%" stop-color="#36e89b"/>
      <stop offset="70%" stop-color="#0c7769"/>
      <stop offset="100%" stop-color="#041216"/>
    </radialGradient>`;
  const body =
    `<path d="M7 48 Q23 20 48 20 Q73 20 89 48 Q73 76 48 76 Q23 76 7 48 Z" fill="#07151b" stroke="#36e89b" stroke-width="3" filter="url(#gg)"/>` +
    `<circle cx="48" cy="48" r="19" fill="url(#giris)" stroke="#a8ffe0" stroke-width="2"/>` +
    `<circle cx="48" cy="48" r="7" fill="#02080b"/>` +
    `<path d="M48 27 V36 M48 60 V69 M27 48 H36 M60 48 H69" stroke="#d8fff0" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="43" cy="42" r="3" fill="#fff" fill-opacity="0.9"/>`;

  return wrap(defs, body);
};

// ---------- Wiki: open knowledge book ----------
const wiki = () => {
  const defs =
    glow("wg", "#55cfff", 1.5) +
    `<linearGradient id="wpage" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e9fbff"/>
      <stop offset="100%" stop-color="#9ddff1"/>
    </linearGradient>`;
  const body =
    `<path d="M10 22 Q28 17 47 28 V78 Q29 67 10 72 Z" fill="url(#wpage)" stroke="#55cfff" stroke-width="2.5" filter="url(#wg)"/>` +
    `<path d="M49 28 Q68 17 86 22 V72 Q67 67 49 78 Z" fill="url(#wpage)" stroke="#55cfff" stroke-width="2.5" filter="url(#wg)"/>` +
    `<path d="M48 29 V78" stroke="#087d9e" stroke-width="2.5"/>` +
    `<path d="M22 36 L28 58 L35 43 L41 58" fill="none" stroke="#075d79" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<g stroke="#0a87aa" stroke-width="2" stroke-linecap="round">
       <path d="M58 38 H76 M58 47 H73 M58 56 H77"/>
     </g>` +
    `<circle cx="76" cy="38" r="2.4" fill="#ff2bd6"/>`;

  return wrap(defs, body);
};

// ---------- Pinball: neon arcade table ----------
const pinball = () => {
  const defs =
    glow("pg", "#65dfff", 1.5) +
    `<linearGradient id="ptable" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#17294c"/>
      <stop offset="100%" stop-color="#090b1c"/>
    </linearGradient>
    <radialGradient id="pball" cx="35%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="#a8f4ff"/>
      <stop offset="100%" stop-color="#3380aa"/>
    </radialGradient>`;
  const body =
    `<path d="M27 7 H69 Q75 7 77 15 L88 79 Q90 88 81 88 H15 Q6 88 8 79 L19 15 Q21 7 27 7 Z" fill="url(#ptable)" stroke="#65dfff" stroke-width="2.5" filter="url(#pg)"/>` +
    `<path d="M24 17 Q48 8 72 17" fill="none" stroke="#ff43d1" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="33" cy="35" r="9" fill="#14283e" stroke="#ff43d1" stroke-width="3"/>` +
    `<circle cx="63" cy="42" r="8" fill="#14283e" stroke="#65dfff" stroke-width="3"/>` +
    `<circle cx="51" cy="61" r="6" fill="#14283e" stroke="#a8f4ff" stroke-width="2.5"/>` +
    `<circle cx="69" cy="23" r="5.5" fill="url(#pball)" stroke="#ffffff" stroke-width="1.2" filter="url(#pg)"/>` +
    `<path d="M25 70 L44 79 M71 70 L52 79" fill="none" stroke="#ff43d1" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="48" cy="83" r="3" fill="#65dfff"/>`;

  return wrap(defs, body);
};

// ---------- V86: virtual x86 microprocessor ----------
const v86 = () => {
  const defs =
    glow("vg", "#8b8cff", 1.5) +
    `<linearGradient id="vchip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#20255a"/>
      <stop offset="100%" stop-color="#090d24"/>
    </linearGradient>
    <linearGradient id="vmark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#70e8ff"/>
      <stop offset="100%" stop-color="#cf78ff"/>
    </linearGradient>`;
  const pins = [24, 38, 58, 72]
    .map(
      (position) =>
        `<path d="M${position} 8 V16 M${position} 80 V88 M8 ${position} H16 M80 ${position} H88" stroke="#8b8cff" stroke-width="4" stroke-linecap="round"/>`
    )
    .join("");
  const body =
    pins +
    `<rect x="16" y="16" width="64" height="64" rx="12" fill="url(#vchip)" stroke="#8b8cff" stroke-width="2.5" filter="url(#vg)"/>` +
    `<rect x="24" y="24" width="48" height="48" rx="8" fill="#070b1d" stroke="#70e8ff" stroke-width="1.5" stroke-opacity="0.75"/>` +
    `<text x="48" y="58" fill="url(#vmark)" font-family="monospace" font-size="28" font-weight="700" text-anchor="middle">86</text>` +
    `<path d="M31 65 H65" stroke="#cf78ff" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="69" cy="28" r="3" fill="#70e8ff"/>`;

  return wrap(defs, body);
};

const ICONS = {
  godseye: godsEye(),
  irc: irc(),
  pinball: pinball(),
  v86: v86(),
  vaptvupt: vaptvupt(),
  wiki: wiki(),
  zupt: vaptvupt(),
  folder: folder(),
  folder_back: folderBack(),
  folder_front: folderFrontIcon(),
  emacs: emacs(),
  undercover: undercover(),
  matrix: matrix(),
};

const requestedIcons = new Set(process.argv.slice(2));
const unknownIcons = [...requestedIcons].filter((name) => !(name in ICONS));

if (unknownIcons.length > 0) {
  throw new Error(`Unknown icon name(s): ${unknownIcons.join(", ")}`);
}

const iconsToGenerate = Object.entries(ICONS).filter(
  ([name]) => requestedIcons.size === 0 || requestedIcons.has(name)
);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let count = 0;
for (const [name, svg] of iconsToGenerate) {
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
    const sizedOutput = join(dir, `${name}.webp`);

    await sharp(png).webp({ lossless: true }).toFile(sizedOutput);
    if (size === 96) copyFileSync(sizedOutput, join(OUT, `${name}.webp`));
    count += 1;
  }
  console.log("icon ->", name, `(${SIZES.length} sizes)`);
}
console.log(`done: ${count} webp files written under ${OUT}`);
