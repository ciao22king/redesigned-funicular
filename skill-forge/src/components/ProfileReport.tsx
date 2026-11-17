'use client';

import { useState } from 'react';
import { PROFILE_REPORT_REASONS, profileReasonLabel } from '@/lib/profile';

/**
 * Report control for a public profile.
 *
 * The same small disclosure the skill page uses: a closed set of reasons and an
 * optional one-line note. It posts to `/api/profile/report` and never changes
 * the profile itself; the server deduplicates a repeat report for the same
 * profile on the same day.
 */
export function ProfileReport({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason, note }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? 'The report could not be sent.');
        return;
      }
      setMessage(data.message ?? 'Thank you. The report was received.');
      setOpen(false);
      setReason('');
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs font-medium text-[--ink-muted] transition-colors hover:text-[--ink]"
        aria-expanded={open}
      >
        Report profile
      </button>

      {open && (
        <div className="mt-3 max-w-md rounded-xl border border-[--line] bg-[--surface-raised] p-4">
          <label className="mb-1 block text-xs font-medium text-[--ink]">
            Why are you reporting this profile?
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
          >
            <option value="">Choose a reason</option>
            {PROFILE_REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {profileReasonLabel(r)}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-[--ink]">
            Anything else (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mb-3 w-full resize-y rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
            placeholder="A short note for the maintainer."
          />

          <button
            type="button"
            disabled={busy || !reason}
            onClick={() => void submit()}
            className="rounded-lg bg-[--accent] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Sending...' : 'Send report'}
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-xs text-[--accent]">{message}</p>}
      {error && <p className="mt-2 text-xs text-[oklch(45%_0.14_28)]">{error}</p>}
    </div>
  );
}
