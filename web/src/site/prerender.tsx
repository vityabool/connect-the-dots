import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { PAGES } from './pages';
import { headTags, llmsTxt, robotsTxt, securityTxt, sitemapXml, webManifest, type PageMeta } from './seo';
import { missingLegalFields, SITE } from './siteConfig';

/**
 * Build-time entry (run by scripts/prerender.mjs): turns the public pages into plain HTML so that search engines and
 * other crawlers that do not run JavaScript can read them, and creates the sitemap, robots.txt and friends.
 */
export function renderStaticSite(origin: string, today: string) {
  const pages = PAGES.map((page) => ({
    path: page.path,
    head: headTags(page, origin),
    html: renderToString(
      <StaticRouter location={page.path}>
        {page.element}
      </StaticRouter>,
    ),
  }));
  const metas: PageMeta[] = [...PAGES];
  const files: Record<string, string> = {
    'sitemap.xml': sitemapXml(metas, origin, today),
    'robots.txt': robotsTxt(origin),
    'llms.txt': llmsTxt(metas, origin),
    'site.webmanifest': webManifest(),
  };
  const contact = SITE.legal.contactEmail.trim();
  if (contact) {
    const year = Number(today.slice(0, 4)) + 1;
    const text = securityTxt(contact, origin, `${year}${today.slice(4)}T00:00:00.000Z`);
    files['.well-known/security.txt'] = text;
    // Static Web Apps does not deploy folders that start with a dot, so the file is also published at /security.txt
    // and staticwebapp.config.json rewrites /.well-known/security.txt to it.
    files['security.txt'] = text;
  }
  return { pages, files, missing: missingLegalFields() };
}
