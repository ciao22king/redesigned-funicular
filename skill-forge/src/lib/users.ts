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

/** Validates a GitHub login before it is written to the users table. */
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isLogin(value: unknown): value is string {
  return typeof value === 'string' && LOGIN_RE.test(value);
}
