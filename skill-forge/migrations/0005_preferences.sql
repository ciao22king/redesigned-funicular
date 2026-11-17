-- Per-user preferences.
--
-- Today there is one flag: `train_opt_out`, whether the material the user
-- submits may be used to improve the service and the models. The default is 0
-- (opt-in), which is what the privacy policy states; the dashboard switch sets
-- it to 1. A missing row means the defaults, so we only write when a user
-- actually changes something.

CREATE TABLE IF NOT EXISTS preferences (
  login         TEXT PRIMARY KEY,
  train_opt_out INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);
