-- El contenido que cambia sin que cambie el diseño.
--
-- Hasta ahora el horario estaba escrito a mano en cuatro páginas y la dirección
-- en otras cuatro: cambiar la hora de cierre eran ocho ediciones y un despliegue.
-- Acá vive una sola vez y el Worker lo pone en las páginas al servirlas.
--
-- Aditiva y reversible: si la tabla está vacía o la consulta falla, las páginas
-- muestran lo que traen escrito, que sigue siendo válido.

CREATE TABLE IF NOT EXISTS contenido (
  clave        TEXT PRIMARY KEY,   -- horario_horas, direccion, carta, ...
  valor        TEXT NOT NULL,      -- texto plano o JSON, según la clave
  actualizado  INTEGER NOT NULL,   -- epoch ms de la última edición
  por          TEXT                -- quién editó, si se sabe
);
