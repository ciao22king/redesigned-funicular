import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy · Skill Forge',
  description: 'How Skill Forge handles personal data.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="November 5, 2026">
      <section>
        <h2>1. Data controller</h2>
        <p>
          The data controller is the operator of {legal.siteName}, a personal
          project, reachable at{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>.
        </p>
      </section>

      <section>
        <h2>2. What data we process</h2>
        <ul>
          <li>
            <strong>GitHub sign-in data</strong>: identifier, username, name and
            profile image, email address (if made available). We receive them
            through OAuth authentication when you sign in.
          </li>
          <li>
            <strong>Material you submit</strong>: the text or documents you
            upload to generate a skill, and the answers to the six questions in
            the &quot;from scratch&quot; mode.
          </li>
          <li>
            <strong>Published skills</strong>: if you choose to publish to the
            marketplace, the skill and your GitHub username are stored and made
            visible to anyone. You can delete them at any time from your
            dashboard.
          </li>
          <li>
            <strong>Registration record</strong>: when you sign in, your GitHub
            username and the date of your first and most recent sign-in are
            stored, so the landing page can show how many people registered.
            Only the username is kept, no email and no token.
          </li>
          <li>
            <strong>Technical data</strong>: IP address, request data and logs,
            handled by our infrastructure provider for security and operation.
          </li>
          <li>
            <strong>Cookies</strong>: one session cookie required to keep you
            signed in (see the <a href="/cookie">cookie policy</a>).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Why we process it (purposes and legal bases)</h2>
        <ul>
          <li>
            <strong>Providing the service</strong> (generating and publishing the
            skill): performance of a contract.
          </li>
          <li>
            <strong>Security and abuse prevention</strong>: legitimate interest.
          </li>
          <li>
            <strong>Legal obligations</strong>, if required: legal obligation.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Who it is shared with</h2>
        <p>We rely on providers that process data as processors:</p>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting and delivery (Workers,
            network).
          </li>
          <li>
            <strong>GitHub</strong> — authentication and reading your profile.
          </li>
          <li>
            <strong>OpenRouter</strong> — the text you submit is transmitted to
            the language model to produce the skill. OpenRouter may route the
            request to one of the available models.
          </li>
        </ul>
        <p>
          We do not sell your data and we do not use it for advertising or
          profiling.
        </p>
      </section>

      <section>
        <h2>5. Transfers outside the EU</h2>
        <p>
          Some providers are based in the United States. Transfers take place
          under the European Commission&apos;s standard contractual clauses or
          other safeguards provided by the GDPR.
        </p>
      </section>

      <section>
        <h2>6. For how long</h2>
        <p>
          The session cookie lasts until the session expires or you sign out. The
          material you submit is processed to generate the skill and is not kept
          permanently by us beyond the time required; technical logs follow the
          infrastructure provider&apos;s retention periods.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          You can exercise the rights set out in articles 15-22 of the GDPR:
          access, rectification, erasure, restriction, objection and
          portability. Write to{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>. You may
          also lodge a complaint with your local data protection authority.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update this policy; the date at the top indicates the version in
          force.
        </p>
      </section>
    </LegalShell>
  );
}
