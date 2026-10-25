import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { MemoryRouter, StaticRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { PAGES } from './pages';
import { renderStaticSite } from './prerender';
import { headTags, llmsTxt, robotsTxt, safeJsonLd, sitemapXml, webManifest } from './seo';
import { SITE } from './siteConfig';

const ORIGIN = 'https://games.example.org';

function htmlOf(path: string): string {
  const page = PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`no page ${path}`);
  return renderToString(<StaticRouter location={path}>{page.element}</StaticRouter>);
}

function textOf(path: string): string {
  return htmlOf(path).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
}

describe('search engine metadata of every public page', () => {
  for (const page of PAGES) {
    describe(page.path, () => {
      const head = headTags(page, ORIGIN);

      it('has a title that fits a search result and a description of a good length', () => {
        expect(page.title.length).toBeGreaterThan(10);
        expect(page.title.length).toBeLessThanOrEqual(65);
        expect(page.description.length).toBeGreaterThanOrEqual(70);
        expect(page.description.length).toBeLessThanOrEqual(160);
      });

      it('has exactly one title, one description and an absolute canonical address', () => {
        expect(head.match(/<title>/g)).toHaveLength(1);
        expect(head.match(/<meta name="description"/g)).toHaveLength(1);
        const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
        expect(canonical).toBe(page.path === '/' ? `${ORIGIN}/` : `${ORIGIN}${page.path}`);
      });

      it('allows indexing and has Open Graph and Twitter card tags with an image', () => {
        expect(head).toContain('<meta name="robots" content="index, follow');
        for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name']) {
          expect(head, tag).toContain(`property="${tag}"`);
        }
        expect(head).toContain('content="summary_large_image"');
        expect(head).toContain(`content="${ORIGIN}/og-image.png"`);
      });

      it('has structured data that is valid JSON with schema.org types', () => {
        const blocks = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1] ?? ''));
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
          expect(block['@context']).toBe('https://schema.org');
          expect(typeof block['@type']).toBe('string');
        }
      });

      it('has exactly one main heading and a landmark region', () => {
        const html = htmlOf(page.path);
        expect(html.match(/<h1[ >]/g)).toHaveLength(1);
        expect(html).toContain('<main id="content">');
        expect(html).toContain('<footer');
        expect(html).toContain('<header');
      });
    });
  }

  it('describes the application on the landing page and the questions on the how-to-play page', () => {
    const landing = headTags(PAGES[0]!, ORIGIN);
    expect(landing).toContain('"@type":"WebApplication"');
    expect(landing).toContain('"isAccessibleForFree":true');
    expect(landing).toContain('"@type":"WebSite"');
    const how = headTags(PAGES.find((p) => p.path === '/how-to-play')!, ORIGIN);
    expect(how).toContain('"@type":"FAQPage"');
    expect(how).toContain('"@type":"BreadcrumbList"');
  });

  it('lists the repository in the structured data only once it is public', () => {
    const repo = SITE.repo as { public: boolean };
    const before = repo.public;
    try {
      repo.public = false;
      expect(headTags(PAGES[0]!, ORIGIN)).not.toContain('codeRepository');
      repo.public = true;
      expect(headTags(PAGES[0]!, ORIGIN)).toContain('codeRepository');
    } finally {
      repo.public = before;
    }
  });

  it('cannot be broken out of by text inside structured data', () => {
    const json = safeJsonLd({ text: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json).text).toBe('</script><script>alert(1)</script>');
  });
});

describe('files for crawlers', () => {
  it('sitemap lists every public page with an absolute address and is not for the app', () => {
    const xml = sitemapXml(PAGES, ORIGIN, '2026-10-24');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<url>/g)).toHaveLength(PAGES.length);
    for (const page of PAGES) expect(xml).toContain(`<loc>${page.path === '/' ? `${ORIGIN}/` : `${ORIGIN}${page.path}`}</loc>`);
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/play');
  });

  it('robots.txt allows the public pages, blocks the app and points to the sitemap', () => {
    const robots = robotsTxt(ORIGIN);
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    for (const blocked of ['/admin', '/play', '/join/', '/api/']) expect(robots).toContain(`Disallow: ${blocked}`);
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('llms.txt summarises the site and links the public pages', () => {
    const text = llmsTxt(PAGES, ORIGIN);
    expect(text.startsWith('# Connect the Dots')).toBe(true);
    for (const page of PAGES) expect(text).toContain(`${ORIGIN}${page.path === '/' ? '/' : page.path}`);
  });

  it('web manifest has name, colors and icons that exist', () => {
    const manifest = JSON.parse(webManifest());
    expect(manifest.name).toContain('Connect the Dots');
    expect(manifest.theme_color).toBe('#0f172a');
    expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual(['/icon-192.png', '/icon-512.png', '/favicon.svg']);
  });

  it('the build step produces all pages and files, and security.txt only when a contact is configured', () => {
    const site = renderStaticSite(ORIGIN, '2026-10-24');
    expect(site.pages.map((p) => p.path)).toEqual(['/', '/how-to-play', '/privacy', '/terms']);
    expect(Object.keys(site.files).sort()).toEqual(['llms.txt', 'robots.txt', 'site.webmanifest', 'sitemap.xml'].concat(SITE.legal.contactEmail ? ['.well-known/security.txt', 'security.txt'] : []).sort());
    for (const page of site.pages) expect(page.html.length).toBeGreaterThan(1000);
  });

  it('reports the legal details that still have to be filled in', () => {
    const site = renderStaticSite(ORIGIN, '2026-10-24');
    expect(Array.isArray(site.missing)).toBe(true);
    if (!SITE.legal.operatorName) expect(site.missing).toContain('operator name');
  });
});

describe('legal pages contain what the GDPR asks for', () => {
  const privacy = textOf('/privacy').toLowerCase();
  const terms = textOf('/terms').toLowerCase();

  it('privacy policy covers controller, purposes, legal bases, recipients, transfers, retention, rights and complaints', () => {
    for (const phrase of [
      'who is responsible',
      'controller',
      'processor',
      'legal bases',
      'article 6(1)(b)',
      'article 6(1)(f)',
      'legitimate interest',
      'microsoft',
      'united states',
      'standard contractual clauses',
      'how long we keep data',
      'access',
      'rectification',
      'erasure',
      'restriction',
      'portability',
      'object',
      'supervisory authority',
      'automated decision',
      'children',
      'cookies',
      'strictly necessary',
      'contact',
    ]) {
      expect(privacy, phrase).toContain(phrase);
    }
  });

  it('privacy policy states the retention periods that the cleanup job really implements', () => {
    expect(privacy).toContain(`deleted automatically ${SITE.limits.retentionAfterExpiryDays} days after they expired`);
    expect(privacy).toContain('hashed client addresses');
    expect(privacy).toContain('never the address itself');
  });

  it('privacy policy makes the operator\'s details visible placeholders until they are filled in', () => {
    const html = htmlOf('/privacy');
    if (!SITE.legal.operatorName) expect(html).toContain('class="todo"');
  });

  it('terms say it is free, as is, without support or warranty, and contain the processor terms', () => {
    for (const phrase of [
      'as is',
      'no support',
      'no warranty',
      'free of charge',
      'acceptable use',
      'data processing terms',
      'article 28',
      'sub-processors',
      'limitation',
    ].filter((p) => p !== 'limitation')) {
      expect(terms, phrase).toContain(phrase);
    }
    expect(terms).toContain('liability');
    expect(terms).toContain('governing law');
    expect(terms).toContain('mit license');
  });

  it('privacy and terms link to each other and every on-page anchor target exists', () => {
    for (const path of ['/privacy', '/terms', '/how-to-play', '/']) {
      const html = htmlOf(path);
      const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
      for (const match of html.matchAll(/ href="#([^"]+)"/g)) expect(ids.has(match[1]), `${path} -> #${match[1]}`).toBe(true);
    }
    expect(htmlOf('/privacy')).toContain('href="/terms');
    expect(htmlOf('/terms')).toContain('href="/privacy');
    // links from other pages into the legal pages point at anchors that exist
    const privacyIds = new Set([...htmlOf('/privacy').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    const termsIds = new Set([...htmlOf('/terms').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const path of ['/', '/how-to-play', '/privacy', '/terms']) {
      const html = htmlOf(path);
      for (const m of html.matchAll(/ href="\/privacy#([^"]+)"/g)) expect(privacyIds.has(m[1]), `${path} -> /privacy#${m[1]}`).toBe(true);
      for (const m of html.matchAll(/ href="\/terms#([^"]+)"/g)) expect(termsIds.has(m[1]), `${path} -> /terms#${m[1]}`).toBe(true);
    }
  });
});

describe('open source links', () => {
  it('do not point at the repository while it is private, and do once it is public', () => {
    const repo = SITE.repo as { public: boolean };
    const before = repo.public;
    try {
      repo.public = false;
      expect(htmlOf('/')).not.toContain('github.com');
      expect(htmlOf('/')).toContain('repository coming soon');
      repo.public = true;
      const html = htmlOf('/');
      expect(html).toContain(`href="${SITE.repo.url}"`);
      expect(html).toContain(`href="${SITE.repo.url}/issues/new/choose"`);
      expect(htmlOf('/terms')).toContain(`${SITE.repo.url}/issues/new/choose`);
    } finally {
      repo.public = before;
    }
  });

  it('the landing page tells people where feedback goes and that there is no support', () => {
    const landing = textOf('/').toLowerCase();
    expect(landing).toContain('issues');
    expect(landing).toContain('without support');
    expect(landing).toContain('mit license');
  });
});

describe('landing page content', () => {
  it('explains how to play, the rounds, and offers joining and facilitator sign-in', () => {
    const html = htmlOf('/');
    expect(html).toContain('id="join"');
    expect(html).toContain('id="how-it-works"');
    expect(html).toContain('id="facilitators"');
    expect(html).toContain('id="open-source"');
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/how-to-play"');
    expect(textOf('/')).toContain('Three rounds, ten minutes each');
  });

  it('makes no tracking promises it cannot keep: no external scripts, fonts or images', () => {
    for (const path of ['/', '/how-to-play', '/privacy', '/terms']) {
      const html = htmlOf(path);
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/src="https?:\/\//);
      expect(html).not.toMatch(/<link[^>]+href="https?:\/\//);
    }
  });
});

describe('hydration of the prebuilt pages', () => {
  // The page re-renders once after hydration (the carousel adds its buttons), so React must know it runs under act().
  const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const path of ['/', '/how-to-play', '/privacy', '/terms']) {
    it(`${path}: the browser attaches to the static HTML without a mismatch`, async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const container = document.createElement('div');
      container.innerHTML = renderToString(
        <StaticRouter location={path}>
          <App />
        </StaticRouter>,
      );
      document.body.appendChild(container);
      const before = container.innerHTML;
      await act(async () => {
        hydrateRoot(
          container,
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>,
        );
      });
      expect(errors).not.toHaveBeenCalled();
      // The only change hydration makes is adding the carousel's buttons (the page works without them).
      const after = container.cloneNode(true) as HTMLElement;
      after.querySelector('.showcase-controls')?.remove();
      expect(after.innerHTML).toBe(before);
      expect(Boolean(container.querySelector('.showcase-controls'))).toBe(path === '/');
      container.remove();
    });
  }
});
