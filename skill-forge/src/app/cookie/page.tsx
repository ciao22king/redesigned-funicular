import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Cookie policy · Skill Forge',
  description: 'Quali cookie usa Skill Forge e perché.',
};

export default function CookiePage() {
  return (
    <LegalShell title="Cookie policy" updated="5 novembre 2026">
      <section>
        <h2>1. In breve</h2>
        <p>
          Skill Forge usa <strong>un solo cookie</strong>, tecnico e necessario: serve a
          tenerti connesso dopo il login con GitHub. Non usiamo cookie di profilazione, di
          pubblicità né di tracciamento. Per questo <strong>non mostriamo un banner
          cookie</strong>: non c’è nulla da acconsentire.
        </p>
      </section>

      <section>
        <h2>2. Il cookie che usiamo</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Scopo</th>
                <th>Durata</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>next-auth.session-token</code></td>
                <td>Tecnico, necessario</td>
                <td>Mantiene la sessione dopo il login GitHub</td>
                <td>Fino a 30 giorni, o al logout</td>
              </tr>
              <tr>
                <td><code>next-auth.csrf-token</code></td>
                <td>Tecnico, necessario</td>
                <td>Protegge i moduli da richieste falsificate (CSRF)</td>
                <td>Sessione</td>
              </tr>
              <tr>
                <td><code>next-auth.callback-url</code></td>
                <td>Tecnico, necessario</td>
                <td>Ricorda dove tornare dopo il login</td>
                <td>Sessione</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Il cookie di sessione è firmato e cifrato; contiene il token GitHub che ci permette
          di leggere il tuo profilo.
        </p>
      </section>

      <section>
        <h2>3. Perché nessun banner</h2>
        <p>
          La normativa (direttiva ePrivacy e linee guida del Garante) richiede il consenso
          solo per cookie diversi da quelli tecnici necessari. Dato che l’unico cookie che
          impostiamo è strettamente necessario al funzionamento, non serve alcun consenso
          preventivo.
        </p>
      </section>

      <section>
        <h2>4. Cosa non facciamo</h2>
        <ul>
          <li>Nessun cookie di terze parti per pubblicità o analytics.</li>
          <li>Nessun tracciamento tra siti diversi.</li>
          <li>Nessuna profilazione.</li>
        </ul>
      </section>

      <section>
        <h2>5. Come gestirli</h2>
        <p>
          Puoi cancellare o bloccare i cookie dalle impostazioni del browser. Se blocchi il
          cookie di sessione, però, non potrai restare connesso e il servizio non funzionerà
          correttamente.
        </p>
      </section>

      <section>
        <h2>6. Contatti</h2>
        <p>
          Per domande sui cookie scrivi a{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>. Vedi anche
          l’<a href="/privacy">informativa privacy</a>.
        </p>
      </section>
    </LegalShell>
  );
}
