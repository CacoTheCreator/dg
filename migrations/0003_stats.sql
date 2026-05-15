-- Daily Grind Publisher — cache de stats por post publicado.
-- Una fila por history.id. Se sobreescribe en cada fetch.

CREATE TABLE IF NOT EXISTS stats (
  history_id        TEXT PRIMARY KEY,
  fetched_at        TEXT NOT NULL,
  likes             INTEGER DEFAULT 0,
  comments          INTEGER DEFAULT 0,
  shares            INTEGER DEFAULT 0,
  saves             INTEGER DEFAULT 0,
  reach             INTEGER DEFAULT 0,
  views             INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  data              TEXT NOT NULL                  -- raw JSON de Meta
);

CREATE INDEX IF NOT EXISTS idx_stats_fetched ON stats(fetched_at);
