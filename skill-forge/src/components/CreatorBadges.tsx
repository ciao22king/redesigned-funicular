import type { PublicProfileBadge } from '@/lib/profile';

/**
 * The badges on a public profile.
 *
 * They are server-rendered and static: a badge is a fact earned from the
 * published work or a stored moderation flag, never a client-side guess. Colour
 * carries meaning, so only `strong` badges take the accent; the rest stay a
 * quiet bordered pill like the role badge elsewhere in the app.
 */
export function CreatorBadges({ badges }: { badges: PublicProfileBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge.id}>
          <span
            title={badge.description}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${
              badge.tone === 'strong'
                ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                : 'border-[--line] bg-[--surface-raised] text-[--ink-muted]'
            }`}
          >
            {badge.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
