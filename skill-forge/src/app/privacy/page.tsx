import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Informativa privacy · Skill Forge',
  description: 'Come Skill Forge tratta i dati personali.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Informativa privacy" updated="5 novembre 2026">
      <section>
        <h2>1. Titolare del trattamento</h2>
        <p>
          Il titolare del trattamento è il gestore di {legal.siteName}, un progetto personale, contattabile a{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>.
        </p>
      </section>

      <section>
        <h2>2. Quali dati trattiamo</h2>
        <ul>
          <li>
            <strong>Dati di accesso GitHub</strong>: identificativo, nome utente, nome e
            immagine del profilo, indirizzo email (se reso disponibile). Li riceviamo tramite
            l’autenticazione OAuth quando accedi.
          </li>
          <li>
            <strong>Materiale che invii</strong>: il testo o i documenti che carichi per
            generare una skill, e le risposte alle sei domande della modalità «da zero».
          </li>
          <li>
            <strong>Skill pubblicate</strong>: se scegli di pubblicare sul marketplace, la
            skill e il tuo nome utente GitHub vengono salvati e resi visibili a chiunque. Le
            puoi eliminare in qualsiasi momento dalla tua dashboard.
          </li>
          <li>
            <strong>Dati tecnici</strong>: indirizzo IP, dati di richiesta e log, gestiti dal
            nostro fornitore di infrastruttura per sicurezza e funzionamento.
          </li>
          <li>
            <strong>Cookie</strong>: un cookie di sessione necessario per tenerti connesso
            (vedi la <a href="/cookie">cookie policy</a>).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Perché li trattiamo (finalità e basi giuridiche)</h2>
        <ul>
          <li>
            <strong>Erogare il servizio</strong> (generare e pubblicare la skill): esecuzione
            del contratto.
          </li>
          <li>
            <strong>Sicurezza e prevenzione degli abusi</strong>: legittimo interesse.
          </li>
          <li>
            <strong>Adempimenti di legge</strong>, se richiesti: obbligo legale.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. A chi sono comunicati</h2>
        <p>Ci appoggiamo a fornitori che trattano i dati come responsabili:</p>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting e distribuzione (Workers, rete).
          </li>
          <li>
            <strong>GitHub</strong> — autenticazione e lettura del tuo profilo.
          </li>
          <li>
            <strong>OpenRouter</strong> — il testo che invii viene trasmesso al modello
            linguistico per produrre la skill. OpenRouter può instradare la richiesta a uno
            dei modelli disponibili.
          </li>
        </ul>
        <p>
          Non vendiamo i tuoi dati e non li usiamo per pubblicità o profilazione.
        </p>
      </section>

      <section>
        <h2>5. Trasferimenti fuori dall’UE</h2>
        <p>
          Alcuni fornitori hanno sede negli Stati Uniti. I trasferimenti avvengono sulla base
          delle clausole contrattuali standard della Commissione europea o di altre garanzie
          previste dal GDPR.
        </p>
      </section>

      <section>
        <h2>6. Per quanto tempo</h2>
        <p>
          Il cookie di sessione dura fino alla scadenza della sessione o al logout. Il
          materiale inviato è elaborato per generare la skill e non è conservato in modo
          permanente da noi oltre il tempo necessario; i log tecnici seguono i tempi del
          fornitore di infrastruttura.
        </p>
      </section>

      <section>
        <h2>7. I tuoi diritti</h2>
        <p>
          Puoi esercitare i diritti previsti dagli articoli 15-22 del GDPR: accesso,
          rettifica, cancellazione, limitazione, opposizione e portabilità. Scrivi a{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>. Puoi anche
          rivolgerti al Garante per la protezione dei dati personali.
        </p>
      </section>

      <section>
        <h2>8. Modifiche</h2>
        <p>
          Possiamo aggiornare questa informativa; la data in alto indica la versione in
          vigore.
        </p>
      </section>
    </LegalShell>
  );
}
