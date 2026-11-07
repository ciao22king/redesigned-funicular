import { getCloudflareContext } from '@opennextjs/cloudflare';
import type {
  NormalizedSkill,
  SkillRow,
  SortKey,
} from './marketplace';
import { orderClause, searchClause, skillId, tagClause } from './marketplace';

/**
 * D1 access for the marketplace.
 *
 * The functions take the database as an optional parameter for two reasons:
 * the tests can pass a fake D1 without touching Cloudflare, and `next dev`
 * without the binding does not blow up but degrades with a readable error.
 */

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
}

async function db(injected?: D1Like): Promise<D1Like> {
  if (injected) return injected;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bound = (env as { MARKETPLACE?: D1Like }).MARKETPLACE;
    if (!bound) throw new Error('binding assente');
    return bound;
  } catch {
    throw new Error(
      'Marketplace unavailable: the D1 binding `MARKETPLACE` is missing.',
    );
  }
}

const COLUMNS =
  'id, slug, owner, name, description, markdown, tags, stars, created_at, updated_at';

export interface ListOptions {
  query?: string;
  sort?: SortKey;
  owner?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/** List for the storefront. Without `markdown`, which is the heavy field. */
export async function listSkills(
  options: ListOptions = {},
  injected?: D1Like,
): Promise<SkillRow[]> {
  const database = await db(injected);
  const { query = '', sort = 'recent', owner, tag, limit = 60, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (owner) {
    conditions.push('owner = ?');
    params.push(owner);
  }

  const search = searchClause(query);
  if (search.sql) {
    // `searchClause` returns a clause that starts with " AND ": here we
    // concatenate it by hand so as not to depend on the position of the WHERE.
    conditions.push(search.sql.replace(/^ AND /, ''));
    params.push(...search.params);
  }

  const byTag = tagClause(tag);
  if (byTag.sql) {
    conditions.push(byTag.sql.replace(/^ AND /, ''));
    params.push(...byTag.params);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT ${COLUMNS} FROM skills ${where} ORDER BY ${orderClause(sort)} LIMIT ? OFFSET ?`;
  params.push(Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));

  const result = await database.prepare(sql).bind(...params).all<SkillRow>();
  return result.results ?? [];
}

/**
 * Light list for the sitemap: only the columns needed to build a URL, without
 * the heavy `markdown` and `description`. Bounded so a huge marketplace still
 * produces a reasonable sitemap.
 */
export async function listSkillRefs(
  limit = 5000,
  injected?: D1Like,
): Promise<{ id: string; updated_at: string }[]> {
  const database = await db(injected);
  const result = await database
    .prepare('SELECT id, updated_at FROM skills ORDER BY created_at DESC LIMIT ?')
    .bind(Math.min(Math.max(limit, 1), 10000))
    .all<{ id: string; updated_at: string }>();
  return result.results ?? [];
}

/** Distinct authors with the last update time, for the sitemap. */
export async function listOwners(
  limit = 5000,
  injected?: D1Like,
): Promise<{ owner: string; updated_at: string }[]> {
  const database = await db(injected);
  const result = await database
    .prepare(
      'SELECT owner, MAX(updated_at) AS updated_at FROM skills GROUP BY owner ORDER BY owner LIMIT ?',
    )
    .bind(Math.min(Math.max(limit, 1), 10000))
    .all<{ owner: string; updated_at: string }>();
  return result.results ?? [];
}

/** Counts the skills matching the filters, for pagination. */
export async function countSkills(
  options: Pick<ListOptions, 'query' | 'owner' | 'tag'> = {},
  injected?: D1Like,
): Promise<number> {
  const database = await db(injected);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.owner) {
    conditions.push('owner = ?');
    params.push(options.owner);
  }
  const search = searchClause(options.query ?? '');
  if (search.sql) {
    conditions.push(search.sql.replace(/^ AND /, ''));
    params.push(...search.params);
  }
  const byTag = tagClause(options.tag);
  if (byTag.sql) {
    conditions.push(byTag.sql.replace(/^ AND /, ''));
    params.push(...byTag.params);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = await database
    .prepare(`SELECT COUNT(*) AS n FROM skills ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Distinct tags with their counts, for the tag index.
 *
 * Only the `tags` column is read: the aggregation happens in JS over a bounded
 * number of rows, so a large marketplace still answers with one cheap query.
 */
export async function tagCounts(
  limit = 5000,
  injected?: D1Like,
): Promise<{ tags: string }[]> {
  const database = await db(injected);
  const result = await database
    .prepare('SELECT tags FROM skills LIMIT ?')
    .bind(Math.min(Math.max(limit, 1), 20000))
    .all<{ tags: string }>();
  return result.results ?? [];
}

/** A single skill, with the markdown body. */
export async function getSkill(
  id: string,
  injected?: D1Like,
): Promise<SkillRow | null> {
  const database = await db(injected);
  return database
    .prepare(`SELECT ${COLUMNS} FROM skills WHERE id = ?`)
    .bind(id)
    .first<SkillRow>();
}

/**
 * Creates or updates an author's skill.
 *
 * The upsert is scoped to the author: republishing the same skill updates it,
 * but the id contains the owner, so nobody can overwrite the skill of
 * altro (l'id risultante sarebbe diverso).
 */
export async function upsertSkill(
  owner: string,
  skill: NormalizedSkill,
  injected?: D1Like,
): Promise<SkillRow> {
  const database = await db(injected);
  const id = skillId(owner, skill.slug);
  const now = new Date().toISOString();

  await database
    .prepare(
      `INSERT INTO skills (id, slug, owner, name, description, markdown, tags, stars, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         markdown = excluded.markdown,
         tags = excluded.tags,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      skill.slug,
      owner,
      skill.name,
      skill.description,
      skill.markdown,
      skill.tags,
      now,
      now,
    )
    .run();

  const row = await getSkill(id, database);
  if (!row) throw new Error('Save failed.');
  return row;
}

/** Deletes a skill, but only if it belongs to the given author. */
export async function deleteSkill(
  id: string,
  owner: string,
  injected?: D1Like,
): Promise<boolean> {
  const database = await db(injected);
  const row = await getSkill(id, database);
  if (!row || row.owner !== owner) return false;

  await database.prepare('DELETE FROM stars WHERE skill_id = ?').bind(id).run();
  await database.prepare('DELETE FROM skills WHERE id = ?').bind(id).run();
  return true;
}

/** True if the user has already starred it. */
export async function hasStar(
  id: string,
  login: string,
  injected?: D1Like,
): Promise<boolean> {
  const database = await db(injected);
  const row = await database
    .prepare('SELECT 1 AS ok FROM stars WHERE skill_id = ? AND user_login = ?')
    .bind(id, login)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** Set of ids the user has starred, for the storefront. */
export async function starredIds(
  login: string,
  injected?: D1Like,
): Promise<Set<string>> {
  const database = await db(injected);
  const result = await database
    .prepare('SELECT skill_id FROM stars WHERE user_login = ?')
    .bind(login)
    .all<{ skill_id: string }>();
  return new Set((result.results ?? []).map((r) => r.skill_id));
}

/**
 * Stars or unstars. The count on `skills.stars` is recomputed from the facts
 * (the rows in `stars`), not incremented by hand: so it cannot diverge if a
 * request fails halfway.
 */
export async function toggleStar(
  id: string,
  login: string,
  injected?: D1Like,
): Promise<{ starred: boolean; stars: number }> {
  const database = await db(injected);
  const skill = await getSkill(id, database);
  if (!skill) throw new Error('Skill not found.');

  const already = await hasStar(id, login, database);

  if (already) {
    await database
      .prepare('DELETE FROM stars WHERE skill_id = ? AND user_login = ?')
      .bind(id, login)
      .run();
  } else {
    await database
      .prepare('INSERT OR IGNORE INTO stars (skill_id, user_login, created_at) VALUES (?, ?, ?)')
      .bind(id, login, new Date().toISOString())
      .run();
  }

  const total = await database
    .prepare('SELECT COUNT(*) AS n FROM stars WHERE skill_id = ?')
    .bind(id)
    .first<{ n: number }>();
  const stars = Number(total?.n ?? 0);

  await database
    .prepare('UPDATE skills SET stars = ? WHERE id = ?')
    .bind(stars, id)
    .run();

  return { starred: !already, stars };
}
