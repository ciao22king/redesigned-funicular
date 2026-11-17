import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { sortedChangelog, kindLabel } from '@/lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog · Skill Forge',
  description:
    'What changed on Skill Forge, written as notes about the effect rather than a list of commits.',
  alternates: { canonical: '/changelog' },
};

/**
 * Changelog page.
 *
 * The entries are read from `lib/changelog.ts`, the same source the RSS item and
 * any future "what's new" banner would use, so there is one place to add a note.
 */
export default function ChangelogPage() {
  const entries = sortedChangelog();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          Changelog
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          What changed
        </h1>
        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          Short notes on what is new, improved or fixed, written about the effect
          for you rather than as a list of commits. Newest first.
        </p>

        <div className="hairline my-10" />

        <ol className="space-y-10">
          {entries.map((entry) => (
            <li key={`${entry.date}-${entry.title}`} className="relative pl-6">
              <span
                aria-hidden
                className="absolute left-0 top-2 h-2 w-2 rounded-full bg-[--accent]"
              />
              <div className="flex flex-wrap items-baseline gap-3">
                <time
                  dateTime={entry.date}
                  className="font-mono text-xs uppercase tracking-wider text-[--ink-muted]"
                >
                  {entry.date}
                </time>
                <span className="rounded-full border border-[--line] bg-[--surface-sunken] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[--accent]">
                  {kindLabel(entry.kind)}
                </span>
              </div>
              <h2 className="mt-2 font-display text-xl font-semibold text-[--ink]">
                {entry.title}
              </h2>
              <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-[--ink-muted]">
                {entry.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="hairline my-10" />

        <p className="text-sm text-[--ink-muted]">
          Prefer a feed? The{' '}
          <Link href="/feed.xml" className="text-[--accent] underline underline-offset-2">
            RSS feed
          </Link>{' '}
          carries the newest published skills. The{' '}
          <Link href="/use-cases" className="text-[--accent] underline underline-offset-2">
            use cases
          </Link>{' '}
          show what the generator is good at.
        </p>
      </main>
      <Footer />
    </>
  );
}
