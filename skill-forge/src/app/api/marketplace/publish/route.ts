import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { deleteSkill, upsertSkill } from '@/lib/marketplace-db';
import { skillId, toDetail, validateSkillInput } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  markdown?: string;
  name?: string;
  description?: string;
  tags?: string[] | string;
}

/**
 * Pubblica (o aggiorna) una skill sul marketplace.
 *
 * L'identita' dell'autore viene dal token GitHub lato server, mai dal corpo
 * della richiesta: altrimenti chiunque potrebbe pubblicare a nome altrui.
 */
export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json(
      { error: 'Devi accedere con GitHub per pubblicare.' },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 });
  }

  const check = validateSkillInput(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Skill non valida.' }, { status: 400 });
  }

  try {
    const row = await upsertSkill(login, check.value);
    return NextResponse.json({ ok: true, skill: toDetail(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

/** Cancella una skill, ma solo se e' dell'utente autenticato. */
export async function DELETE(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'Devi accedere con GitHub.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'Manca lo slug della skill.' }, { status: 400 });
  }

  const id = skillId(login, slug);
  const removed = await deleteSkill(id, login);
  if (!removed) {
    return NextResponse.json({ error: 'Skill non trovata.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
