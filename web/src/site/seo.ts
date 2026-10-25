import { SITE } from './siteConfig';

/** What search engines, link previews and crawlers need to know about one static page. */
export interface PageMeta {
  /** URL path, for example "/privacy" ("/" for the landing page). */
  path: string;
  /** Page title, 60 characters or fewer so it is not cut off in search results. */
  title: string;
  /** Page description, 70 to 160 characters. */
  description: string;
  /** Structured data (JSON-LD) objects for this page; `origin` is the site's absolute address. */
  jsonLd: (origin: string) => object[];
  /** How often the page changes, for the sitemap. */
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Importance inside this site, 0.0 to 1.0, for the sitemap. */
  priority: number;
}

export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_ALT = 'Connect the Dots: colored dots joined by lines, a network of colleagues';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function absoluteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path === '/' ? '/' : path}`;
}

/** JSON for a <script type="application/ld+json"> tag: "</script>" and friends cannot end the tag early. */
export function safeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Everything that goes into the page's <head> besides the generic tags of the app shell. */
export function headTags(page: PageMeta, origin: string): string {
  const url = absoluteUrl(origin, page.path);
  const image = absoluteUrl(origin, OG_IMAGE_PATH);
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_SIZE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_SIZE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}" />`,
    ...page.jsonLd(origin).map((data) => `<script type="application/ld+json">${safeJsonLd(data)}</script>`),
  ];
  return tags.map((tag) => `    ${tag}`).join('\n');
}

/** Head tags for the app shell (join / play / admin pages): not for search engines. */
export function appShellHead(): string {
  return `    <meta name="robots" content="noindex, nofollow" />`;
}

export function sitemapXml(pages: readonly PageMeta[], origin: string, lastmod: string): string {
  const urls = pages
    .map(
      (page) =>
        `  <url>\n    <loc>${escapeHtml(absoluteUrl(origin, page.path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Search engines may read the public pages; the app itself (joining, playing, admin, API) is off limits. */
export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /play',
    'Disallow: /join/',
    'Disallow: /api/',
    'Disallow: /.auth/',
    '',
    `Sitemap: ${absoluteUrl(origin, '/sitemap.xml')}`,
    '',
  ].join('\n');
}

/** A short plain-text summary for AI assistants and other crawlers (the emerging llms.txt convention). */
export function llmsTxt(pages: readonly PageMeta[], origin: string): string {
  const lines = [
    `# ${SITE.name}: ${SITE.subtitle}`,
    '',
    `> ${SITE.description}`,
    '',
    'Free to use as is, without support or warranty. Players join with a 6-digit game code on their phones; a facilitator runs the game and projects a live network graph.',
    '',
    '## Pages',
    ...pages.map((page) => `- [${page.title}](${absoluteUrl(origin, page.path)}): ${page.description}`),
    '',
    '## Notes for automated tools',
    '- The application itself (join, play, admin, API) is not meant to be crawled and requires a game code or a Microsoft sign-in.',
    SITE.repo.public
      ? `- Source code (open source, ${SITE.license.name}): ${SITE.repo.url}`
      : `- The source code is open source (${SITE.license.name}); the repository address will be published here.`,
    '',
  ];
  return lines.join('\n');
}

/** RFC 9116 security.txt; only meaningful when a contact address is configured. */
export function securityTxt(contactEmail: string, origin: string, expires: string): string {
  return [
    `Contact: mailto:${contactEmail}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    `Canonical: ${absoluteUrl(origin, '/.well-known/security.txt')}`,
    '',
  ].join('\n');
}

export function webManifest(): string {
  return JSON.stringify(
    {
      name: `${SITE.name}: ${SITE.subtitle}`,
      short_name: SITE.name,
      description: SITE.description,
      start_url: '/',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    null,
    2,
  );
}
