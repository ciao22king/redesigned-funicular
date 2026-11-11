'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SKILL_STATUS_ACTIONS } from '@/lib/admin';

/**
 * The moderation controls on a skill: approve, send to review, reject, remove.
 *
 * Each button posts to `/api/admin/skills` and refreshes the server component,
 * so the list shows the stored status. The current status is disabled, so the
 * buttons read as the set of moves available right now.
 */
export function AdminSkillActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function setStatus(next: string) {
    setBusy(next);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
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
      {SKILL_STATUS_ACTIONS.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={busy !== null || action.status === status}
          onClick={() => void setStatus(action.status)}
          className="rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-40"
        >
          {action.label}
        </button>
      ))}
      {notice && <span className="text-xs text-[--ink-muted]">{notice}</span>}
    </div>
  );
}
