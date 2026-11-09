/**
 * Registered users: pure helpers.
 *
 * Signing in with GitHub is the registration (see the `users` table in
 * `migrations/0002_users.sql`). Everything that can be decided without touching
 * D1 lives here, so it is verifiable with unit tests.
 */

export interface UserRow {
  login: string;
  first_seen: string;
  last_seen: string;
  role?: string;
}

/** The noun alone, so the UI can style the number and the label separately. */
export function userNoun(count: number): string {
  return count === 1 ? 'user' : 'users';
}

/**
 * Label for the landing page, pluralized in English.
 *
 * The caller passes the number from D1; the wording stays here so the UI and
 * any future client cannot drift. A non-finite or negative count is treated as
 * zero rather than rendering `NaN` or `-3`.
 */
export function userCountLabel(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${n} ${userNoun(n)}`;
}

/** Validates a GitHub login before it is written to the users table. */
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isLogin(value: unknown): value is string {
  return typeof value === 'string' && LOGIN_RE.test(value);
}
