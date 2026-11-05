import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { toggleStar } from '@/lib/marketplace-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  id?: string;
}

/**
 * Mette o toglie la stella a una skill.
 *
 * La chiave primaria (skill_id, user_login) impedisce il doppio voto a livello
 * di database: due richieste in parallelo non possono contare due stelle.
 */
export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json(
      { error: 'Devi accedere con GitHub per mettere una stella.' },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Manca l\'id della skill.' }, { status: 400 });
  }

  try {
    const result = await toggleStar(id, login);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    const status = /non trovata/i.test(message) ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
