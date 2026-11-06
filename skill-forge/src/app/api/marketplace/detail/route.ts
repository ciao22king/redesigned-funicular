import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getSkill, hasStar } from '@/lib/marketplace-db';
import { toDetail } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Dettaglio di una skill, con il markdown, per il download e l'anteprima.
 * L'id arriva come `?id=owner/slug` per non dover codificare lo slash nel path.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Manca l\'id della skill.' }, { status: 400 });
  }

  const { login } = await getServerAuth(req);

  try {
    const row = await getSkill(id);
    if (!row) {
      return NextResponse.json({ error: 'Skill non trovata.' }, { status: 404 });
    }
    const starred = login ? await hasStar(id, login) : false;
    return NextResponse.json({ skill: toDetail(row, starred) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
