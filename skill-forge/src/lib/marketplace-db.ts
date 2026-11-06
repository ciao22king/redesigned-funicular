import { getCloudflareContext } from '@opennextjs/cloudflare';
import type {
  NormalizedSkill,
  SkillRow,
  SortKey,
} from './marketplace';
import { orderClause, searchClause, skillId } from './marketplace';

/**
 * Accesso a D1 per il marketplace.
 *
 * Le funzioni prendono il database come parametro opzionale per due motivi:
 * i test possono passare un finto D1 senza toccare Cloudflare, e `next dev`
 * senza binding non esplode ma degrada con un errore leggibile.
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
      'Marketplace non disponibile: manca il binding D1 `MARKETPLACE`.',
    );
  }
}

const COLUMNS =
  'id, slug, owner, name, description, markdown, tags, stars, created_at, updated_at';

export interface ListOptions {
  query?: string;
  sort?: SortKey;
  owner?: string;
  limit?: number;
  offset?: number;
}

/** Elenco per la vetrina. Senza `markdown`, che e' il campo pesante. */
export async function listSkills(
  options: ListOptions = {},
  injected?: D1Like,
): Promise<SkillRow[]> {
  const database = await db(injected);
  const { query = '', sort = 'recent', owner, limit = 60, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (owner) {
    conditions.push('owner = ?');
    params.push(owner);
  }

  const search = searchClause(query);
  if (search.sql) {
    // `searchClause` restituisce una clausola che inizia con " AND ": qui la
    // concateniamo a mano per non dipendere dalla posizione della WHERE.
    conditions.push(search.sql.replace(/^ AND /, ''));
    params.push(...search.params);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT ${COLUMNS} FROM skills ${where} ORDER BY ${orderClause(sort)} LIMIT ? OFFSET ?`;
  params.push(Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));

  const result = await database.prepare(sql).bind(...params).all<SkillRow>();
  return result.results ?? [];
}

/** Conta le skill che soddisfano i filtri, per la paginazione. */
export async function countSkills(
  options: Pick<ListOptions, 'query' | 'owner'> = {},
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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = await database
    .prepare(`SELECT COUNT(*) AS n FROM skills ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Una singola skill, con il corpo markdown. */
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
 * Crea o aggiorna la skill di un autore.
 *
 * L'upsert e' limitato all'autore: ripubblicando la stessa skill si aggiorna,
 * ma l'id contiene l'owner, quindi nessuno puo' sovrascrivere la skill di un
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
  if (!row) throw new Error('Salvataggio non riuscito.');
  return row;
}

/** Cancella una skill, ma solo se appartiene all'autore indicato. */
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

/** True se l'utente ha gia' messo la stella. */
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

/** Insieme degli id a cui l'utente ha messo la stella, per la vetrina. */
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
 * Mette o toglie la stella. Il conteggio su `skills.stars` viene ricalcolato
 * dai fatti (le righe in `stars`), non incrementato a mano: cosi' non puo'
 * divergere se una richiesta fallisce a meta'.
 */
export async function toggleStar(
  id: string,
  login: string,
  injected?: D1Like,
): Promise<{ starred: boolean; stars: number }> {
  const database = await db(injected);
  const skill = await getSkill(id, database);
  if (!skill) throw new Error('Skill non trovata.');

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
