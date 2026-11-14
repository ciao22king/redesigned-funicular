'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CREATOR_STATUSES } from '@/lib/admin';
import { MANUAL_BADGE_IDS } from '@/lib/profile';

/**
 * The moderation controls on a creator.
 *
 * Every button posts to `/api/admin/creators` and reloads the server component,
 * so the page always shows the state the database actually holds instead of a
 * client-side guess. A notice reports the last action or the error.
 */
export function AdminCreatorActions({
  login,
  verified,
  status,
  manualBadges,
  socials,
  verifiedSocials,
}: {
  login: string;
  verified: boolean;
  status: string;
  manualBadges: string[];
  socials: { key: string; label: string }[];
  verifiedSocials: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, ...body }),
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

  const granted = new Set(manualBadges);
  const verifiedSet = new Set(verifiedSocials);

  return (
    <div className="space-y-8">
      {notice && (
        <p className="rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink]">
          {notice}
        </p>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold text-[--ink]">Standing</h2>
        <p className="mt-1 text-sm text-[--ink-muted]">
          Suspending or banning hides the profile from discovery and the sitemap;
          a ban is the stronger, account-level sanction.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CREATOR_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy !== null || s === status}
              onClick={() => void send(`status:${s}`, { action: 'status', status: s })}
              className="rounded-lg border border-[--line] bg-[--surface-raised] px-3.5 py-2 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-40"
            >
              {s === 'active' ? 'Reinstate' : s === 'suspended' ? 'Suspend' : 'Ban'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-[--ink]">Verification</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void send('verify', { action: 'verify', verified: !verified })}
            className="rounded-lg border border-[--accent] bg-[--accent-soft] px-3.5 py-2 text-sm font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {verified ? 'Remove verification' : 'Verify profile'}
          </button>
        </div>

        <h3 className="mt-5 text-sm font-medium text-[--ink]">Social links</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {socials.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void send(`social:${s.key}`, {
                  action: 'social',
                  social: s.key,
                  socialVerified: !verifiedSet.has(s.key),
                })
              }
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                verifiedSet.has(s.key)
                  ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                  : 'border-[--line] bg-[--surface-raised] text-[--ink-muted] hover:text-[--ink]'
              }`}
            >
              {s.label}
              {verifiedSet.has(s.key) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-[--ink]">Badges</h2>
        <p className="mt-1 text-sm text-[--ink-muted]">
          Grant or remove the badges an operator hands out. Earned badges (founding,
          top author, featured) are computed from the work and cannot be set here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MANUAL_BADGE_IDS.map((badge) => (
            <button
              key={badge}
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void send(`badge:${badge}`, {
                  action: 'badge',
                  badge,
                  granted: !granted.has(badge),
                })
              }
              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                granted.has(badge)
                  ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                  : 'border-[--line] bg-[--surface-raised] text-[--ink-muted] hover:text-[--ink]'
              }`}
            >
              {granted.has(badge) ? `Remove ${badge}` : `Grant ${badge}`}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
