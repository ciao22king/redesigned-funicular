import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getPublicSkill, hasStar } from '@/lib/marketplace-db';
import { toDetail } from '@/lib/marketplace';
import { recordMetrics } from '@/lib/metrics-db';
import { normalizeBatch } from '@/lib/metrics';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Detail of a skill, with the markdown, for download and preview.
 * The id comes as `?id=owner/slug` so we do not have to encode the slash in the path.
 *
 * Only a `published` skill is served: a skill the operator rejected or removed
 * stops being downloadable the moment its status changes.
 *
 * Sign-in is required. The marketplace is free to browse — the list and every
 * skill page are public — but taking the `.md` file needs a GitHub account.
 * That keeps the KV and D1 traffic tied to identifiable people instead of
 * anonymous scrapers, and it is the same account the generator already needs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing skill id.' }, { status: 400 });
  }

  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json(
      { error: 'Sign in with GitHub to download a skill.', signInRequired: true },
      { status: 401 },
    );
  }

  try {
    const row = await getPublicSkill(id);
    if (!row) {
      return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
    }
    // This route serves the Download button, so a successful hit is a download.
    // Counted server-side with the skill id as target and no identifier: the
    // aggregate download count is what the creator stats show.
    await recordMetrics(normalizeBatch([{ event: 'download', target: id }]));
    const starred = await hasStar(id, login);
    return NextResponse.json({ skill: toDetail(row, starred) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
