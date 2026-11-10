import { getDatabase, type D1Like } from './d1';
import { metricDay, type MetricsCounts, type NormalizedMetric } from './metrics';

/**
 * D1 access for the metrics.
 *
 * One row per `(day, event, target)`, with a count and an accumulated duration:
 * an upsert, never an append. A busy day adds numbers to a handful of rows
 * instead of growing a table of per-visit rows, which is both cheaper and the
 * reason no identifier has to be stored.
 */

/** Records a batch of events. Best effort: never throws. */
export async function recordMetrics(
  metrics: NormalizedMetric[],
  injected?: D1Like,
  now = new Date(),
): Promise<number> {
  if (metrics.length === 0) return 0;
  try {
    const database = await getDatabase(injected);
    const day = metricDay(now);
    const statements = metrics.map((m) =>
      database
        .prepare(
          `INSERT INTO metrics (day, event, target, count, total_ms, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(day, event, target) DO UPDATE SET
             count = count + excluded.count,
             total_ms = total_ms + excluded.total_ms,
             updated_at = excluded.updated_at`,
        )
        .bind(day, m.event, m.target, m.count, m.totalMs, now.toISOString()),
    );
    await database.batch(statements);
    return metrics.length;
  } catch {
    return 0;
  }
}

/** Reads the counters for the last `days` UTC days, merged into one map. */
export async function readMetrics(
  days = 30,
  injected?: D1Like,
  now = new Date(),
): Promise<MetricsCounts> {
  const database = await getDatabase(injected);
  const since = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const from = metricDay(since);

  const result = await database
    .prepare(
      'SELECT event, SUM(count) AS n, SUM(total_ms) AS ms FROM metrics WHERE day >= ? GROUP BY event',
    )
    .bind(from)
    .all<{ event: string; n: number; ms: number }>();

  const events: Record<string, number> = {};
  let generationMs = 0;
  for (const row of result.results ?? []) {
    events[row.event] = Number(row.n) || 0;
    if (row.event === 'generation_ms') generationMs = Number(row.ms) || 0;
  }

  return {
    events,
    generationMs,
    generationSamples: events.generation_ms ?? 0,
  };
}

/** Per-day series for one event, for a small trend line. */
export async function readDailySeries(
  event: string,
  days = 30,
  injected?: D1Like,
  now = new Date(),
): Promise<{ day: string; count: number }[]> {
  const database = await getDatabase(injected);
  const since = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const from = metricDay(since);

  const result = await database
    .prepare(
      'SELECT day, SUM(count) AS n FROM metrics WHERE event = ? AND day >= ? GROUP BY day ORDER BY day',
    )
    .bind(event, from)
    .all<{ day: string; n: number }>();

  return (result.results ?? []).map((r) => ({ day: r.day, count: Number(r.n) || 0 }));
}

/**
 * The public counters of one skill: how many times it was downloaded and how
 * many times its markdown was copied.
 *
 * Both are aggregates over the whole life of the skill (no day window): a skill
 * page shows totals, and a total that shrank every morning would be a lie. A
 * missing binding yields zeros, so the page still renders.
 */
export async function skillCounters(
  id: string,
  injected?: D1Like,
): Promise<{ downloads: number; copies: number }> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare(
      "SELECT event, SUM(count) AS n FROM metrics WHERE target = ? AND event IN ('download', 'copy') GROUP BY event",
    )
    .bind(id)
    .all<{ event: string; n: number }>();

  let downloads = 0;
  let copies = 0;
  for (const row of result.results ?? []) {
    if (row.event === 'download') downloads = Number(row.n) || 0;
    if (row.event === 'copy') copies = Number(row.n) || 0;
  }
  return { downloads, copies };
}
