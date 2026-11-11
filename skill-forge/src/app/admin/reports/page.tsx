import Link from 'next/link';
import { adminReports } from '@/lib/admin-db';
import { profileReasonLabel, type ProfileReportReason } from '@/lib/profile';
import { reasonLabel, isReportReason } from '@/lib/reports';
import { AdminReportActions } from '@/components/AdminReportActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'resolved', 'dismissed', 'all'] as const;

/**
 * The report queue: skill reports and profile reports in one list, newest first.
 *
 * A report is a signal, never an automatic takedown. Triage here resolves the
 * report; the moderation of the underlying skill or creator is a separate action
 * on their own pages, and both are audited.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as string)
    : 'open';

  let rows: Awaited<ReturnType<typeof adminReports>> = [];
  let error: string | null = null;
  try {
    rows = await adminReports(status, 300);
  } catch {
    error = 'The database is unreachable right now.';
  }

  return (
    <main id="content" className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
        Reports
      </h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              s === status
                ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                : 'border-[--line] bg-[--surface-raised] text-[--ink-muted] hover:text-[--ink]'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink-muted]">
          {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="mt-8 text-sm text-[--ink-muted]">Nothing here. The queue is clear.</p>
      )}

      {rows.length > 0 && (
        <ul className="mt-8 space-y-4">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                    {r.kind === 'skill' ? 'Skill' : 'Profile'} · {r.status}
                  </p>
                  <p className="mt-1 font-medium text-[--ink]">
                    {r.kind === 'skill' ? (
                      <Link href={`/skills/${r.target}`} className="hover:text-[--accent]">
                        {r.target}
                      </Link>
                    ) : (
                      <Link href={`/creators/${r.target}`} className="hover:text-[--accent]">
                        @{r.target}
                      </Link>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[--ink-muted]">
                    {reasonText(r.kind, r.reason)}
                  </p>
                  {r.note && (
                    <p className="mt-2 max-w-prose text-sm text-[--ink]">{r.note}</p>
                  )}
                  <p className="mt-2 text-xs text-[--ink-muted]">
                    by {r.reporter} · {new Date(r.createdAt).toLocaleString('en-US')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {r.kind === 'skill' ? (
                    <Link
                      href={`/admin/skills?q=${encodeURIComponent(r.target)}`}
                      className="text-xs text-[--accent] underline underline-offset-2"
                    >
                      Moderate skill
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/creators/${r.target}`}
                      className="text-xs text-[--accent] underline underline-offset-2"
                    >
                      Moderate creator
                    </Link>
                  )}
                  <AdminReportActions id={r.id} kind={r.kind} status={r.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function reasonText(kind: 'skill' | 'profile', reason: string): string {
  if (kind === 'skill') {
    return isReportReason(reason) ? reasonLabel(reason) : reason;
  }
  return profileReasonLabel(reason as ProfileReportReason);
}
