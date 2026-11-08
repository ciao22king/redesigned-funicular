import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { legal } from '@/lib/legal';
import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, formatBytes } from '@/lib/uploads';
import { MAX_SOURCE_CHARS, MAX_OUTPUT_CHARS } from '@/lib/guardrails';
import { OPT_OUT_EFFECT } from '@/lib/preferences';

export const metadata: Metadata = {
  title: 'Security & Privacy · Skill Forge',
  description:
    'Where Skill Forge keeps your data, for how long, the upload limits, how uploads are scanned, and who processes data on our behalf.',
  alternates: { canonical: '/security' },
};

/**
 * Security & Privacy: the concrete version of the privacy policy.
 *
 * The numbers here come from the same constants the server enforces, so the
 * page cannot promise a limit the code does not apply.
 */
export default function SecurityPage() {
  return (
    <LegalShell title="Security & Privacy" updated={legal.lastUpdated}>
      <section>
        <h2>1. The short version</h2>
        <ul>
          <li>Your material is not stored on our servers after the response.</li>
          <li>
            What is stored is small and specific: published skills, your GitHub
            username, a generation counter, and a short audit line for the
            actions that change public state.
          </li>
          <li>
            Uploads are checked before use: allowed formats, size limits, and a
            scan for binaries, harmful payloads and prompt-injection markers.
          </li>
          <li>
            You can turn off any use of your material to improve the service from
            your dashboard, in one click.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Where your data actually lives</h2>
        <p>Four places, and each one has a single purpose:</p>
        <ul>
          <li>
            <strong>Cloudflare D1</strong> (a SQLite database, in the Cloudflare
            network) holds the public data: published skills and their metadata,
            stars, the registration record, the audit log, reports, your
            preferences, the feedback you leave after a generation, and
            aggregate usage counters. It is bound to the Worker as{' '}
            <code>MARKETPLACE</code>.
          </li>
          <li>
            <strong>Cloudflare KV</strong> holds the generation counters, keyed
            per account (or per IP for the anonymous demo) and per UTC day. Each
            entry expires automatically after 48 hours.
          </li>
          <li>
            <strong>Your browser</strong> holds the skills you generate, in{' '}
            <code>localStorage</code>, until you clear them. This copy is on your
            device and is not visible to us.
          </li>
          <li>
            <strong>Cloudflare observability</strong> holds request logs
            (method, path, status, and the request metadata Cloudflare records)
            for security and diagnostics, on Cloudflare&apos;s retention window.
          </li>
        </ul>
        <p>
          There is no other datastore. There is no third-party analytics on your
          content, and no advertising profile.
        </p>
      </section>

      <section>
        <h2>3. How we measure, without identifying you</h2>
        <p>
          We count visits, generations, downloads, publications and the steps of
          the generation flow, and we read the feedback you choose to leave. All
          of it is aggregate, and that constrains how it is built:
        </p>
        <ul>
          <li>
            <strong>Counters, not events.</strong> The metrics table holds one
            row per day, per event, per target, with a running count and a summed
            duration. There is no row per visit and no per-request value.
          </li>
          <li>
            <strong>No identifier and no IP.</strong> The metrics table has no
            user, session or address column. The address is used only to rate
            limit the anonymous demo, in KV, and is not written to the metrics.
          </li>
          <li>
            <strong>No cookie.</strong> The visit beacon is cookieless. Whether
            you are a returning visitor is decided on your device, from a date in{' '}
            <code>localStorage</code>; only the resulting yes/no is sent, never
            the date.
          </li>
          <li>
            <strong>Feedback is about the skill, not you.</strong> The prompt
            after a generation stores a verdict and an optional short note. It
            carries no account and no address.
          </li>
        </ul>
        <p>
          The consequence is deliberate: there is no way to reconstruct who did
          what, only how many did it. That is the trade we make, and it is the
          reason no consent banner is needed for measurement.
        </p>
      </section>

      <section>
        <h2>4. What we keep, and for how long</h2>
        <ul>
          <li>
            <strong>Submitted material</strong>: not retained. It is used for the
            one request that generates the skill and is never written to D1 or
            KV. The only limit we enforce on it is size (see below).
          </li>
          <li>
            <strong>Published skills</strong>: kept in D1 until you delete them
            from your dashboard. Deleting also removes the associated stars.
          </li>
          <li>
            <strong>Registration record</strong>: your GitHub username and the
            dates of your first and most recent sign-in, kept until you ask us to
            delete them. No email, no token.
          </li>
          <li>
            <strong>Audit log</strong>: who did what and when (publish,
            unpublish, report, star), with the actor, the target, a short note and
            the address. It never contains the material. Entries older than 180
            days are removed.
          </li>
          <li>
            <strong>Reports</strong>: kept until the report is resolved or
            dismissed, so a pattern of abuse can be seen.
          </li>
          <li>
            <strong>Generation counter</strong>: 48 hours, then it expires.
          </li>
          <li>
            <strong>Preferences</strong>: your opt-out choice, until you change
            it or ask us to delete it.
          </li>
          <li>
            <strong>Usage counters</strong>: one row per day, per event, per
            skill, with a count and a summed duration. No identifier, no address,
            no per-visit row. They are kept as long as they are useful for the
            trend, and carry nothing that points to a person.
          </li>
          <li>
            <strong>Feedback</strong>: the verdict and the optional note you
            leave after a generation, kept so the notes can be acted on. It
            carries no account and no address.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Who processes data on our behalf</h2>
        <p>These are the only subprocessors:</p>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting, the D1 database, the KV
            counters and the network. All of the above runs inside Cloudflare.
          </li>
          <li>
            <strong>GitHub</strong> — sign-in through OAuth, and reading your
            public profile. We store only your username.
          </li>
          <li>
            <strong>OpenRouter</strong> — the gateway that routes the text you
            submit to the language model that writes the skill. OpenRouter and
            the upstream model provider process that text under their own terms;
            their retention and training practices are theirs, not ours.
          </li>
        </ul>
        <p>
          We do not sell your data. We do not share it with advertisers. There
          are no other third parties.
        </p>
      </section>

      <section>
        <h2>6. Upload limits</h2>
        <p>
          The limits are explicit and enforced, both in the browser and again on
          the server, so a crafted request cannot skip them:
        </p>
        <ul>
          <li>
            <strong>Formats</strong>: text only. Markdown, plain text, JSON,
            YAML, TOML, CSV and common source-code extensions. Anything else is
            refused by extension and again by content.
          </li>
          <li>
            <strong>Number of files</strong>: at most {MAX_FILES} per
            generation.
          </li>
          <li>
            <strong>Size per file</strong>: at most {formatBytes(MAX_FILE_BYTES)}.
          </li>
          <li>
            <strong>Combined size</strong>: at most {formatBytes(MAX_TOTAL_BYTES)}{' '}
            across all files, sources and pasted text.
          </li>
          <li>
            <strong>Material length</strong>: at most{' '}
            {MAX_SOURCE_CHARS.toLocaleString('en-US')} characters sent to the
            model; a generated skill is capped at{' '}
            {MAX_OUTPUT_CHARS.toLocaleString('en-US')} characters.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. How uploads are scanned</h2>
        <p>
          Every file is checked before it is read, and the material is checked
          again on the server:
        </p>
        <ul>
          <li>
            <strong>Binary detection</strong>: the first bytes of each file are
            compared against the signatures of executables, archives, images and
            documents (ELF, PE, PDF, ZIP, GZIP, PNG, JPEG, and others). A binary
            renamed to <code>.md</code> is refused, not read.
          </li>
          <li>
            <strong>Harmful payloads</strong>: shell and script patterns that are
            destructive or hostile (a fork bomb, a disk wipe, a pipe from a
            download straight into a shell, a reverse shell, an encoded
            PowerShell payload, credential-file reads) cause the request to be
            refused with a clear message.
          </li>
          <li>
            <strong>Prompt injection</strong>: phrases that try to override the
            instructions or to close the data block are detected and reported to
            you. They do not stop the generation, because the generator already
            treats your material strictly as data, never as instructions.
          </li>
          <li>
            <strong>Control characters</strong>: non-printable characters are
            flagged, as they are a common way to hide content.
          </li>
        </ul>
        <p>
          This is not a general-purpose antivirus and we do not claim it is.
          What it does is cover the threats that apply to a service that only
          ever reads text, and it is honest about being that.
        </p>
      </section>

      <section>
        <h2>8. Sanitising what becomes public</h2>
        <p>
          A skill&apos;s name, description and tags become public on the skill
          page, in the marketplace cards and in the RSS feed. They are sanitised
          on save: markup is stripped, control characters and zero-width
          characters are removed, and the whitespace is collapsed.
        </p>
        <p>
          The body of a skill is rendered through a Markdown parser that returns
          a typed block model, never an HTML string, so no field is ever inserted
          into the page as raw HTML. Text nodes are escaped by the renderer, and
          the same sanitising covers the RSS feed and the sitemap.
        </p>
      </section>

      <section>
        <h2>9. Reporting and moderation</h2>
        <p>
          Every published skill has a <strong>Report</strong> control. Anyone can
          use it, signed in or not. You choose a reason from a fixed list (spam,
          malware, harmful content, copyright, misleading) and may add a short
          note. A report never changes a skill by itself: it is a signal for the
          maintainer, who reviews it. Repeats of the same report for the same
          skill on the same day are collapsed into one.
        </p>
      </section>

      <section>
        <h2>10. Your training opt-out</h2>
        <p>
          In your dashboard there is a switch:{' '}
          <strong>
            &quot;Do not use my material to improve the service or the
            model&quot;
          </strong>
          . {OPT_OUT_EFFECT}
        </p>
        <p>
          To be precise about the default: we do not train models, and your
          material is already not retained after the response either way. The
          switch makes that commitment explicit and keeps your actions out of any
          evaluation or debugging sample.
        </p>
      </section>

      <section>
        <h2>11. Rate limits, in the open</h2>
        <p>
          The daily generation limit exists to keep the service available and to
          contain abuse. It is not a secret: every response carries{' '}
          <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and{' '}
          <code>X-RateLimit-Reset</code> headers, and the dashboard shows how
          much you have left. When a limit is reached, the response says exactly
          when it resets, in UTC and in your own time, and what you can do
          meanwhile.
        </p>
      </section>

      <section>
        <h2>12. How the service is built</h2>
        <ul>
          <li>
            <strong>Secrets stay on the server</strong>: the OpenRouter key, the
            GitHub client secret and the session secret are Worker secrets. They
            are never sent to the browser and never written to the repository.
          </li>
          <li>
            <strong>Least privilege</strong>: the D1 binding is scoped to the
            marketplace database, and the Worker holds no other credential than
            the ones it needs.
          </li>
          <li>
            <strong>Fetches are constrained</strong>: when you ask the service to
            read a public URL, only http and https are allowed, private and
            internal addresses (loopback, private ranges, link-local and cloud
            metadata) are refused, redirects are validated at every hop, and the
            body size and time are capped. This closes the server-side request
            forgery path.
          </li>
          <li>
            <strong>Identity is server-side</strong>: the author of a published
            skill comes from the verified session, never from the request body,
            so nobody can publish under another person&apos;s name.
          </li>
        </ul>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          For a security issue, a data request, or a takedown, write to{' '}
          <a href={`mailto:${legal.owner.email}`}>{legal.owner.email}</a>. We
          answer personal-project speed, but we do answer.
        </p>
      </section>
    </LegalShell>
  );
}
