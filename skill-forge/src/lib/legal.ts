/**
 * Unica fonte dei dati legali. Compila qui una volta e tutte le pagine
 * (note legali, privacy, cookie, termini, footer) si aggiornano da sole.
 *
 * Per un progetto personale bastano `name` ed `email`: i campi aziendali
 * (legalForm, address, vat, taxCode, pec) restano vuoti e non compaiono.
 */
export const legal = {
  siteName: 'Skill Forge',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skillforge.eu.org',
  lastUpdated: '5 novembre 2026',
  // Anno di prima pubblicazione, per il copyright nel footer.
  since: 2026,

  owner: {
    // Nome del gestore. Se pubblichi a titolo personale, va bene il tuo nome
    // o il nome del progetto. Compare nel footer e nelle note legali.
    name: 'Skill Forge',
    email: 'ciao22king@gmail.com',
    // Campi per aziende o professionisti. Lasciali vuoti se pubblichi a
    // titolo personale: se vuoti, non compaiono da nessuna parte.
    legalForm: '',
    address: '',
    vat: '',
    taxCode: '',
    pec: '',
  },

  // Chi ospita e chi tratta i dati per noi (responsabili ex art. 28 GDPR).
  providers: [
    { name: 'Cloudflare, Inc.', role: 'Hosting, rete e distribuzione', country: 'Stati Uniti' },
    { name: 'GitHub, Inc.', role: 'Autenticazione e pubblicazione su repository', country: 'Stati Uniti' },
    { name: 'OpenRouter, Inc.', role: 'Erogazione del modello linguistico', country: 'Stati Uniti' },
  ],
} as const;

export type Legal = typeof legal;
