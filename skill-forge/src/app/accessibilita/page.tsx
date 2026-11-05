import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Dichiarazione di accessibilità · Skill Forge',
  description: 'Impegno di Skill Forge verso l’accessibilità.',
};

export default function AccessibilitaPage() {
  return (
    <LegalShell title="Dichiarazione di accessibilità" updated={legal.lastUpdated}>
      <section>
        <h2>Il nostro impegno</h2>
        <p>
          Vogliamo che {legal.siteName} sia usabile da chiunque, comprese le persone che
          usano tecnologie assistive. Il riferimento che seguiamo è lo standard{' '}
          <strong>WCAG 2.2, livello AA</strong>.
        </p>
      </section>

      <section>
        <h2>Stato attuale</h2>
        <p>
          Il sito è <strong>parzialmente conforme</strong>. Abbiamo curato in particolare:
        </p>
        <ul>
          <li>contrasto del testo e degli elementi interattivi adeguato;</li>
          <li>foco visibile su tutti i controlli da tastiera;</li>
          <li>navigazione completa da tastiera, con «salta al contenuto» dove serve;</li>
          <li>testi alternativi per le immagini informative;</li>
          <li>struttura dei titoli coerente (h1, h2, h3);</li>
          <li>rispetto dell&apos;impostazione «riduci animazioni» del sistema.</li>
        </ul>
      </section>

      <section>
        <h2>Limiti noti</h2>
        <ul>
          <li>alcune aree del percorso di creazione non sono ancora testate con tutti gli screen reader;</li>
          <li>i documenti legali possono contenere termini complessi non spiegati in linguaggio semplice.</li>
        </ul>
      </section>

      <section>
        <h2>Segnalare un problema</h2>
        <p>
          Se incontri una barriera, scrivi a{' '}
          <a href={`mailto:${legal.owner.email}`}>{legal.owner.email}</a> descrivendo la pagina
          e il problema. Ci impegniamo a rispondere e a correggere.
        </p>
      </section>

      <section>
        <h2>Normativa</h2>
        <p>
          Questa dichiarazione è resa in coerenza con la legge 9 gennaio 2004, n. 4 e con la
          direttiva europea 2016/2102 sull&apos;accessibilità dei siti web.
        </p>
      </section>
    </LegalShell>
  );
}
