import Link from 'next/link';
import { Share } from '@/components/Share';
import { SkillActions } from '@/components/SkillActions';
import { MarkdownBlocks } from '@/components/MarkdownBlocks';
import { SkillGrid } from '@/components/SkillGrid';
import { CreatorBadges } from '@/components/CreatorBadges';
import type { SkillDetail, SkillSummary } from '@/lib/marketplace';
import type { CreatorProfile, PublicProfileBadge, SocialLink } from '@/lib/profile';
import type { CreatorStats } from '@/lib/creator';
import type { VersionEntry } from '@/lib/skill-page';
import { parseMarkdown } from '@/lib/markdown';
import { skillBreadcrumb, skillPath, type CategoryId } from '@/lib/skill-page';
import { legal } from '@/lib/legal';

/** Everything the skill page renders, assembled by the route. */
export interface SkillPageData {
  id: string;
  owner: string;
  slug: string;
  detail: SkillDetail & { starred: boolean };
  profile: CreatorProfile;
  stats: CreatorStats;
  counters: { downloads: number; copies: number };
  versions: VersionEntry[];
  related: SkillSummary[];
  authorName: string;
  avatar: string;
  badges: PublicProfileBadge[];
  authorLinks: SocialLink[];
}

/**
 * The canonical skill page body.
 *
 * It is a server component: the markdown is rendered as React text nodes (never
 * HTML), the structured data is a plain object, and the action bar is the only
 * client island. That keeps a page that anyone can publish to cheap to serve and
 * safe to render.
 */
export function SkillDetailView({ data, base }: { data: SkillPageData; base: string }) {
  const { detail, owner, slug, counters, versions, related, authorName, avatar, badges, authorLinks } =
    data;
  const url = `${base}${skillPath(owner, slug)}`;
  const blocks = parseMarkdown(detail.markdown);
  const latestVersion = versions[0]?.version ?? 1;
  const breadcrumb = skillBreadcrumb({
    skillName: detail.name,
    category: detail.category as CategoryId,
  });

  // Structured data: the skill as an authored work, its author as a Person, and
  // the trail that leads to it. The `Person` node is the same entity the creator
  // page names, so search engines tie the two pages together.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': `${url}#skill`,
        name: detail.name,
        description: detail.description || undefined,
        url,
        version: String(latestVersion),
        genre: detail.category,
        keywords: detail.tags.join(', ') || undefined,
        datePublished: detail.createdAt,
        dateModified: detail.updatedAt,
        inLanguage: 'en',
        author: { '@id': `${base}/creators/${owner}#person` },
        isPartOf: { '@type': 'WebSite', name: legal.siteName, url: legal.siteUrl },
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/DownloadAction',
            userInteractionCount: counters.downloads,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: detail.stars,
          },
        ],
      },
      {
        '@type': 'Person',
        '@id': `${base}/creators/${owner}#person`,
        name: authorName,
        alternateName: `@${owner}`,
        url: `${base}/creators/${owner}`,
        image: avatar,
        description: data.profile.bio || undefined,
        sameAs: authorLinks.filter((l) => l.key !== 'github').map((l) => l.url),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumb.map((crumb, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: crumb.label,
          ...(crumb.href ? { item: `${base}${crumb.href}` } : {}),
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data only: `JSON.stringify` of a plain object, no user HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-[--ink-muted]">
          {breadcrumb.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-[--accent]">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[--ink]">{crumb.label}</span>
              )}
              {i < breadcrumb.length - 1 && <span aria-hidden>/</span>}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          {detail.name}
        </h1>

        {detail.description && (
          <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-[--ink-muted]">
            {detail.description}
          </p>
        )}

        {/* Author: avatar, clickable name, badges. */}
        <div className="mt-6 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full border border-[--line] bg-[--surface-raised]"
          />
          <div className="min-w-0">
            <Link
              href={`/creators/${owner}`}
              className="font-medium text-[--ink] underline-offset-2 hover:text-[--accent] hover:underline"
            >
              {authorName}
            </Link>
            <p className="text-sm text-[--ink-muted]">@{owner}</p>
            {badges.length > 0 && (
              <div className="mt-2">
                <CreatorBadges badges={badges} />
              </div>
            )}
          </div>
        </div>

        {/* Category and tags. */}
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/skills/category/${detail.category}`}
            className="rounded-full border border-[--accent] bg-[--accent-soft] px-3 py-1 text-[11px] font-medium text-[--accent]"
          >
            {detail.category}
          </Link>
          {detail.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${tag}`}
              className="rounded-full bg-[--surface-sunken] px-2.5 py-1 font-mono text-[11px] text-[--ink-muted] transition-colors hover:text-[--accent]"
            >
              {tag}
            </Link>
          ))}
        </div>

        {/* Dates and version. */}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[--ink-muted]">
          <div className="flex gap-1.5">
            <dt>Published</dt>
            <dd>{new Date(detail.createdAt).toLocaleDateString('en-US')}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Updated</dt>
            <dd>{new Date(detail.updatedAt).toLocaleDateString('en-US')}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Version</dt>
            <dd className="font-mono">v{latestVersion}</dd>
          </div>
        </dl>

        {/* Counters: downloads, copies, stars. */}
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[--ink-muted]">
          <li>{counters.downloads} downloads</li>
          <li>{counters.copies} copies</li>
          <li aria-label={`${detail.stars} stars`}>★ {detail.stars}</li>
        </ul>

        <div className="mt-6">
          <SkillActions
            skillId={detail.id}
            name={detail.name}
            slug={slug}
            owner={owner}
            markdown={detail.markdown}
          />
        </div>

        <div className="mt-6">
          <Share title={detail.name} url={url} />
        </div>

        <div className="hairline mt-8" />
      </header>

      {/* Markdown preview. */}
      <article className="skill-body space-y-5 text-[15px] leading-relaxed text-[--ink]">
        <MarkdownBlocks blocks={blocks} />
      </article>

      {/* Changelog. */}
      {versions.length > 0 && (
        <section aria-label="Version history" className="mt-12">
          <div className="hairline mb-8" />
          <h2 className="font-display text-xl font-semibold text-[--ink]">Version history</h2>
          <ol className="mt-4 space-y-3">
            {versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-mono text-[--accent]">v{v.version}</span>
                <span className="text-[--ink]">{v.note}</span>
                <time dateTime={v.createdAt} className="font-mono text-xs text-[--ink-muted]">
                  {new Date(v.createdAt).toLocaleDateString('en-US')}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Related skills. */}
      {related.length > 0 && (
        <section aria-label="Related skills" className="mt-12">
          <div className="hairline mb-8" />
          <h2 className="font-display text-xl font-semibold text-[--ink]">Related skills</h2>
          <SkillGrid skills={related} />
        </section>
      )}

      <div className="hairline my-10" />
      <p className="text-sm text-[--ink-muted]">
        <Link href={`/creators/${owner}`} className="text-[--accent] underline underline-offset-2">
          More by @{owner}
        </Link>
        {' · '}
        <Link href="/skills" className="text-[--accent] underline underline-offset-2">
          All skills
        </Link>
      </p>
    </>
  );
}
