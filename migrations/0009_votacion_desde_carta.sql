-- La votación deja de tener su propia lista: sale de la carta.
--
-- Se marcan los seis que hoy están en la ronda, para que el panel abra
-- mostrando la verdad en vez de doce casillas vacías.
--
-- El UPDATE va condicionado a `por = 'siembra'`: si alguien ya editó la carta
-- desde el panel, esta migración no la pisa y las marcas se ponen a mano.

INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por)
VALUES ('votacion_ronda', '2026-11', 1793364553285, 'siembra');

UPDATE contenido
   SET valor = '[{"nombre": "Macerati", "que": "Piña pasada al ron", "bloqueado": false, "vota": false}, {"nombre": "Locura", "que": "Lúcuma", "bloqueado": false, "vota": false}, {"nombre": "Enrique", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Anti vainilla", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Chocolate", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Cookies & cream", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Frambuesa", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Frutilla", "que": "", "bloqueado": false, "vota": false}, {"nombre": "Mango", "que": "", "bloqueado": false, "vota": true}, {"nombre": "Piña", "que": "", "bloqueado": false, "vota": false}, {"nombre": "Menta chips", "que": "", "bloqueado": false, "vota": false}, {"nombre": "Pie de limón", "que": "", "bloqueado": false, "vota": false}]', actualizado = 1793364553285
 WHERE clave = 'carta' AND por = 'siembra';
