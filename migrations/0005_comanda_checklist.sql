-- La Comanda — checklist de evento, compartido entre todos los aparatos.
--
-- Es la lista de lo que no puede faltar al montar el pod. No se corta por dia
-- como los pedidos: la misma lista sirve para el proximo evento y se desmarca
-- entera cuando toca volver a cargar el auto.

CREATE TABLE IF NOT EXISTS comanda_checklist (
  id            TEXT PRIMARY KEY,           -- uuid generado en el navegador
  texto         TEXT NOT NULL,
  hecho         INTEGER NOT NULL DEFAULT 0,
  orden         INTEGER NOT NULL,           -- epoch ms de cuando se agrego
  borrado       INTEGER NOT NULL DEFAULT 0, -- baja logica, igual que los pedidos
  actualizado   INTEGER NOT NULL            -- epoch ms del ultimo cambio
);

-- Los aparatos sincronizan pidiendo solo lo que cambio desde su ultimo sondeo.
CREATE INDEX IF NOT EXISTS idx_checklist_actualizado ON comanda_checklist(actualizado);
