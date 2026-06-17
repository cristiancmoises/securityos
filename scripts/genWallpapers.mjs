// One-off generator for the SecurityOS themed wallpaper library.
// Authors original procedural SVG art per theme, rasterizes it with rsvg-convert,
// and writes optimized WEBP files into public/Users/Public/Pictures/Wallpapers/<Theme>/.
// Nothing here ships to the client; it just produces the image assets.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 2560;
const H = 1440;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.WP_OUT || join(ROOT, "public/Users/Public/Pictures/Wallpapers");
const TMP = "/tmp/wpgen";

// ---------- tiny seeded PRNG ----------
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashSeed = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// ---------- svg builder ----------
const ctxNew = (seed) => ({ defs: [], body: [], uid: 0, r: mulberry32(seed) });
const id = (c, p) => `${p}${(c.uid += 1)}`;
const rr = (c, a, b) => a + (b - a) * c.r();
const ri = (c, a, b) => Math.floor(rr(c, a, b + 1));
const pick = (c, arr) => arr[Math.floor(c.r() * arr.length)];

const lin = (c, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => {
  const gid = id(c, "lg");
  c.defs.push(
    `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
      .map(
        ([o, col, op = 1]) =>
          `<stop offset="${o}" stop-color="${col}" stop-opacity="${op}"/>`
      )
      .join("")}</linearGradient>`
  );
  return gid;
};
const rad = (c, stops, cx, cy, rx, ry = rx) => {
  const gid = id(c, "rg");
  c.defs.push(
    `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rx}" fx="${cx}" fy="${cy}"${
      ry !== rx ? ` gradientTransform="translate(0 ${cy}) scale(1 ${ry / rx}) translate(0 ${-cy})"` : ""
    }>${stops
      .map(
        ([o, col, op = 1]) =>
          `<stop offset="${o}" stop-color="${col}" stop-opacity="${op}"/>`
      )
      .join("")}</radialGradient>`
  );
  return gid;
};
const blur = (c, std) => {
  const fid = id(c, "bl");
  c.defs.push(
    `<filter id="${fid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${std}"/></filter>`
  );
  return fid;
};
// Colored procedural cloud/nebula via fractal noise -> alpha from luminance.
const nebula = (c, hex, baseFreq, octaves) => {
  const fid = id(c, "nb");
  const { r, g, b } = hexRgb(hex);
  c.defs.push(
    `<filter id="${fid}" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${baseFreq}" numOctaves="${octaves}" seed="${ri(
        c,
        1,
        9999
      )}" stitchTiles="stitch" result="n"/>` +
      `<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0.9 0 0 0 -0.18"/>` +
      `</filter>`
  );
  return fid;
};
const grain = (c, freq, op) => {
  const fid = id(c, "gr");
  c.defs.push(
    `<filter id="${fid}" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${ri(
        c,
        1,
        9999
      )}" stitchTiles="stitch" result="n"/>` +
      `<feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${op} 0"/>` +
      `</filter>`
  );
  return fid;
};

const hexRgb = (hex) => {
  const h = hex.replace("#", "");
  return {
    r: (parseInt(h.slice(0, 2), 16) / 255).toFixed(3),
    g: (parseInt(h.slice(2, 4), 16) / 255).toFixed(3),
    b: (parseInt(h.slice(4, 6), 16) / 255).toFixed(3),
  };
};

// ---------- reusable layers ----------
const bgGrad = (c, cols, vertical = true) => {
  const g = lin(
    c,
    cols.map((col, i) => [`${(i / (cols.length - 1)) * 100}%`, col, 1]),
    0,
    0,
    vertical ? 0 : 1,
    vertical ? 1 : 0
  );
  c.body.push(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
};
const radialBg = (c, cols, cx, cy, r) => {
  const g = rad(c, cols, cx, cy, r);
  c.body.push(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
};
const nebulaLayer = (c, hex, freq, oct, op) => {
  const f = nebula(c, hex, freq, oct);
  c.body.push(
    `<rect width="${W}" height="${H}" filter="url(#${f})" opacity="${op}"/>`
  );
};
const grainLayer = (c, op = 0.05) => {
  const f = grain(c, 0.9, 0.9);
  c.body.push(`<rect width="${W}" height="${H}" filter="url(#${f})" opacity="${op}"/>`);
};
const vignette = (c, strength = 0.85) => {
  const g = rad(c, [
    ["55%", "#000000", 0],
    ["100%", "#000000", strength],
  ], W / 2, H / 2, W * 0.72);
  c.body.push(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
};
const glow = (c, cx, cy, r, hex, op = 0.5) => {
  const g = rad(c, [
    ["0%", hex, op],
    ["100%", hex, 0],
  ], cx, cy, r);
  c.body.push(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
};
const stars = (c, n, cols) => {
  const b = blur(c, 1.1);
  let s = "";
  for (let i = 0; i < n; i += 1) {
    const x = rr(c, 0, W);
    const y = rr(c, 0, H * 0.85);
    const rad2 = rr(c, 0.5, 2.2);
    const op = rr(c, 0.25, 0.95);
    const col = pick(c, cols);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad2.toFixed(2)}" fill="${col}" opacity="${op.toFixed(2)}"/>`;
    if (c.r() > 0.9)
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad2 * 2.4).toFixed(2)}" fill="${col}" opacity="${(op * 0.4).toFixed(2)}" filter="url(#${b})"/>`;
  }
  c.body.push(`<g>${s}</g>`);
};
const lightRays = (c, cx, cy, hex, count = 16, len = H * 1.3, op = 0.16) => {
  const b = blur(c, 7);
  let s = "";
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + rr(c, -0.05, 0.05);
    const w = rr(c, 0.012, 0.05);
    const x1 = cx + Math.cos(a - w) * len;
    const y1 = cy + Math.sin(a - w) * len;
    const x2 = cx + Math.cos(a + w) * len;
    const y2 = cy + Math.sin(a + w) * len;
    s += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${hex}" opacity="${(op * rr(c, 0.5, 1)).toFixed(3)}"/>`;
  }
  c.body.push(`<g filter="url(#${b})" style="mix-blend-mode:screen">${s}</g>`);
};

// particle constellation
const particles = (c, n, hex, hex2, linkDist = 220) => {
  const pts = [];
  for (let i = 0; i < n; i += 1) pts.push([rr(c, 0, W), rr(c, 0, H)]);
  let lines = "";
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dx = pts[i][0] - pts[j][0];
      const dy = pts[i][1] - pts[j][1];
      const d = Math.hypot(dx, dy);
      if (d < linkDist) {
        const op = (1 - d / linkDist) * 0.5;
        lines += `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${pts[j][0].toFixed(1)}" y2="${pts[j][1].toFixed(1)}" stroke="${hex2}" stroke-width="1" opacity="${op.toFixed(3)}"/>`;
      }
    }
  }
  const b = blur(c, 2.5);
  let dots = "";
  for (const [x, y] of pts) {
    const r = rr(c, 1.6, 4.5);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 2.6).toFixed(1)}" fill="${hex}" opacity="0.25" filter="url(#${b})"/>`;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${hex}" opacity="0.95"/>`;
  }
  c.body.push(`<g>${lines}${dots}</g>`);
};

// Matrix-style glyph rain
const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789ABCDEFｦｧｨｩ".split("");
const glyphRain = (c, headHex, tailHex, density = 1, sizePx = 26) => {
  const colW = sizePx * 1.15;
  const cols = Math.floor(W / colW);
  const b = blur(c, 4);
  let g = "";
  for (let i = 0; i < cols; i += 1) {
    if (c.r() > 0.92 * density) continue;
    const x = i * colW + colW * 0.2;
    const headY = rr(c, -H * 0.4, H);
    const len = ri(c, 8, 34);
    for (let k = 0; k < len; k += 1) {
      const y = headY - k * sizePx;
      if (y < -sizePx || y > H + sizePx) continue;
      const ch = pick(c, GLYPHS);
      if (k === 0) {
        g += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="'Sarasa Mono J', monospace" font-size="${sizePx}" fill="#eafff0" opacity="0.95">${ch}</text>`;
        g += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="'Sarasa Mono J', monospace" font-size="${sizePx}" fill="${headHex}" opacity="0.7" filter="url(#${b})">${ch}</text>`;
      } else {
        const op = Math.max(0.05, 0.85 * (1 - k / len));
        g += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="'Sarasa Mono J', monospace" font-size="${sizePx}" fill="${tailHex}" opacity="${op.toFixed(2)}">${ch}</text>`;
      }
    }
  }
  c.body.push(`<g>${g}</g>`);
};

// synthwave perspective grid floor
const perspectiveGrid = (c, hex, horizonY, vanishX, glowHex) => {
  const b = blur(c, 3);
  let g = "";
  // verticals converge to vanishing point
  for (let i = -14; i <= 14; i += 1) {
    const bx = vanishX + (i / 14) * W * 1.4;
    g += `<line x1="${vanishX}" y1="${horizonY}" x2="${bx.toFixed(1)}" y2="${H}" stroke="${hex}" stroke-width="2" opacity="0.5"/>`;
  }
  // horizontals with perspective spacing
  let y = horizonY;
  let step = 6;
  while (y < H) {
    g += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${hex}" stroke-width="${(1 + (y - horizonY) / 200).toFixed(2)}" opacity="${Math.min(0.7, 0.2 + (y - horizonY) / H).toFixed(2)}"/>`;
    y += step;
    step *= 1.32;
  }
  c.body.push(`<g filter="url(#${b})">${g}</g>`);
  c.body.push(`<rect x="0" y="${horizonY - 2}" width="${W}" height="3" fill="${glowHex}" opacity="0.8"/>`);
};

// jagged mountain ridge
const ridge = (c, baseY, amp, fill, op = 1, jag = 10) => {
  let d = `M0 ${H} L0 ${baseY.toFixed(1)} `;
  let x = 0;
  let y = baseY;
  const seg = W / jag;
  for (let i = 0; i <= jag; i += 1) {
    x = i * seg;
    y = baseY + (c.r() - 0.5) * amp;
    d += `L${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  d += `L${W} ${H} Z`;
  c.body.push(`<path d="${d}" fill="${fill}" opacity="${op}"/>`);
};

// topographic contour lines
const contours = (c, lineHex, n = 22, op = 0.5) => {
  let g = "";
  for (let i = 0; i < n; i += 1) {
    const y0 = (i / n) * H * 1.1 - H * 0.05;
    const amp = rr(c, 30, 130);
    const ph = rr(c, 0, Math.PI * 2);
    const fr = rr(c, 1.2, 3.2);
    let d = `M0 ${(y0 + Math.sin(ph) * amp).toFixed(1)} `;
    for (let x = 0; x <= W; x += 40) {
      const y = y0 + Math.sin((x / W) * Math.PI * 2 * fr + ph) * amp + Math.sin((x / W) * Math.PI * 6 + i) * amp * 0.2;
      d += `L${x} ${y.toFixed(1)} `;
    }
    g += `<path d="${d}" fill="none" stroke="${lineHex}" stroke-width="${rr(c, 1, 2.2).toFixed(2)}" opacity="${(op * rr(c, 0.4, 1)).toFixed(2)}"/>`;
  }
  c.body.push(`<g>${g}</g>`);
};

// circuit traces with pads
const circuit = (c, hex, glowHex, count = 60) => {
  const b = blur(c, 2);
  let g = "";
  for (let i = 0; i < count; i += 1) {
    let x = rr(c, 0, W);
    let y = rr(c, 0, H);
    let d = `M${x.toFixed(1)} ${y.toFixed(1)} `;
    const steps = ri(c, 2, 6);
    for (let s = 0; s < steps; s += 1) {
      if (c.r() > 0.5) x += (c.r() - 0.5) * 420;
      else y += (c.r() - 0.5) * 420;
      d += `L${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    g += `<path d="${d}" fill="none" stroke="${hex}" stroke-width="${rr(c, 1, 2.4).toFixed(2)}" opacity="${rr(c, 0.18, 0.5).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr(c, 2.5, 5).toFixed(1)}" fill="${glowHex}" opacity="0.8"/>`;
  }
  c.body.push(`<g>${g}</g>`);
  c.body.push(`<g filter="url(#${b})" opacity="0.6">${g}</g>`);
};

// hexagon grid
const hexGrid = (c, hex, glowHex) => {
  const s = 64;
  const wstep = s * 1.5;
  const hstep = Math.sqrt(3) * s;
  let g = "";
  const hexPath = (cx, cy) => {
    let p = "";
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i;
      const x = cx + s * Math.cos(a);
      const y = cy + s * Math.sin(a);
      p += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return `${p}Z`;
  };
  let col = 0;
  for (let x = -s; x < W + s; x += wstep) {
    const off = col % 2 ? hstep / 2 : 0;
    for (let y = -s + off; y < H + s; y += hstep) {
      const active = c.r() > 0.92;
      g += `<path d="${hexPath(x, y)}" fill="${active ? glowHex : "none"}" fill-opacity="${active ? 0.18 : 0}" stroke="${hex}" stroke-width="1" opacity="${rr(c, 0.12, 0.32).toFixed(2)}"/>`;
    }
    col += 1;
  }
  c.body.push(`<g>${g}</g>`);
};

const sakura = (c, n) => {
  const b = blur(c, 3);
  const cols = ["#ffd1ec", "#ff9ed6", "#ffb3df", "#ffe3f1"];
  let g = "";
  const petal = (x, y, s, rot, col, op) =>
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})" opacity="${op.toFixed(2)}"><path d="M0 0 C 6 -10 14 -8 12 2 C 18 0 18 10 8 11 C 10 18 0 20 0 12 C -10 20 -18 11 -8 11 C -18 10 -18 0 -12 2 C -14 -8 -6 -10 0 0 Z" fill="${col}"/></g>`;
  for (let i = 0; i < n; i += 1) {
    const far = c.r() > 0.6;
    g += petal(rr(c, 0, W), rr(c, 0, H), rr(c, 0.6, far ? 1.1 : 2.4), rr(c, 0, 360), pick(c, cols), far ? rr(c, 0.2, 0.45) : rr(c, 0.5, 0.9));
  }
  c.body.push(`<g>${g}</g>`);
  // a few blurred foreground petals
  let f = "";
  for (let i = 0; i < n / 6; i += 1)
    f += petal(rr(c, 0, W), rr(c, 0, H), rr(c, 2.5, 4), rr(c, 0, 360), pick(c, cols), 0.5);
  c.body.push(`<g filter="url(#${b})">${f}</g>`);
};

// ---------- signature emblems (centered) ----------
const emblemGlow = (c, cx, cy, r, hex) => glow(c, cx, cy, r, hex, 0.55);

const cross = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 14);
  const arm = s * 0.22;
  const v = `<rect x="${cx - arm / 2}" y="${cy - s}" width="${arm}" height="${s * 2}" rx="${arm / 3}"/>`;
  const hbar = `<rect x="${cx - s * 0.62}" y="${cy - s * 0.42}" width="${s * 1.24}" height="${arm}" rx="${arm / 3}"/>`;
  c.body.push(`<g fill="${glowHex}" filter="url(#${b})" opacity="0.9">${v}${hbar}</g>`);
  const grd = lin(c, [["0%", "#fff8e6"], ["100%", hex]], 0, 0, 0, 1);
  c.body.push(`<g fill="url(#${grd})">${v}${hbar}</g>`);
};

const shield = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 16);
  const d = `M${cx} ${cy - s} L${cx + s * 0.78} ${cy - s * 0.6} L${cx + s * 0.78} ${cy + s * 0.18} Q${cx + s * 0.78} ${cy + s * 0.8} ${cx} ${cy + s * 1.05} Q${cx - s * 0.78} ${cy + s * 0.8} ${cx - s * 0.78} ${cy + s * 0.18} L${cx - s * 0.78} ${cy - s * 0.6} Z`;
  c.body.push(`<path d="${d}" fill="${glowHex}" opacity="0.6" filter="url(#${b})"/>`);
  const grd = lin(c, [["0%", glowHex, 0.25], ["100%", "#02060f", 0.15]], 0, 0, 0, 1);
  c.body.push(`<path d="${d}" fill="url(#${grd})" stroke="${hex}" stroke-width="6"/>`);
  // keyhole
  c.body.push(`<circle cx="${cx}" cy="${cy - s * 0.05}" r="${s * 0.16}" fill="${hex}"/>`);
  c.body.push(`<path d="M${cx - s * 0.07} ${cy} L${cx + s * 0.07} ${cy} L${cx + s * 0.12} ${cy + s * 0.34} L${cx - s * 0.12} ${cy + s * 0.34} Z" fill="${hex}"/>`);
};

const padlock = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 14);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 1.1}" fill="${glowHex}" opacity="0.4" filter="url(#${b})"/>`);
  // shackle (open)
  c.body.push(`<path d="M${cx - s * 0.5} ${cy - s * 0.2} L${cx - s * 0.5} ${cy - s * 0.7} A ${s * 0.5} ${s * 0.5} 0 0 1 ${cx + s * 0.5} ${cy - s * 0.95}" fill="none" stroke="${hex}" stroke-width="${s * 0.16}" stroke-linecap="round"/>`);
  const grd = lin(c, [["0%", glowHex], ["100%", hex]], 0, 0, 0, 1);
  c.body.push(`<rect x="${cx - s * 0.62}" y="${cy - s * 0.18}" width="${s * 1.24}" height="${s * 0.95}" rx="${s * 0.12}" fill="url(#${grd})"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy + s * 0.22}" r="${s * 0.13}" fill="#04140c"/>`);
  c.body.push(`<rect x="${cx - s * 0.05}" y="${cy + s * 0.22}" width="${s * 0.1}" height="${s * 0.28}" fill="#04140c"/>`);
};

const mask = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 16);
  c.body.push(`<ellipse cx="${cx}" cy="${cy}" rx="${s * 1.2}" ry="${s * 1.35}" fill="${glowHex}" opacity="0.45" filter="url(#${b})"/>`);
  const grd = lin(c, [["0%", "#f4f0ff"], ["100%", "#cfc4ec"]], 0, 0, 0, 1);
  // face
  c.body.push(`<path d="M${cx} ${cy - s} Q${cx + s * 0.9} ${cy - s * 0.9} ${cx + s * 0.7} ${cy + s * 0.2} Q${cx + s * 0.45} ${cy + s} ${cx} ${cy + s * 1.25} Q${cx - s * 0.45} ${cy + s} ${cx - s * 0.7} ${cy + s * 0.2} Q${cx - s * 0.9} ${cy - s * 0.9} ${cx} ${cy - s} Z" fill="url(#${grd})" stroke="${hex}" stroke-width="3"/>`);
  // eyes
  c.body.push(`<path d="M${cx - s * 0.45} ${cy - s * 0.15} q${s * 0.2} ${-s * 0.18} ${s * 0.34} 0 q${-s * 0.17} ${s * 0.14} ${-s * 0.34} 0 Z" fill="#2a2140"/>`);
  c.body.push(`<path d="M${cx + s * 0.11} ${cy - s * 0.15} q${s * 0.2} ${-s * 0.18} ${s * 0.34} 0 q${-s * 0.17} ${s * 0.14} ${-s * 0.34} 0 Z" fill="#2a2140"/>`);
  // smile + mustache + goatee
  c.body.push(`<path d="M${cx - s * 0.4} ${cy + s * 0.3} Q${cx} ${cy + s * 0.62} ${cx + s * 0.4} ${cy + s * 0.3}" fill="none" stroke="#2a2140" stroke-width="4"/>`);
  c.body.push(`<path d="M${cx} ${cy + s * 0.34} q${-s * 0.18} ${s * 0.05} ${-s * 0.26} ${s * 0.16} q${s * 0.16} ${-s * 0.04} ${s * 0.26} ${s * 0.18} q${s * 0.1} ${-s * 0.22} ${s * 0.26} ${-s * 0.18} q${-s * 0.08} ${-s * 0.11} ${-s * 0.26} ${-s * 0.16} Z" fill="#2a2140"/>`);
  c.body.push(`<path d="M${cx - s * 0.06} ${cy + s * 0.7} L${cx + s * 0.06} ${cy + s * 0.7} L${cx} ${cy + s * 1.0} Z" fill="#2a2140"/>`);
};

const fingerprint = (c, cx, cy, s, hex, op = 0.9) => {
  const b = blur(c, 1.2);
  let g = "";
  for (let i = 0; i < 11; i += 1) {
    const rx = s * (0.18 + i * 0.082);
    const ry = rx * rr(c, 1.05, 1.25);
    const dash = i % 3 === 0 ? `stroke-dasharray="${ri(c, 30, 90)} ${ri(c, 10, 40)}"` : "";
    const rot = rr(c, -12, 12);
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${hex}" stroke-width="${rr(c, 2, 3.4).toFixed(2)}" opacity="${(op * (1 - i * 0.03)).toFixed(2)}" ${dash} transform="rotate(${rot.toFixed(1)} ${cx} ${cy})"/>`;
  }
  c.body.push(`<g filter="url(#${b})">${g}</g>`);
};

const magnifier = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 12);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s}" fill="${glowHex}" opacity="0.3" filter="url(#${b})"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s}" fill="none" stroke="${hex}" stroke-width="${s * 0.12}"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 0.86}" fill="#0a0f12" opacity="0.35"/>`);
  c.body.push(`<line x1="${cx + s * 0.74}" y1="${cy + s * 0.74}" x2="${cx + s * 1.7}" y2="${cy + s * 1.7}" stroke="${hex}" stroke-width="${s * 0.2}" stroke-linecap="round"/>`);
};

const dnaHelix = (c, cx, hex, hex2) => {
  const b = blur(c, 3);
  let s1 = "M";
  let s2 = "M";
  const amp = 150;
  const top = -40;
  const bot = H + 40;
  let rungs = "";
  for (let y = top; y <= bot; y += 8) {
    const t = (y / H) * Math.PI * 5;
    const x1 = cx + Math.sin(t) * amp;
    const x2 = cx + Math.sin(t + Math.PI) * amp;
    s1 += `${y === top ? "" : "L"}${x1.toFixed(1)} ${y} `;
    s2 += `${y === top ? "" : "L"}${x2.toFixed(1)} ${y} `;
    if (Math.round(y) % 56 === 0) {
      const front = Math.cos(t) > 0;
      rungs += `<line x1="${x1.toFixed(1)}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${front ? hex : hex2}" stroke-width="${front ? 5 : 3}" opacity="${front ? 0.85 : 0.4}"/>`;
    }
  }
  c.body.push(`<g filter="url(#${b})" opacity="0.5"><path d="${s1}" fill="none" stroke="${hex}" stroke-width="10"/><path d="${s2}" fill="none" stroke="${hex2}" stroke-width="10"/></g>`);
  c.body.push(`<g>${rungs}<path d="${s1}" fill="none" stroke="${hex}" stroke-width="5"/><path d="${s2}" fill="none" stroke="${hex2}" stroke-width="5"/></g>`);
};

const pineEmblem = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 12);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 1.15}" fill="${glowHex}" opacity="0.3" filter="url(#${b})"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s}" fill="none" stroke="${hex}" stroke-width="4" opacity="0.8"/>`);
  const grd = lin(c, [["0%", glowHex], ["100%", hex]], 0, 0, 0, 1);
  let tree = "";
  const tiers = 3;
  for (let i = 0; i < tiers; i += 1) {
    const ty = cy - s * 0.55 + (i * s * 0.5);
    const tw = s * (0.3 + i * 0.18);
    tree += `<path d="M${cx} ${ty.toFixed(1)} L${cx + tw} ${(ty + s * 0.55).toFixed(1)} L${cx - tw} ${(ty + s * 0.55).toFixed(1)} Z" fill="url(#${grd})"/>`;
  }
  tree += `<rect x="${cx - s * 0.07}" y="${cy + s * 0.5}" width="${s * 0.14}" height="${s * 0.25}" fill="${hex}"/>`;
  c.body.push(`<g>${tree}</g>`);
};

const chip = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 16);
  c.body.push(`<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" rx="${s * 0.12}" fill="${glowHex}" opacity="0.4" filter="url(#${b})"/>`);
  const grd = lin(c, [["0%", "#0a1830"], ["100%", "#05101f"]], 0, 0, 0, 1);
  c.body.push(`<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" rx="${s * 0.1}" fill="url(#${grd})" stroke="${hex}" stroke-width="4"/>`);
  // pins
  let pins = "";
  for (let i = 0; i < 7; i += 1) {
    const t = -s + s * 0.4 + i * s * 0.28;
    for (const [px, py, w, h] of [
      [cx + t, cy - s - s * 0.22, s * 0.12, s * 0.22],
      [cx + t, cy + s, s * 0.12, s * 0.22],
      [cx - s - s * 0.22, cy + t, s * 0.22, s * 0.12],
      [cx + s, cy + t, s * 0.22, s * 0.12],
    ])
      pins += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${hex}" opacity="0.85"/>`;
  }
  c.body.push(`<g>${pins}</g>`);
  // inner core + traces
  c.body.push(`<rect x="${cx - s * 0.5}" y="${cy - s * 0.5}" width="${s}" height="${s}" rx="${s * 0.06}" fill="none" stroke="${glowHex}" stroke-width="3" opacity="0.9"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 0.18}" fill="${glowHex}"/>`);
  let tr = "";
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    tr += `<line x1="${(cx + Math.cos(a) * s * 0.18).toFixed(1)}" y1="${(cy + Math.sin(a) * s * 0.18).toFixed(1)}" x2="${(cx + Math.cos(a) * s * 0.5).toFixed(1)}" y2="${(cy + Math.sin(a) * s * 0.5).toFixed(1)}" stroke="${glowHex}" stroke-width="2.5" opacity="0.7"/>`;
  }
  c.body.push(`<g>${tr}</g>`);
};

const atom = (c, cx, cy, s, hex, glowHex) => {
  const b = blur(c, 10);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 1.1}" fill="${glowHex}" opacity="0.3" filter="url(#${b})"/>`);
  for (let i = 0; i < 3; i += 1)
    c.body.push(`<ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.38}" fill="none" stroke="${hex}" stroke-width="4" opacity="0.85" transform="rotate(${i * 60} ${cx} ${cy})"/>`);
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${s * 0.16}" fill="${glowHex}"/>`);
};

const torii = (c, cx, cy, s, hex) => {
  const col = s * 0.12;
  c.body.push(`<rect x="${cx - s * 0.62}" y="${cy - s}" width="${col}" height="${s * 2}" fill="${hex}"/>`);
  c.body.push(`<rect x="${cx + s * 0.5}" y="${cy - s}" width="${col}" height="${s * 2}" fill="${hex}"/>`);
  c.body.push(`<path d="M${cx - s * 0.95} ${cy - s} Q${cx} ${cy - s * 1.25} ${cx + s * 0.95} ${cy - s} L${cx + s * 0.95} ${cy - s * 0.78} Q${cx} ${cy - s * 0.98} ${cx - s * 0.95} ${cy - s * 0.78} Z" fill="${hex}"/>`);
  c.body.push(`<rect x="${cx - s * 0.78}" y="${cy - s * 0.55}" width="${s * 1.56}" height="${col * 0.9}" fill="${hex}"/>`);
};

const dove = (c, x, y, s, hex, op = 0.9) => {
  c.body.push(`<path d="M${x} ${y} q${s * 0.5} ${-s * 0.5} ${s} ${-s * 0.1} q${-s * 0.3} ${s * 0.05} ${-s * 0.5} ${s * 0.25} q${s * 0.5} ${-s * 0.2} ${s} ${s * 0.1}" fill="none" stroke="${hex}" stroke-width="${s * 0.12}" stroke-linecap="round" opacity="${op}"/>`);
};

// ---------- helper: HUD ring ----------
const hudRing = (c, cx, cy, r, hex, dashed = true) => {
  c.body.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${hex}" stroke-width="2" opacity="0.5" ${dashed ? `stroke-dasharray="${ri(c, 14, 30)} ${ri(c, 8, 18)}"` : ""}/>`);
};

// ---------- compose + render ----------
const svg = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${c.defs.join("")}</defs>${c.body.join("")}</svg>`;

const render = async (theme, name, build) => {
  const seed = hashSeed(`${theme}/${name}`);
  const c = ctxNew(seed);
  build(c);
  const dir = join(OUT, theme);
  mkdirSync(dir, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const svgPath = join(TMP, `${theme}-${name}.svg`);
  const pngPath = join(TMP, `${theme}-${name}.png`);
  writeFileSync(svgPath, svg(c));
  execFileSync("rsvg-convert", [svgPath, "-w", String(W), "-h", String(H), "-o", pngPath]);
  const outFile = join(dir, `${name}.webp`);
  const info = await sharp(pngPath).webp({ quality: 82, effort: 5 }).toFile(outFile);
  console.log(`  ${theme}/${name}.webp  ${(info.size / 1024).toFixed(0)}KB`);
};

// ============================================================
//  THEME RECIPES
// ============================================================
const THEMES = {
  Matrix: {
    "matrix-rain": (c) => {
      bgGrad(c, ["#02160c", "#021a0e", "#000402"]);
      glow(c, W * 0.5, H * 0.1, W * 0.6, "#00ff66", 0.18);
      glyphRain(c, "#7dffb0", "#16c25a", 1, 28);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "matrix-core": (c) => {
      radialBg(c, [["0%", "#063a20"], ["55%", "#021a0e"], ["100%", "#000301"]], W / 2, H / 2, W * 0.7);
      glyphRain(c, "#5fffa0", "#0c9c44", 0.55, 26);
      lightRays(c, W / 2, H / 2, "#00ff77", 22, H * 1.2, 0.1);
      glow(c, W / 2, H / 2, W * 0.32, "#00ff88", 0.5);
      hudRing(c, W / 2, H / 2, 360, "#39ff8d");
      hudRing(c, W / 2, H / 2, 430, "#1fae5e");
      c.body.push(`<text x="${W / 2}" y="${H / 2 + 130}" font-family="'Sarasa Mono J', monospace" font-size="380" fill="#aaffc8" opacity="0.95" text-anchor="middle">日</text>`);
      vignette(c, 0.92);
      grainLayer(c, 0.04);
    },
    "matrix-grid": (c) => {
      bgGrad(c, ["#021c10", "#011008", "#000301"]);
      glow(c, W / 2, H * 0.6, W * 0.5, "#00ff66", 0.22);
      perspectiveGrid(c, "#0bbf52", H * 0.6, W / 2, "#7dffb0");
      glyphRain(c, "#7dffb0", "#16c25a", 0.5, 24);
      vignette(c, 0.85);
      grainLayer(c, 0.04);
    },
  },

  Hacking: {
    "circuit-breach": (c) => {
      bgGrad(c, ["#06100c", "#040806", "#01040a"]);
      circuit(c, "#39ff14", "#7dff5a", 70);
      hexGrid(c, "#1c6b2e", "#39ff14");
      glow(c, W * 0.3, H * 0.7, W * 0.4, "#39ff14", 0.16);
      glow(c, W * 0.78, H * 0.25, W * 0.35, "#00e0ff", 0.14);
      vignette(c, 0.88);
      grainLayer(c, 0.05);
    },
    "root-shell": (c) => {
      bgGrad(c, ["#05100b", "#03090b", "#01060a"]);
      glow(c, W / 2, H / 2, W * 0.5, "#39ff14", 0.12);
      // terminal window
      const tw = W * 0.62;
      const th = H * 0.5;
      const tx = (W - tw) / 2;
      const ty = (H - th) / 2;
      c.body.push(`<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="16" fill="#040b08" stroke="#39ff14" stroke-width="2" opacity="0.96"/>`);
      c.body.push(`<rect x="${tx}" y="${ty}" width="${tw}" height="44" rx="16" fill="#0a1a12"/>`);
      for (let i = 0; i < 3; i += 1)
        c.body.push(`<circle cx="${tx + 28 + i * 28}" cy="${ty + 22}" r="7" fill="${["#ff5f56", "#ffbd2e", "#27c93f"][i]}"/>`);
      const lines = [
        "root@securityos:~# nmap -sS -Pn 10.0.0.0/24",
        "[+] host up: 10.0.0.7  ports: 22,80,443",
        "root@securityos:~# hydra -L users -P rock ssh://10.0.0.7",
        "[+] login: admin   pass: ********  CRACKED",
        "root@securityos:~# ssh admin@10.0.0.7",
        "Welcome. Last login from 127.0.0.1",
        "admin@target:~$ sudo -i",
        "root@target:~# whoami",
        "root",
        "root@target:~# _",
      ];
      lines.forEach((ln, i) => {
        const col = ln.startsWith("[+]") ? "#7dff5a" : ln.includes("root@") ? "#39ff14" : "#bfffcf";
        c.body.push(`<text x="${tx + 34}" y="${ty + 92 + i * 46}" font-family="'Sarasa Mono J', monospace" font-size="27" fill="${col}" opacity="0.95">${ln}</text>`);
      });
      // scanlines
      let sl = "";
      for (let y = 0; y < H; y += 4) sl += `<rect x="0" y="${y}" width="${W}" height="2" fill="#000" opacity="0.18"/>`;
      c.body.push(`<g>${sl}</g>`);
      vignette(c, 0.9);
    },
    "glitch-skull": (c) => {
      bgGrad(c, ["#0a0f12", "#06090c", "#020308"]);
      circuit(c, "#1f7d2c", "#39ff14", 40);
      // RGB split glitch bars
      let g = "";
      for (let i = 0; i < 26; i += 1) {
        const y = rr(c, 0, H);
        const h = rr(c, 4, 34);
        const x = rr(c, -40, 40);
        const col = pick(c, ["#ff2d55", "#00e0ff", "#39ff14"]);
        g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" fill="${col}" opacity="${rr(c, 0.05, 0.2).toFixed(2)}"/>`;
      }
      c.body.push(`<g style="mix-blend-mode:screen">${g}</g>`);
      glow(c, W / 2, H / 2, W * 0.4, "#ff2d55", 0.12);
      c.body.push(`<text x="${W / 2}" y="${H / 2 + 70}" font-family="'Sarasa Mono J', monospace" font-weight="bold" font-size="220" fill="#39ff14" opacity="0.9" text-anchor="middle" letter-spacing="14">ACCESS</text>`);
      c.body.push(`<text x="${W / 2}" y="${H / 2 + 200}" font-family="'Sarasa Mono J', monospace" font-size="90" fill="#ff2d55" opacity="0.85" text-anchor="middle" letter-spacing="40">GRANTED</text>`);
      vignette(c, 0.9);
      grainLayer(c, 0.06);
    },
  },

  Anonymity: {
    "constellation": (c) => {
      bgGrad(c, ["#0c0c1c", "#0a0a16", "#040408"]);
      nebulaLayer(c, "#3a2a7a", 0.0014, 4, 0.5);
      nebulaLayer(c, "#1c5a8a", 0.0022, 3, 0.32);
      particles(c, 70, "#9d86ff", "#3f6fff", 260);
      glow(c, W * 0.5, H * 0.4, W * 0.5, "#7c5cff", 0.16);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "the-mask": (c) => {
      radialBg(c, [["0%", "#1a1640"], ["55%", "#0c0a22"], ["100%", "#040308"]], W / 2, H / 2, W * 0.7);
      particles(c, 46, "#8a6cff", "#3f6fff", 230);
      lightRays(c, W / 2, H * 0.45, "#7c5cff", 20, H * 1.2, 0.12);
      glow(c, W / 2, H * 0.46, W * 0.3, "#9d86ff", 0.4);
      mask(c, W / 2, H * 0.47, 300, "#b9a7ff", "#7c5cff");
      vignette(c, 0.92);
      grainLayer(c, 0.04);
    },
    "lone-figure": (c) => {
      bgGrad(c, ["#0b0c1e", "#0c1030", "#06070f"]);
      nebulaLayer(c, "#274a9a", 0.0016, 4, 0.4);
      stars(c, 220, ["#cfe0ff", "#9d86ff", "#ffffff"]);
      glow(c, W / 2, H * 0.78, W * 0.5, "#22d3ff", 0.2);
      // hooded silhouette
      const cx = W / 2;
      const fy = H * 0.98;
      c.body.push(`<path d="M${cx} ${fy - 560} q-120 10 -150 150 q-26 120 -20 410 l-150 0 l40 -250 q-70 60 -90 250 l-30 0 q10 -360 120 -470 q-30 -40 -20 -130 q20 -150 170 -160 q150 10 170 160 q10 90 -20 130 q110 110 120 470 l-30 0 q-20 -190 -90 -250 l40 250 l-150 0 q6 -290 -20 -410 q-30 -140 -150 -150 Z" fill="#05060e"/>`);
      c.body.push(`<ellipse cx="${cx}" cy="${fy - 470}" rx="70" ry="86" fill="#0a0c18"/>`);
      vignette(c, 0.92);
      grainLayer(c, 0.04);
    },
  },

  Security: {
    "hex-defense": (c) => {
      radialBg(c, [["0%", "#0c2a5e"], ["55%", "#071634"], ["100%", "#02050e"]], W / 2, H * 0.45, W * 0.72);
      hexGrid(c, "#2257a0", "#39b6ff");
      particles(c, 54, "#5fd0ff", "#2f8fff", 250);
      for (let i = 1; i <= 4; i += 1) hudRing(c, W / 2, H * 0.47, 150 + i * 110, "#2f8fff");
      glow(c, W / 2, H * 0.47, W * 0.32, "#2f8fff", 0.32);
      glow(c, W * 0.2, H * 0.78, W * 0.34, "#00e5c0", 0.16);
      c.body.push(`<g opacity="0.16">`);
      shield(c, W / 2, H * 0.47, 240, "#7dc4ff", "#2f8fff");
      c.body.push(`</g>`);
      vignette(c, 0.86);
      grainLayer(c, 0.04);
    },
    "shield-core": (c) => {
      radialBg(c, [["0%", "#0b2350"], ["55%", "#06122a"], ["100%", "#02040c"]], W / 2, H / 2, W * 0.7);
      hexGrid(c, "#10305c", "#2f8fff");
      lightRays(c, W / 2, H / 2, "#2f8fff", 22, H * 1.2, 0.12);
      glow(c, W / 2, H / 2, W * 0.3, "#3aa0ff", 0.4);
      hudRing(c, W / 2, H / 2, 380, "#2f8fff");
      hudRing(c, W / 2, H / 2, 450, "#00e5c0");
      shield(c, W / 2, H * 0.47, 300, "#7dc4ff", "#2f8fff");
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "radar-watch": (c) => {
      radialBg(c, [["0%", "#062436"], ["60%", "#04101e"], ["100%", "#01060c"]], W / 2, H / 2, W * 0.7);
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 1; i <= 5; i += 1)
        c.body.push(`<circle cx="${cx}" cy="${cy}" r="${i * 120}" fill="none" stroke="#1d9c8a" stroke-width="2" opacity="0.5"/>`);
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        c.body.push(`<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * 620).toFixed(1)}" y2="${(cy + Math.sin(a) * 620).toFixed(1)}" stroke="#1d9c8a" stroke-width="1" opacity="0.3"/>`);
      }
      // sweep wedge
      const sg = rad(c, [["0%", "#37ffd0", 0.5], ["100%", "#37ffd0", 0]], cx, cy, 620);
      c.body.push(`<path d="M${cx} ${cy} L${cx + 620} ${cy} A620 620 0 0 0 ${(cx + Math.cos(-0.9) * 620).toFixed(1)} ${(cy + Math.sin(-0.9) * 620).toFixed(1)} Z" fill="url(#${sg})"/>`);
      // blips
      for (let i = 0; i < 9; i += 1) {
        const a = rr(c, 0, Math.PI * 2);
        const d = rr(c, 80, 580);
        c.body.push(`<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${rr(c, 4, 8).toFixed(1)}" fill="#5dffd6" opacity="0.9"/>`);
      }
      glow(c, cx, cy, W * 0.25, "#00e5c0", 0.18);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
  },

  Forensics: {
    "fingerprint-scan": (c) => {
      bgGrad(c, ["#0b0f12", "#10171b", "#050708"]);
      hexGrid(c, "#3a3320", "#ffb22e");
      fingerprint(c, W / 2, H / 2, 520, "#ffb22e", 0.8);
      // scan line
      c.body.push(`<rect x="${W / 2 - 560}" y="${H / 2 - 30}" width="1120" height="6" fill="#2fd6ff" opacity="0.8"/>`);
      glow(c, W / 2, H / 2, W * 0.4, "#ffb22e", 0.14);
      vignette(c, 0.9);
      grainLayer(c, 0.05);
    },
    "evidence-magnify": (c) => {
      radialBg(c, [["0%", "#13202a"], ["60%", "#0a1116"], ["100%", "#04070a"]], W / 2, H / 2, W * 0.7);
      fingerprint(c, W * 0.62, H * 0.52, 360, "#2fd6ff", 0.55);
      lightRays(c, W * 0.4, H * 0.4, "#ffb22e", 16, H * 1.1, 0.08);
      magnifier(c, W * 0.4, H * 0.45, 230, "#ffd27a", "#ffb22e");
      fingerprint(c, W * 0.4, H * 0.45, 200, "#ffe2b0", 0.9);
      vignette(c, 0.9);
      grainLayer(c, 0.05);
    },
    "dna-trace": (c) => {
      bgGrad(c, ["#0a1014", "#0c1820", "#04080b"]);
      nebulaLayer(c, "#1d6a8a", 0.0018, 3, 0.3);
      dnaHelix(c, W * 0.5, "#2fd6ff", "#ffb22e");
      // data ticks
      let g = "";
      for (let i = 0; i < 60; i += 1)
        g += `<rect x="${rr(c, 0, W).toFixed(1)}" y="${rr(c, 0, H).toFixed(1)}" width="${rr(c, 6, 30).toFixed(1)}" height="3" fill="#2fd6ff" opacity="${rr(c, 0.1, 0.4).toFixed(2)}"/>`;
      c.body.push(`<g>${g}</g>`);
      glow(c, W / 2, H / 2, W * 0.35, "#2fd6ff", 0.14);
      vignette(c, 0.9);
      grainLayer(c, 0.05);
    },
  },

  Anime: {
    "vapor-sunset": (c) => {
      bgGrad(c, ["#241047", "#5b1f6e", "#b23a6b", "#ff7a59"]);
      // sun with stripes
      const cx = W / 2;
      const cy = H * 0.42;
      const sg = rad(c, [["0%", "#fff2b0"], ["55%", "#ffd24d"], ["100%", "#ff5d8f"]], cx, cy, 320);
      c.body.push(`<circle cx="${cx}" cy="${cy}" r="320" fill="url(#${sg})"/>`);
      // stripes carved out of sun's lower half
      for (let i = 0; i < 7; i += 1)
        c.body.push(`<rect x="${cx - 330}" y="${cy + 40 + i * 30}" width="660" height="${10 + i * 3}" fill="#3a1252" opacity="0.9"/>`);
      stars(c, 120, ["#ffffff", "#ffd6f0", "#bda6ff"]);
      glow(c, cx, cy, W * 0.5, "#ff7ad9", 0.18);
      perspectiveGrid(c, "#ff5db0", H * 0.62, W / 2, "#ff9ee0");
      // distant mountains
      ridge(c, H * 0.62, 70, "#2a0f3e", 1, 8);
      vignette(c, 0.7);
      grainLayer(c, 0.04);
    },
    "sakura-drift": (c) => {
      bgGrad(c, ["#2a1144", "#6d2470", "#ff8a9b"]);
      glow(c, W * 0.7, H * 0.25, W * 0.5, "#ffd0e6", 0.3);
      // big soft moon
      const mg = rad(c, [["0%", "#fff6fb"], ["70%", "#ffd9ec"], ["100%", "#ffb6d6", 0]], W * 0.74, H * 0.28, 260);
      c.body.push(`<circle cx="${W * 0.74}" cy="${H * 0.28}" r="260" fill="url(#${mg})"/>`);
      sakura(c, 150);
      // branch silhouette
      c.body.push(`<path d="M0 ${H * 0.1} q300 60 520 30 q200 -28 360 70 q-180 -30 -360 0 q-240 40 -520 -10 Z" fill="#1c0a2c" opacity="0.85"/>`);
      ridge(c, H * 0.84, 50, "#240d36", 0.95, 7);
      vignette(c, 0.7);
      grainLayer(c, 0.04);
    },
    "torii-moon": (c) => {
      bgGrad(c, ["#15093a", "#3a1466", "#7a2a78"]);
      const cx = W * 0.5;
      const cy = H * 0.4;
      const mg = rad(c, [["0%", "#ffe7a8"], ["60%", "#ff9ec4"], ["100%", "#ff6aa8", 0]], cx, cy, 420);
      c.body.push(`<circle cx="${cx}" cy="${cy}" r="420" fill="url(#${mg})"/>`);
      stars(c, 160, ["#ffffff", "#ffd6f0", "#bda6ff"]);
      // water + reflection band
      c.body.push(`<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#0e0626" opacity="0.85"/>`);
      const rg = lin(c, [["0%", "#ffcaa0", 0.45], ["100%", "#ff6aa8", 0]], 0, 0, 0, 1);
      c.body.push(`<rect x="${cx - 60}" y="${H * 0.72}" width="120" height="${H * 0.28}" fill="url(#${rg})"/>`);
      torii(c, cx, H * 0.6, 240, "#160826");
      ridge(c, H * 0.72, 40, "#170828", 1, 9);
      vignette(c, 0.72);
      grainLayer(c, 0.04);
    },
  },

  Christ: {
    "radiant-cross": (c) => {
      radialBg(c, [["0%", "#2a3568"], ["45%", "#141d44"], ["100%", "#060a1c"]], W / 2, H * 0.42, W * 0.8);
      nebulaLayer(c, "#caa24a", 0.0012, 4, 0.28);
      lightRays(c, W / 2, H * 0.4, "#ffd97a", 26, H * 1.4, 0.16);
      glow(c, W / 2, H * 0.42, W * 0.34, "#ffe6a0", 0.5);
      cross(c, W / 2, H * 0.46, 330, "#ffae42", "#ffd97a");
      // dust motes
      stars(c, 120, ["#ffe9b8", "#fff4d6", "#ffd97a"]);
      dove(c, W * 0.5 - 80, H * 0.16, 160, "#fff3d0", 0.6);
      vignette(c, 0.86);
      grainLayer(c, 0.04);
    },
    "dawn-hope": (c) => {
      bgGrad(c, ["#0a1430", "#26345f", "#caa05a", "#ffcf7a"]);
      const cx = W / 2;
      const cy = H * 0.6;
      const sg = rad(c, [["0%", "#fff6d8"], ["40%", "#ffd97a"], ["100%", "#ffcf7a", 0]], cx, cy, 520);
      c.body.push(`<circle cx="${cx}" cy="${cy}" r="520" fill="url(#${sg})"/>`);
      lightRays(c, cx, cy, "#fff0c0", 24, H * 1.3, 0.12);
      stars(c, 70, ["#fff4d6", "#ffe9b8"]);
      // birds
      for (let i = 0; i < 6; i += 1)
        dove(c, rr(c, W * 0.2, W * 0.8), rr(c, H * 0.16, H * 0.36), rr(c, 40, 80), "#1a1326", 0.5);
      // hill with cross
      ridge(c, H * 0.72, 36, "#15224a", 1, 8);
      c.body.push(`<g opacity="0.95">`);
      cross(c, cx, H * 0.6, 150, "#0c1430", "#0c1430");
      c.body.push(`</g>`);
      vignette(c, 0.72);
      grainLayer(c, 0.04);
    },
    "heaven-light": (c) => {
      bgGrad(c, ["#0a1738", "#243a72", "#caa05a", "#ffe1a0"]);
      nebulaLayer(c, "#e6c266", 0.001, 4, 0.34);
      nebulaLayer(c, "#6a8ad6", 0.0016, 3, 0.18);
      lightRays(c, W * 0.5, H * 0.05, "#ffe6a0", 30, H * 1.7, 0.16);
      glow(c, W * 0.5, H * 0.08, W * 0.6, "#ffe6a0", 0.4);
      stars(c, 120, ["#ffe9b8", "#fff4d6", "#bcd0ff"]);
      glow(c, W / 2, H * 0.5, W * 0.3, "#ffd97a", 0.3);
      cross(c, W / 2, H * 0.5, 300, "#ffae42", "#ffd97a");
      dove(c, W * 0.32, H * 0.2, 120, "#fff3d0", 0.6);
      dove(c, W * 0.6, H * 0.16, 90, "#fff3d0", 0.5);
      vignette(c, 0.82);
      grainLayer(c, 0.04);
    },
  },

  Nature: {
    "aurora-peaks": (c) => {
      bgGrad(c, ["#04122a", "#0a2746", "#06140f"]);
      // aurora ribbons
      const b = blur(c, 26);
      let a = "";
      for (let i = 0; i < 4; i += 1) {
        const y0 = H * 0.18 + i * 60;
        const col = ["#39ffa8", "#46c8ff", "#b07bff", "#39ffd0"][i];
        let d = `M0 ${y0}`;
        for (let x = 0; x <= W; x += 60) d += ` L${x} ${(y0 + Math.sin(x / 320 + i) * 90 + Math.sin(x / 90) * 18).toFixed(1)}`;
        d += ` L${W} ${y0 + 220} L0 ${y0 + 220} Z`;
        a += `<path d="${d}" fill="${col}" opacity="0.22"/>`;
      }
      c.body.push(`<g filter="url(#${b})">${a}</g>`);
      stars(c, 200, ["#cfeaff", "#a6ffd9", "#ffffff"]);
      // mountains
      ridge(c, H * 0.5, 120, "#0a2236", 1, 7);
      ridge(c, H * 0.6, 150, "#08303a", 1, 6);
      // lake reflection
      c.body.push(`<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#041a16" opacity="0.85"/>`);
      const rg = lin(c, [["0%", "#39ffa8", 0.25], ["100%", "#46c8ff", 0]], 0, 0, 0, 1);
      c.body.push(`<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="url(#${rg})"/>`);
      // pines
      pineRow(c, H * 0.72, "#03110d");
      vignette(c, 0.78);
      grainLayer(c, 0.04);
    },
    "topo-forest": (c) => {
      radialBg(c, [["0%", "#0e3326"], ["55%", "#0a2018"], ["100%", "#02100c"]], W * 0.5, H * 0.4, W * 0.7);
      contours(c, "#46f0b0", 26, 0.5);
      glow(c, W * 0.7, H * 0.28, W * 0.4, "#2fc7d6", 0.16);
      glow(c, W * 0.25, H * 0.72, W * 0.4, "#36e0a0", 0.14);
      ridge(c, H * 0.84, 60, "#03140e", 1, 7);
      pineRow(c, H * 0.84, "#02120c");
      vignette(c, 0.86);
      grainLayer(c, 0.04);
    },
    "pine-emblem": (c) => {
      radialBg(c, [["0%", "#0e3a2e"], ["55%", "#072018"], ["100%", "#02100c"]], W / 2, H / 2, W * 0.7);
      contours(c, "#2aa078", 16, 0.3);
      lightRays(c, W / 2, H * 0.3, "#43e0a0", 18, H * 1.1, 0.1);
      glow(c, W / 2, H / 2, W * 0.28, "#43e0a0", 0.36);
      pineEmblem(c, W / 2, H * 0.48, 300, "#7df0c0", "#2fc7d6");
      vignette(c, 0.88);
      grainLayer(c, 0.04);
    },
  },

  Technology: {
    "circuit-flow": (c) => {
      bgGrad(c, ["#040912", "#06162e", "#020610"]);
      circuit(c, "#28b6ff", "#7cf0ff", 80);
      hexGrid(c, "#123a66", "#28b6ff");
      // data streams
      let g = "";
      for (let i = 0; i < 40; i += 1) {
        const x = rr(c, 0, W);
        const y = rr(c, 0, H);
        const len = rr(c, 40, 200);
        g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${len.toFixed(1)}" height="2" fill="#7cf0ff" opacity="${rr(c, 0.1, 0.4).toFixed(2)}"/>`;
      }
      c.body.push(`<g>${g}</g>`);
      glow(c, W * 0.3, H * 0.3, W * 0.4, "#28b6ff", 0.16);
      glow(c, W * 0.75, H * 0.7, W * 0.36, "#7c5cff", 0.14);
      vignette(c, 0.88);
      grainLayer(c, 0.04);
    },
    "chip-core": (c) => {
      radialBg(c, [["0%", "#0a2350"], ["55%", "#06122a"], ["100%", "#02040c"]], W / 2, H / 2, W * 0.7);
      circuit(c, "#1c6bb0", "#28b6ff", 50);
      lightRays(c, W / 2, H / 2, "#28b6ff", 24, H * 1.2, 0.1);
      glow(c, W / 2, H / 2, W * 0.3, "#33c6ff", 0.4);
      hudRing(c, W / 2, H / 2, 420, "#28b6ff");
      chip(c, W / 2, H / 2, 280, "#7cf0ff", "#28b6ff");
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "data-corridor": (c) => {
      bgGrad(c, ["#04091a", "#061634", "#020610"]);
      glow(c, W / 2, H * 0.5, W * 0.5, "#28b6ff", 0.2);
      perspectiveGrid(c, "#1f7ad0", H * 0.5, W / 2, "#7cf0ff");
      // mirror grid on ceiling
      c.body.push(`<g transform="translate(0 ${H}) scale(1 -1)">`);
      perspectiveGrid(c, "#1f7ad0", H * 0.5, W / 2, "#7cf0ff");
      c.body.push(`</g>`);
      particles(c, 40, "#7cf0ff", "#28b6ff", 220);
      atom(c, W / 2, H / 2, 150, "#7cf0ff", "#28b6ff");
      vignette(c, 0.84);
      grainLayer(c, 0.04);
    },
  },

  // ---- Distro / editor tribute themes (original neon homage art) ----
  Gentoo: {
    "gentoo-emerge": (c) => {
      bgGrad(c, ["#241b3a", "#1a1430", "#0a0716"]);
      hexGrid(c, "#3a2d63", "#8f78ff");
      glow(c, W * 0.5, H * 0.42, W * 0.55, "#7c5cff", 0.22);
      perspectiveGrid(c, "#5a47a0", H * 0.64, W / 2, "#b39dff");
      gentooMark(c, W / 2, H * 0.44, 300, "#cdbcff");
      glow(c, W / 2, H * 0.44, W * 0.22, "#9d86ff", 0.35);
      brandText(c, W / 2, H * 0.82, "G E N T O O", 84, "#cbb8ff", 26);
      brandText(c, W / 2, H * 0.87, "compile the world", 30, "#8f78ff", 10, 500);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "gentoo-portage": (c) => {
      radialBg(c, [["0%", "#2a2150"], ["55%", "#140f2c"], ["100%", "#05030e"]], W / 2, H / 2, W * 0.72);
      particles(c, 60, "#b39dff", "#6a4fff", 240);
      lightRays(c, W / 2, H * 0.46, "#7c5cff", 20, H * 1.2, 0.12);
      hudRing(c, W / 2, H / 2, 360, "#9d86ff");
      hudRing(c, W / 2, H / 2, 432, "#5a47a0");
      glow(c, W / 2, H / 2, W * 0.3, "#9d86ff", 0.4);
      gentooMark(c, W / 2, H / 2, 250, "#e6dcff");
      vignette(c, 0.92);
      grainLayer(c, 0.04);
    },
    "gentoo-circuit": (c) => {
      bgGrad(c, ["#150f28", "#0c0a1c", "#04030a"]);
      circuit(c, "#5a47a0", "#b39dff", 56);
      glow(c, W * 0.32, H * 0.7, W * 0.4, "#7c5cff", 0.16);
      glow(c, W * 0.78, H * 0.26, W * 0.34, "#9d86ff", 0.14);
      gentooMark(c, W * 0.78, H * 0.42, 150, "#cdbcff");
      vignette(c, 0.88);
      grainLayer(c, 0.05);
    },
  },

  Emacs: {
    "emacs-lambda": (c) => {
      radialBg(c, [["0%", "#241a44"], ["55%", "#150e2c"], ["100%", "#05030e"]], W / 2, H * 0.46, W * 0.72);
      lightRays(c, W / 2, H * 0.46, "#9b6bff", 20, H * 1.2, 0.1);
      hudRing(c, W / 2, H * 0.44, 340, "#a98bff");
      parensGlyph(c, W / 2, H * 0.44, 260, "#7d5bd0");
      lambdaGlyph(c, W / 2, H * 0.44, 200, "#e7ddff");
      glow(c, W / 2, H * 0.44, W * 0.24, "#9b6bff", 0.38);
      brandText(c, W / 2, H * 0.82, "GNU EMACS", 80, "#d9ccff", 22);
      brandText(c, W / 2, H * 0.87, "M-x butterfly", 30, "#a98bff", 10, 500);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "emacs-minibuffer": (c) => {
      bgGrad(c, ["#17112e", "#0e0a1f", "#050310"]);
      glow(c, W / 2, H / 2, W * 0.5, "#9b6bff", 0.12);
      const tw = W * 0.64;
      const th = H * 0.5;
      const tx = (W - tw) / 2;
      const ty = (H - th) / 2;
      c.body.push(`<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="14" fill="#0b0820" stroke="#9b6bff" stroke-width="2" opacity="0.96"/>`);
      c.body.push(`<rect x="${tx}" y="${ty}" width="${tw}" height="40" rx="14" fill="#1a1238"/>`);
      c.body.push(`<text x="${tx + 20}" y="${ty + 27}" font-family="'Sarasa Mono J',monospace" font-size="20" fill="#c9b6ff" opacity="0.9">*scratch* — GNU Emacs</text>`);
      const lines = [
        ";; This buffer is for text not saved.",
        "(defun hello (name)",
        '  (message "Hello, %s!" name))',
        "(hello \"SecurityOS\")",
        "",
        "M-x package-install RET magit RET",
      ];
      lines.forEach((ln, i) => {
        const col = ln.startsWith(";;") ? "#9b8bd0" : ln.startsWith("M-x") ? "#7dffb0" : "#d9ccff";
        c.body.push(`<text x="${tx + 28}" y="${ty + 86 + i * 44}" font-family="'Sarasa Mono J',monospace" font-size="26" fill="${col}" opacity="0.95">${ln}</text>`);
      });
      c.body.push(`<rect x="${tx}" y="${ty + th - 34}" width="${tw}" height="34" fill="#2a1f55"/>`);
      c.body.push(`<text x="${tx + 20}" y="${ty + th - 11}" font-family="'Sarasa Mono J',monospace" font-size="20" fill="#a98bff">-:**-  *scratch*   All  L4   (Lisp Interaction)</text>`);
      vignette(c, 0.9);
    },
    "emacs-parens": (c) => {
      bgGrad(c, ["#1b1338", "#110c24", "#05030f"]);
      hexGrid(c, "#3a2d63", "#a98bff");
      particles(c, 56, "#c9b6ff", "#7d5bd0", 230);
      parensGlyph(c, W * 0.3, H * 0.4, 130, "#9b6bff");
      parensGlyph(c, W * 0.72, H * 0.62, 110, "#7d5bd0");
      lambdaGlyph(c, W * 0.5, H * 0.5, 150, "#e7ddff");
      glow(c, W * 0.5, H * 0.5, W * 0.3, "#9b6bff", 0.18);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
  },

  Guix: {
    "guix-flow": (c) => {
      radialBg(c, [["0%", "#3a2c08"], ["50%", "#1c1404"], ["100%", "#070501"]], W / 2, H * 0.46, W * 0.72);
      lightRays(c, W / 2, H * 0.46, "#ffcf33", 22, H * 1.2, 0.1);
      hudRing(c, W / 2, H * 0.44, 350, "#ffd84d");
      glow(c, W / 2, H * 0.44, W * 0.26, "#ffcf00", 0.36);
      guixMark(c, W / 2, H * 0.44, 240, "#ffe27a");
      brandText(c, W / 2, H * 0.82, "GNU GUIX", 80, "#ffe9a3", 24);
      brandText(c, W / 2, H * 0.87, "functional · reproducible", 30, "#ffd84d", 8, 500);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "guix-scheme": (c) => {
      bgGrad(c, ["#241a06", "#160f03", "#070501"]);
      hexGrid(c, "#5a4410", "#ffd84d");
      parensGlyph(c, W / 2, H * 0.46, 280, "#c79a1e");
      lambdaGlyph(c, W / 2, H * 0.46, 210, "#ffe9a3");
      glow(c, W / 2, H * 0.46, W * 0.24, "#ffcf00", 0.3);
      brandText(c, W / 2, H * 0.84, "(guile scheme)", 36, "#ffd84d", 8, 500);
      vignette(c, 0.9);
      grainLayer(c, 0.04);
    },
    "guix-daemon": (c) => {
      bgGrad(c, ["#1c1505", "#120c03", "#060401"]);
      glow(c, W / 2, H * 0.55, W * 0.5, "#ffcf00", 0.18);
      perspectiveGrid(c, "#7a5d14", H * 0.55, W / 2, "#ffe27a");
      particles(c, 44, "#ffe27a", "#c79a1e", 220);
      guixMark(c, W / 2, H * 0.4, 170, "#ffe9a3");
      glow(c, W / 2, H * 0.4, W * 0.16, "#ffcf00", 0.3);
      vignette(c, 0.86);
      grainLayer(c, 0.04);
    },
  },
};

// pine row helper used by Nature
function pineRow(c, baseY, col) {
  let g = "";
  let x = 0;
  while (x < W) {
    const s = rr(c, 30, 90);
    const tiers = 4;
    let tree = "";
    for (let i = 0; i < tiers; i += 1) {
      const ty = baseY - s * 1.6 + i * s * 0.42;
      const tw = s * (0.28 + i * 0.16);
      tree += `<path d="M${x} ${ty.toFixed(1)} L${(x + tw).toFixed(1)} ${(ty + s * 0.55).toFixed(1)} L${(x - tw).toFixed(1)} ${(ty + s * 0.55).toFixed(1)} Z"/>`;
    }
    g += `<g fill="${col}">${tree}</g>`;
    x += rr(c, 40, 120);
  }
  c.body.push(`<g>${g}</g>`);
}

// ---- brand marks for the distro / editor tribute themes (original homage art) ----
function brandText(c, x, y, str, size, fill, spacing = 16, weight = 700) {
  c.body.push(
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="'Orbitron','Sarasa Mono J',sans-serif" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="${fill}" opacity="0.9">${str}</text>`
  );
}
// Stylized Gentoo-style swirl "g".
function gentooMark(c, cx, cy, r, fill) {
  const sw = r * 0.17;
  c.body.push(
    `<g fill="none" stroke="${fill}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" opacity="0.95">` +
      `<path d="M ${(cx + r).toFixed(1)} ${cy.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx - r * 0.15).toFixed(1)} ${(cy - r * 0.99).toFixed(1)}"/>` +
      `<path d="M ${(cx - r * 0.15).toFixed(1)} ${(cy - r * 0.99).toFixed(1)} A ${(r * 0.55).toFixed(1)} ${(r * 0.55).toFixed(1)} 0 1 0 ${(cx + r * 0.5).toFixed(1)} ${(cy - r * 0.08).toFixed(1)}"/>` +
      `</g>` +
      `<circle cx="${(cx + r).toFixed(1)}" cy="${cy.toFixed(1)}" r="${(sw * 0.75).toFixed(1)}" fill="${fill}"/>`
  );
}
// Lambda glyph (Emacs / Scheme).
function lambdaGlyph(c, cx, cy, r, fill, sw = null) {
  const w = sw || r * 0.16;
  c.body.push(
    `<g fill="none" stroke="${fill}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">` +
      `<path d="M ${(cx - r * 0.5).toFixed(1)} ${(cy + r).toFixed(1)} L ${(cx + r * 0.1).toFixed(1)} ${(cy - r).toFixed(1)}"/>` +
      `<path d="M ${(cx - r * 0.1).toFixed(1)} ${(cy - r * 0.27).toFixed(1)} L ${(cx + r * 0.5).toFixed(1)} ${(cy + r).toFixed(1)}"/>` +
      `</g>`
  );
}
// Pair of parentheses ( ) — Lisp / Scheme motif.
function parensGlyph(c, cx, cy, r, fill, sw = null) {
  const w = sw || r * 0.1;
  c.body.push(
    `<g fill="none" stroke="${fill}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="0.8">` +
      `<path d="M ${(cx - r * 1.0).toFixed(1)} ${(cy - r).toFixed(1)} A ${(r * 1.3).toFixed(1)} ${(r * 1.3).toFixed(1)} 0 0 0 ${(cx - r * 1.0).toFixed(1)} ${(cy + r).toFixed(1)}"/>` +
      `<path d="M ${(cx + r * 1.0).toFixed(1)} ${(cy - r).toFixed(1)} A ${(r * 1.3).toFixed(1)} ${(r * 1.3).toFixed(1)} 0 0 1 ${(cx + r * 1.0).toFixed(1)} ${(cy + r).toFixed(1)}"/>` +
      `</g>`
  );
}
// Flowing three-blade "G" — GNU Guix tribute mark.
function guixMark(c, cx, cy, r, fill) {
  let blades = "";
  for (let k = 0; k < 3; k += 1) {
    const a = k * 120;
    blades +=
      `<g transform="rotate(${a} ${cx} ${cy})">` +
      `<path d="M ${cx} ${(cy - r * 0.12).toFixed(1)} ` +
      `C ${(cx + r * 0.85).toFixed(1)} ${(cy - r * 0.45).toFixed(1)}, ${(cx + r * 0.62).toFixed(1)} ${(cy - r * 1.02).toFixed(1)}, ${cx} ${(cy - r * 0.98).toFixed(1)} ` +
      `C ${(cx - r * 0.34).toFixed(1)} ${(cy - r * 0.95).toFixed(1)}, ${(cx - r * 0.3).toFixed(1)} ${(cy - r * 0.5).toFixed(1)}, ${cx} ${(cy - r * 0.12).toFixed(1)} Z"/>` +
      `</g>`;
  }
  c.body.push(`<g fill="${fill}" opacity="0.92">${blades}</g>`);
}

// ============================================================
const onlyTheme = process.env.WP_THEME;
const run = async () => {
  if (process.env.WP_CLEAN) rmSync(OUT, { recursive: true, force: true });
  for (const [theme, recipes] of Object.entries(THEMES)) {
    if (onlyTheme && theme !== onlyTheme) continue;
    console.log(theme);
    for (const [name, build] of Object.entries(recipes)) {
      // eslint-disable-next-line no-await-in-loop
      await render(theme, name, build);
    }
  }
  console.log("done ->", OUT);
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
