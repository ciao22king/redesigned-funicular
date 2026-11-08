/**
 * Client-side metrics beacon.
 *
 * Privacy-first, and that constrains the design:
 *
 *   - no cookie and no identifier is ever sent. The request body carries only
 *     the event name, an optional public skill id, and a duration;
 *   - "returning" is decided here, from a date kept in `localStorage` on the
 *     device. Only the resulting boolean leaves the browser, so the server
 *     never learns who came back, only how many did;
 *   - the beacon is fire-and-forget and must never break a page: every call is
 *     wrapped so a failure is silent.
 *
 * The event names are the closed set in `metrics.ts`; sending anything else is
 * dropped server-side.
 */

import type { MetricEvent } from './metrics';
import type { StorageLike } from './localstore';

/** Key of the local "first seen" date. One per origin, no personal data. */
const FIRST_SEEN_KEY = 'skillforge:first-seen:v1';

export interface TrackOptions {
  /** Public skill id the event is about, when there is one. */
  target?: string;
  /** Duration in milliseconds, for the timing event. */
  value?: number;
}

function storage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * True the first time it is called on a device, false afterwards, and marks the
 * date on the first call. A visitor who has been here before is a returning one.
 *
 * The `Storage` is injectable so the rule is testable without a browser, the
 * same convention `localstore.ts` uses.
 */
export function markVisit(store?: StorageLike): { returning: boolean } {
  const s = store ?? storage();
  if (!s) return { returning: false };
  try {
    const seen = s.getItem(FIRST_SEEN_KEY);
    if (seen) return { returning: true };
    s.setItem(FIRST_SEEN_KEY, new Date().toISOString());
    return { returning: false };
  } catch {
    return { returning: false };
  }
}

/**
 * Sends one event. Uses `sendBeacon` when available so the event survives a
 * navigation (the download and publish events happen right before one), and
 * falls back to `fetch` with `keepalive`.
 */
export function track(event: MetricEvent, options: TrackOptions = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      events: [{ event, target: options.target, value: options.value }],
    });
    const url = '/api/metrics';

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Metrics are never worth a broken page.
  }
}

/**
 * Records the visit once per page load, plus whether it is a return. Called
 * from a top-level effect, not on every render.
 */
export function trackVisit(): void {
  const { returning } = markVisit();
  track('visit');
  if (returning) track('returning');
}
