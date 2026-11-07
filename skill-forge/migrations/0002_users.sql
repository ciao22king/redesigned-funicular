-- Registered users.
--
-- Signing in with GitHub is the registration: this table records one row per
-- login, the first time the person signs in and the last time they come back.
-- It exists so the landing page can show how many people registered, which is
-- a number the `skills` table alone cannot give (it only knows authors).
--
-- Only the GitHub login is stored, the same identifier already shown as the
-- author of a published skill. No email, no token: those stay in the session.

CREATE TABLE IF NOT EXISTS users (
  login      TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);

-- The count on the landing page is a plain COUNT(*), but the index keeps the
-- "recently active" order cheap if a later feature needs it.
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen DESC);

-- Backfill: people who already used the site before this table existed.
--
-- The `users` table starts empty, so without this the landing page would show
-- zero until the next sign-in. The rows below are derived from the data the
-- marketplace already holds: an author published a skill, or someone starred
-- one. That is a real, verifiable signal of use, not a guess. `OR IGNORE`
-- keeps an existing row (a later sign-in) untouched.
INSERT OR IGNORE INTO users (login, first_seen, last_seen)
SELECT owner, MIN(created_at), MAX(updated_at) FROM skills GROUP BY owner;

INSERT OR IGNORE INTO users (login, first_seen, last_seen)
SELECT user_login, MIN(created_at), MAX(created_at) FROM stars GROUP BY user_login;
