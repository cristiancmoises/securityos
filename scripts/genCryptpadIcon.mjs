// Generates the CryptPad app icon (root 96x96 + 16/32/48/96/144 variants) as webp,
// matching the OS icon system. Run with: node scripts/genCryptpadIcon.mjs
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ICONS_DIR = "public/System/Icons";
const SIZES = [16, 32, 48, 96, 144];
const ROOT_SIZE = 96;

// A document with text lines + a small collaborator cursor, on the CryptPad blue.
const glyph = `<g transform="translate(24,24) scale(4)">
  <rect x="4" y="2.5" width="13" height="18" rx="2" fill="#fff"/>
  <rect x="6.6" y="6" width="7.8" height="1.6" rx="0.8" fill="#0f63c4"/>
  <rect x="6.6" y="9.2" width="7.8" height="1.6" rx="0.8" fill="#9bbef0"/>
  <rect x="6.6" y="12.4" width="5.2" height="1.6" rx="0.8" fill="#9bbef0"/>
  <path d="M14.5 13.5l6 2.2-2.5 1-1 2.6-2.5-5.8z" fill="#23c552" stroke="#fff" stroke-width="0.7" stroke-linejoin="round"/>
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs><linearGradient id="cp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f8bff"/><stop offset="1" stop-color="#0a5bd6"/></linearGradient></defs>
  <rect x="4" y="4" width="136" height="136" rx="32" fill="url(#cp)"/>
  ${glyph}
</svg>`;

const writeWebp = async (size, outPath) => {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).webp({ quality: 92 }).toFile(outPath);
};

await writeWebp(ROOT_SIZE, join(ICONS_DIR, "cryptpad.webp"));
for (const size of SIZES) {
  // eslint-disable-next-line no-await-in-loop
  await writeWebp(size, join(ICONS_DIR, `${size}x${size}`, "cryptpad.webp"));
}
// eslint-disable-next-line no-console
console.log(`generated cryptpad icon (root + ${SIZES.join("/")})`);
