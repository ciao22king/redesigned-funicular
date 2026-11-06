/**
 * Single source of legal data. Fill it in once here and the pages
 * (terms, privacy, cookie) and the footer update themselves.
 *
 * The operator is a single developer: no company data needed
 * (P.IVA, sede, PEC). Bastano `name` ed `email`.
 */
export const legal = {
  siteName: 'Skill Forge',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skillforge.eu.org',
  lastUpdated: 'November 6, 2026',
  // First publication year, for the copyright in the footer.
  since: 2026,

  owner: {
    name: 'Skill Forge',
    email: 'ciao22king@gmail.com',
  },
} as const;
