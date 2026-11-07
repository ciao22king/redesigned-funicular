import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SkillGrid } from '@/components/SkillGrid';
import { countSkills, listSkills } from '@/lib/marketplace-db';
import { normalizeTag, toSummary } from '@/lib/marketplace';

export const runtime = 'nodejs';
// Per request: the skill list lives in D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

interface Params {
  tag: string;
}

async function load(tag: string) {
  const clean = normalizeTag(tag);
  if (!clean) return null;
  try {
    const [rows, total] = await Promise.all([
      listSkills({ tag: clean, sort: 'trending', limit: 60 }),
      countSkills({ tag: clean }),
    ]);
    return { tag: clean, skills: rows.map((r) => toSummary(r)), total };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag } = await params;
  const clean = normalizeTag(tag);
  if (!clean) return { title: 'Tag not found · Skill Forge' };
  return {
    title: `#${clean} skills · Skill Forge`,
    description: `Skills for AI agents tagged "${clean}" on Skill Forge.`,
    alternates: { canonical: `/tags/${clean}` },
  };
}

export default async function TagPage({ params }: { params: Promise<Params> }) {
  const { tag } = await params;
  const data = await load(tag);
  if (!data) notFound();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <header>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
            <Link href="/tags" className="transition-colors hover:text-[--accent]">
              Tags
            </Link>
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            #{data.tag}
          </h1>
          <p className="mt-3 text-[15px] text-[--ink-muted]">
            {data.total} {data.total === 1 ? 'skill' : 'skills'} with this tag.
          </p>
        </header>

        <div className="hairline my-10" />

        {data.skills.length === 0 ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">
              No skills with this tag yet
            </p>
            <Link
              href="/marketplace"
              className="mt-3 inline-block text-sm text-[--accent] underline underline-offset-2"
            >
              Browse the marketplace
            </Link>
          </div>
        ) : (
          <SkillGrid
            skills={data.skills.map((s) => ({
              id: s.id,
              owner: s.owner,
              name: s.name,
              description: s.description,
              tags: s.tags,
              stars: s.stars,
            }))}
          />
        )}

        <p className="mt-12 text-sm text-[--ink-muted]">
          <Link href="/tags" className="text-[--accent] underline underline-offset-2">
            All tags
          </Link>
          {' · '}
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            Marketplace
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
