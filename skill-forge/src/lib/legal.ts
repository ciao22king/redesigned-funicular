/**
 * Unica fonte dei dati legali. Compila qui una volta e le pagine
 * (termini, privacy, cookie) e il footer si aggiornano da soli.
 *
 * Il gestore è un singolo sviluppatore: non servono dati di impresa
 * (P.IVA, sede, PEC). Bastano `name` ed `email`.
 */
export const legal = {
  siteName: 'Skill Forge',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skillforge.eu.org',
  lastUpdated: '5 novembre 2026',
  // Anno di prima pubblicazione, per il copyright nel footer.
  since: 2026,

  owner: {
    name: 'Skill Forge',
    email: 'ciao22king@gmail.com',
  },
} as const;
