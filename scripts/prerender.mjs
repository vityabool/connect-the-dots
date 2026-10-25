#!/usr/bin/env node
/**
 * Runs after `vite build`. Turns the public pages (landing page, how to play, privacy, terms) into static HTML
 * so that search engines and crawlers that do not run JavaScript can read them, and writes the files that help
 * them find the site: sitemap.xml, robots.txt, llms.txt, site.webmanifest and (when a contact is configured)
 * .well-known/security.txt (also written to /security.txt, because Static Web Apps skips dot-folders).
 *
 * Output in web/dist:
 *   index.html, how-to-play/index.html, privacy/index.html, terms/index.html   the public pages (with the app attached)
 *   app.html                                                                   the empty app shell for /join, /play, /admin (noindex)
 *
 * The site address comes from the SITE_URL environment variable (default: the production address in siteConfig.ts).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'web');
const dist = join(webDir, 'dist');
const tmpDir = join(root, '.prerender-tmp');
const bundlePath = join(tmpDir, 'entry.mjs');

mkdirSync(tmpDir, { recursive: true });
await build({
  entryPoints: [join(webDir, 'src/site/prerender.tsx')],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  jsx: 'automatic',
  tsconfig: join(webDir, 'tsconfig.json'),
  logLevel: 'warning',
  // react-dom/server is CommonJS and needs require(); give the ES module one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

const { renderStaticSite } = await import(pathToFileURL(bundlePath).href);

const origin = (process.env.SITE_URL || 'https://www.connect-the-dots.top').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const { pages, files, missing } = renderStaticSite(origin, today);

const template = readFileSync(join(dist, 'index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) throw new Error('web/dist/index.html has no empty root element');

// 1) The app shell for every address that is not a public page: no content, not for search engines.
writeFileSync(
  join(dist, 'app.html'),
  template.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>'),
);

// 2) The public pages.
for (const page of pages) {
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, page.head.trimStart())
    .replace('<div id="root"></div>', `<div id="root">${page.html}</div>`);
  const target = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.slice(1), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

// 3) Files for crawlers.
for (const [name, content] of Object.entries(files)) {
  const target = join(dist, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

rmSync(tmpDir, { recursive: true, force: true });

console.log(`Prerendered ${pages.length} public pages for ${origin}: ${pages.map((p) => p.path).join(', ')}`);
console.log(`Wrote ${Object.keys(files).join(', ')} and app.html`);
if (missing.length > 0) {
  console.warn(`\nWARNING: legal details still missing in web/src/site/legal.config.json: ${missing.join(', ')}.`);
  console.warn('The privacy policy and terms show a visible "to be completed" marker for each. Fill them in before you promote the site.\n');
}
