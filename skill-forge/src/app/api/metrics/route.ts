import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { filterClientAssertable, normalizeBatch, type MetricInput } from '@/lib/metrics';
import { recordMetrics } from '@/lib/metrics-db';
import { consumeMetricsQuota } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface Body {
  events?: MetricInput[];
}

/** Client address, only for rate limiting. Cloudflare sets `cf-connecting-ip`. */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

/**
 * Ingests a small batch of privacy-first events.
 *
 * There is no authentication on purpose: the visit event happens before anyone
 * signs in, and a metric must not require an account. What keeps this safe is
 * that nothing identifying is accepted or stored: the body carries an event
 * name, an optional public skill id and a duration, and everything else is
 * dropped. Unknown event names are discarded rather than stored.
 *
 * Only the events a client may assert about itself are accepted; the outcome
 * events that feed the creator numbers are recorded server-side, so an anonymous
 * caller cannot inflate a skill's counters. A per-IP daily quota bounds the rest.
 *
 * The response is always 204 and never reveals whether the write succeeded:
 * a beacon does not need the answer, and staying silent gives an abuser no
 * signal to tune against.
 */
export async function POST(req: NextRequest) {
  try {
    const { allowed } = await consumeMetricsQuota(clientIp(req));
    if (!allowed) return new NextResponse(null, { status: 204 });

    const body = (await req.json()) as Body;
    const metrics = filterClientAssertable(
      normalizeBatch(Array.isArray(body.events) ? body.events : []),
    );
    if (metrics.length > 0) {
      await recordMetrics(metrics);
    }
  } catch {
    // A malformed beacon is not an error worth reporting.
  }
  return new NextResponse(null, { status: 204 });
}
