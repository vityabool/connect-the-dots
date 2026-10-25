#!/usr/bin/env node
/**
 * Serves the production build (web/dist) the way Azure Static Web Apps does, for a local check of the
 * real bundle: same response headers (from staticwebapp.config.json), the static public pages, the app
 * shell fallback for unknown addresses, and /api proxied to the local Functions host.
 *
 *   npm run build
 *   node scripts/serve-dist.mjs [--port 4173] [--api http://localhost:7072]
 *
 * With CTD_DEV_ADMIN=1 the proxy adds the same sign-in header as vite's dev server (local use only);
 * CTD_DEV_ADMIN_NAME sets the name shown as the signed-in user (default simulation@example.com).
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web/dist/', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const port = Number(option('port', 4173));
const api = new URL(option('api', 'http://localhost:7072'));

const config = JSON.parse(readFileSync(join(root, 'staticwebapp.config.json'), 'utf8'));
const headers = config.globalHeaders ?? {};
const rewrites = new Map((config.routes ?? []).filter((r) => r.rewrite).map((r) => [r.route, r.rewrite]));
const fallback = config.navigationFallback?.rewrite ?? '/index.html';

const devAdmin =
  process.env.CTD_DEV_ADMIN === '1'
    ? Buffer.from(
        JSON.stringify({ userId: 'simulation-admin', userDetails: process.env.CTD_DEV_ADMIN_NAME ?? 'simulation@example.com', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated'] }),
      ).toString('base64')
    : undefined;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Resolves an address to a file the way the hosting platform does: exact file, a folder's index.html, or the app shell. */
function resolveFile(pathname) {
  const clean = rewrites.get(pathname) ?? pathname;
  const candidates = [clean, `${clean.replace(/\/$/, '')}/index.html`];
  for (const candidate of candidates) {
    const file = normalize(join(root, decodeURIComponent(candidate)));
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) return { file, status: 200 };
  }
  return { file: join(root, fallback), status: 200 };
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    const proxied = httpRequest(
      { host: api.hostname, port: api.port, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: api.host, ...(devAdmin ? { 'x-ms-client-principal': devAdmin } : {}) } },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxied.on('error', () => {
      res.writeHead(502);
      res.end('API not reachable');
    });
    req.pipe(proxied);
    return;
  }

  const { file, status } = resolveFile(url.pathname);
  res.writeHead(status, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', ...headers });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving web/dist on http://127.0.0.1:${port} with the production security headers`);
});
