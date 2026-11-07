'use client';

import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { userCountLabel } from '@/lib/users';

/**
 * Landing page body. It is a client component because of the session state
 * (`useSession`/`signIn`); the registered-user count is passed in from the
 * server component `app/page.tsx`, so it is rendered in the HTML and visible to
 * search engines, not fetched after hydration.
 */
export function Landing({ userCount }: { userCount?: number }) {
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
                <Link
                  href="/create/from-skills"
                  className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                >
                  Create your first skill
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => signIn('github')}
                  className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                >
                  Sign in with GitHub
                </button>
              )}
              <Link
                href="/create/from-scratch"
                className="rounded-xl border border-[--line] bg-[--surface-raised] px-6 py-3.5 font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
              >
                Start from scratch
              </Link>
            </div>

            {userCount !== undefined && (
              <p className="mt-8 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[--ink-muted]">
                <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" aria-hidden />
                {userCountLabel(userCount)} registered
              </p>
            )}
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
              body="Transcripts, notes, exported PDFs, a rough skill. The model merges everything into one document, fills the gaps and keeps every technical detail."
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

        {/* How it works: a numbered sequence, not a grid */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            How it works
          </h2>
          <ol className="mt-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
            <Step n="1" t="Sign in with GitHub">
              One click, to read your profile. The author identity is used
              to sign the skills you publish.
            </Step>
            <Step n="2" t="Provide material or answer the wizard">
              Up to twenty files, or six fields. The material stays only
              in the request, it is not archived.
            </Step>
            <Step n="3" t="The model writes the skill">
              Fixed structure: when to use it, prerequisites, procedure,
              examples, common mistakes, checklist.
            </Step>
            <Step n="4" t="Download or publish">
              A ready <code className="font-mono text-[13px]">.md</code> file,
              or publish to the marketplace, with author and stars.
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

export default Landing;
