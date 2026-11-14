-- Admin panel: moderation state and manual badges.
--
-- Three additions, all needed by the operator area:
--
--   * `skills.status` — moderation of a published skill. A skill is `published`
--     by default (publishing stays immediate, as before); the operator may move
--     it to `pending`, `rejected` or `removed`. Only `published` rows are visible
--     to the public: every storefront read filters on it, so a rejected skill
--     disappears from the marketplace, the tags, the sitemap and its own page
--     without the row being deleted.
--
--   * `profiles.banned` and `profiles.verified_socials` — the ban flag is
--     stronger than `suspended` (both hide a profile from discovery, but a ban
--     is the account-level sanction), and `verified_socials` is the comma
--     separated list of social keys the operator has confirmed.
--
--   * `creator_badges` — badges granted by hand, beyond the ones a creator earns
--     from their published work. The earned badges are still computed on read;
--     this table only adds to them, so the two cannot drift.

ALTER TABLE skills ADD COLUMN status TEXT NOT NULL DEFAULT 'published';

-- The public reads all filter on `status`, and the admin list sorts by it.
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills (status, updated_at DESC);

ALTER TABLE profiles ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN verified_socials TEXT NOT NULL DEFAULT '';

-- The directory hides banned profiles as well as suspended ones.
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles (banned);

CREATE TABLE IF NOT EXISTS creator_badges (
  login      TEXT NOT NULL,
  badge      TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT '',
  granted_at TEXT NOT NULL,
  PRIMARY KEY (login, badge)
);

CREATE INDEX IF NOT EXISTS idx_creator_badges_login ON creator_badges (login);
