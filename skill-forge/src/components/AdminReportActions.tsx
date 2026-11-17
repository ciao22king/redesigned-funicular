'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The triage controls on a report: resolve or dismiss.
 *
 * Resolving a report changes only the report's status, never the skill or the
 * profile: the actual moderation is a separate, audited action. The buttons
 * refresh the server component so the queue shows the stored state.
 */
export function AdminReportActions({
  id,
  kind,
  status,
}: {
  id: number;
  kind: 'skill' | 'profile';
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function setStatus(next: string) {
    setBusy(next);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind, status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Action failed.');
      setNotice('Done.');
      router.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy !== null || status === 'resolved'}
        onClick={() => void setStatus('resolved')}
        className="rounded-lg border border-[--accent] bg-[--accent-soft] px-3 py-1.5 text-xs font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Resolve
      </button>
      <button
        type="button"
        disabled={busy !== null || status === 'dismissed'}
        onClick={() => void setStatus('dismissed')}
        className="rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-40"
      >
        Dismiss
      </button>
      {notice && <span className="text-xs text-[--ink-muted]">{notice}</span>}
    </div>
  );
}
