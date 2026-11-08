import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Share } from '@/components/Share';
import { Report } from '@/components/Report';
import { getSkill } from '@/lib/marketplace-db';
import { skillId, toDetail } from '@/lib/marketplace';
import { parseMarkdown, type Block } from '@/lib/markdown';
import { siteBase } from '@/lib/site-url';
import { legal } from '@/lib/legal';

export const runtime = 'nodejs';
// Rendered per request: the skill list lives in D1, which is only bound on the
// Worker at runtime, not during `next build`.
export const dynamic = 'force-dynamic';

interface Params {
  owner: string;
  slug: string;
}

async function load(id: string) {
  try {
    const row = await getSkill(id);
    return row ? toDetail(row) : null;
  } catch {
    // D1 missing (for example in local dev without the binding): behave like a
    // missing page rather than crashing the whole render.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { owner, slug } = await params;
  const skill = await load(skillId(owner, slug));
  if (!skill) return { title: 'Skill not found · Skill Forge' };

  const base = await siteBase();
  const url = `${base}/s/${owner}/${slug}`;
  const description =
    skill.description ||
    `A skill for AI agents published by @${owner} on Skill Forge.`;

  return {
    title: `${skill.name} · Skill Forge`,
    description,
    alternates: { canonical: `/s/${owner}/${slug}` },
    openGraph: {
      type: 'article',
      url,
      title: `${skill.name} · Skill Forge`,
      description,
      siteName: 'Skill Forge',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${skill.name} · Skill Forge`,
      description,
    },
  };
}

export default async function SkillPage({ params }: { params: Promise<Params> }) {
  const { owner, slug } = await params;
  const skill = await load(skillId(owner, slug));
  if (!skill) notFound();

  const base = await siteBase();
  const url = `${base}/s/${owner}/${slug}`;
  const blocks = parseMarkdown(skill.markdown);

  // Structured data so search engines understand this is an authored work.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: skill.name,
    description: skill.description,
    url,
    author: { '@type': 'Person', name: `@${owner}` },
    datePublished: skill.createdAt,
    dateModified: skill.updatedAt,
    keywords: skill.tags.join(', '),
    isPartOf: { '@type': 'WebSite', name: legal.siteName, url: legal.siteUrl },
  };

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <script
          type="application/ld+json"
          // Structured data only: `JSON.stringify` of a plain object, no user HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <header className="mb-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
            Skill
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            {skill.name}
          </h1>
          {skill.description && (
            <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-[--ink-muted]">
              {skill.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[--ink-muted]">
            <Link href={`/u/${owner}`} className="text-[--accent] underline underline-offset-2">
              @{owner}
            </Link>
            <span>★ {skill.stars}</span>
            {skill.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/tags/${tag}`}
                      className="rounded-full bg-[--surface-sunken] px-2.5 py-1 font-mono text-[11px] transition-colors hover:text-[--accent]"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={`/api/marketplace/detail?id=${encodeURIComponent(skill.id)}`}
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Download .md
            </a>
            <Share title={skill.name} url={url} />
            <Report skillId={skill.id} />
          </div>
          <div className="hairline mt-8" />
        </header>

        <article className="skill-body space-y-5 text-[15px] leading-relaxed text-[--ink]">
          {blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </article>

        <div className="hairline my-10" />
        <p className="text-sm text-[--ink-muted]">
          Want one of your own?{' '}
          <Link href="/create/from-skills" className="text-[--accent] underline underline-offset-2">
            Create a skill
          </Link>{' '}
          or browse the{' '}
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            marketplace
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${Math.min(block.level + 1, 6)}`) as 'h2';
      return <Tag className="font-display text-xl font-semibold text-[--ink]">{block.text}</Tag>;
    }
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-6">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-6">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl bg-[oklch(20%_0.02_50)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[oklch(91%_0.03_70)]">
          <code>{block.text}</code>
        </pre>
      );
    default:
      return <p>{block.text}</p>;
  }
}
