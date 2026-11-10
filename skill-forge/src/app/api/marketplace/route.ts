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
import { skillCardsFor } from '@/lib/skill-cards';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PAGE_SIZE = 24;

/**
 * Public storefront: anyone can browse without signing in.
 * If there is a session, each row also says whether the user has starred it.
 *
 * The rows are enriched into card data here — author, badges, downloads — in one
 * batch, so the client renders the same `SkillCard` the server-rendered grids
 * use instead of shipping its own markup for the same thing.
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

    const summaries = rows.map((row: SkillRow) => toSummary(row, starred.has(row.id)));
    const cards = await skillCardsFor(summaries);

    return NextResponse.json({
      skills: cards.map((card, i) => ({ ...card, starred: summaries[i].starred })),
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
