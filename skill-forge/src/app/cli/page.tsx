import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import {
  CLI_BINARIES,
  CLI_COMMANDS,
  CLI_INSTALL_COMMAND,
  CLI_NODE,
  CLI_PACKAGE,
  CLI_STEPS,
  CLI_TOKEN_SOURCES,
} from '@/lib/cli';

export const metadata: Metadata = {
  title: 'CLI · Skill Forge',
  description:
    'Install the Skill Forge CLI from npm, sign in with GitHub and generate, publish or pull skills from the terminal. Node 18 or later, no runtime dependencies.',
  alternates: { canonical: '/cli' },
};

/**
 * CLI page.
 *
 * The install command, the sign-in flow and the command reference. Everything
 * comes from `lib/cli.ts` so the landing page and this page cannot drift, and
 * a test guards the package name.
 */
export default function CliPage() {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          CLI
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          Skill Forge from the terminal
        </h1>
        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          The same service as the web app, as a CLI. Generate, publish and pull
          skills without leaving the shell. It talks to the same public API, has
          no runtime dependencies and needs Node {CLI_NODE} or later.
        </p>

        <div className="mt-8 rounded-2xl border border-[--line] bg-[--surface-raised] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
            Install
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[oklch(20%_0.02_50)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[oklch(91%_0.03_70)]">
            <code>$ {CLI_INSTALL_COMMAND}</code>
          </pre>
          <p className="mt-3 text-xs text-[--ink-muted]">
            Installs two commands:{' '}
            {CLI_BINARIES.map((b, i) => (
              <span key={b}>
                {i > 0 ? ' and ' : ''}
                <code className="font-mono text-[--ink]">{b}</code>
              </span>
            ))}
            . On npm:{' '}
            <a
              href={`https://www.npmjs.com/package/${CLI_PACKAGE}`}
              className="text-[--accent] underline underline-offset-2"
            >
              {CLI_PACKAGE}
            </a>
            .
          </p>
        </div>

        <div className="hairline my-10" />

        {/* Three steps: install, sign in, use it */}
        <ol className="space-y-8">
          {CLI_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="mt-0.5 font-mono text-sm text-[--accent]">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-semibold tracking-tight text-[--ink]">
                  {s.title}
                </h2>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-[--ink-muted]">
                  {s.body}
                </p>
                {s.code && (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-[oklch(20%_0.02_50)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[oklch(91%_0.03_70)]">
                    <code>$ {s.code}</code>
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="hairline my-10" />

        {/* Authentication detail: the token sources, in priority order */}
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[--ink]">
            Authentication
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-[--ink-muted]">
            <code className="font-mono text-[13px] text-[--ink]">login</code> starts
            GitHub&apos;s Device Flow: it prints a code, you open{' '}
            <code className="font-mono text-[13px] text-[--ink]">
              github.com/login/device
            </code>
            , enter it and authorize. The CLI waits and saves the token as soon as
            it arrives. The token is stored in{' '}
            <code className="font-mono text-[13px] text-[--ink]">
              ~/.config/skill-forge/config.json
            </code>{' '}
            with mode <code className="font-mono text-[13px] text-[--ink]">600</code>.
          </p>
          <p className="mt-4 text-sm text-[--ink-muted]">
            The token is read from the first source that has one:
          </p>
          <ol className="mt-3 space-y-1.5">
            {CLI_TOKEN_SOURCES.map((src, i) => (
              <li key={src} className="flex gap-3 text-sm text-[--ink]">
                <span className="font-mono text-[--accent]">{i + 1}.</span>
                <code className="font-mono text-[13px]">{src}</code>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-[--ink-muted]">
            The token is only needed by the commands that write. Reading commands
            work without an account, and in a non-interactive context (CI, a pipe)
            the Device Flow is skipped automatically: use{' '}
            <code className="font-mono text-[13px] text-[--ink]">--token</code> or{' '}
            <code className="font-mono text-[13px] text-[--ink]">
              $SKILL_FORGE_TOKEN
            </code>{' '}
            instead.
          </p>
        </section>

        <div className="hairline my-10" />

        {/* Command reference: a table, the same list the CLI prints in `help` */}
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[--ink]">
            Commands
          </h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[--line] text-left">
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                    Command
                  </th>
                  <th className="py-2 font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                    What it does
                  </th>
                </tr>
              </thead>
              <tbody>
                {CLI_COMMANDS.map((c) => (
                  <tr key={c.usage} className="border-b border-[--line] align-top">
                    <td className="py-3 pr-4">
                      <code className="whitespace-nowrap font-mono text-[12.5px] text-[--ink]">
                        {c.usage}
                      </code>
                    </td>
                    <td className="py-3 text-[--ink-muted]">
                      {c.what}
                      {c.needsAuth && (
                        <span className="ml-2 rounded-full border border-[--line] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[--ink-muted]">
                          token
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="hairline my-12" />

        <div className="rounded-2xl border border-[--accent] bg-[--accent-soft] p-6">
          <h2 className="font-display text-xl font-semibold text-[--ink]">
            Prefer the browser?
          </h2>
          <p className="mt-2 max-w-prose text-sm text-[--ink]">
            The web app does the same, with the marketplace, the demo and the
            editor. The CLI is for when you would rather not leave the shell.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Browse the marketplace
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
