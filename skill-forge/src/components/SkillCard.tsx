import type { ReactNode } from 'react';
import Link from 'next/link';
import { CreatorBadges } from '@/components/CreatorBadges';
import { categoryLabel, isCategory, skillPath } from '@/lib/skill-page';
import { parseSkillId } from '@/lib/marketplace';
import type { SkillCardData } from '@/lib/skill-cards';

/** How many tags a card shows before the rest are summarised. */
const MAX_TAGS = 3;

/**
 * One skill card.
 *
 * Presentational only: it renders a `SkillCardData` and owns no data access, so
 * the same card is used by the server-rendered grids and by the client-side
 * marketplace. The author is a link of its own — a card cannot nest one link in
 * another — and hovering it reveals "View author profile", which makes the
 * profile discoverable without a second, competing call to action.
 *
 * Two optional slots keep the interactive marketplace card and the static grids
 * on the same markup: `starControl` replaces the plain star readout with a
 * toggle, and `actions` appends controls (such as Download) to the meta row.
 */
export function SkillCard({
  skill,
  starControl,
  actions,
}: {
  skill: SkillCardData;
  starControl?: ReactNode;
  actions?: ReactNode;
}) {
  const parsed = parseSkillId(skill.id);
  const href = skillPath(skill.owner, parsed?.slug ?? '');
  const tags = skill.tags.slice(0, MAX_TAGS);
  const extraTags = skill.tags.length - tags.length;
  const updated = formatDate(skill.updatedAt);

  return (
    <li className="surface-card group flex flex-col p-6">
      {/* Author: avatar, clickable name, and the badges earned from their work. */}
      <Link
        href={`/creators/${skill.owner}`}
        title="View author profile"
        className="group/author flex min-w-0 items-center gap-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={skill.avatar}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full border border-[--line] bg-[--surface-sunken]"
        />
        <span className="min-w-0">
          <span className="block truncate font-medium leading-tight text-[--ink] transition-colors group-hover/author:text-[--accent]">
            {skill.authorName}
          </span>
          <span className="block truncate text-xs text-[--ink-muted]">@{skill.owner}</span>
          <span className="block text-[11px] text-[--accent] opacity-0 transition-opacity group-hover/author:opacity-100">
            View author profile →
          </span>
        </span>
      </Link>

      {skill.badges.length > 0 && (
        <div className="mt-3">
          <CreatorBadges badges={skill.badges} />
        </div>
      )}

      <h2 className="mt-4 font-display text-lg font-semibold leading-snug text-[--ink]">
        <Link href={href} className="transition-colors hover:text-[--accent]">
          {skill.name}
        </Link>
      </h2>

      {skill.description && (
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[--ink-muted]">
          {skill.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Link
          href={`/skills/category/${skill.category}`}
          className="rounded-full border border-[--accent] bg-[--accent-soft] px-2.5 py-1 text-[11px] font-medium text-[--accent]"
        >
          {isCategory(skill.category) ? categoryLabel(skill.category) : skill.category}
        </Link>
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/tags/${tag}`}
            className="rounded-full bg-[--surface-sunken] px-2.5 py-1 font-mono text-[11px] text-[--ink-muted] transition-colors hover:text-[--accent]"
          >
            {tag}
          </Link>
        ))}
        {extraTags > 0 && (
          <span className="px-1 text-[11px] text-[--ink-muted]">+{extraTags}</span>
        )}
      </div>

      <dl className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[--ink-muted]">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Downloads</dt>
          <dd aria-label={`${skill.downloads} downloads`}>↓ {skill.downloads}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Stars</dt>
          <dd aria-label={`${skill.stars} stars`}>
            {starControl ?? `★ ${skill.stars}`}
          </dd>
        </div>
        {updated && (
          <div className="flex items-center gap-1.5">
            <dt>Updated</dt>
            <dd>
              <time dateTime={skill.updatedAt}>{updated}</time>
            </dd>
          </div>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </dl>
    </li>
  );
}

/** A short, readable date, or an empty string when the value is unusable. */
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US');
}
