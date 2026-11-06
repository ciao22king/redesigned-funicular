import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Termini di servizio · Skill Forge',
  description: 'Condizioni d’uso del servizio Skill Forge.',
};

export default function TerminiPage() {
  return (
    <LegalShell title="Termini di servizio" updated="5 novembre 2026">
      <section>
        <h2>1. Che cos’è Skill Forge</h2>
        <p>
          Skill Forge è un servizio che trasforma materiale grezzo (appunti, documenti,
          descrizioni) in una skill in formato Markdown per agenti AI. Offre due modalità: a
          partire da materiale esistente oppure da zero, rispondendo a sei domande. Il
          risultato può essere scaricato come file <code>.md</code> o pubblicato sul
          marketplace di Skill Forge.
        </p>
      </section>

      <section>
        <h2>2. Accesso</h2>
        <p>
          L’accesso avviene tramite GitHub. Serve un account GitHub valido. Sei responsabile
          della riservatezza delle tue credenziali e di ogni attività svolta con il tuo
          account. Devi avere almeno l’età minima prevista dalla legge del tuo Paese per
          acconsentire al trattamento dei dati (in Italia, 14 anni).
        </p>
      </section>

      <section>
        <h2>3. Uso consentito</h2>
        <p>Ti impegni a non usare il servizio per:</p>
        <ul>
          <li>caricare contenuti illeciti, diffamatori, o che violino diritti di terzi;</li>
          <li>tentare di aggirare i limiti tecnici, i limiti di utilizzo o le misure di sicurezza;</li>
          <li>automatizzare richieste in modo da degradare il servizio per gli altri utenti;</li>
          <li>generare contenuti ingannevoli o dannosi destinati ad altri.</li>
        </ul>
      </section>

      <section>
        <h2>4. Contenuti che fornisci</h2>
        <p>
          Mantieni la proprietà del materiale che carichi. Caricandolo, ci autorizzi a
          elaborarlo al solo fine di generare la skill richiesta e a trasmetterlo al
          fornitore del modello linguistico (OpenRouter e i modelli da esso instradati). Non
          acquisiamo diritti sul tuo materiale oltre a quanto serve per erogare il servizio.
        </p>
        <p>
          La skill generata è tua. Tuttavia la generazione automatica può produrre
          inesattezze: <strong>verifica sempre il risultato prima di usarlo</strong>, in
          particolare se contiene comandi, codice o procedure operative.
        </p>
      </section>

      <section>
        <h2>5. Pubblicazione sul marketplace</h2>
        <p>
          Se scegli di pubblicare, la skill viene salvata sul marketplace di Skill Forge e
          diventa visibile a chiunque, con il tuo nome utente come autore. Puoi eliminarla in
          qualsiasi momento dalla tua dashboard. Sei responsabile del contenuto che pubblichi.
        </p>
      </section>

      <section>
        <h2>6. Disponibilità e limiti</h2>
        <p>
          Il servizio è offerto «così com’è», senza garanzia di disponibilità continua. Ci
          appoggiamo a fornitori terzi (Cloudflare, GitHub, OpenRouter) e possiamo sospendere,
          modificare o interrompere il servizio, in tutto o in parte, in qualsiasi momento.
        </p>
      </section>

      <section>
        <h2>7. Limitazione di responsabilità</h2>
        <p>
          Nei limiti consentiti dalla legge, non siamo responsabili per danni indiretti,
          perdita di dati o mancato guadagno derivanti dall’uso o dall’impossibilità di usare
          il servizio, né per il contenuto delle skill generate.
        </p>
      </section>

      <section>
        <h2>8. Modifiche</h2>
        <p>
          Possiamo aggiornare questi termini. La versione in vigore è quella pubblicata su
          questa pagina, con la data di ultimo aggiornamento in alto. L’uso continuato dopo
          una modifica ne implica l’accettazione.
        </p>
      </section>

      <section>
        <h2>9. Legge applicabile</h2>
        <p>
          Questi termini sono regolati dalla legge italiana. Per le controversie è competente
          il foro del consumatore, se applicabile.
        </p>
      </section>

      <section>
        <h2>10. Contatti</h2>
        <p>
          Per questioni legali o segnalazioni scrivi a{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  );
}
