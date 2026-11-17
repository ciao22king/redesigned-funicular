import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { toggleStar } from '@/lib/marketplace-db';
import { recordAudit } from '@/lib/audit-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  id?: string;
}

/**
 * Stars or unstars a skill.
 *
 * The primary key (skill_id, user_login) prevents double voting at the database
 * level: two parallel requests cannot count two stars.
 */
export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json(
      { error: 'You must sign in with GitHub to star a skill.' },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing skill id.' }, { status: 400 });
  }

  try {
    const result = await toggleStar(id, login);
    await recordAudit({
      actor: login,
      action: result.starred ? 'star' : 'unstar',
      target: id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = /not found/i.test(message) ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
