#!/usr/bin/env node
/**
 * Lists the details that still have to be filled in before the public pages are ready to be promoted:
 * the operator details in web/src/site/legal.config.json and the repository switch in siteConfig.ts.
 *
 *   npm run check:site          prints a report (exit code 0)
 *   npm run check:site -- --strict   exits with code 1 when something is missing (for a release checklist)
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'web/src/site/legal.config.json'), 'utf8'));
const siteConfig = readFileSync(join(root, 'web/src/site/siteConfig.ts'), 'utf8');

const labels = {
  operatorName: 'Operator name (who runs the service)',
  contactEmail: 'Contact email for privacy requests and security reports',
  governingLaw: 'Governing law for the terms (for example "Ireland")',
  supervisoryAuthority: 'Competent data protection supervisory authority',
};

const addressSet = String(legal.operatorAddress ?? '').trim() !== '';
let missing = 0;
console.log('Public site checklist\n');
for (const [key, label] of Object.entries(labels)) {
  const ok = String(legal[key] ?? '').trim() !== '';
  if (!ok) missing += 1;
  console.log(`${ok ? '[x]' : '[ ]'} ${label}${ok ? `: ${legal[key]}` : ''}`);
}

console.log(`${addressSet ? '[x]' : '[-]'} Operator postal address (optional; not shown when empty)${addressSet ? ': ' + legal.operatorAddress : ''}`);

const repoPublic = /public:\s*true/.test(siteConfig);
console.log(`\n${repoPublic ? '[x]' : '[ ]'} Repository links are ${repoPublic ? 'ON' : 'OFF'} (siteConfig.ts: repo.public). Switch to true when the repository is made public.`);
console.log('\nEdit web/src/site/legal.config.json, then run the build. See docs/LEGAL_NOTES.md and docs/OPEN_SOURCING.md.');

if (process.argv.includes('--strict') && (missing > 0 || !repoPublic)) process.exitCode = 1;
