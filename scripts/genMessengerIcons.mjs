// Generates the brand app icons for the messenger launcher apps (WhatsApp /
// Telegram / Session) as webp at the sizes the OS icon system expects: a 96x96
// root icon plus 16/32/48/96/144 size variants. Run with: node scripts/genMessengerIcons.mjs
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ICONS_DIR = "public/System/Icons";
const SIZES = [16, 32, 48, 96, 144];
const ROOT_SIZE = 96;

// Each glyph is authored in a 24x24 viewBox, centered into the 144 tile by
// translate(24,24) scale(4) (24*4 = 96, leaving a 24px margin all round).
const tile = (bg, glyph, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>${extra}</defs>
  <rect x="4" y="4" width="136" height="136" rx="32" fill="${bg}"/>
  <g transform="translate(24,24) scale(4)">${glyph}</g>
</svg>`;

const WHATSAPP = tile(
  "#25d366",
  `<path fill="#fff" d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01ZM12.04 20.15h-.003a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z"/>`
);

const TELEGRAM = tile(
  "url(#tg)",
  `<path fill="#fff" d="M21.94 4.5 2.9 11.84c-1.3.5-1.29 1.24-.24 1.56l4.88 1.52 1.89 5.8c.23.63.34.88.77.88.43 0 .62-.2 1.02-.5l2.44-2.37 5.08 3.75c.94.52 1.61.25 1.84-.87l3.34-15.74c.34-1.37-.51-1.99-1.43-1.57ZM7.6 14.2l9.86-6.22c.49-.3.94-.13.57.2l-8.43 7.6-.33 3.5-1.67-5.08Z"/>`,
  `<linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2aabee"/><stop offset="1" stop-color="#229ed9"/></linearGradient>`
);

const SESSION = tile(
  "#00f782",
  `<g fill="none" stroke="#0b3b22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.4 3.4 7.5 8 9 4.6-1.5 8-4.6 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></g>`
);

const ICONS = {
  session: SESSION,
  telegram: TELEGRAM,
  whatsapp: WHATSAPP,
};

const writeWebp = async (svg, size, outPath) => {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).webp({ quality: 92 }).toFile(outPath);
};

for (const [name, svg] of Object.entries(ICONS)) {
  // Root icon (96x96), referenced as /System/Icons/<name>.webp in directory.ts.
  // eslint-disable-next-line no-await-in-loop
  await writeWebp(svg, ROOT_SIZE, join(ICONS_DIR, `${name}.webp`));
  for (const size of SIZES) {
    // eslint-disable-next-line no-await-in-loop
    await writeWebp(svg, size, join(ICONS_DIR, `${size}x${size}`, `${name}.webp`));
  }
  // eslint-disable-next-line no-console
  console.log(`generated ${name} icon (root + ${SIZES.join("/")})`);
}
