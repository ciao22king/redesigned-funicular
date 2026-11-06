import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getSkill, hasStar } from '@/lib/marketplace-db';
import { toDetail } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Detail of a skill, with the markdown, for download and preview.
 * The id comes as `?id=owner/slug` so we do not have to encode the slash in the path.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing skill id.' }, { status: 400 });
  }

  const { login } = await getServerAuth(req);

  try {
    const row = await getSkill(id);
    if (!row) {
      return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
    }
    const starred = login ? await hasStar(id, login) : false;
    return NextResponse.json({ skill: toDetail(row, starred) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
