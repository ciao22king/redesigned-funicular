'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { OPT_OUT_EFFECT } from '@/lib/preferences';

/**
 * The training opt-out switch.
 *
 * It reads the current value on mount and writes it on change, so the state is
 * the server's, not a local guess. The explanatory line comes from
 * `OPT_OUT_EFFECT`, the same constant the privacy page can quote, so the
 * promise and the switch cannot drift.
 */
export function PrivacySettings() {
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => (r.ok ? (r.json() as Promise<{ trainOptOut?: boolean }>) : null))
      .then((d) => d && setOptOut(Boolean(d.trainOptOut)))
      .catch(() => {});
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/me/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainOptOut: next }),
      });
      const data = (await res.json()) as { trainOptOut?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not save the preference.');
      setOptOut(Boolean(data.trainOptOut));
      setNotice(
        data.trainOptOut
          ? 'Done. Your material will not be used to improve the service.'
          : 'Done. Your material may be used to improve the service.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[--line] bg-[--surface-raised] p-6">
      <h2 className="font-display text-lg font-semibold text-[--ink]">
        Privacy and your material
      </h2>
      <p className="mt-2 max-w-prose text-sm text-[--ink-muted]">
        Your material is sent to our AI provider to generate the skill and is not
        stored on our servers afterwards. Read the details in the{' '}
        <Link href="/security" className="text-[--accent] underline underline-offset-2">
          Security &amp; Privacy
        </Link>{' '}
        page.
      </p>

      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(optOut)}
          disabled={busy || optOut === null}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[--accent]"
        />
        <span className="text-sm text-[--ink]">
          Do not use my material to improve the service or the model.
          <span className="mt-1 block text-[--ink-muted]">{OPT_OUT_EFFECT}</span>
        </span>
      </label>

      {notice && <p className="mt-3 text-sm text-[--accent]">{notice}</p>}
      {error && <p className="mt-3 text-sm text-[oklch(45%_0.14_28)]">{error}</p>}
    </section>
  );
}
