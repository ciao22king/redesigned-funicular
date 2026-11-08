-- Reports on published skills.
--
-- Anyone can report a skill; a signed-in user is identified by their login,
-- an anonymous visitor by a key derived from the address. The unique index
-- stops the same reporter from duplicating a report for one skill on the same
-- day, while a different person can still report the same skill.
--
-- A report is a signal for the owner to triage: it never changes the skill by
-- itself. `status` moves from `open` to `resolved` or `dismissed` by hand.

CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id     TEXT NOT NULL,
  reason       TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  reporter     TEXT NOT NULL DEFAULT 'anonymous',
  reporter_key TEXT NOT NULL,
  ip           TEXT NOT NULL DEFAULT '',
  day          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   TEXT NOT NULL,
  UNIQUE (skill_id, reporter_key, day)
);

CREATE INDEX IF NOT EXISTS idx_reports_skill  ON reports (skill_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
