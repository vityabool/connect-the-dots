# Legal notes for the operator

For the person or organisation that **operates the public service**. This is not legal advice and it is not part of the
published site. The privacy policy and the terms of service in this repository were drafted to match what the system really
does, using the GDPR's transparency and processor requirements as a checklist. **Have them reviewed for your situation before
you promote the service.**

## 1. What you must fill in before launch

`web/src/site/legal.config.json` (run `npm run check:site` to see what is missing). Empty values appear as yellow
"to be completed" markers on the published pages.

| Field | Used for | Notes |
|-------|----------|-------|
| `operatorName` | Privacy policy sections 1 and 12, terms sections 1 and 14 | Person or organisation that is legally responsible for the service. A natural person's name appears publicly |
| `operatorAddress` | Same | **Optional.** Shown only when filled in; the contact email satisfies the GDPR's contact-details requirement. Some countries require a postal address for websites (see 5), in which case use a PO box, a registered-agent address or a company address |
| `contactEmail` | Privacy requests, security reports (`/.well-known/security.txt`), code of conduct reports | Must be monitored: GDPR requests have a one-month deadline |
| `governingLaw` | Terms section 13 | For example "Ireland" or "the Netherlands". Consumer protection rules of the user's country still apply |
| `supervisoryAuthority` | Privacy policy section 9 | The data protection authority competent for the operator (usually where the operator is established) |
| `effectiveDate` | "Last updated" date | Change it whenever the texts change materially |

Also check `SITE.region` in `web/src/site/siteConfig.ts` if you host somewhere else than Azure East US 2.

## 2. Roles, as the texts describe them

- **Participants' data** (names on the list, topics, connections): the **facilitator is the controller**, the operator is the
  **processor** (GDPR Article 28), Microsoft is the **sub-processor**. The processor terms are section 9 of the terms of service.
  Facilitators are told to have a lawful basis, to inform participants and not to enter sensitive data (terms section 5).
- **Facilitator sign-in data and technical security data**: the **operator is the controller** (Article 6(1)(b) and (f)).
- The operator is **not** a controller of the free-text names and topics, but should still be able to help with requests.

If your use is different (for example you run games for your own staff as an employer), you are both controller and operator:
simplify the texts accordingly.

## 3. What the texts assume (verify each when you change the system)

| Statement in the policy | Where it is true in the code |
|-------------------------|-------------------------------|
| No analytics, ads, third-party scripts, fonts or images | Content security policy `default-src 'self'` in `web/public/staticwebapp.config.json`; test `site.test.tsx` checks the static pages have no external resources |
| No player accounts; the browser stores a signed session | `web/src/play/session.ts`, `api/src/playerToken.ts` |
| Facilitator identity: only an opaque user ID is stored | `ownerId` in the `Games`/`OwnerGames` tables (`api/src/services/games.ts`); the display name comes from the sign-in header and is not stored |
| Client addresses are not stored; only a keyed hash with a failure counter, rows replaced every 10 minutes and deleted within two days | `api/src/services/rateLimit.ts`, `api/src/services/cleanup.ts`; tests in `api/src/services/privacy.test.ts` |
| Games close after 3 days (extendable to 30) and are deleted 30 days after expiry; no other copies | `api/src/services/cleanup.ts`, run daily by `.github/workflows/cleanup.yml` (secret `CLEANUP_TOKEN`). **If this job stops running, the retention promise is broken**: watch the workflow |
| Data location: Azure East US 2 (United States) | `infra/main.bicep` |
| Microsoft takes part in the EU-U.S. Data Privacy Framework and offers Standard Contractual Clauses | **Verify on Microsoft's current documentation** before relying on this wording |
| Hosting logs are kept by Microsoft; no own request logging | No Application Insights or custom logging is configured; check this when you add monitoring |
| Strictly necessary storage only (no consent banner) | Local storage `ctd.session`; the Static Web Apps sign-in cookie for facilitators |

## 4. GDPR Article 13 checklist (privacy policy)

| Requirement | Section of the policy |
|-------------|-----------------------|
| Identity and contact details of the controller (13(1)(a)) | 1, 12 |
| Purposes and legal basis (13(1)(c)) | 3 |
| Legitimate interests pursued (13(1)(d)) | 3 |
| Recipients (13(1)(e)) | 5 |
| Transfers to third countries and safeguards (13(1)(f)) | 6 |
| Retention period or criteria (13(2)(a)) | 2 (table), 7 |
| Rights: access, rectification, erasure, restriction, objection, portability (13(2)(b)) | 9 |
| Right to withdraw consent (13(2)(c)) | Not applicable: consent is not the basis (stated in 9) |
| Right to complain to a supervisory authority (13(2)(d)) | 9 |
| Statutory or contractual requirement, consequences of not providing data (13(2)(e)) | 2 (what is needed to take part) |
| Automated decision-making and profiling (13(2)(f)) | 3 (none) |
| Article 14 (data from another source): participants' names come from the facilitator | 1, 2 (source column) |
| Cookies and similar technologies (ePrivacy Article 5(3)) | 4 |

Article 28(3) (processor terms) is covered by section 9 of the terms of service: subject matter and duration, types of data and
people, documented instructions, confidentiality, security, sub-processors, assistance with rights and obligations, breach
notification, deletion at the end, and information to demonstrate compliance together with cooperation in audits and
inspections (Article 28(3)(h): the contract may set practical rules for audits, but may not exclude them).

## 5. Points to have a lawyer look at

- **Liability and warranty clauses** (terms 3 and 11). They are written to be "as is" and to respect mandatory law, but the
  enforceability of liability limits differs by country and between consumers and businesses.
- **Governing law and courts** (terms 13) and whether you want a venue clause.
- **Impressum / provider identification.** Some countries (for example Germany and Austria) require clear provider
  identification on websites that are not purely personal, and sometimes more than name and email. A free public service may
  count.
- **An EU/UK representative** (GDPR Article 27) if the operator is outside the EU/UK and the service is offered to people there.
- **A data protection officer** (Article 37): normally not required for a small service like this, but check.
- **Record of processing** (Article 30): small operators are often exempt, but a short record is good practice: the table in
  section 2 of the privacy policy is a good start (purpose, categories, recipients, transfers, retention).
- **Data subject requests directly to the operator.** You do not have access to other facilitators' games through the app.
  Procedure: ask the person which game, ask the facilitator to act, or delete the rows yourself in the storage account (tables
  `Participants` and `Connections`, partition = game id) with Azure Storage Explorer, and keep a note of what you did.
- **Breach handling.** A personal data breach likely to cause risk must be reported to the authority within 72 hours
  (Article 33). Know who decides and how to contact the authority before something happens.
- **Employer and intellectual-property rules.** If you are employed, check your employer's policies on outside activities,
  ownership of work, and publishing open source before you make the repository public or run a public service.
- **Name and trademark.** "Connect the Dots" is a common phrase; check that you may use it as a product name where you operate.
- **Accessibility law.** The site was built to WCAG 2.1 AA practices and tested (see [ACCESSIBILITY.md](ACCESSIBILITY.md)), but
  whether any accessibility law applies to you, and whether a formal accessibility statement is needed, depends on who you are.

## 6. Open-source licensing notes

- The repository carries the **MIT License** (`LICENSE`). It includes a disclaimer of warranty and liability that matches the "as
  is" position. Contributions are accepted under the same license (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
- MIT is permissive: anyone may use, modify, host and sell the code, also in closed-source products, as long as the copyright
  and license notice are kept. Nobody has to publish their changes. If you ever want that, a copyleft license (GPL-3.0, or
  AGPL-3.0 for hosted copies) is needed, and switching **after** you accept outside contributions needs every contributor's
  agreement.
- All shipped third-party packages use permissive licenses (MIT, ISC, 0BSD) that are compatible with the MIT License
  ([THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md), checked in CI by `npm run licenses -- --check`).
- The license covers the code, not the hosted service's data and not the name or logo.

## 7. After launch

- Answer rights requests within **one month**.
- Keep the policy true: if you add a feature that collects data, change the policy in the same change (a test keeps some
  promises honest, but not all).
- Watch the daily cleanup workflow and the Azure resource group for changes.
- Review the texts at least once a year and bump `effectiveDate` when they change.
