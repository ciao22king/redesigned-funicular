/**
 * Single source of legal data. Fill it in once here and the pages
 * (terms, privacy, cookie) and the footer update themselves.
 *
 * The operator is a single developer: no company data needed
 * (P.IVA, sede, PEC). Bastano `name` ed `email`.
 */
export const legal = {
  siteName: 'Skill Forge',
  // Canonical origin for meta tags, OG image and JSON-LD. Defaults to the host
  // that actually answers today; the skillforge.eu.org zone stays pending until
  // eu.org publishes the NS delegation, so pointing there made every shared link
  // and every OG preview resolve to a dead domain.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skill-forge.ciao22king.workers.dev',
  lastUpdated: 'November 6, 2026',
  // First publication year, for the copyright in the footer.
  since: 2026,

  owner: {
    name: 'Skill Forge',
    email: 'ciao22king@gmail.com',
  },
} as const;
