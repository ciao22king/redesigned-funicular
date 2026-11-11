import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardAdminAction } from '@/lib/admin-auth';
import { setProfileReportStatus, setReportStatus } from '@/lib/admin-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

const STATUSES = ['open', 'resolved', 'dismissed'] as const;

interface Body {
  id?: number;
  kind?: 'skill' | 'profile';
  status?: string;
}

/**
 * Moves a report through the queue: open, resolved or dismissed.
 *
 * A report is a signal, never an automatic takedown, so resolving it changes
 * only the report's own status. The moderator takes the actual moderation
 * action (on the skill or the creator) separately, and both are audited.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const id = Number(body.id);
  const status = (body.status ?? '').trim();
  const kind = body.kind === 'profile' ? 'profile' : 'skill';

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid report id.' }, { status: 400 });
  }
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const guard = await guardAdminAction(req, 'admin.report.status', `${kind}:${id}:${status}`);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
  }

  const ok = kind === 'profile'
    ? await setProfileReportStatus(id, status)
    : await setReportStatus(id, status);
  if (!ok) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, id, kind, status });
}
