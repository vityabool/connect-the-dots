#!/usr/bin/env node
/**
 * Generates the brand images in web/public from SVG sources: favicon.svg, apple-touch-icon.png, icon-192.png,
 * icon-512.png and the 1200x630 social preview picture og-image.png. The results are committed, so this only has to be
 * run again when the design changes:  node scripts/make-brand-assets.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'web', 'public');
mkdirSync(out, { recursive: true });

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

/** The logo mark: three dots joined by lines on a dark rounded square. */
const logo = (size = 32, extra = '') => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"${extra}>
  <rect width="32" height="32" rx="8" fill="#0f172a"/>
  <path d="M9 22 16 10l7 12" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 22h14" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>
  <circle cx="9" cy="22" r="3.5" fill="#f8fafc"/>
  <circle cx="16" cy="10" r="3.5" fill="#f8fafc"/>
  <circle cx="23" cy="22" r="3.5" fill="#f8fafc"/>
</svg>`;

writeFileSync(join(out, 'favicon.svg'), logo(32).trim() + '\n');

// App icons: the logo on a full-bleed dark background (no transparent corners) so it looks right everywhere.
const squareIcon = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0f172a"/>
  <g transform="translate(4 4) scale(0.75)">
    <path d="M9 22 16 10l7 12" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9 22h14" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>
    <circle cx="9" cy="22" r="3.5" fill="#f8fafc"/><circle cx="16" cy="10" r="3.5" fill="#f8fafc"/><circle cx="23" cy="22" r="3.5" fill="#f8fafc"/>
  </g>
</svg>`;
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(Buffer.from(squareIcon(size))).png().toFile(join(out, name));
}

// Social preview (1200x630): a network on the right, the title on the left.
const dots = [
  [820, 150, 22], [960, 90, 26], [1090, 170, 20], [1040, 300, 28], [880, 330, 24],
  [780, 460, 20], [930, 500, 26], [1080, 470, 22], [700, 270, 18],
];
const lines = [
  [0, 1, '#38bdf8'], [1, 2, '#f472b6'], [2, 3, '#facc15'], [3, 4, '#4ade80'], [0, 4, '#a78bfa'],
  [4, 5, '#fb923c'], [4, 6, '#2dd4bf'], [3, 7, '#38bdf8'], [6, 7, '#f472b6'], [5, 6, '#facc15'], [8, 0, '#4ade80'], [8, 4, '#a78bfa'], [1, 3, '#2dd4bf'],
];
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="85%" cy="0%" r="70%"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.28"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0%" cy="20%" r="70%"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.22"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
    <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0f172a"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  ${lines.map(([a, b, c]) => `<line x1="${dots[a][0]}" y1="${dots[a][1]}" x2="${dots[b][0]}" y2="${dots[b][1]}" stroke="${c}" stroke-width="6" stroke-linecap="round" opacity="0.9"/>`).join('\n  ')}
  ${dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f8fafc" stroke="#0b1220" stroke-width="5"/>`).join('\n  ')}
  <g transform="translate(72 84) scale(2.2)">${logo(32).replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="72" y="262" font-family="${FONT}" font-size="84" font-weight="800" fill="#f8fafc">Connect</text>
  <text x="72" y="352" font-family="${FONT}" font-size="84" font-weight="800" fill="#f8fafc">the Dots</text>
  <text x="72" y="424" font-family="${FONT}" font-size="40" font-weight="700" fill="url(#t)">The Human Network</text>
  <text x="72" y="500" font-family="${FONT}" font-size="30" fill="#cbd5e1">A free team-building game for</text>
  <text x="72" y="542" font-family="${FONT}" font-size="30" fill="#cbd5e1">offsites and workshops</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(join(out, 'og-image.png'));

console.log('Brand assets written to web/public');
