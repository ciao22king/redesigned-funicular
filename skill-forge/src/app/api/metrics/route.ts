import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeBatch, type MetricInput } from '@/lib/metrics';
import { recordMetrics } from '@/lib/metrics-db';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface Body {
  events?: MetricInput[];
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
 * The response is always 204 and never reveals whether the write succeeded:
 * a beacon does not need the answer, and staying silent gives an abuser no
 * signal to tune against.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const metrics = normalizeBatch(Array.isArray(body.events) ? body.events : []);
    if (metrics.length > 0) {
      await recordMetrics(metrics);
    }
  } catch {
    // A malformed beacon is not an error worth reporting.
  }
  return new NextResponse(null, { status: 204 });
}
