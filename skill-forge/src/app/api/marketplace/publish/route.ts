import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { deleteSkill, upsertSkill } from '@/lib/marketplace-db';
import { skillId, toDetail, validateSkillInput } from '@/lib/marketplace';
import { submitUrlsInBackground } from '@/lib/indexnow';
import { legal } from '@/lib/legal';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
    submitUrlsInBackground([`${legal.siteUrl}/s/${row.id}`, `${legal.siteUrl}/marketplace`]);
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
  return NextResponse.json({ ok: true });
}
