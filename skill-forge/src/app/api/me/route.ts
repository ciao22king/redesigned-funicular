import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { readQuota } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Identita' dell'utente autenticato, piu' la sua quota.
 *
 * La CLI usa questo endpoint per `login` e `whoami`: una sola chiamata dice se
 * il token e' valido, chi e' l'utente e quante generazioni gli restano.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'Token non valido o assente.' }, { status: 401 });
  }
  return NextResponse.json({ login, quota: await readQuota(login) });
}
