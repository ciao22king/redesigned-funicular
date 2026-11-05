import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Contatti · Skill Forge',
  description: 'Come contattare il gestore di Skill Forge.',
};

export default function ContattiPage() {
  const o = legal.owner;
  return (
    <LegalShell title="Contatti" updated={legal.lastUpdated}>
      <section>
        <h2>Scrivici</h2>
        <p>
          Per domande sul servizio, richieste relative ai tuoi dati personali o segnalazioni
          scrivi a <a href={`mailto:${o.email}`}>{o.email}</a>. Rispondiamo appena possibile.
        </p>
      </section>

      <section>
        <h2>Richieste privacy</h2>
        <p>
          Per esercitare i tuoi diritti GDPR (accesso, rettifica, cancellazione, limitazione,
          opposizione, portabilità) usa lo stesso indirizzo, indicando «Richiesta privacy»
          nell&apos;oggetto. Dettagli nell&apos;<a href="/privacy">informativa privacy</a>.
        </p>
      </section>

      <section>
        <h2>Segnalazioni di sicurezza</h2>
        <p>
          Se hai trovato una vulnerabilità, non pubblicarla: scrivici e la gestiremo. Trovi le
          indicazioni nella pagina <a href="/sicurezza">sicurezza</a>.
        </p>
      </section>
    </LegalShell>
  );
}
