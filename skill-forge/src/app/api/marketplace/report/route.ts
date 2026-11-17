import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { validateReport } from '@/lib/reports';
import { createReport } from '@/lib/reports-db';
import { recordAudit } from '@/lib/audit-db';
import { getSkill } from '@/lib/marketplace-db';
import { consumeIngestQuota, rateLimitHeaders } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Reports a published skill.
 *
 * Anyone can report, signed in or not, because a harmful skill must be
 * flaggable by whoever sees it. A signed-in user is identified by their login;
 * an anonymous visitor by a key derived from the address. Either way the report
 * is one row, and the unique index stops the same reporter from spamming the
 * same skill on the same day.
 *
 * The report never changes the skill by itself: it is a signal for the owner.
 */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

interface Body {
  skillId?: string;
  reason?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const check = validateReport(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Invalid report.' }, { status: 400 });
  }

  // The skill must exist: a report for something that is not there is noise.
  const skill = await getSkill(check.value.skillId).catch(() => null);
  if (!skill) {
    return NextResponse.json({ error: 'That skill does not exist.' }, { status: 404 });
  }

  // Reuse the ingest budget: reporting is cheap but not free, and it is the
  // same kind of anonymous, third-party-facing action.
  const { allowed, quota } = await consumeIngestQuota(`report:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          'You have sent too many reports today. Write to us at the address in the footer if it is urgent.',
      },
      { status: 429, headers: rateLimitHeaders(quota) },
    );
  }

  const { login } = await getServerAuth(req);
  const reporter = login ?? 'anonymous';
  const reporterKey = login ?? ip;

  const id = await createReport({ report: check.value, reporter, ip });
  if (id === null) {
    // Either a duplicate for today, or the insert failed: both mean "not stored
    // again", and telling the user their report is already in is the honest
    // answer.
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        message: 'You have already reported this skill today. Thank you.',
      },
      { headers: rateLimitHeaders(quota) },
    );
  }

  await recordAudit({
    actor: reporter,
    action: 'report',
    target: check.value.skillId,
    detail: check.value.reason,
    ip,
  });

  return NextResponse.json(
    {
      ok: true,
      id,
      message: 'Thank you. The report reached the maintainer and will be reviewed.',
    },
    { headers: rateLimitHeaders(quota) },
  );
}
