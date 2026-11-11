import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardAdminAction } from '@/lib/admin-auth';
import { setSkillStatus } from '@/lib/marketplace-db';
import { isSkillStatus } from '@/lib/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  id?: string;
  status?: string;
}

/**
 * Approves, rejects or removes a skill.
 *
 * Moderation is a status change, never a delete: the row, its versions and its
 * stars stay, and only the public reads stop showing it. That keeps a rejected
 * skill recoverable and the audit trail meaningful.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const id = (body.id ?? '').trim();
  const status = (body.status ?? '').trim();
  if (!id || !/^[^/\s]+\/[^/\s]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid skill id.' }, { status: 400 });
  }
  if (!isSkillStatus(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const guard = await guardAdminAction(req, 'admin.skill.status', `${id}:${status}`);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
  }

  const ok = await setSkillStatus(id, status);
  if (!ok) return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, id, status });
}
