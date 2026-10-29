-- Siembra con lo que las páginas dicen hoy. Idempotente: se puede correr de
-- nuevo sin pisar lo que alguien haya editado después, porque solo inserta
-- las claves que todavía no existen.

INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('horario_dias', 'Martes a domingo', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('horario_horas', '12:00 a 20:00', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('horario_abre', '12', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('horario_cierra', '20', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('horario_dia_cerrado', '1', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('direccion', 'Los Leones 1012, local 2', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('comuna', 'Providencia', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('pistacho_bloqueado', 'si', 1793309655430, 'siembra');
INSERT OR IGNORE INTO contenido (clave, valor, actualizado, por) VALUES ('carta', '[{"nombre": "Macerati", "que": "Piña pasada al ron", "bloqueado": false}, {"nombre": "Locura", "que": "Lúcuma", "bloqueado": false}, {"nombre": "Enrique", "que": "", "bloqueado": false}, {"nombre": "Anti vainilla", "que": "", "bloqueado": false}, {"nombre": "Chocolate", "que": "", "bloqueado": false}, {"nombre": "Cookies & cream", "que": "", "bloqueado": false}, {"nombre": "Frambuesa", "que": "", "bloqueado": false}, {"nombre": "Frutilla", "que": "", "bloqueado": false}, {"nombre": "Mango", "que": "", "bloqueado": false}, {"nombre": "Piña", "que": "", "bloqueado": false}, {"nombre": "Menta chips", "que": "", "bloqueado": false}, {"nombre": "Pie de limón", "que": "", "bloqueado": false}]', 1793309655430, 'siembra');
