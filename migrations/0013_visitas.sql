-- Physical visits recorded by staff, separate from orders and web traffic.
CREATE TABLE IF NOT EXISTS visitas (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('instagram','google','paso','recomendacion','habitual','otro','sin_respuesta')),
  creado INTEGER NOT NULL,
  anulado INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0,1)),
  actualizado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha, creado);
