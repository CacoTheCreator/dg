-- La Comanda — cola compartida entre todos los aparatos que atienden.
--
-- Antes cada navegador llevaba su propia cola en localStorage, asi que dos
-- personas tomando pedidos generaban dos numeraciones paralelas y ninguna veia
-- lo de la otra. Ahora el pedido vive aca y el navegador es solo una vista.
--
-- El id lo genera el cliente (uuid) para que un reintento por señal mala no
-- duplique el pedido: el INSERT es idempotente por clave primaria.

CREATE TABLE IF NOT EXISTS comanda_pedidos (
  id            TEXT PRIMARY KEY,           -- uuid generado en el navegador
  n             INTEGER NOT NULL,           -- correlativo del dia, lo asigna el servidor
  fecha         TEXT NOT NULL,              -- dd-mm-aaaa en hora de Chile
  hora          TEXT NOT NULL,              -- hh:mm en hora de Chile
  t             INTEGER NOT NULL,           -- epoch ms de cuando se tomo
  estado        TEXT NOT NULL,              -- pendiente | listo
  nombre        TEXT,                       -- para gritar el pedido
  dscto         TEXT,                       -- '' | dailyback | amigos
  total         INTEGER NOT NULL,           -- pesos
  lineas        TEXT NOT NULL,              -- JSON: [{desc, extra, precio, qty}]
  borrado       INTEGER NOT NULL DEFAULT 0, -- baja logica, para que el resto se entere
  actualizado   INTEGER NOT NULL            -- epoch ms del ultimo cambio
);

-- La cola y el historial siempre filtran por dia.
CREATE INDEX IF NOT EXISTS idx_comanda_fecha ON comanda_pedidos(fecha);

-- Los aparatos sincronizan pidiendo solo lo que cambio desde su ultimo sondeo.
CREATE INDEX IF NOT EXISTS idx_comanda_actualizado ON comanda_pedidos(actualizado);

-- El correlativo se calcula por dia; este indice hace barato el max(n).
CREATE INDEX IF NOT EXISTS idx_comanda_fecha_n ON comanda_pedidos(fecha, n);
