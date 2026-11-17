-- Feedback on a generation.
--
-- Asked right after the skill appears. One row per answer, with a closed-set
-- verdict and an optional short note. No identifier is stored: the answer is
-- about the skill, not about the person, and the note is sanitised in code.

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  verdict    TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  mode       TEXT NOT NULL DEFAULT 'from-skills',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_verdict ON feedback (verdict);
