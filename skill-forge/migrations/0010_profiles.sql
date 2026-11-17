-- Public creator profiles.
--
-- One row per login, created the first time a person edits their profile. A
-- missing row means "defaults": the login as the name and the GitHub avatar, so
-- nobody has to fill anything in for their profile page to work.
--
-- Only what a person writes about themselves lives here. The numbers a profile
-- shows (published skills, stars, downloads) are derived from `skills` and
-- `metrics` on read, exactly like the dashboard stats, so they cannot go stale.
--
-- `verified` and `suspended` are moderation flags: verified is set by hand by
-- the maintainers, suspended hides a profile from discovery without deleting
-- the account.

CREATE TABLE IF NOT EXISTS profiles (
  login        TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  bio          TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT NOT NULL DEFAULT '',
  x            TEXT NOT NULL DEFAULT '',
  linkedin     TEXT NOT NULL DEFAULT '',
  youtube      TEXT NOT NULL DEFAULT '',
  website      TEXT NOT NULL DEFAULT '',
  newsletter   TEXT NOT NULL DEFAULT '',
  verified     INTEGER NOT NULL DEFAULT 0,
  suspended    INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL
);

-- The creators directory lists non-suspended profiles; the flag is the filter.
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles (suspended);

-- Reports about a profile (as opposed to about a skill, which live in
-- `reports`). Same shape and the same one-per-reporter-per-day rule: a report is
-- a signal for the maintainer to triage, never an automatic takedown.

CREATE TABLE IF NOT EXISTS profile_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL,
  reason       TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  reporter     TEXT NOT NULL DEFAULT 'anonymous',
  reporter_key TEXT NOT NULL,
  ip           TEXT NOT NULL DEFAULT '',
  day          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   TEXT NOT NULL,
  UNIQUE (username, reporter_key, day)
);

CREATE INDEX IF NOT EXISTS idx_profile_reports_user   ON profile_reports (username);
CREATE INDEX IF NOT EXISTS idx_profile_reports_status ON profile_reports (status, created_at DESC);
