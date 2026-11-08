'use client';

import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { formatPercent, type MetricsSummary } from '@/lib/metrics';
import type { FeedbackSummary } from '@/lib/feedback';

interface StatsResponse {
  window: string;
  metrics: MetricsSummary;
  feedback: FeedbackSummary;
  error?: string;
}

/**
 * Owner dashboard: aggregate growth numbers and feedback in one place.
 *
 * It is client-rendered because it reads `/api/stats`, which is limited to the
 * operator. Every value shown is an aggregate; there is no per-person data to
 * display, by design.
 */
export default function StatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(async (r) => {
        const body = (await r.json()) as StatsResponse;
        if (!r.ok) throw new Error(body.error ?? 'Not available.');
        return body;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unknown error'));
  }, []);

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-4xl px-6 py-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          Growth
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          Growth and measurement
        </h1>

        {error && (
          <p className="mt-8 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink-muted]">
            {error}
          </p>
        )}

        {data && (
          <>
            <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
              {data.window}, aggregate and cookieless. No identifier is stored, so
              there is no per-person data here, only totals.
            </p>

            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-[--ink]">
                Visits and conversion
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Visits" value={String(data.metrics.visits)} />
                <Stat label="Returning" value={formatPercent(data.metrics.returningShare)} />
                <Stat
                  label="Visit → generation"
                  value={formatPercent(data.metrics.visitToGeneration)}
                />
                <Stat label="Generations" value={String(data.metrics.generations)} />
                <Stat label="Demo generations" value={String(data.metrics.demoGenerations)} />
                <Stat
                  label="Avg generation"
                  value={`${(data.metrics.averageGenerationMs / 1000).toFixed(1)}s`}
                />
                <Stat label="Downloads" value={String(data.metrics.downloads)} />
                <Stat label="Publishes" value={String(data.metrics.publishes)} />
              </dl>
            </section>

            <section className="mt-12">
              <h2 className="font-display text-xl font-semibold text-[--ink]">
                Where people stop
              </h2>
              <p className="mt-2 text-sm text-[--ink-muted]">
                Each row is a step of the funnel. The last column is how many were
                lost between the previous step and this one.
              </p>
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[--line] text-left text-[--ink-muted]">
                    <th className="py-2 font-medium">Step</th>
                    <th className="py-2 text-right font-medium">Count</th>
                    <th className="py-2 text-right font-medium">Of visits</th>
                    <th className="py-2 text-right font-medium">Dropped</th>
                  </tr>
                </thead>
                <tbody>
                  {data.metrics.dropoff.map((row) => (
                    <tr key={row.step} className="border-b border-[--line]">
                      <td className="py-2 text-[--ink]">{row.label}</td>
                      <td className="py-2 text-right font-mono text-[--ink]">{row.count}</td>
                      <td className="py-2 text-right font-mono text-[--ink-muted]">
                        {formatPercent(row.shareOfStart)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          row.dropFromPrevious > 0 ? 'text-[--accent]' : 'text-[--ink-muted]'
                        }`}
                      >
                        {row.dropFromPrevious > 0 ? `−${row.dropFromPrevious}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="mt-12">
              <h2 className="font-display text-xl font-semibold text-[--ink]">
                Feedback after generation
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Answers" value={String(data.feedback.total)} />
                <Stat label="Useful" value={String(data.feedback.yes)} />
                <Stat label="Partly" value={String(data.feedback.partly)} />
                <Stat label="Missed" value={String(data.feedback.no)} />
              </dl>
              <p className="mt-4 text-sm text-[--ink-muted]">
                Useful or partly useful: {formatPercent(data.feedback.usefulShare)}.
              </p>
            </section>

            <p className="mt-12 text-sm text-[--ink-muted]">
              Read the{' '}
              <a href="/api/stats" className="text-[--accent] underline underline-offset-2">
                raw JSON
              </a>
              .
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-[--ink]">{value}</dd>
    </div>
  );
}
