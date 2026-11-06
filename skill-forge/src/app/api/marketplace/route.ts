import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { countSkills, listSkills, starredIds } from '@/lib/marketplace-db';
import {
  normalizeQuery,
  parseSort,
  toSummary,
  type SkillRow,
} from '@/lib/marketplace';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PAGE_SIZE = 24;

/**
 * Public storefront: anyone can browse without signing in.
 * If there is a session, each row also says whether the user has starred it.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = normalizeQuery(url.searchParams.get('q'));
  const sort = parseSort(url.searchParams.get('sort'));
  const owner = url.searchParams.get('owner')?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);

  const { login } = await getServerAuth(req);

  try {
    const [rows, total, starred] = await Promise.all([
      listSkills({ query, sort, owner, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      countSkills({ query, owner }),
      login ? starredIds(login) : Promise.resolve(new Set<string>()),
    ]);

    return NextResponse.json({
      skills: rows.map((row: SkillRow) => toSummary(row, starred.has(row.id))),
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
