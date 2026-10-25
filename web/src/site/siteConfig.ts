import legal from './legal.config.json';

/**
 * Facts about the public site that appear on several pages (landing page, legal pages, search-engine data).
 * Operator details for the legal pages live in `legal.config.json`.
 */
export const SITE = {
  name: 'Connect the Dots',
  subtitle: 'The Human Network',
  /** One sentence used as the page description and in link previews. */
  description:
    'A free team-building game for offsites and workshops: colleagues talk, find what they have in common, and a live network graph shows the connections growing on the big screen.',
  /** Used when no SITE_URL is given at build time. */
  defaultUrl: 'https://www.connect-the-dots.top',
  repo: {
    url: 'https://github.com/vityabool/connect-the-dots',
    /**
     * Set to true when the repository is made public. While false the pages say "open source, coming soon"
     * and do not link to the (private) repository, so visitors never meet a "404 Not Found".
     */
    public: true,
  },
  license: {
    spdx: 'MIT',
    name: 'MIT License',
    url: 'https://opensource.org/license/mit',
  },
  limits: {
    participants: 200,
    topics: 200,
    gamesPerFacilitator: 50,
    defaultExpiryDays: 3,
    maxExpiryDays: 30,
    retentionAfterExpiryDays: 30,
  },
  region: 'East US 2 (United States)',
  legal: legal as {
    operatorName: string;
    operatorAddress: string;
    contactEmail: string;
    governingLaw: string;
    supervisoryAuthority: string;
    effectiveDate: string;
  },
} as const;

export function issuesUrl(kind: 'list' | 'new' = 'new'): string {
  return kind === 'new' ? `${SITE.repo.url}/issues/new/choose` : `${SITE.repo.url}/issues`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10-24" -> "24 October 2026" (done by hand so server and browser always print the same text). */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1] ?? ''} ${year}`;
}

/** Operator details that are still empty in legal.config.json. */
export function missingLegalFields(): string[] {
  const labels: Record<string, string> = {
    operatorName: 'operator name',
    contactEmail: 'contact email',
    governingLaw: 'governing law',
    supervisoryAuthority: 'supervisory authority',
  };
  return Object.entries(labels)
    .filter(([key]) => !String((SITE.legal as Record<string, string>)[key] ?? '').trim())
    .map(([, label]) => label);
}
