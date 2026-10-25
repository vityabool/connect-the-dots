#!/usr/bin/env node
/**
 * Composes the pictures for the landing page carousel from the screenshots in docs/screenshots: browser windows and phones
 * arranged on a dark background, cropped to 16:10. Writes web/public/screens/:
 *   slide-<name>.webp        1600 x 1000, shown in the carousel
 *   slide-<name>-full.webp   3200 x 2000, shown when a visitor clicks the picture to enlarge it
 *
 *   node scripts/make-landing-slides.mjs
 *
 * Run it again after the screenshots change (docs/screenshots/README.md explains how to take them).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'docs/screenshots');
const out = join(root, 'web/public/screens');
mkdirSync(out, { recursive: true });

// Everything is drawn at twice the size (the "full" picture); the carousel picture is that, scaled down.
const S = 2;
const W = 1600 * S;
const H = 1000 * S;

/** The slide background: the same dark navy and soft colored glows as the site. */
function background() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="a" cx="85%" cy="0%" r="70%"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.22"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>
      <radialGradient id="b" cx="0%" cy="100%" r="70%"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.2"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#0b1220"/>
    <rect width="${W}" height="${H}" fill="url(#a)"/>
    <rect width="${W}" height="${H}" fill="url(#b)"/>
  </svg>`);
}

const roundedMask = (w, h, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

/** A soft shadow under a rounded rectangle, drawn on a layer as big as the slide (so it can never exceed the slide). */
const shadow = (x, y, w, h, r) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${28 * S}"/></filter></defs>
    <rect x="${x}" y="${y + 16 * S}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.55" filter="url(#s)"/>
  </svg>`);

/**
 * A screenshot in a browser window (title bar with three dots). Positions and sizes are in carousel pixels (1600 x 1000).
 * `crop` is a region {left, top, width, height} of the screenshot, or a list of regions of the same width that are stacked on
 * top of each other (to cut out empty space).
 */
async function windowLayers(file, x0, y0, width0, crop) {
  const [x, y, width] = [x0 * S, y0 * S, width0 * S];
  const meta = await sharp(join(shots, file)).metadata();
  const regions = Array.isArray(crop) ? crop : [crop ?? { left: 0, top: 0, width: meta.width, height: meta.height }];
  const region = { width: regions[0].width, height: regions.reduce((sum, r) => sum + r.height, 0) };
  const bar = 36 * S;
  const height = Math.round((width * region.height) / region.width);
  const total = height + bar;
  const radius = 18 * S;
  const parts = await Promise.all(regions.map((r) => sharp(join(shots, file)).extract(r).toBuffer()));
  let offset = 0;
  const stacked = await sharp({ create: { width: region.width, height: region.height, channels: 4, background: '#0b1220' } })
    .composite(parts.map((input, i) => ({ input, left: 0, top: (offset += i === 0 ? 0 : regions[i - 1].height) })))
    .png()
    .toBuffer();
  const image = await sharp(stacked).resize(width, height).toBuffer();
  const barSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bar}">
    <rect width="${width}" height="${bar}" fill="#17233f"/>
    <circle cx="${22 * S}" cy="${18 * S}" r="${6 * S}" fill="#fb7185"/><circle cx="${42 * S}" cy="${18 * S}" r="${6 * S}" fill="#facc15"/><circle cx="${62 * S}" cy="${18 * S}" r="${6 * S}" fill="#4ade80"/>
    <rect x="${width / 2 - 140 * S}" y="${8 * S}" width="${280 * S}" height="${20 * S}" rx="${10 * S}" fill="#0b1220" opacity="0.7"/>
  </svg>`);
  const flat = await sharp({ create: { width, height: total, channels: 4, background: '#0b1220' } })
    .composite([
      { input: barSvg, left: 0, top: 0 },
      { input: image, left: 0, top: bar },
    ])
    .png()
    .toBuffer();
  const body = await sharp(flat)
    .composite([{ input: roundedMask(width, total, radius), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const border = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}"><rect x="${S}" y="${S}" width="${width - 2 * S}" height="${total - 2 * S}" rx="${radius}" fill="none" stroke="#334155" stroke-width="${2 * S}"/></svg>`,
  );
  return [
    { input: shadow(Math.round(x), Math.round(y), width, total, radius), left: 0, top: 0 },
    { input: body, left: Math.round(x), top: Math.round(y) },
    { input: border, left: Math.round(x), top: Math.round(y) },
  ];
}

/** A phone: the screenshot (390x844 CSS pixels at 2x) with a rounded bezel. Positions and sizes are in carousel pixels. */
async function phoneLayers(file, x0, y0, width0, crop) {
  const [x, y, width] = [x0 * S, y0 * S, width0 * S];
  const meta = await sharp(join(shots, file)).metadata();
  const region = crop ?? { left: 0, top: 0, width: meta.width, height: meta.height };
  const bezel = Math.max(8 * S, Math.round(width * 0.028));
  const innerW = width - bezel * 2;
  const innerH = Math.round((innerW * region.height) / region.width);
  const height = innerH + bezel * 2;
  const radius = Math.round(width * 0.12);
  const image = await sharp(join(shots, file))
    .extract(region)
    .resize(innerW, innerH)
    .composite([{ input: roundedMask(innerW, innerH, radius - bezel), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" rx="${radius}" fill="#1e293b"/>
    <rect x="${1.5 * S}" y="${1.5 * S}" width="${width - 3 * S}" height="${height - 3 * S}" rx="${radius - S}" fill="none" stroke="#475569" stroke-width="${3 * S}"/>
  </svg>`);
  return [
    { input: shadow(Math.round(x), Math.round(y), width, height, radius), left: 0, top: 0 },
    { input: frame, left: Math.round(x), top: Math.round(y) },
    { input: image, left: Math.round(x + bezel), top: Math.round(y + bezel) },
  ];
}

async function save(name, layers) {
  const full = await sharp(background()).composite(layers).png().toBuffer();
  await sharp(full).webp({ quality: 80, effort: 6 }).toFile(join(out, `slide-${name}-full.webp`));
  await sharp(full).resize(1600, 1000).webp({ quality: 84, effort: 6 }).toFile(join(out, `slide-${name}.webp`));
  console.log('wrote', name);
}

// 1. The facilitator: the game page behind, the timer settings in front.
await save('facilitator', [
  ...(await windowLayers('facilitator-game.png', 80, 90, 940, { left: 0, top: 0, width: 2560, height: 1600 })),
  ...(await windowLayers('facilitator-timer.png', 560, 340, 960, { left: 0, top: 0, width: 2560, height: 1500 })),
]);

// 2. The players: three phones, the middle one in front and a little larger.
await save('phones', [
  ...(await phoneLayers('mobile-pick-name.png', 150, 250, 360, { left: 0, top: 0, width: 780, height: 1100 })),
  ...(await phoneLayers('mobile-my-connections.png', 1090, 190, 360, { left: 0, top: 0, width: 780, height: 1500 })),
  ...(await phoneLayers('mobile-add-connection.png', 570, 60, 460, { left: 0, top: 0, width: 780, height: 1560 })),
]);

// 3. The big screen with the countdown, QR code and the live graph.
await save('timer', await windowLayers('timer-screen.png', 150, 120, 1300, { left: 0, top: 0, width: 2560, height: 1360 }));

// 4. The results: the network view, without the empty space between the tabs and the graph.
await save(
  'network',
  await windowLayers('results-network.png', 200, 60, 1200, [
    { left: 0, top: 0, width: 2560, height: 380 },
    { left: 0, top: 560, width: 2560, height: 970 },
    { left: 0, top: 1690, width: 2560, height: 230 },
  ]),
);

// 5. More results: top topics behind, "who met whom" in front.
await save('results', [
  ...(await windowLayers('results-topics.png', 70, 90, 880, { left: 0, top: 0, width: 2560, height: 1750 })),
  ...(await windowLayers('results-matrix.png', 640, 330, 880, { left: 0, top: 0, width: 2560, height: 1750 })),
]);
