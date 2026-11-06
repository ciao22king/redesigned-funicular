import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Cookie policy · Skill Forge',
  description: 'Which cookies Skill Forge uses and why.',
};

export default function CookiePage() {
  return (
    <LegalShell title="Cookie policy" updated="November 5, 2026">
      <section>
        <h2>1. In short</h2>
        <p>
          Skill Forge uses <strong>a single cookie</strong>, technical and
          necessary: it keeps you signed in after the GitHub login. We do not use
          profiling, advertising or tracking cookies. That is why{' '}
          <strong>we do not show a cookie banner</strong>: there is nothing to
          consent to.
        </p>
      </section>

      <section>
        <h2>2. The cookie we use</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>next-auth.session-token</code></td>
                <td>Technical, necessary</td>
                <td>Keeps the session after the GitHub login</td>
                <td>Up to 30 days, or until sign-out</td>
              </tr>
              <tr>
                <td><code>next-auth.csrf-token</code></td>
                <td>Technical, necessary</td>
                <td>Protects forms from forged requests (CSRF)</td>
                <td>Session</td>
              </tr>
              <tr>
                <td><code>next-auth.callback-url</code></td>
                <td>Technical, necessary</td>
                <td>Remembers where to return after login</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The session cookie is signed and encrypted; it contains the GitHub
          token that lets us read your profile.
        </p>
      </section>

      <section>
        <h2>3. Why no banner</h2>
        <p>
          The rules (ePrivacy directive and the Italian Data Protection
          Authority&apos;s guidelines) require consent only for cookies other than
          the necessary technical ones. Since the only cookie we set is strictly
          necessary for the service to work, no prior consent is needed.
        </p>
      </section>

      <section>
        <h2>4. What we do not do</h2>
        <ul>
          <li>No third-party cookies for advertising or analytics.</li>
          <li>No tracking across different sites.</li>
          <li>No profiling.</li>
        </ul>
      </section>

      <section>
        <h2>5. How to manage them</h2>
        <p>
          You can delete or block cookies from your browser settings. If you
          block the session cookie, however, you will not be able to stay signed
          in and the service will not work correctly.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          For questions about cookies, write to{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>. See also
          the <a href="/privacy">privacy policy</a>.
        </p>
      </section>
    </LegalShell>
  );
}
