import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { deleteSkill, upsertSkill } from '@/lib/marketplace-db';
import { skillId, toDetail, validateSkillInput } from '@/lib/marketplace';
import { submitUrlsInBackground } from '@/lib/indexnow';
import { legal } from '@/lib/legal';
import { recordAudit } from '@/lib/audit-db';
import { normalizeBatch } from '@/lib/metrics';
import { recordMetrics } from '@/lib/metrics-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Client address, only for the audit line. Cloudflare sets `cf-connecting-ip`. */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    ''
  );
}

interface Body {
  markdown?: string;
  name?: string;
  description?: string;
  tags?: string[] | string;
}

/**
 * Publishes (or updates) a skill on the marketplace.
 *
 * The author identity comes from the server-side GitHub token, never from the
 * request body: otherwise anyone could publish under someone else's name.
 */
export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json(
      { error: 'You must sign in with GitHub to publish.' },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const check = validateSkillInput(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Invalid skill.' }, { status: 400 });
  }

  try {
    const row = await upsertSkill(login, check.value);
    // Tell the engines the new page exists, so it is crawled in minutes instead
    // of waiting for the next scheduled crawl.
    submitUrlsInBackground([`${legal.siteUrl}/skills/${row.id}`, `${legal.siteUrl}/marketplace`]);
    // Audit: who published what. No material, only the identity and the target.
    await recordAudit({
      actor: login,
      action: 'publish',
      target: row.id,
      detail: row.name,
      ip: clientIp(req),
    });
    // Outcome event, recorded server-side where it cannot be faked.
    await recordMetrics(normalizeBatch([{ event: 'publish', target: row.id }]));
    return NextResponse.json({ ok: true, skill: toDetail(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

/** Deletes a skill, but only if it belongs to the authenticated user. */
export async function DELETE(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing skill slug.' }, { status: 400 });
  }

  const id = skillId(login, slug);
  const removed = await deleteSkill(id, login);
  if (!removed) {
    return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
  }
  await recordAudit({
    actor: login,
    action: 'unpublish',
    target: id,
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true });
}
