import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { creatorStats, isFeaturedAuthor } from '@/lib/creator-db';
import { badgeFor, nextTier } from '@/lib/creator';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * The creator's own numbers: published skills, stars, downloads, badge and how
 * far the next badge is.
 *
 * Scoped to the authenticated login, so a person only ever sees their own
 * stats. The dashboard renders this; there is no public variant, because the
 * aggregate numbers of everyone are not something this endpoint should expose.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }

  const [stats, featured] = await Promise.all([
    creatorStats(login),
    isFeaturedAuthor(login),
  ]);

  return NextResponse.json({
    login,
    stats,
    badge: badgeFor(stats, featured),
    next: nextTier(stats),
  });
}
