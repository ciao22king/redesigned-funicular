'use client';

import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { BeforeAfter } from '@/components/BeforeAfter';
import Link from 'next/link';
import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import type { FeaturedCandidate } from '@/lib/creator';
import { CLI_INSTALL_COMMAND } from '@/lib/cli';

/**
 * Landing page body. It is a client component because of the session state
 * (`useSession`/`signIn`); the featured skills are passed in from the server
 * component `app/page.tsx`, so they are rendered in the HTML and visible to
 * search engines, not fetched after hydration.
 */
export function Landing({ featured = [] }: { featured?: FeaturedCandidate[] }) {
  const { status } = useSession();

  return (
    <>
      <Nav />

      <main id="content" className="mx-auto max-w-6xl px-6">
        {/* Hero: asymmetric, not all centered */}
        <section className="grid items-start gap-14 py-20 lg:grid-cols-[1.35fr_1fr] lg:py-28">
          <div className="animate-fade-up">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[--line] bg-[--surface-raised] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
              <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              For AI agents
            </p>

            <h1 className="font-display text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-[--ink]">
              Your notes are not
              <br />
              a skill yet.
              <br />
              <span className="text-[--accent]">We make them one.</span>
            </h1>

            <p className="mt-8 max-w-prose text-[18px] leading-relaxed text-[--ink-muted]">
              Upload notes, documents or drafts, or start from scratch.
              The model writes an operational document with a numbered procedure,
              examples, common mistakes and a verification checklist.
              Then download it or publish it to the marketplace.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {status === 'authenticated' ? (
                <>
                  <Link
                    href="/create/from-skills"
                    className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Create your first skill
                  </Link>
                  <Link
                    href="/create/from-scratch"
                    className="rounded-xl border border-[--line] bg-[--surface-raised] px-6 py-3.5 font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
                  >
                    Start from scratch
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/demo"
                    className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Try the demo, no account
                  </Link>
                  <button
                    type="button"
                    onClick={() => signIn('github')}
                    className="rounded-xl border border-[--line] bg-[--surface-raised] px-6 py-3.5 font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
                  >
                    Sign in with GitHub
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Side panel: a sample output, not a decorative card */}
          <aside className="animate-fade-up rounded-2xl border border-[--line] bg-[--surface-raised] p-6 lg:mt-6">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
              Typical output
            </p>
            <div className="space-y-3 font-mono text-[12.5px] leading-relaxed text-[--ink-muted]">
              <p className="text-[--ink]">---</p>
              <p className="text-[--ink]">name: pull-request-review</p>
              <p className="text-[--ink]">description: Analyze a PR and produce a report with blockers, suggestions and risks.</p>
              <p className="text-[--ink]">---</p>
              <div className="hairline my-4" />
              <p className="text-[--ink]">## Procedure</p>
              <p>1. Read the full diff before commenting.</p>
              <p>2. Separate blocking issues from suggestions.</p>
              <p>3. Verify every claim against the code, not the description.</p>
            </div>
          </aside>
        </section>

        <div className="hairline" />

        {/* The two modes: differentiated, not two identical cards */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            Two ways to start
          </h2>

          <div className="mt-12 space-y-4">
            <ModeRow
              letter="A"
              title="I already have material"
              body="Transcripts, notes, exported PDFs, a rough skill. The model merges everything into one document, identifies missing information and asks targeted questions, and keeps every technical detail."
              href="/create/from-skills"
              cta="Upload material"
            />
            <ModeRow
              letter="B"
              title="I start from an idea"
              body="Six questions about name, domain, goal, tone and constraints. The model writes the full procedure from scratch, with realistic examples and common mistakes."
              href="/create/from-scratch"
              cta="Fill in the wizard"
            />
          </div>
        </section>

        <div className="hairline" />

        {/* Before / After: the transformation, shown side by side */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            Before and after
          </h2>
          <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
            On the left, the raw material: a few standup notes, written for
            people. On the right, the skill the model produces from it, written
            for an agent, with a procedure, examples and a checklist.
          </p>
          <div className="mt-12">
            <BeforeAfter />
          </div>
          <p className="mt-6 text-sm text-[--ink-muted]">
            Where the notes are silent, the skill does not invent: it lists the
            missing information and the questions to ask.{' '}
            <Link href="/demo" className="text-[--accent] underline underline-offset-2">
              Try it with your own text →
            </Link>
          </p>
        </section>

        <div className="hairline" />

        {/* How it works: a numbered sequence, not a grid */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            How it works
          </h2>
          <ol className="mt-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
            <Step n="1" t="Try the demo, or sign in">
              Generate a free preview with no account, then sign in with GitHub
              to keep the skill. The author identity is used to sign the skills
              you publish.
            </Step>
            <Step n="2" t="Provide material or answer the wizard">
              Up to twenty files, or six fields. The material stays only
              in the request, it is not archived.
            </Step>
            <Step n="3" t="The model writes the skill">
              Fixed structure: when to use it, prerequisites, procedure,
              examples, common mistakes, checklist.
            </Step>
            <Step n="4" t="Edit, download or publish">
              Adjust the text, copy the Markdown, get a ready{' '}
              <code className="font-mono text-[13px]">.md</code> file, or publish
              to the marketplace, with author and stars.
            </Step>
          </ol>
        </section>

        <div className="hairline" />

        {/* Marketplace: the community showcase, with an algorithmic ranking */}
        <section className="py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
                Browse the marketplace
              </h2>
              <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
                Skills published by the community, ranked by an algorithm: the
                newest, the rising ones (trending) and the most starred.
                Download any skill as a <code className="font-mono text-[14px]">.md</code>{' '}
                file in one click.
              </p>
              <Link
                href="/marketplace"
                className="mt-6 inline-block text-sm font-medium text-[--accent] underline underline-offset-2"
              >
                Browse the marketplace →
              </Link>
            </div>
            <RankingPreview />
          </div>
        </section>

        <div className="hairline" />

        {/* CLI: the same service from the terminal, with a copyable command */}
        <section className="py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
                Or use it from the terminal
              </h2>
              <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
                The same service as a CLI. Generate, publish and pull skills
                without leaving the shell. No runtime dependencies: just Node 18
                or later.
              </p>
              <Link
                href="/cli"
                className="mt-6 inline-block text-sm font-medium text-[--accent] underline underline-offset-2"
              >
                Install the CLI →
              </Link>
            </div>
            <InstallCommand />
          </div>
        </section>

        {/* Featured skills: the creators whose work the community has starred
            most. It only appears once there is something to show, so a fresh
            marketplace does not render an empty heading. */}
        {featured.length > 0 && (
          <>
            <div className="hairline" />
            <section className="py-20">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
                Featured skills
              </h2>
              <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
                The most starred skills, from the creators who have published the
                most. Publish your own to be considered.
              </p>
              <ul className="mt-10 grid gap-4 md:grid-cols-3">
                {featured.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/skills/${s.id}`}
                      className="flex h-full flex-col rounded-2xl border border-[--line] bg-[--surface-raised] p-5 transition-colors hover:border-[--accent]"
                    >
                      <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[--accent] bg-[--accent-soft] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[--accent]">
                        Featured
                      </span>
                      <span className="font-mono text-[13px] text-[--ink]">{s.name}</span>
                      <span className="mt-2 line-clamp-3 text-sm text-[--ink-muted]">
                        {s.description}
                      </span>
                      <span className="mt-4 flex items-center justify-between text-xs text-[--ink-muted]">
                        <span>@{s.owner}</span>
                        <span className="font-mono">★ {s.stars}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

function ModeRow({
  letter,
  title,
  body,
  href,
  cta,
}: {
  letter: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group grid items-center gap-6 rounded-2xl border border-[--line] bg-[--surface-raised] p-7 transition-all duration-200 hover:border-[--accent] md:grid-cols-[auto_1fr_auto]"
    >
      <span className="font-display text-4xl font-semibold text-[--accent-soft] transition-colors group-hover:text-[--accent]">
        {letter}
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-[--ink]">
          {title}
        </h3>
        <p className="mt-2 max-w-prose text-[15px] text-[--ink-muted]">{body}</p>
      </div>
      <span className="whitespace-nowrap text-sm font-medium text-[--accent]">
        {cta} →
      </span>
    </Link>
  );
}

function Step({
  n,
  t,
  children,
}: {
  n: string;
  t: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-5">
      <span className="mt-0.5 font-mono text-sm text-[--accent]">{n}.</span>
      <div>
        <h3 className="font-display text-lg font-semibold text-[--ink]">{t}</h3>
        <p className="mt-1.5 max-w-prose text-[15px] text-[--ink-muted]">
          {children}
        </p>
      </div>
    </li>
  );
}

/**
 * A small, static illustration of the three marketplace rankings.
 * It is not live data: it only shows, at a glance, what the tabs mean.
 */
function RankingPreview() {
  const rows: { tab: string; name: string; stars: number; hint: string }[] = [
    { tab: 'Trending', name: 'pull-request-review', stars: 12, hint: '+8 this week' },
    { tab: 'New', name: 'changelog-writer', stars: 1, hint: 'published today' },
    { tab: 'Most starred', name: 'incident-postmortem', stars: 240, hint: 'all-time top' },
  ];

  return (
    <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
        Rankings
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.tab}
            className="flex items-center justify-between gap-3 rounded-xl bg-[--surface-sunken] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[--accent]">
                {r.tab}
              </p>
              <p className="truncate font-mono text-[13px] text-[--ink]">{r.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[13px] text-[--ink]">★ {r.stars}</p>
              <p className="text-[11px] text-[--ink-muted]">{r.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * CLI install command, with a copy button.
 * The command comes from `lib/cli.ts`, so the landing page and the /cli page
 * never disagree on the package name.
 */
function InstallCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CLI_INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure context or permission refused): the command
      // is still selectable by hand, so no warning is needed.
    }
  }

  return (
    <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
          Install
        </p>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg border border-[--line] px-3 py-1.5 text-xs font-medium text-[--ink-muted] transition-colors hover:text-[--ink]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-[oklch(20%_0.02_50)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[oklch(91%_0.03_70)]">
        <code>$ {CLI_INSTALL_COMMAND}</code>
      </pre>
      <div className="mt-4 space-y-1.5 font-mono text-[12.5px] leading-relaxed text-[--ink-muted]">
        <p>$ skill-forge login</p>
        <p>$ skill-forge generate -f notes.md -o skill.md</p>
      </div>
    </div>
  );
}

export default Landing;
