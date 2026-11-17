import Link from 'next/link';
import { adminCounts } from '@/lib/admin-db';
import { skillStatusLabel, SKILL_STATUSES } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The admin dashboard: the service-wide totals in one screen.
 *
 * Everything is an aggregate read from D1; there is no per-person data beyond
 * the creator rows on their own pages. If D1 is unreachable the page says so
 * instead of rendering zeros as if they were real.
 */
export default async function AdminDashboard() {
  let counts: Awaited<ReturnType<typeof adminCounts>> | null = null;
  let error: string | null = null;
  try {
    counts = await adminCounts();
  } catch {
    error = 'The database is unreachable right now.';
  }

  return (
    <main id="content" className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
        Dashboard
      </h1>

      {error && (
        <p className="mt-6 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink-muted]">
          {error}
        </p>
      )}

      {counts && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Users" value={counts.users} href="/admin/creators" />
            <Stat label="Creators" value={counts.creators} href="/admin/creators" />
            <Stat label="Skills" value={counts.skills} href="/admin/skills" />
            <Stat label="Downloads" value={counts.downloads} />
            <Stat label="Generations" value={counts.generations} />
            <Stat
              label="Open skill reports"
              value={counts.openReports}
              href="/admin/reports"
              accent={counts.openReports > 0}
            />
            <Stat
              label="Open profile reports"
              value={counts.openProfileReports}
              href="/admin/reports"
              accent={counts.openProfileReports > 0}
            />
            <Stat label="Banned" value={counts.banned} />
          </dl>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-[--ink]">
              Skills by status
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SKILL_STATUSES.map((status) => (
                <li
                  key={status}
                  className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3"
                >
                  <Link
                    href={`/admin/skills?status=${status}`}
                    className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted] hover:text-[--ink]"
                  >
                    {skillStatusLabel(status)}
                  </Link>
                  <p className="mt-1 font-display text-2xl font-semibold text-[--ink]">
                    {counts.skillsByStatus[status] ?? 0}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-[--ink]">Exports</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/api/admin/export?type=creators"
                className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
              >
                Export creators (CSV)
              </a>
              <a
                href="/api/admin/export?type=skills"
                className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
              >
                Export skills (CSV)
              </a>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-2xl font-semibold ${
          accent ? 'text-[--accent]' : 'text-[--ink]'
        }`}
      >
        {value}
      </dd>
    </>
  );
  const cls = 'block rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3';
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-[--accent]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
