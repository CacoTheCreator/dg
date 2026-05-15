-- Daily Grind Publisher — agregar kind 'story' (IG Story).
-- SQLite no permite ALTER CHECK constraint, hay que rebuildear las tablas.

PRAGMA foreign_keys=OFF;

-- queue
CREATE TABLE queue_new (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('fb','ig')),
  kind          TEXT NOT NULL CHECK (kind IN ('text','link','photo','reel','carousel','story')),
  params        TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retrying','publishing')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
INSERT INTO queue_new SELECT * FROM queue;
DROP TABLE queue;
ALTER TABLE queue_new RENAME TO queue;
CREATE INDEX IF NOT EXISTS idx_queue_due ON queue(scheduled_at) WHERE status IN ('pending','retrying');

-- history
CREATE TABLE history_new (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  params        TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('published','failed')),
  attempts      INTEGER NOT NULL,
  media_id      TEXT,
  post_id       TEXT,
  permalink     TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL,
  finalized_at  TEXT NOT NULL
);
INSERT INTO history_new SELECT * FROM history;
DROP TABLE history;
ALTER TABLE history_new RENAME TO history;
CREATE INDEX IF NOT EXISTS idx_history_finalized ON history(finalized_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_ig_published ON history(platform, status, finalized_at) WHERE platform='ig' AND status='published';

PRAGMA foreign_keys=ON;
