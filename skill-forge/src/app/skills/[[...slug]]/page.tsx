import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SkillGrid } from '@/components/SkillGrid';
import { SkillDetailView } from '@/components/SkillDetailView';
import { loadSkillPage, resolveSlug } from '@/lib/skill-page-data';
import { categoryCounts, listSkills } from '@/lib/marketplace-db';
import { toSummary } from '@/lib/marketplace';
import { CATEGORIES, CATEGORY_META, categoryLabel, isCategory, skillPath } from '@/lib/skill-page';
import { siteBase } from '@/lib/site-url';

export const runtime = 'nodejs';
// Rendered per request: the skills live in D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

interface Params {
  slug?: string[];
}

/**
 * One route for the whole `/skills` surface.
 *
 * A single optional catch-all handles four shapes, because Next does not allow a
 * static `category` segment and a dynamic one at the same level:
 *
 *   /skills                       the index of every skill
 *   /skills/category/<id>         one category
 *   /skills/<slug>                a skill, when its slug is unambiguous
 *   /skills/<owner>/<slug>        the canonical skill page
 *
 * The one-segment form resolves through the database and, when it matches
 * exactly one skill, redirects (308) to the canonical two-segment URL, so there
 * is a single indexable address per skill.
 */
export default async function SkillsRoute({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const segments = (slug ?? []).filter(Boolean);

  if (segments.length === 0) return <SkillsIndex />;
  if (segments[0] === 'category') return <CategoryPage id={segments[1]} />;
  if (segments.length === 1) return <ShortSkill slug={segments[0]} />;
  if (segments.length === 2) return <CanonicalSkill owner={segments[0]} slug={segments[1]} />;

  notFound();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const segments = (slug ?? []).filter(Boolean);

  if (segments.length === 2) {
    const data = await loadSkillPage(segments[0], segments[1]);
    if (!data) return { title: 'Skill not found · Skill Forge' };
    const description =
      data.detail.description ||
      `A skill for AI agents published by @${segments[0]} on Skill Forge.`;
    return {
      title: `${data.detail.name} · Skill Forge`,
      description,
      alternates: { canonical: skillPath(segments[0], segments[1]) },
      openGraph: {
        type: 'article',
        title: `${data.detail.name} · Skill Forge`,
        description,
        siteName: 'Skill Forge',
      },
      twitter: { card: 'summary_large_image', title: `${data.detail.name} · Skill Forge`, description },
    };
  }

  if (segments[0] === 'category') {
    const id = segments[1];
    if (!id || !isCategory(id)) return { title: 'Category not found · Skill Forge' };
    return {
      title: `${categoryLabel(id)} skills · Skill Forge`,
      description: CATEGORY_META.find((c) => c.id === id)?.description,
      alternates: { canonical: `/skills/category/${id}` },
    };
  }

  return {
    title: 'Skills · Skill Forge',
    description: 'Every skill for AI agents published on Skill Forge.',
    alternates: { canonical: '/skills' },
  };
}

/** The canonical page. */
async function CanonicalSkill({ owner, slug }: { owner: string; slug: string }) {
  const data = await loadSkillPage(owner, slug);
  if (!data) notFound();
  const base = await siteBase();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <SkillDetailView data={data} base={base} />
      </main>
      <Footer />
    </>
  );
}

/**
 * The one-segment form. It is a permanent redirect to the canonical URL, never a
 * second copy of the page: two addresses for one skill would split the ranking.
 */
async function ShortSkill({ slug }: { slug: string }) {
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();
  permanentRedirect(skillPath(resolved.owner, resolved.slug));
  // `permanentRedirect` throws, so this is unreachable; it exists to satisfy the
  // JSX component contract, which requires a return value.
  return null;
}

/** The index of every skill. */
async function SkillsIndex() {
  const base = await siteBase();
  let skills: ReturnType<typeof toSummary>[] = [];
  let counts: { category: string; count: number }[] = [];
  try {
    const [rows, cats] = await Promise.all([listSkills({ sort: 'stars', limit: 100 }), categoryCounts()]);
    skills = rows.map((r) => toSummary(r));
    counts = cats;
  } catch {
    skills = [];
  }
  const countById = new Map(counts.map((c) => [c.category, c.count]));

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <header>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">Skills</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            Every skill
          </h1>
          <p className="mt-3 text-[15px] text-[--ink-muted]">
            {skills.length} {skills.length === 1 ? 'skill' : 'skills'} for AI agents, newest and most
            starred first.
          </p>
        </header>

        <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
          {CATEGORY_META.filter((c) => (countById.get(c.id) ?? 0) > 0).map((c) => (
            <Link
              key={c.id}
              href={`/skills/category/${c.id}`}
              className="rounded-full border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs text-[--ink-muted] transition-colors hover:border-[--accent] hover:text-[--accent]"
            >
              {c.label} <span className="font-mono">{countById.get(c.id)}</span>
            </Link>
          ))}
        </nav>

        <div className="hairline my-10" />

        {skills.length === 0 ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">No skills yet</p>
            <Link
              href="/create/from-skills"
              className="mt-3 inline-block text-sm text-[--accent] underline underline-offset-2"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <SkillGrid skills={skills} />
        )}

        <p className="mt-12 text-sm text-[--ink-muted]">
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            Marketplace
          </Link>
          {' · '}
          <Link href="/creators" className="text-[--accent] underline underline-offset-2">
            Creators
          </Link>
          {' · '}
          <Link href="/tags" className="text-[--accent] underline underline-offset-2">
            Tags
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}

/** One category. */
async function CategoryPage({ id }: { id?: string }) {
  if (!id || !isCategory(id)) notFound();
  let skills: ReturnType<typeof toSummary>[] = [];
  try {
    const rows = await listSkills({ category: id, sort: 'stars', limit: 100 });
    skills = rows.map((r) => toSummary(r));
  } catch {
    skills = [];
  }
  const meta = CATEGORY_META.find((c) => c.id === id)!;

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[--ink-muted]">
            <li>
              <Link href="/skills" className="transition-colors hover:text-[--accent]">
                Skills
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-[--ink]">{meta.label}</li>
          </ol>
        </nav>

        <header>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            {meta.label}
          </h1>
          <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">{meta.description}</p>
          <p className="mt-3 text-sm text-[--ink-muted]">
            {skills.length} {skills.length === 1 ? 'skill' : 'skills'}.
          </p>
        </header>

        <div className="hairline my-10" />

        {skills.length === 0 ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">Nothing here yet</p>
            <Link
              href="/skills"
              className="mt-3 inline-block text-sm text-[--accent] underline underline-offset-2"
            >
              Browse every skill
            </Link>
          </div>
        ) : (
          <SkillGrid skills={skills} />
        )}

        <nav aria-label="Other categories" className="mt-12 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c !== id).map((c) => (
            <Link
              key={c}
              href={`/skills/category/${c}`}
              className="rounded-full border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs text-[--ink-muted] transition-colors hover:border-[--accent] hover:text-[--accent]"
            >
              {categoryLabel(c)}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </>
  );
}
