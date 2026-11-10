/**
 * Privacy-first metrics.
 *
 * What is measured, and how, is deliberately narrow:
 *
 *   - only aggregate counters, per UTC day, per event, per target;
 *   - no cookie, no identifier, no IP stored. The address is never written;
 *   - "returning" is computed in the browser (a first-seen date in
 *     `localStorage`) and only the resulting boolean is reported, so no
 *     identifier ever leaves the device;
 *   - durations are accumulated as a sum, never as a per-visit row.
 *
 * The pure part (the event set, the normalisation, the conversion and the
 * drop-off arithmetic) lives here, so it is testable without a database.
 */

import { sanitizeField } from './sanitize';

/**
 * The closed set of events. Keeping it closed means the `event` column stays
 * queryable and a crafted request cannot invent new dimensions.
 */
export const METRIC_EVENTS = [
  // Audience
  'visit',
  'returning',
  // Funnel, in order: this is where people stop.
  'funnel_start',
  'funnel_material',
  'funnel_submit',
  'funnel_result',
  'funnel_download',
  'funnel_publish',
  // Outcomes
  'generate',
  'demo_generate',
  'download',
  'copy',
  'publish',
  // Timing: carries a duration in milliseconds.
  'generation_ms',
] as const;

export type MetricEvent = (typeof METRIC_EVENTS)[number];

/** Funnel steps in the order a person walks them. */
export const FUNNEL_STEPS = [
  'funnel_start',
  'funnel_material',
  'funnel_submit',
  'funnel_result',
  'funnel_download',
  'funnel_publish',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Human labels, so the page and the arithmetic cannot drift. */
export const FUNNEL_LABELS: Record<FunnelStep, string> = {
  funnel_start: 'Opened the generator',
  funnel_material: 'Added material',
  funnel_submit: 'Asked for a generation',
  funnel_result: 'Received a skill',
  funnel_download: 'Downloaded the .md',
  funnel_publish: 'Published to the marketplace',
};

/** The event that carries a duration rather than a plain count. */
export const TIMING_EVENT = 'generation_ms';

/** At most this many events in one request: a batch, not a stream. */
export const MAX_EVENTS_PER_REQUEST = 20;

/** Cap on the target column. */
export const MAX_TARGET_CHARS = 120;

/** A duration longer than this is not a real generation, so it is clamped. */
export const MAX_DURATION_MS = 10 * 60 * 1000;

export function isMetricEvent(value: string): value is MetricEvent {
  return (METRIC_EVENTS as readonly string[]).includes(value);
}

/** UTC day, `YYYY-MM-DD`. The same key as the quota, so the two align. */
export function metricDay(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * The target is a public skill id (`owner/slug`) or empty. It is sanitised and
 * capped like any other field that reaches storage, so a crafted value cannot
 * carry markup into an admin view.
 */
export function normalizeTarget(value: string | undefined): string {
  return sanitizeField((value ?? '').trim(), MAX_TARGET_CHARS);
}

export interface MetricInput {
  event?: string;
  target?: string;
  /** Duration in milliseconds, only for the timing event. */
  value?: number;
}

export interface NormalizedMetric {
  event: MetricEvent;
  target: string;
  count: number;
  totalMs: number;
}

/** Validates one event. Returns null for anything not in the closed set. */
export function normalizeMetric(input: MetricInput): NormalizedMetric | null {
  const event = String(input.event ?? '');
  if (!isMetricEvent(event)) return null;

  const timing = event === TIMING_EVENT;
  const raw = Number(input.value);
  const value = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), MAX_DURATION_MS) : 0;

  return {
    event,
    target: normalizeTarget(input.target),
    count: 1,
    totalMs: timing ? Math.round(value) : 0,
  };
}

/**
 * Normalises a batch, dropping unknown events and merging duplicates so one
 * request cannot write the same row twice.
 */
export function normalizeBatch(inputs: MetricInput[]): NormalizedMetric[] {
  const merged = new Map<string, NormalizedMetric>();
  for (const input of inputs.slice(0, MAX_EVENTS_PER_REQUEST)) {
    const metric = normalizeMetric(input);
    if (!metric) continue;
    const key = `${metric.event}\u0000${metric.target}`;
    const previous = merged.get(key);
    if (previous) {
      previous.count += metric.count;
      previous.totalMs += metric.totalMs;
    } else {
      merged.set(key, metric);
    }
  }
  return [...merged.values()];
}

/**
 * Events a client may assert about itself.
 *
 * The outcome events that feed the creator and operator numbers (`download`,
 * `publish`, `generate`, `demo_generate`) are recorded server-side by the routes
 * that actually observe them, so they are never taken from the anonymous beacon:
 * otherwise anyone could inflate any skill's counters.
 */
export const CLIENT_ASSERTABLE_EVENTS: readonly MetricEvent[] = [
  'visit',
  'returning',
  'funnel_start',
  'funnel_material',
  'funnel_submit',
  'funnel_result',
  'funnel_download',
  // A clipboard copy can only be observed in the browser, so unlike `download`
  // it has to be asserted by the client. It is a low-value number to inflate
  // (it changes no ranking and grants nothing), which is why it is allowed here.
  'copy',
  'generation_ms',
] as const;

/** Keeps only the events a client is allowed to report; drops the rest. */
export function filterClientAssertable(metrics: NormalizedMetric[]): NormalizedMetric[] {
  return metrics.filter((m) => CLIENT_ASSERTABLE_EVENTS.includes(m.event));
}

/** A ratio in [0, 1]; 0 when the denominator is 0. */
export function conversionRate(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(Math.max(part / whole, 0), 1);
}

/** Percentage with one decimal, for display. */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export interface DropoffRow {
  step: FunnelStep;
  label: string;
  count: number;
  /** Share of the people who opened the generator. */
  shareOfStart: number;
  /** How many were lost between the previous step and this one. */
  dropFromPrevious: number;
}

/**
 * Turns the funnel counts into a table where the drop between two steps is
 * explicit: the whole point is to see *where* people leave, not just how many
 * arrived.
 */
export function computeDropoff(counts: Partial<Record<string, number>>): DropoffRow[] {
  const start = counts[FUNNEL_STEPS[0]] ?? 0;
  let previous: number | null = null;

  return FUNNEL_STEPS.map((step) => {
    const count = counts[step] ?? 0;
    const drop = previous === null ? 0 : Math.max(0, previous - count);
    previous = count;
    return {
      step,
      label: FUNNEL_LABELS[step],
      count,
      shareOfStart: conversionRate(count, start),
      dropFromPrevious: drop,
    };
  });
}

export interface MetricsSummary {
  visits: number;
  returning: number;
  generations: number;
  demoGenerations: number;
  downloads: number;
  publishes: number;
  /** Visit -> generation, the headline conversion. */
  visitToGeneration: number;
  /** Share of visits from someone who had been here before. */
  returningShare: number;
  averageGenerationMs: number;
  dropoff: DropoffRow[];
}

export interface MetricsCounts {
  /** `event` -> total count, across the whole window. */
  events: Record<string, number>;
  /** `generation_ms` -> accumulated milliseconds. */
  generationMs: number;
  /** `generation_ms` -> number of samples, from the same event count. */
  generationSamples: number;
}

/**
 * Assembles the summary from the raw counters. Kept pure so the conversion and
 * the averages are testable without D1.
 */
export function summarizeMetrics(counts: MetricsCounts): MetricsSummary {
  const events = counts.events;
  const visits = events.visit ?? 0;
  const generations = events.generate ?? 0;

  return {
    visits,
    returning: events.returning ?? 0,
    generations,
    demoGenerations: events.demo_generate ?? 0,
    downloads: events.download ?? 0,
    publishes: events.publish ?? 0,
    visitToGeneration: conversionRate(generations, visits),
    returningShare: conversionRate(events.returning ?? 0, visits),
    averageGenerationMs:
      counts.generationSamples > 0
        ? Math.round(counts.generationMs / counts.generationSamples)
        : 0,
    dropoff: computeDropoff(events),
  };
}
