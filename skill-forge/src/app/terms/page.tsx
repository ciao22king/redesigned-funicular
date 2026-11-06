import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of service · Skill Forge',
  description: 'Terms of use of the Skill Forge service.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of service" updated="November 5, 2026">
      <section>
        <h2>1. What Skill Forge is</h2>
        <p>
          Skill Forge is a service that turns raw material (notes, documents,
          descriptions) into a skill in Markdown format for AI agents. It offers
          two modes: starting from existing material, or from scratch by
          answering six questions. The result can be downloaded as a{' '}
          <code>.md</code> file or published to the Skill Forge marketplace.
        </p>
      </section>

      <section>
        <h2>2. Access</h2>
        <p>
          Access is through GitHub. You need a valid GitHub account. You are
          responsible for the confidentiality of your credentials and for all
          activity carried out with your account. You must be at least the
          minimum age set by the law of your country to consent to data
          processing (in Italy, 14 years).
        </p>
      </section>

      <section>
        <h2>3. Permitted use</h2>
        <p>You agree not to use the service to:</p>
        <ul>
          <li>upload unlawful or defamatory content, or content that infringes the rights of others;</li>
          <li>attempt to circumvent technical limits, usage limits or security measures;</li>
          <li>automate requests in a way that degrades the service for other users;</li>
          <li>generate misleading or harmful content intended for others.</li>
        </ul>
      </section>

      <section>
        <h2>4. Content you provide</h2>
        <p>
          You keep ownership of the material you upload. By uploading it, you
          authorise us to process it for the sole purpose of generating the
          requested skill and to transmit it to the language model provider
          (OpenRouter and the models it routes to). We do not acquire rights over
          your material beyond what is needed to provide the service.
        </p>
        <p>
          The generated skill is yours. However, automatic generation can produce
          inaccuracies: <strong>always verify the result before using it</strong>,
          in particular if it contains commands, code or operational procedures.
        </p>
      </section>

      <section>
        <h2>5. Publishing to the marketplace</h2>
        <p>
          If you choose to publish, the skill is stored on the Skill Forge
          marketplace and becomes visible to anyone, with your username as the
          author. You can delete it at any time from your dashboard. You are
          responsible for the content you publish.
        </p>
      </section>

      <section>
        <h2>6. Availability and limits</h2>
        <p>
          The service is provided &quot;as is&quot;, with no guarantee of
          continuous availability. We rely on third-party providers (Cloudflare,
          GitHub, OpenRouter) and we may suspend, change or discontinue the
          service, in whole or in part, at any time.
        </p>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          To the extent permitted by law, we are not liable for indirect damages,
          loss of data or loss of profit arising from the use of, or inability to
          use, the service, nor for the content of the generated skills.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these terms. The version in force is the one published on
          this page, with the last-updated date at the top. Continued use after a
          change implies acceptance of it.
        </p>
      </section>

      <section>
        <h2>9. Governing law</h2>
        <p>
          These terms are governed by Italian law. For disputes, the competent
          court is the consumer&apos;s court, where applicable.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          For legal matters or reports, write to{' '}
          <a href="mailto:ciao22king@gmail.com">ciao22king@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  );
}
