-- La barquillera — un voto por tarjeta DailyBack y por ronda.
--
-- El sabor que se queda en la barquillera lo elige quien ya tiene tarjeta.
-- La identidad no vive aca: el Worker valida el socio contra DailyBack antes
-- de escribir, asi que esta tabla solo guarda un id ya validado.
--
-- La clave primaria (ronda, socio) hace el voto idempotente: volver a votar
-- cambia el sabor en vez de sumar una fila, y nadie infla el recuento.
-- Rotar la ronda deja los votos viejos guardados con su propia etiqueta.

CREATE TABLE IF NOT EXISTS votos_barquillera (
  ronda        TEXT NOT NULL,     -- aaaa-mm de la ronda
  socio        TEXT NOT NULL,     -- membership id de DailyBack (uuid)
  sabor        TEXT NOT NULL,     -- uno de los sabores de la barquillera
  creado       INTEGER NOT NULL,  -- epoch ms del primer voto
  actualizado  INTEGER NOT NULL,  -- epoch ms del ultimo cambio
  PRIMARY KEY (ronda, socio)
);

-- El recuento siempre agrupa por sabor dentro de una ronda.
CREATE INDEX IF NOT EXISTS idx_votos_ronda_sabor ON votos_barquillera(ronda, sabor);
