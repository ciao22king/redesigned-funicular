import Link from 'next/link';

/**
 * Server-rendered grid of skill cards, shared by the tag and author pages.
 *
 * Unlike the marketplace list (which is a client component with a star button),
 * this one is a plain server component: those pages are about discovery, so a
 * card only needs to link to the skill and show its metadata. No JavaScript is
 * shipped for the list itself.
 */
export interface SkillCardItem {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  stars: number;
}

export function SkillGrid({ skills }: { skills: SkillCardItem[] }) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {skills.map((skill) => (
        <li key={skill.id} className="surface-card flex flex-col p-6">
          <h2 className="font-display text-lg font-semibold leading-snug text-[--ink]">
            <Link href={`/s/${skill.id}`} className="transition-colors hover:text-[--accent]">
              {skill.name}
            </Link>
          </h2>

          {skill.description && (
            <p className="mt-3 flex-1 text-sm leading-relaxed text-[--ink-muted]">
              {skill.description}
            </p>
          )}

          {skill.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {skill.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/tags/${tag}`}
                    className="rounded-full bg-[--surface-sunken] px-2.5 py-1 font-mono text-[11px] text-[--ink-muted] transition-colors hover:text-[--accent]"
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-[--ink-muted]">
            <Link href={`/u/${skill.owner}`} className="truncate hover:text-[--accent]">
              @{skill.owner}
            </Link>
            <span aria-label={`${skill.stars} stars`}>★ {skill.stars}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
