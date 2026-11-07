import { getDatabase, type D1Like } from './d1';
import { isLogin } from './users';

/**
 * D1 access for the registered users.
 *
 * The same conventions as `marketplace-db.ts`: the database is an optional
 * parameter, so the tests pass a fake and a missing binding degrades with a
 * readable error instead of crashing the render.
 */

/**
 * Records a sign-in.
 *
 * One row per login: the first insert sets `first_seen`, every later sign-in
 * only moves `last_seen`. The count is therefore the number of distinct people
 * who have registered, not the number of sign-ins.
 */
export async function recordUser(
  login: string,
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<void> {
  if (!isLogin(login)) return;
  const database = await getDatabase(injected);
  await database
    .prepare(
      `INSERT INTO users (login, first_seen, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET last_seen = excluded.last_seen`,
    )
    .bind(login, now, now)
    .run();
}

/**
 * Number of registered users.
 *
 * `first_seen` is kept out of the answer on purpose: the landing page needs a
 * number, not a list.
 */
export async function countUsers(injected?: D1Like): Promise<number> {
  const database = await getDatabase(injected);
  const row = await database
    .prepare('SELECT COUNT(*) AS n FROM users')
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * The count as shown on the landing page, or `undefined` when it cannot be
 * read (missing binding in local development, empty table).
 *
 * Returning `undefined` rather than 0 lets the hero hide the number entirely
 * instead of claiming "0 users" when the data is simply not available.
 */
export async function publicUserCount(injected?: D1Like): Promise<number | undefined> {
  try {
    const n = await countUsers(injected);
    return n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}
