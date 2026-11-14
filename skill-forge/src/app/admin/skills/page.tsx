import Link from 'next/link';
import { adminSkills } from '@/lib/admin-db';
import { SKILL_STATUSES, skillStatusLabel } from '@/lib/admin';
import { AdminSkillActions } from '@/components/AdminSkillActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
}

/**
 * The skills list: every status, with search and a status filter.
 *
 * Approving, rejecting and removing happen here. A status change is a filter on
 * the public reads, never a delete, so the row and its history survive.
 */
export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const status = (sp.status ?? 'all').trim() || 'all';

  let rows: Awaited<ReturnType<typeof adminSkills>> = [];
  let error: string | null = null;
  try {
    rows = await adminSkills({ query, status, limit: 500 });
  } catch {
    error = 'The database is unreachable right now.';
  }

  return (
    <main id="content" className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
          Skills
        </h1>
        <a
          href={`/api/admin/export?type=skills${query ? `&q=${encodeURIComponent(query)}` : ''}`}
          className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
        >
          Export CSV
        </a>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name, id or owner"
          className="min-w-[220px] flex-1 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm text-[--ink] outline-none focus:border-[--accent]"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-[--line] bg-[--surface-raised] px-3 py-2.5 text-sm text-[--ink]"
        >
          <option value="all">Any status</option>
          {SKILL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {skillStatusLabel(s)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Filter
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink-muted]">
          {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="mt-8 text-sm text-[--ink-muted]">No skills match these filters.</p>
      )}

      {rows.length > 0 && (
        <ul className="mt-8 space-y-4">
          {rows.map((s) => (
            <li key={s.id} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/skills/${s.id}`}
                    className="font-display text-base font-semibold text-[--ink] hover:text-[--accent]"
                  >
                    {s.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-[--ink-muted]">
                    {s.id} · {s.category} ·{' '}
                    <span className="font-medium text-[--ink]">{skillStatusLabel(s.status)}</span>
                  </p>
                  {s.description && (
                    <p className="mt-2 line-clamp-2 max-w-prose text-sm text-[--ink-muted]">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[--ink-muted]">
                    ★ {s.stars} · ↓ {s.downloads} · updated{' '}
                    {new Date(s.updatedAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <AdminSkillActions id={s.id} status={s.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
