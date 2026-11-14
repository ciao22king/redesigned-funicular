'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Badge, CreatorStats } from '@/lib/creator';

interface StatsResponse {
  login: string;
  stats: CreatorStats;
  badge: Badge;
  next: { badge: Badge; missing: string } | null;
}

/**
 * The creator's own numbers, in the dashboard.
 *
 * It reads `/api/me/stats`, which is scoped to the signed-in login, so nothing
 * here is public: it is the author looking at their own work.
 */
export function CreatorStats() {
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    fetch('/api/me/stats')
      .then((r) => (r.ok ? (r.json() as Promise<StatsResponse>) : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-[--line] bg-[--surface-raised] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[--ink]">
          Your skills as a creator
        </h2>
        <span className="rounded-full border border-[--accent] bg-[--accent-soft] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[--accent]">
          {data.badge.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-[--ink-muted]">{data.badge.description}</p>

      <dl className="mt-5 grid grid-cols-3 gap-4">
        <Stat label="Published" value={data.stats.published} />
        <Stat label="Stars" value={data.stats.stars} />
        <Stat label="Downloads" value={data.stats.downloads} />
      </dl>

      {data.next && (
        <p className="mt-5 text-sm text-[--ink-muted]">
          {data.next.badge.label} is next: {data.next.missing}.
        </p>
      )}

      <p className="mt-4 text-xs text-[--ink-muted]">
        Downloads are counted without identifying anyone: only a daily total per
        skill. See the{' '}
        <Link href="/security" className="text-[--accent] underline underline-offset-2">
          Security &amp; Privacy
        </Link>{' '}
        page.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[--surface-sunken] px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-[--ink]">{value}</dd>
    </div>
  );
}
