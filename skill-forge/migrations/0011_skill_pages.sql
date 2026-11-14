-- Public skill pages: a category and a version history.
--
-- `category` is stored rather than derived on read so the category listing is a
-- single indexed query. It is computed once, at publish time, by `categoryFor`
-- in `src/lib/skill-page.ts`: a small, closed taxonomy read off the tags and the
-- text, never curated by hand. Rows published before this column existed fall
-- back to 'other'.
--
-- `skill_versions` is the changelog a skill page shows. One row per distinct
-- content: publishing the same markdown again does not add a version, editing it
-- does. The `hash` is what makes that comparison cheap and exact.

ALTER TABLE skills ADD COLUMN category TEXT NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (category, stars DESC);

CREATE TABLE IF NOT EXISTS skill_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id   TEXT NOT NULL,
  version    INTEGER NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (skill_id, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions (skill_id, version DESC);
