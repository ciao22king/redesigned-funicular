import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SkillGrid } from '@/components/SkillGrid';
import { countSkills, listSkills } from '@/lib/marketplace-db';
import { toSummary } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  owner: string;
}

/** GitHub logins are alphanumeric with single hyphens, up to 39 chars. */
const OWNER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

async function load(owner: string) {
  if (!OWNER_RE.test(owner)) return null;
  try {
    const [rows, total] = await Promise.all([
      listSkills({ owner, sort: 'recent', limit: 100 }),
      countSkills({ owner }),
    ]);
    return { owner, skills: rows.map((r) => toSummary(r)), total };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { owner } = await params;
  if (!OWNER_RE.test(owner)) return { title: 'Author not found · Skill Forge' };
  return {
    title: `@${owner} · Skill Forge`,
    description: `Skills for AI agents published by @${owner} on Skill Forge.`,
    alternates: { canonical: `/u/${owner}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<Params> }) {
  const { owner } = await params;
  const data = await load(owner);
  if (!data || data.total === 0) notFound();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <header className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://avatars.githubusercontent.com/${owner}`}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border border-[--line] bg-[--surface-raised]"
          />
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
              Author
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
              @{data.owner}
            </h1>
            <p className="mt-1 text-sm text-[--ink-muted]">
              {data.total} {data.total === 1 ? 'skill' : 'skills'} published
            </p>
          </div>
        </header>

        <div className="hairline my-10" />

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

        <p className="mt-12 text-sm text-[--ink-muted]">
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            Browse the full marketplace
          </Link>
          {' · '}
          <Link href="/tags" className="text-[--accent] underline underline-offset-2">
            All tags
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
