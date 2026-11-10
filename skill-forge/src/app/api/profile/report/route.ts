import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { validateProfileReport } from '@/lib/profile';
import { createProfileReport, hasPublishedSkills } from '@/lib/profile-db';
import { recordAudit } from '@/lib/audit-db';
import { consumeIngestQuota, rateLimitHeaders } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Reports a creator profile.
 *
 * Anyone can report, signed in or not: an impersonated person is exactly the
 * kind of thing a visitor should be able to flag. A signed-in user is
 * identified by their login, an anonymous visitor by a key derived from the
 * address, and the unique index stops the same reporter filling the table for
 * one profile on the same day.
 *
 * The report never changes the profile by itself: it is a signal for the
 * maintainer, the same as a report on a skill.
 */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

interface Body {
  username?: string;
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

  const check = validateProfileReport(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Invalid report.' }, { status: 400 });
  }

  // The profile must belong to someone who has published something: reporting a
  // login that is not a real creator is noise.
  const exists = await hasPublishedSkills(check.value.username);
  if (!exists) {
    return NextResponse.json({ error: 'That profile does not exist.' }, { status: 404 });
  }

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

  const id = await createProfileReport({ report: check.value, reporter, ip });
  if (id === null) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        message: 'You have already reported this profile today. Thank you.',
      },
      { headers: rateLimitHeaders(quota) },
    );
  }

  await recordAudit({
    actor: reporter,
    action: 'profile.report',
    target: check.value.username,
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
