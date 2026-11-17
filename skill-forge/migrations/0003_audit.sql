-- Minimal audit log.
--
-- One row per event that changes the public state of the service: publish,
-- unpublish, report, star, unstar. It exists for accountability (who did what,
-- and when), not for surveillance: `detail` is a short note capped in code, and
-- the submitted material is never written here.
--
-- Rows older than the retention window are removed by `pruneAudit`.

CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  ip     TEXT NOT NULL DEFAULT ''
);

-- Newest-first reads, and the range scan that `pruneAudit` does.
CREATE INDEX IF NOT EXISTS idx_audit_at     ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log (target);
