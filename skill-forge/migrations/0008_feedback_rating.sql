-- Rating on a generation.
--
-- Extends the feedback table with an optional 1 to 5 score, so a generation can
-- be rated and not only judged useful or not. The verdict stays: it answers a
-- different question ("was it useful?") from the rating ("how good was it?"),
-- and keeping both means the numbers mean something on their own.
--
-- 0 means "no rating given", which is why the column is NOT NULL with a default
-- rather than nullable: a missing score is a fact, not an unknown.

ALTER TABLE feedback ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;

-- Reads that aggregate the scores scan only the rated rows.
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback (rating);
