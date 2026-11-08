import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { USE_CASES } from '@/lib/usecases';

export const metadata: Metadata = {
  title: 'Use cases · Skill Forge',
  description:
    'Five concrete cases: code review, incident postmortem, onboarding, customer support and DevOps runbooks. The material you start from, and the skill it becomes.',
  alternates: { canonical: '/use-cases' },
};

/**
 * Use cases page.
 *
 * One section per case, each with the situation, the material a person actually
 * has, what the skill does and the steps it enforces. It is written so a reader
 * recognises their own week and tries it with their own notes.
 */
export default function UseCasesPage() {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          Use cases
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          Five things people turn into skills
        </h1>
        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          Each case below starts from material you already have and ends with a
          skill an agent can follow. If one of them sounds like your week, paste
          your own notes into the{' '}
          <Link href="/demo" className="text-[--accent] underline underline-offset-2">
            demo
          </Link>{' '}
          and see the result.
        </p>

        <nav aria-label="Jump to a case" className="mt-8 flex flex-wrap gap-2">
          {USE_CASES.map((u) => (
            <a
              key={u.slug}
              href={`#${u.slug}`}
              className="rounded-full border border-[--line] bg-[--surface-raised] px-3.5 py-1.5 text-xs text-[--ink-muted] transition-colors hover:border-[--accent] hover:text-[--ink]"
            >
              {u.title}
            </a>
          ))}
        </nav>

        <div className="hairline my-10" />

        <div className="space-y-16">
          {USE_CASES.map((u, i) => (
            <section key={u.slug} id={u.slug} className="scroll-mt-24">
              <p className="font-mono text-xs uppercase tracking-wider text-[--accent]">
                Case {i + 1}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[--ink]">
                {u.title}
              </h2>
              <p className="mt-2 max-w-prose text-sm text-[--ink-muted]">{u.audience}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                    The situation
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[--ink]">{u.situation}</p>
                </div>
                <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                    What you start from
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[--ink]">{u.input}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[--line] bg-[--surface-sunken] p-5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                  What the skill does
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[--ink]">{u.outcome}</p>
              </div>

              <div className="mt-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                  The steps it enforces
                </p>
                <ol className="mt-3 space-y-2">
                  {u.steps.map((step, j) => (
                    <li key={j} className="flex gap-3 text-sm text-[--ink]">
                      <span className="font-mono text-[--accent]">{j + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ))}
        </div>

        <div className="hairline my-12" />

        <div className="rounded-2xl border border-[--accent] bg-[--accent-soft] p-6">
          <h2 className="font-display text-xl font-semibold text-[--ink]">
            Start from the one that matches your week
          </h2>
          <p className="mt-2 max-w-prose text-sm text-[--ink]">
            Paste the material into the demo, or sign in to keep, edit and publish
            the result.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Try the demo
            </Link>
            <Link
              href="/create/from-skills"
              className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Create a skill
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
