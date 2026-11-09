import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { isOperatorRole, roleFor } from '@/lib/roles';
import { readMetrics } from '@/lib/metrics-db';
import { summarizeMetrics } from '@/lib/metrics';
import { feedbackVerdicts } from '@/lib/feedback-db';
import { summarizeFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * The owner's growth dashboard: aggregate metrics and feedback in one call.
 *
 * Access is limited to the operator (the owner role), because these are
 * service-wide numbers. Every value is an aggregate: no per-person data exists
 * to leak, which is the point of the privacy-first design.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }
  if (!isOperatorRole(roleFor(login))) {
    return NextResponse.json({ error: 'Not available.' }, { status: 403 });
  }

  try {
    const [counts, verdicts] = await Promise.all([readMetrics(30), feedbackVerdicts()]);
    return NextResponse.json({
      window: 'last 30 days',
      metrics: summarizeMetrics(counts),
      feedback: summarizeFeedback(verdicts),
    });
  } catch {
    return NextResponse.json({ error: 'Metrics unavailable.' }, { status: 503 });
  }
}
