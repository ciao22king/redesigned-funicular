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
            <strong>Technical data and logs</strong>: IP address, the request
            (method, path, status) and the user agent, recorded by our
            infrastructure provider for security, diagnostics and abuse
            prevention.
          </li>
          <li>
            <strong>Generation counter</strong>: a number, per account and per
            UTC day, used to enforce the daily limit. For the anonymous demo the
            counter is keyed on the IP address and stores no other information.
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
            network) and cookieless aggregate analytics (Web Analytics).
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
        <h2>5. What happens to the content you submit</h2>
        <p>
          The material you upload or paste is used only to generate the skill you
          asked for. It is sent in the request to OpenRouter and to the language
          model that serves it; it is not stored on our servers after the
          response, and it is not used to train any model by us.
        </p>
        <p>
          OpenRouter and the upstream model providers process the text under
          their own terms. Their retention and training practices are set by
          them, not by us. Do not submit material you are not allowed to share:
          in particular, do not paste proprietary source code, personal data of
          third parties, passwords, credentials or confidential documents.
        </p>
        <p>
          What you choose to publish to the marketplace is different: the skill
          and your GitHub username become public and remain so until you delete
          them from your dashboard. Treat publishing as a public act.
        </p>
      </section>

      <section>
        <h2>6. Transfers outside the EU</h2>
        <p>
          Some providers are based in the United States. Transfers take place
          under the European Commission&apos;s standard contractual clauses or
          other safeguards provided by the GDPR.
        </p>
      </section>

      <section>
        <h2>7. For how long</h2>
        <ul>
          <li>
            <strong>Submitted material</strong>: not retained. It lives in the
            request that produces the skill and is not written to our storage.
          </li>
          <li>
            <strong>Generated skills</strong>: kept in your browser&apos;s local
            archive, on your device, until you clear it. We hold a copy only if
            you publish it to the marketplace, until you delete it.
          </li>
          <li>
            <strong>Session cookie</strong>: until the session expires or you
            sign out.
          </li>
          <li>
            <strong>Generation counter</strong>: 48 hours, then it expires
            automatically.
          </li>
          <li>
            <strong>Registration record</strong>: username and sign-in dates,
            until you ask us to delete them.
          </li>
          <li>
            <strong>Technical logs</strong>: for the retention period of our
            infrastructure provider (Cloudflare), which is kept short and is used
            for security and diagnostics.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          You can exercise the rights set out in articles 15-22 of the GDPR:
          access, rectification, erasure, restriction, objection and
          portability. Write to{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>. You may
          also lodge a complaint with your local data protection authority.
        </p>
      </section>

      <section>
        <h2>9. Changes</h2>
        <p>
          We may update this policy; the date at the top indicates the version in
          force.
        </p>
      </section>
    </LegalShell>
  );
}
