import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Sicurezza · Skill Forge',
  description: 'Come Skill Forge protegge i dati e come segnalare vulnerabilità.',
};

export default function SicurezzaPage() {
  return (
    <LegalShell title="Sicurezza" updated={legal.lastUpdated}>
      <section>
        <h2>Misure adottate</h2>
        <ul>
          <li>tutto il traffico viaggia su <strong>HTTPS</strong> con cifratura;</li>
          <li>le chiavi dei servizi (GitHub, OpenRouter) sono <strong>segreti lato server</strong>, mai nel browser;</li>
          <li>la sessione è un cookie <strong>firmato e cifrato</strong> (HttpOnly, SameSite);</li>
          <li>l&apos;accesso avviene tramite <strong>OAuth GitHub</strong>: non vediamo né conserviamo la tua password;</li>
          <li>l&apos;infrastruttura è affidata a <strong>Cloudflare</strong>, con protezione DDoS e WAF;</li>
          <li>i log sono minimi e limitati a ciò che serve per sicurezza e funzionamento.</li>
        </ul>
      </section>

      <section>
        <h2>Segnalare una vulnerabilità</h2>
        <p>
          Se hai scoperto una vulnerabilità, ti chiediamo di segnalarla in privato a{' '}
          <a href={`mailto:${legal.owner.email}`}>{legal.owner.email}</a> prima di divulgarla.
          Indica passi per riprodurla e, se vuoi, come essere ricontattato. Ci impegniamo a
          rispondere e a risolvere. Trovi anche il file{' '}
          <a href="/.well-known/security.txt">security.txt</a>.
        </p>
        <p>Ti chiediamo di non:</p>
        <ul>
          <li>accedere, modificare o cancellare dati che non ti appartengono;</li>
          <li>degradare il servizio o interromperlo per altri;</li>
          <li>divulgare il problema prima che sia risolto.</li>
        </ul>
      </section>

      <section>
        <h2>Password e account</h2>
        <p>
          Non gestiamo password: l&apos;autenticazione è interamente su GitHub. La sicurezza
          del tuo account dipende dalle impostazioni GitHub (ti consigliamo l&apos;autenticazione
          a due fattori).
        </p>
      </section>

      <section>
        <h2>Contatti</h2>
        <p>
          Vedi la pagina <a href="/contatti">contatti</a>. Vedi anche la{' '}
          <a href="/privacy">informativa privacy</a>.
        </p>
      </section>
    </LegalShell>
  );
}
