import { roleBadge, type Role } from '@/lib/roles';

/**
 * The role badge, shown next to the login.
 *
 * Colour carries meaning elsewhere in the app, so the badge stays quiet: a
 * bordered pill, not a loud colour. A member has no badge, which is why the
 * component renders nothing instead of an empty pill.
 */
export function RoleBadge({ role, className = '' }: { role?: Role; className?: string }) {
  const text = role ? roleBadge(role) : null;
  if (!text) return null;
  const tone =
    role === 'owner'
      ? 'border-[--accent] text-[--accent]'
      : 'border-[--line] text-[--ink-muted]';
  return (
    <span
      title={text}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${tone} ${className}`}
    >
      {text}
    </span>
  );
}
