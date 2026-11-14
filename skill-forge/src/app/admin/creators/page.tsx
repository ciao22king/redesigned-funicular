import Link from 'next/link';
import { adminCreators } from '@/lib/admin-db';
import { manualBadgesFor } from '@/lib/creator-db';
import { creatorStatus, creatorStatusLabel, CREATOR_STATUSES } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
  verified?: string;
}

/**
 * The creators list: search by login or name, filter by standing and by the
 * verified flag. The filters are query parameters, so a filtered view is a URL
 * the operator can bookmark or share with themselves.
 */
export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const verified = sp.verified === '1';

  let rows: Awaited<ReturnType<typeof adminCreators>> = [];
  let badges = new Map<string, string[]>();
  let error: string | null = null;
  try {
    rows = await adminCreators({ query, status: status || undefined, verified });
    badges = await manualBadgesFor(rows.map((r) => r.login));
  } catch {
    error = 'The database is unreachable right now.';
  }

  return (
    <main id="content" className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
          Creators
        </h1>
        <a
          href={`/api/admin/export?type=creators${query ? `&q=${encodeURIComponent(query)}` : ''}`}
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
          placeholder="Search login or name"
          className="min-w-[220px] flex-1 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm text-[--ink] outline-none focus:border-[--accent]"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-[--line] bg-[--surface-raised] px-3 py-2.5 text-sm text-[--ink]"
        >
          <option value="">Any standing</option>
          {CREATOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {creatorStatusLabel(s)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[--ink-muted]">
          <input type="checkbox" name="verified" value="1" defaultChecked={verified} />
          Verified only
        </label>
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
        <p className="mt-8 text-sm text-[--ink-muted]">No creators match these filters.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--line] text-left text-[--ink-muted]">
                <th className="py-2 pr-4 font-medium">Creator</th>
                <th className="py-2 pr-4 font-medium">Standing</th>
                <th className="py-2 pr-4 text-right font-medium">Skills</th>
                <th className="py-2 pr-4 text-right font-medium">Stars</th>
                <th className="py-2 pr-4 text-right font-medium">Downloads</th>
                <th className="py-2 pr-4 font-medium">Badges</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const standing = creatorStatus(c);
                const list = badges.get(c.login) ?? [];
                return (
                  <tr key={c.login} className="border-b border-[--line]">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/creators/${c.login}`}
                        className="font-medium text-[--ink] hover:text-[--accent]"
                      >
                        {c.displayName || c.login}
                      </Link>
                      <span className="block text-xs text-[--ink-muted]">@{c.login}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={standingPill(standing)}>{creatorStatusLabel(standing)}</span>
                      {c.verified && (
                        <span className="ml-2 rounded-full border border-[--accent] bg-[--accent-soft] px-2 py-0.5 text-[11px] font-medium text-[--accent]">
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-[--ink]">{c.published}</td>
                    <td className="py-3 pr-4 text-right font-mono text-[--ink]">{c.stars}</td>
                    <td className="py-3 pr-4 text-right font-mono text-[--ink]">{c.downloads}</td>
                    <td className="py-3 pr-4 text-[--ink-muted]">
                      {list.length ? list.join(', ') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function standingPill(status: string): string {
  const base = 'rounded-full border px-2 py-0.5 text-[11px] font-medium';
  if (status === 'banned') return `${base} border-[--accent] bg-[--accent-soft] text-[--accent]`;
  if (status === 'suspended') return `${base} border-[--line] bg-[--surface-sunken] text-[--ink]`;
  return `${base} border-[--line] bg-[--surface-raised] text-[--ink-muted]`;
}
