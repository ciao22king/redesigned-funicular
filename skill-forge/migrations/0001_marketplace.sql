-- Marketplace delle skill.
--
-- `id` e' la chiave pubblica ed e' composta da `owner/slug`: lo slug da solo
-- non basta, perche' due autori diversi possono avere una skill con lo stesso
-- nome. Pubblicare due volte la stessa skill dallo stesso autore aggiorna la
-- riga invece di creare un doppione (vedi l'upsert in src/lib/marketplace.ts).

CREATE TABLE IF NOT EXISTS skills (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  owner       TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  markdown    TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '',
  stars       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Vetrina: ordinamento per stelle e per data, e filtro per autore.
CREATE INDEX IF NOT EXISTS idx_skills_stars   ON skills (stars DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_created ON skills (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_owner   ON skills (owner);

-- Una stella per utente per skill. La chiave composta impedisce il doppio voto
-- a livello di database, non solo nel codice.
CREATE TABLE IF NOT EXISTS stars (
  skill_id   TEXT NOT NULL,
  user_login TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (skill_id, user_login)
);

CREATE INDEX IF NOT EXISTS idx_stars_user ON stars (user_login);
