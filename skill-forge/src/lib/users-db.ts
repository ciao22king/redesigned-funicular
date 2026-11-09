import { getDatabase, type D1Like } from './d1';
import { isLogin } from './users';
import { isRole, roleFor, type Role } from './roles';

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
 *
 * The role is recomputed from configuration on every sign-in, so promoting or
 * demoting a login is a configuration change that takes effect at the next
 * sign-in, without a manual database update.
 */
export async function recordUser(
  login: string,
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<void> {
  if (!isLogin(login)) return;
  const database = await getDatabase(injected);
  const role = roleFor(login);
  await database
    .prepare(
      `INSERT INTO users (login, first_seen, last_seen, role)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET last_seen = excluded.last_seen, role = excluded.role`,
    )
    .bind(login, now, now, role)
    .run();
}

/**
 * The stored role of a login, or the configured role when the row is missing.
 *
 * The fallback matters on the very first request after a sign-in: the row is
 * written in the background and may not be visible yet, but the person must
 * still be recognised as an owner or a tester straight away.
 */
export async function readRole(login: string, injected?: D1Like): Promise<Role> {
  const configured = roleFor(login);
  if (!isLogin(login)) return configured;
  try {
    const database = await getDatabase(injected);
    const row = await database
      .prepare('SELECT role FROM users WHERE login = ?')
      .bind(login)
      .first<{ role?: string }>();
    return isRole(row?.role) ? row.role : configured;
  } catch {
    return configured;
  }
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
