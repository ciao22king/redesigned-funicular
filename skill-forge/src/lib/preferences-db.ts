import { getDatabase, type D1Like } from './d1';
import { isLogin } from './users';
import { DEFAULT_PREFERENCES, toPreferences, type Preferences } from './preferences';

/**
 * D1 access for user preferences. Same conventions as the other `*-db` modules:
 * the database is injectable, and a missing binding degrades instead of
 * crashing the page.
 */

/** Reads a user's preferences; the defaults when the row does not exist yet. */
export async function getPreferences(
  login: string,
  injected?: D1Like,
): Promise<Preferences> {
  if (!isLogin(login)) return { ...DEFAULT_PREFERENCES };
  try {
    const database = await getDatabase(injected);
    const row = await database
      .prepare('SELECT login, train_opt_out, updated_at FROM preferences WHERE login = ?')
      .bind(login)
      .first<{ login: string; train_opt_out: number; updated_at: string }>();
    return toPreferences(row);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Writes the opt-out flag, creating the row on first change. */
export async function setTrainOptOut(
  login: string,
  optOut: boolean,
  injected?: D1Like,
): Promise<Preferences> {
  if (!isLogin(login)) return { ...DEFAULT_PREFERENCES };
  const database = await getDatabase(injected);
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO preferences (login, train_opt_out, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET
         train_opt_out = excluded.train_opt_out,
         updated_at = excluded.updated_at`,
    )
    .bind(login, optOut ? 1 : 0, now)
    .run();
  return { trainOptOut: optOut, updatedAt: now };
}

/** True when the user asked that their material not be used to improve the service. */
export async function isOptedOut(login: string, injected?: D1Like): Promise<boolean> {
  const prefs = await getPreferences(login, injected);
  return prefs.trainOptOut;
}
