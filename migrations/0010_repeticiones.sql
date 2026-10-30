-- Publicaciones que se repiten solas.
--
-- El Publisher sabía agendar una publicación para una fecha y hora. No sabía
-- repetir, así que la historia de «abrimos» había que cargarla a mano todos los
-- días, y por eso no sale ninguna desde el 6 de junio.
--
-- Una regla dice qué pieza, a qué hora y qué días. El cron, que ya corre cada
-- minuto, la mete a la cola de siempre: de ahí en adelante el camino es el
-- mismo que el de una publicación cargada a mano, con sus reintentos y su
-- límite de Instagram.
--
-- `ultima` guarda el día en que encoló por última vez, en fecha de Chile. Es lo
-- que impide que un minuto se publique dos veces: la regla solo dispara si ese
-- campo no es el día de hoy.

CREATE TABLE IF NOT EXISTS repeticiones (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,            -- para reconocerla en la lista
  platform  TEXT NOT NULL,            -- ig | fb
  kind      TEXT NOT NULL,            -- story | photo | ...
  params    TEXT NOT NULL,            -- JSON, igual que el de la cola
  hora      INTEGER NOT NULL,         -- 0-23, hora de Chile
  minuto    INTEGER NOT NULL DEFAULT 0,
  dias      TEXT NOT NULL,            -- dígitos, 0 domingo: '23456' = martes a sábado
  activa    INTEGER NOT NULL DEFAULT 1,
  ultima    TEXT,                     -- aaaa-mm-dd de Chile del último encolado
  creada    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repeticiones_activa ON repeticiones(activa);
