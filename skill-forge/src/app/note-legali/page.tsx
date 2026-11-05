import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Note legali · Skill Forge',
  description: 'Chi gestisce Skill Forge e informazioni sulla proprietà intellettuale.',
};

export default function NoteLegaliPage() {
  const o = legal.owner;
  const hasBusinessInfo = Boolean(o.legalForm || o.address || o.vat || o.taxCode || o.pec);
  return (
    <LegalShell title="Note legali" updated={legal.lastUpdated}>
      <section>
        <h2>1. Chi gestisce il sito</h2>
        <p>
          {legal.siteName} è un progetto personale, gestito a titolo individuale.
        </p>
        <ul>
          <li><strong>Gestore:</strong> {o.name}</li>
          <li><strong>Email:</strong> <a href={`mailto:${o.email}`}>{o.email}</a></li>
          {o.legalForm && <li><strong>Forma giuridica:</strong> {o.legalForm}</li>}
          {o.address && <li><strong>Sede:</strong> {o.address}</li>}
          {o.vat && <li><strong>Partita IVA:</strong> {o.vat}</li>}
          {o.taxCode && <li><strong>Codice fiscale:</strong> {o.taxCode}</li>}
          {o.pec && <li><strong>PEC:</strong> {o.pec}</li>}
        </ul>
        {!hasBusinessInfo && (
          <p className="text-sm text-[--ink-muted]">
            Il servizio non è un'attività commerciale: non sono richiesti i dati di impresa.
          </p>
        )}
      </section>

      <section>
        <h2>2. Proprietà intellettuale</h2>
        <p>
          Il nome, il logo, l&apos;interfaccia e il codice di {legal.siteName} appartengono al
          gestore del sito, salvo diversa indicazione. Il materiale che carichi resta tuo. La
          skill che generi è tua, come precisato nei{' '}
          <a href="/termini">termini di servizio</a>.
        </p>
      </section>

      <section>
        <h2>3. Marchi di terzi</h2>
        <p>
          GitHub, Cloudflare e OpenRouter sono marchi dei rispettivi titolari, usati qui solo
          per descrivere i servizi di cui ci avvaliamo. Nessun rapporto di affiliazione è
          implicato.
        </p>
      </section>

      <section>
        <h2>4. Contenuti generati da intelligenza artificiale</h2>
        <p>
          Le skill sono prodotte da modelli linguistici e possono contenere errori o
          imprecisioni. Non costituiscono consulenza professionale di alcun tipo. Verifica
          sempre il risultato prima di usarlo.
        </p>
      </section>

      <section>
        <h2>5. Limitazione di responsabilità</h2>
        <p>
          Le informazioni su questo sito sono fornite «così come sono». Nei limiti consentiti
          dalla legge, il gestore non è responsabile per danni derivanti dall&apos;uso del
          sito o dei contenuti generati.
        </p>
      </section>

      <section>
        <h2>6. Segnalazioni</h2>
        <p>
          Per segnalare un contenuto illecito o lesivo scrivi a{' '}
          <a href={`mailto:${o.email}`}>{o.email}</a>. Vedi anche la pagina{' '}
          <a href="/sicurezza">sicurezza</a> per le vulnerabilità tecniche.
        </p>
      </section>
    </LegalShell>
  );
}
