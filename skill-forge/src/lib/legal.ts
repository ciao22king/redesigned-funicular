/**
 * Unica fonte dei dati legali. Compila qui una volta e tutte le pagine
 * (note legali, privacy, cookie, termini, footer) si aggiornano da sole.
 *
 * I valori tra parentesi quadre sono segnaposto: sostituiscili con i tuoi.
 */
export const legal = {
  siteName: 'Skill Forge',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skillforge.eu.org',
  lastUpdated: '5 novembre 2026',
  // Anno di prima pubblicazione, per il copyright nel footer.
  since: 2026,

  owner: {
    // Se sei una persona fisica: nome e cognome. Se una societa': ragione sociale.
    name: '[Nome e cognome o ragione sociale]',
    // Vuoto se persona fisica.
    legalForm: '[es. ditta individuale / S.r.l. / S.a.s.]',
    address: '[Via e numero civico, CAP, Citta, Provincia, Paese]',
    vat: '[Partita IVA]',
    taxCode: '[Codice fiscale]',
    email: 'ciao22king@gmail.com',
    pec: '[indirizzo PEC]',
  },

  // Chi ospita e chi tratta i dati per noi (responsabili ex art. 28 GDPR).
  providers: [
    { name: 'Cloudflare, Inc.', role: 'Hosting, rete e distribuzione', country: 'Stati Uniti' },
    { name: 'GitHub, Inc.', role: 'Autenticazione e pubblicazione su repository', country: 'Stati Uniti' },
    { name: 'OpenRouter, Inc.', role: 'Erogazione del modello linguistico', country: 'Stati Uniti' },
  ],
} as const;

export type Legal = typeof legal;
