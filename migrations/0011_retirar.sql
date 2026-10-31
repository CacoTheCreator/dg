-- El Publisher aprendió a retirar, pero el esquema no lo dejaba entrar:
--   · queue.kind   solo admitía los seis tipos que se publican
--   · history.status solo admitía 'published' y 'failed'
-- Sin esto, encolar un retiro falla con CHECK constraint y marcar el posteo
-- retirado también.
--
-- SQLite no sabe alterar un CHECK, así que las dos tablas se reconstruyen.
-- Se copian las filas con INSERT SELECT y no se trunca nada: si entre la
-- comprobación y esto cayera una fila, viaja igual.

PRAGMA foreign_keys = OFF;

CREATE TABLE queue_nueva (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('fb','ig')),
  kind          TEXT NOT NULL CHECK (kind IN ('text','link','photo','reel','carousel','story','retirar')),
  params        TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retrying','publishing')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
INSERT INTO queue_nueva SELECT * FROM queue;
DROP TABLE queue;
ALTER TABLE queue_nueva RENAME TO queue;
CREATE INDEX idx_queue_due ON queue(scheduled_at) WHERE status IN ('pending','retrying');

CREATE TABLE history_nueva (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  params        TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('published','failed','retirado','retiro')),
  attempts      INTEGER NOT NULL,
  media_id      TEXT,
  post_id       TEXT,
  permalink     TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL,
  finalized_at  TEXT NOT NULL
);
INSERT INTO history_nueva SELECT * FROM history;
DROP TABLE history;
ALTER TABLE history_nueva RENAME TO history;
CREATE INDEX idx_history_finalized ON history(finalized_at DESC);
CREATE INDEX idx_history_ig_published ON history(platform, status, finalized_at)
  WHERE platform='ig' AND status='published';

PRAGMA foreign_keys = ON;
