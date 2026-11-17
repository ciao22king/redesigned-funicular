import { listAudit } from '@/lib/audit-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The audit log: who did what, to which target, and when.
 *
 * It holds the events that change the public state of the service (publishes,
 * reports, and every admin action) with the actor and the target, and never the
 * content of the material. Newest first, bounded, so the page stays fast as the
 * table grows.
 */
export default async function AdminAuditPage() {
  let rows: Awaited<ReturnType<typeof listAudit>> = [];
  let error: string | null = null;
  try {
    rows = await listAudit(300);
  } catch {
    error = 'The database is unreachable right now.';
  }

  return (
    <main id="content" className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
        Audit log
      </h1>
      <p className="mt-3 max-w-prose text-sm text-[--ink-muted]">
        Every state change, newest first. Admin actions are recorded here too, so
        the panel is accountable to itself.
      </p>

      {error && (
        <p className="mt-6 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink-muted]">
          {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="mt-8 text-sm text-[--ink-muted]">No events recorded yet.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--line] text-left text-[--ink-muted]">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Actor</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 pr-4 font-medium">Detail</th>
                <th className="py-2 pr-4 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[--line] align-top">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-[--ink-muted]">
                    {new Date(row.at).toLocaleString('en-US')}
                  </td>
                  <td className="py-2 pr-4 text-[--ink]">@{row.actor}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-[--ink]">{row.action}</td>
                  <td className="py-2 pr-4 text-[--ink-muted]">{row.target}</td>
                  <td className="py-2 pr-4 text-[--ink-muted]">{row.detail || '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-[--ink-muted]">
                    {row.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
