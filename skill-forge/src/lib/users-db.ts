import { getDatabase, type D1Like } from './d1';
import { isLogin } from './users';
import { roleForSignup, type Role } from './roles';

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
 * The role is decided once, at account creation, from `first_seen`: an account
 * created inside the founding tester window keeps the perk for good, one created
 * after it is an ordinary member. Later sign-ins never overwrite the role, which
 * is what makes the perk survive past the deadline.
 */
export async function recordUser(
  login: string,
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<void> {
  if (!isLogin(login)) return;
  const database = await getDatabase(injected);
  const role = roleForSignup(login, now);
  await database
    .prepare(
      `INSERT INTO users (login, first_seen, last_seen, role)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET last_seen = excluded.last_seen`,
    )
    .bind(login, now, now, role)
    .run();
}

/**
 * The role of a login, from the stored account.
 *
 * The role is a function of when the account was created, not of "now": an
 * account created inside the founding tester window keeps the perk for good,
 * one created after it is a member for good. Reading `first_seen` and recomputing
 * (instead of trusting the stored `role` column) makes the answer self-healing:
 * an account that signed up before the rule existed still lands on the right role.
 *
 * The fallback matters on the very first request after a sign-in: the row is
 * written in the background and may not be visible yet, so we fall back to the
 * role the account would get signing up now.
 */
export async function readRole(login: string, injected?: D1Like): Promise<Role> {
  const fallback = roleForSignup(login, Date.now());
  if (!isLogin(login)) return fallback;
  try {
    const database = await getDatabase(injected);
    const row = await database
      .prepare('SELECT first_seen FROM users WHERE login = ?')
      .bind(login)
      .first<{ first_seen?: string }>();
    if (!row?.first_seen) return fallback;
    return roleForSignup(login, row.first_seen);
  } catch {
    return fallback;
  }
}

/**
 * The roles of many logins at once, keyed by login.
 *
 * A page of skill cards needs a role per author; one query returns the
 * `first_seen` dates and the rule is applied in memory, exactly as `readRole`
 * does. A login with no row — or a failed read — falls back to the role the
 * account would get signing up now, so the map always answers for every login
 * asked about.
 */
export async function rolesFor(
  logins: string[],
  injected?: D1Like,
): Promise<Map<string, Role>> {
  const out = new Map<string, Role>();
  const wanted = [...new Set(logins.filter(isLogin))];
  for (const login of wanted) out.set(login, roleForSignup(login, Date.now()));
  if (wanted.length === 0) return out;

  try {
    const database = await getDatabase(injected);
    const placeholders = wanted.map(() => '?').join(',');
    const result = await database
      .prepare(`SELECT login, first_seen FROM users WHERE login IN (${placeholders})`)
      .bind(...wanted)
      .all<{ login: string; first_seen: string }>();
    for (const row of result.results ?? []) {
      if (row.first_seen) out.set(row.login, roleForSignup(row.login, row.first_seen));
    }
  } catch {
    // Keep the sign-up-time fallbacks already in the map.
  }
  return out;
}
