// One-off generator for the animated wallpaper GIFs. Renders per-frame SVG with
// rsvg-convert, then assembles a seamlessly-looping GIF with ffmpeg (palettegen/
// paletteuse for clean color). Output -> Pictures/Wallpapers/<Theme>/<name>.gif.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1280;
const H = 720;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT =
  process.env.WP_OUT || join(ROOT, "public/Users/Public/Pictures/Wallpapers");
const TMP = "/tmp/wpgif";

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const wrap = (svgBody, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${svgBody}</svg>`;

const GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789ABCDEF".split("");

// ---- frame builders: (t in [0,1)) => svg string ----
const codeRain = () => {
  const size = 24;
  const cols = Math.floor(W / size) + 1;
  const rows = Math.floor(H / size) + 2;
  const r = mulberry32(12345);
  const colData = [];
  for (let i = 0; i < cols; i += 1) {
    const speed = [1, 1, 2, 1, 2, 3][Math.floor(r() * 6)];
    const phase = r() * rows;
    const trail = rows * (0.45 + r() * 0.4);
    const glyphs = [];
    for (let k = 0; k < rows; k += 1)
      glyphs.push(GLYPHS[Math.floor(r() * GLYPHS.length)]);
    colData.push({ speed, phase, trail, glyphs });
  }
  const defs =
    `<radialGradient id="bg" cx="50%" cy="8%" r="90%"><stop offset="0%" stop-color="#04240f"/><stop offset="60%" stop-color="#021107"/><stop offset="100%" stop-color="#000201"/></radialGradient>` +
    `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;
  return (t) => {
    let g = `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    let heads = "";
    for (let i = 0; i < cols; i += 1) {
      const cd = colData[i];
      const x = i * size + 4;
      const head = (cd.phase + t * cd.speed * rows) % rows;
      for (let rIdx = 0; rIdx < rows; rIdx += 1) {
        let d = head - rIdx;
        d = ((d % rows) + rows) % rows;
        const y = rIdx * size + size;
        const ch = cd.glyphs[rIdx];
        if (d < 1) {
          heads += `<text x="${x}" y="${y}" font-family="'Sarasa Mono J', monospace" font-size="${size}" fill="#7dffb0" opacity="0.6" filter="url(#bl)">${ch}</text>`;
          heads += `<text x="${x}" y="${y}" font-family="'Sarasa Mono J', monospace" font-size="${size}" fill="#eafff0">${ch}</text>`;
        } else if (d < cd.trail) {
          const op = Math.max(0.05, 0.9 * (1 - d / cd.trail));
          g += `<text x="${x}" y="${y}" font-family="'Sarasa Mono J', monospace" font-size="${size}" fill="#19c24f" opacity="${op.toFixed(
            2
          )}">${ch}</text>`;
        }
      }
    }
    return wrap(g + heads, defs);
  };
};

const radarSweep = () => {
  const cx = W / 2;
  const cy = H / 2;
  const R = H * 0.46;
  const r = mulberry32(777);
  const blips = [];
  for (let i = 0; i < 9; i += 1)
    blips.push([r() * Math.PI * 2, 60 + r() * (R - 80)]);
  const defs =
    `<radialGradient id="bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#062436"/><stop offset="60%" stop-color="#03101e"/><stop offset="100%" stop-color="#01060c"/></radialGradient>` +
    `<radialGradient id="sweep" cx="50%" cy="50%" r="50%" gradientUnits="userSpaceOnUse" fx="${cx}" fy="${cy}"><stop offset="0%" stop-color="#37ffd0" stop-opacity="0.55"/><stop offset="100%" stop-color="#37ffd0" stop-opacity="0"/></radialGradient>`;
  return (t) => {
    const ang = t * Math.PI * 2;
    let g = `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    for (let i = 1; i <= 5; i += 1)
      g += `<circle cx="${cx}" cy="${cy}" r="${
        (i / 5) * R
      }" fill="none" stroke="#1d9c8a" stroke-width="2" opacity="0.45"/>`;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      g += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * R).toFixed(
        1
      )}" y2="${(cy + Math.sin(a) * R).toFixed(
        1
      )}" stroke="#1d9c8a" stroke-width="1" opacity="0.28"/>`;
    }
    // sweep wedge (trailing ~55deg)
    const a0 = ang;
    const a1 = ang - 0.96;
    g += `<path d="M${cx} ${cy} L${(cx + Math.cos(a0) * R).toFixed(1)} ${(
      cy +
      Math.sin(a0) * R
    ).toFixed(1)} A${R} ${R} 0 0 0 ${(cx + Math.cos(a1) * R).toFixed(1)} ${(
      cy +
      Math.sin(a1) * R
    ).toFixed(1)} Z" fill="url(#sweep)"/>`;
    g += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a0) * R).toFixed(
      1
    )}" y2="${(cy + Math.sin(a0) * R).toFixed(
      1
    )}" stroke="#9bffe6" stroke-width="2.5"/>`;
    // blips: brighten when beam is near
    for (const [ba, bd] of blips) {
      let da = (((ang - ba) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const near = da < 1.2 ? 1 - da / 1.2 : 0.12;
      const bx = cx + Math.cos(ba) * bd;
      const by = cy + Math.sin(ba) * bd;
      g += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(
        4 +
        near * 6
      ).toFixed(1)}" fill="#5dffd6" opacity="${(0.2 + near * 0.8).toFixed(
        2
      )}"/>`;
    }
    g += `<circle cx="${cx}" cy="${cy}" r="6" fill="#9bffe6"/>`;
    const vg = `<radialGradient id="vg" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.8"/></radialGradient>`;
    g += `<rect width="${W}" height="${H}" fill="url(#vg)"/>`;
    return wrap(g, defs + vg);
  };
};

const gridDrive = (opt) => {
  const horizon = H * 0.54;
  const N = 16;
  const sun = opt.sun;
  const defs =
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${opt.sky
      .map(
        (c, i) =>
          `<stop offset="${
            (i / (opt.sky.length - 1)) * 100
          }%" stop-color="${c}"/>`
      )
      .join("")}</linearGradient>` +
    `<radialGradient id="glow" cx="50%" cy="0%" r="60%" gradientUnits="userSpaceOnUse" fx="${
      W / 2
    }" fy="${horizon}"><stop offset="0%" stop-color="${
      opt.glow
    }" stop-opacity="0.5"/><stop offset="100%" stop-color="${
      opt.glow
    }" stop-opacity="0"/></radialGradient>` +
    (sun
      ? `<radialGradient id="sun" cx="50%" cy="50%" r="50%" gradientUnits="userSpaceOnUse" fx="${
          W / 2
        }" fy="${
          horizon - 70
        }"><stop offset="0%" stop-color="#fff2b0"/><stop offset="55%" stop-color="#ffd24d"/><stop offset="100%" stop-color="#ff5d8f"/></radialGradient>`
      : "");
  return (t) => {
    let g = `<rect width="${W}" height="${horizon}" fill="url(#sky)"/>`;
    g += `<rect y="${horizon}" width="${W}" height="${
      H - horizon
    }" fill="#05030c"/>`;
    if (sun) {
      g += `<circle cx="${W / 2}" cy="${
        horizon - 70
      }" r="150" fill="url(#sun)"/>`;
      for (let i = 0; i < 6; i += 1)
        g += `<rect x="${W / 2 - 155}" y="${
          horizon - 40 + i * 22
        }" width="310" height="${6 + i * 2}" fill="${
          opt.sky[0]
        }" opacity="0.9"/>`;
    }
    // horizon glow band
    g += `<rect width="${W}" height="${H}" fill="url(#glow)"/>`;
    g += `<rect x="0" y="${horizon - 2}" width="${W}" height="3" fill="${
      opt.glow
    }"/>`;
    // moving horizontal lines (perspective)
    let lines = "";
    for (let i = 0; i < N; i += 1) {
      const z = (((i / N + t) % 1) + 1) % 1;
      const e = Math.pow(z, 2.3);
      const y = horizon + (H - horizon) * e;
      const op = Math.min(0.8, 0.1 + z * 0.8);
      const wdt = 0.6 + z * 2.6;
      lines += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(
        1
      )}" stroke="${opt.grid}" stroke-width="${wdt.toFixed(
        2
      )}" opacity="${op.toFixed(2)}"/>`;
    }
    // converging verticals (static)
    for (let i = -10; i <= 10; i += 1) {
      const bx = W / 2 + (i / 10) * W * 1.5;
      lines += `<line x1="${W / 2}" y1="${horizon}" x2="${bx.toFixed(
        1
      )}" y2="${H}" stroke="${opt.grid}" stroke-width="1.6" opacity="0.4"/>`;
    }
    g += `<g>${lines}</g>`;
    // stars in sky
    const r = mulberry32(opt.seed || 5);
    for (let i = 0; i < 70; i += 1)
      g += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * horizon).toFixed(
        1
      )}" r="${(0.5 + r() * 1.6).toFixed(2)}" fill="#ffffff" opacity="${(
        0.2 +
        r() * 0.6
      ).toFixed(2)}"/>`;
    const vg = `<radialGradient id="vg2" cx="50%" cy="50%" r="75%"><stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.7"/></radialGradient>`;
    g += `<rect width="${W}" height="${H}" fill="url(#vg2)"/>`;
    return wrap(g, defs + vg);
  };
};

const SPECS = [
  {
    theme: "Matrix",
    name: "code-rain",
    frames: 44,
    fps: 20,
    colors: 36,
    dither: "none",
    scale: "960:540",
    make: codeRain,
  },
  {
    theme: "Security",
    name: "radar-sweep",
    frames: 48,
    fps: 24,
    colors: 96,
    make: radarSweep,
  },
  {
    theme: "Anime",
    name: "neon-drive",
    frames: 48,
    fps: 24,
    colors: 128,
    make: () =>
      gridDrive({
        sky: ["#241047", "#7a2a78", "#ff5d73"],
        grid: "#ff5db0",
        glow: "#ff9ee0",
        sun: true,
        seed: 9,
      }),
  },
  {
    theme: "Technology",
    name: "grid-corridor",
    frames: 48,
    fps: 24,
    colors: 128,
    make: () =>
      gridDrive({
        sky: ["#04091a", "#061634", "#020610"],
        grid: "#28b6ff",
        glow: "#7cf0ff",
        sun: false,
        seed: 3,
      }),
  },
];

const onlyName = process.env.WP_GIF;
const run = () => {
  for (const spec of SPECS) {
    if (onlyName && spec.name !== onlyName) continue;
    const frameDir = join(TMP, spec.name);
    rmSync(frameDir, { recursive: true, force: true });
    mkdirSync(frameDir, { recursive: true });
    const frame = spec.make();
    for (let f = 0; f < spec.frames; f += 1) {
      const t = f / spec.frames;
      const svgPath = join(frameDir, `f${String(f).padStart(3, "0")}.svg`);
      const pngPath = join(frameDir, `f${String(f).padStart(3, "0")}.png`);
      writeFileSync(svgPath, frame(t));
      execFileSync("rsvg-convert", [
        svgPath,
        "-w",
        String(W),
        "-h",
        String(H),
        "-o",
        pngPath,
      ]);
    }
    const dir = join(OUT, spec.theme);
    mkdirSync(dir, { recursive: true });
    const outGif = join(dir, `${spec.name}.gif`);
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(spec.fps),
      "-i",
      join(frameDir, "f%03d.png"),
      "-vf",
      `${
        spec.scale ? `scale=${spec.scale}:flags=lanczos,` : ""
      }split[s0][s1];[s0]palettegen=max_colors=${
        spec.colors
      }:stats_mode=full[p];[s1][p]paletteuse=dither=${
        spec.dither || "bayer:bayer_scale=3"
      }:diff_mode=rectangle`,
      "-loop",
      "0",
      outGif,
    ]);
    console.log(
      `  ${spec.theme}/${spec.name}.gif  ${(
        statSync(outGif).size /
        1024 /
        1024
      ).toFixed(2)}MB`
    );
  }
  console.log("gifs done ->", OUT);
};
run();
