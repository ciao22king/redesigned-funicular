-- Privacy-first metrics.
--
-- One row per (day, event, target): an aggregate counter, never a per-visit
-- row. There is no user id, no session id and no IP column, because none is
-- needed: the only question asked is "how many", and "how long", never "who".
--
-- `total_ms` accumulates durations (today only the generation time), so the
-- average is a division, not a stored per-request value.

CREATE TABLE IF NOT EXISTS metrics (
  day        TEXT NOT NULL,
  event      TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  count      INTEGER NOT NULL DEFAULT 0,
  total_ms   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, event, target)
);

-- Range scans by day, which is how every read works.
CREATE INDEX IF NOT EXISTS idx_metrics_day   ON metrics (day);
CREATE INDEX IF NOT EXISTS idx_metrics_event ON metrics (event, day);
