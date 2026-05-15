-- Daily Grind Publisher — schema inicial
-- Aplicar con: npx wrangler d1 execute publisher --remote --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS queue (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('fb','ig')),
  kind          TEXT NOT NULL CHECK (kind IN ('text','link','photo','reel','carousel')),
  params        TEXT NOT NULL,                  -- JSON con message/url/image_url/etc
  scheduled_at  TEXT NOT NULL,                  -- ISO 8601 UTC
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retrying','publishing')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_due ON queue(scheduled_at) WHERE status IN ('pending','retrying');

CREATE TABLE IF NOT EXISTS history (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  params        TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('published','failed')),
  attempts      INTEGER NOT NULL,
  media_id      TEXT,                            -- IG media id o FB post id
  post_id       TEXT,                            -- FB post_id cuando aplica
  permalink     TEXT,                            -- URL del post si se resolvio
  error         TEXT,
  created_at    TEXT NOT NULL,
  finalized_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_finalized ON history(finalized_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_ig_published ON history(platform, status, finalized_at) WHERE platform='ig' AND status='published';

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  label       TEXT                               -- nombre/handle opcional para audit
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS assets (
  key           TEXT PRIMARY KEY,                -- nombre del objeto en R2
  content_type  TEXT,
  size_bytes    INTEGER,
  uploaded_at   TEXT NOT NULL,
  uploaded_by   TEXT
);
