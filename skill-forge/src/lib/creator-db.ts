import { getDatabase, type D1Like } from './d1';
import { FEATURED_MIN_STARS, pickFeatured, type CreatorStats, type FeaturedCandidate } from './creator';
import { toSummary } from './marketplace';

/**
 * D1 access for the creator programme.
 *
 * The stats are computed from the facts already in D1 (`skills`, `stars`) and
 * from the aggregate downloads in `metrics`: nothing new is stored about a
 * person, the numbers are derived on read.
 */

/** Published skills, total stars and summed downloads for one author. */
export async function creatorStats(
  owner: string,
  injected?: D1Like,
): Promise<CreatorStats> {
  const database = await getDatabase(injected);

  const row = await database
    .prepare('SELECT COUNT(*) AS published, COALESCE(SUM(stars), 0) AS stars FROM skills WHERE owner = ?')
    .bind(owner)
    .first<{ published: number; stars: number }>();

  // Downloads are keyed by skill id in the metrics, so the sum is over the
  // author's own ids only.
  const downloadsRow = await database
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS n FROM metrics
       WHERE event = 'download' AND target IN (SELECT id FROM skills WHERE owner = ?)`,
    )
    .bind(owner)
    .first<{ n: number }>();

  return {
    published: Number(row?.published ?? 0) || 0,
    stars: Number(row?.stars ?? 0) || 0,
    downloads: Number(downloadsRow?.n ?? 0) || 0,
  };
}

/**
 * The skills the homepage features. Reads a bounded slice of the most starred
 * rows and lets `pickFeatured` apply the shared rule, so the homepage and the
 * creator badge cannot disagree about what "featured" means.
 */
export async function featuredSkills(
  limit = 3,
  injected?: D1Like,
): Promise<FeaturedCandidate[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare(
      'SELECT id, slug, owner, name, description, markdown, tags, stars, created_at, updated_at FROM skills WHERE stars >= ? ORDER BY stars DESC, id ASC LIMIT ?',
    )
    .bind(FEATURED_MIN_STARS, Math.min(Math.max(limit * 4, 12), 40))
    .all<Parameters<typeof toSummary>[0]>();

  const candidates: FeaturedCandidate[] = (result.results ?? []).map((row) => {
    const summary = toSummary(row);
    return {
      id: summary.id,
      name: summary.name,
      description: summary.description,
      owner: summary.owner,
      stars: summary.stars,
      tags: summary.tags,
    };
  });

  return pickFeatured(candidates, limit);
}

export interface CreatorSummaryRow {
  owner: string;
  published: number;
  stars: number;
  updatedAt: string;
}

/**
 * One row per author, with their totals, in a single query.
 *
 * The creators directory needs every author's numbers at once, so aggregating
 * in SQL avoids a query per profile. Ordered by stars so the most interesting
 * creators come first.
 */
export async function creatorSummaries(
  limit = 500,
  injected?: D1Like,
): Promise<CreatorSummaryRow[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare(
      `SELECT owner, COUNT(*) AS published, COALESCE(SUM(stars), 0) AS stars, MAX(updated_at) AS updated_at
       FROM skills GROUP BY owner ORDER BY stars DESC, owner ASC LIMIT ?`,
    )
    .bind(Math.min(Math.max(limit, 1), 5000))
    .all<{ owner: string; published: number; stars: number; updated_at: string }>();
  return (result.results ?? []).map((row) => ({
    owner: row.owner,
    published: Number(row.published) || 0,
    stars: Number(row.stars) || 0,
    updatedAt: row.updated_at,
  }));
}

/**
 * When the author last touched their published work: the newest `updated_at`
 * across their skills. Returns null when they have none, so the profile shows
 * nothing rather than a bogus date.
 */
export async function creatorLastActivity(
  owner: string,
  injected?: D1Like,
): Promise<string | null> {
  const database = await getDatabase(injected);
  const row = await database
    .prepare('SELECT MAX(updated_at) AS last FROM skills WHERE owner = ?')
    .bind(owner)
    .first<{ last: string | null }>();
  return row?.last ?? null;
}

/** True if any of the author's skills is currently featured. */
export async function isFeaturedAuthor(
  owner: string,
  injected?: D1Like,
): Promise<boolean> {
  const database = await getDatabase(injected);
  const row = await database
    .prepare('SELECT 1 AS ok FROM skills WHERE owner = ? AND stars >= ? LIMIT 1')
    .bind(owner, FEATURED_MIN_STARS)
    .first<{ ok: number }>();
  return Boolean(row);
}
