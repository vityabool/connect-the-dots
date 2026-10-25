import type { ReactElement } from 'react';
import { HowToPlay, HOW_TO_PLAY_FAQ } from './HowToPlay';
import { Landing } from './Landing';
import { Privacy } from './Privacy';
import { absoluteUrl, OG_IMAGE_PATH, type PageMeta } from './seo';
import { SITE } from './siteConfig';
import { Terms } from './Terms';

/** A static, search-engine friendly page: its metadata and the component that shows it. */
export interface SitePage extends PageMeta {
  element: ReactElement;
}

function breadcrumbs(origin: string, name: string, path: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: absoluteUrl(origin, '/') },
      { '@type': 'ListItem', position: 2, name, item: absoluteUrl(origin, path) },
    ],
  };
}

function webPage(origin: string, name: string, description: string, path: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: absoluteUrl(origin, path),
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: absoluteUrl(origin, '/') },
  };
}

const LANDING_DESCRIPTION =
  'A free team-building game for offsites: colleagues talk, find what they share, and a live network graph grows on the big screen. Works on any phone.';
const LANDING_TITLE = 'Connect the Dots: a free team-building game for offsites';
const HOW_TITLE = 'How to play Connect the Dots: rules and facilitator guide';
const HOW_DESCRIPTION =
  'Rules, the three rounds and a step-by-step guide for players and facilitators of Connect the Dots, the team-building game where colleagues build a network.';
const PRIVACY_TITLE = 'Privacy policy | Connect the Dots';
const PRIVACY_DESCRIPTION =
  'What data Connect the Dots stores, why, for how long and which rights you have under the GDPR. No tracking, no advertising, automatic deletion.';
const TERMS_TITLE = 'Terms of service | Connect the Dots';
const TERMS_DESCRIPTION =
  'The terms for using Connect the Dots: free to use as is, without support or warranty, with acceptable-use rules and data processing terms for facilitators.';

export const PAGES: readonly SitePage[] = [
  {
    path: '/',
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    changefreq: 'monthly',
    priority: 1,
    element: <Landing />,
    jsonLd: (origin) => [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: `${SITE.name}: ${SITE.subtitle}`,
        url: absoluteUrl(origin, '/'),
        description: SITE.description,
        inLanguage: 'en',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE.name,
        alternateName: SITE.subtitle,
        url: absoluteUrl(origin, '/'),
        description: SITE.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires a current web browser with JavaScript',
        isAccessibleForFree: true,
        inLanguage: 'en',
        image: absoluteUrl(origin, OG_IMAGE_PATH),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: SITE.license.url,
        ...(SITE.repo.public ? { codeRepository: SITE.repo.url, sameAs: [SITE.repo.url] } : {}),
      },
    ],
  },
  {
    path: '/how-to-play',
    title: HOW_TITLE,
    description: HOW_DESCRIPTION,
    changefreq: 'monthly',
    priority: 0.8,
    element: <HowToPlay />,
    jsonLd: (origin) => [
      breadcrumbs(origin, 'How to play', '/how-to-play'),
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: HOW_TO_PLAY_FAQ.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  },
  {
    path: '/privacy',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    changefreq: 'yearly',
    priority: 0.3,
    element: <Privacy />,
    jsonLd: (origin) => [breadcrumbs(origin, 'Privacy policy', '/privacy'), webPage(origin, PRIVACY_TITLE, PRIVACY_DESCRIPTION, '/privacy')],
  },
  {
    path: '/terms',
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    changefreq: 'yearly',
    priority: 0.3,
    element: <Terms />,
    jsonLd: (origin) => [breadcrumbs(origin, 'Terms of service', '/terms'), webPage(origin, TERMS_TITLE, TERMS_DESCRIPTION, '/terms')],
  },
];
