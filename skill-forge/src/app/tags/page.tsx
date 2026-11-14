import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { tagCounts } from '@/lib/marketplace-db';
import { aggregateTags } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tags · Skill Forge',
  description: 'Browse skills for AI agents by tag.',
  alternates: { canonical: '/tags' },
};

export default async function TagsPage() {
  let tags: { tag: string; count: number }[] = [];
  try {
    tags = aggregateTags(await tagCounts());
  } catch {
    // D1 missing (local dev without the binding): show an empty state instead
    // of failing the whole page.
    tags = [];
  }

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <header>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
            Discovery
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            Tags
          </h1>
          <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">
            Every tag used on the marketplace, most used first. Open one to see
            the skills that carry it.
          </p>
        </header>

        <div className="hairline my-10" />

        {tags.length === 0 ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">No tags yet</p>
            <p className="mt-2 text-sm text-[--ink-muted]">
              Tags appear here as soon as skills are published with them.
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <Link
                  href={`/tags/${tag}`}
                  className="flex items-center gap-2 rounded-full border border-[--line] bg-[--surface-raised] px-3.5 py-2 font-mono text-[12px] text-[--ink] transition-colors hover:border-[--accent] hover:text-[--accent]"
                >
                  {tag}
                  <span className="rounded-full bg-[--surface-sunken] px-1.5 text-[11px] text-[--ink-muted]">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-sm text-[--ink-muted]">
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            Browse the full marketplace
          </Link>{' '}
          or search by name, description or author.
        </p>
      </main>
      <Footer />
    </>
  );
}
