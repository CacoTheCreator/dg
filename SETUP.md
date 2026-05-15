# Daily Grind Publisher — Setup en Cloudflare

Stack: Worker `dg` (este repo) + D1 + R2 + Cron Triggers. Todo dentro del free tier.

Lo que sigue lo corres **una sola vez**. Después ya es solo deploys con `npx wrangler deploy`.

> Pre-requisitos: estar logueado en wrangler con la cuenta `juan@realestodo.com's Account` (id `9d84c31c5105d9dfaf43d3c66a2cccac`). Verificar con `npx wrangler whoami`.

---

## 1. Crear la base de datos D1

```bash
cd ~/Documents/agency/output/devwebs/thedailygrind
npx wrangler d1 create publisher
```

Eso imprime algo como:

```
✅ Successfully created DB 'publisher' in region ...
[[d1_databases]]
binding = "DB"
database_name = "publisher"
database_id = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
```

Copia ese `database_id` y reemplaza el placeholder en `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "publisher"
database_id = "REPLACE_AFTER_CREATE"   ← pega acá
```

Aplica el schema:

```bash
npx wrangler d1 execute publisher --remote --file=migrations/0001_init.sql
```

Verifica con:

```bash
npx wrangler d1 execute publisher --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Debes ver: `queue`, `history`, `sessions`, `assets`.

---

## 2. Crear el bucket R2

```bash
npx wrangler r2 bucket create dg-media
```

(El Worker accede al bucket por binding, así que no necesitas hacer pública la URL — todo se sirve por `/publisher/media/`.)

---

## 3. Setear los secrets

Tomamos los valores del `.env` local en `~/Documents/agency/output/daily-grind/social-media-dept/publisher/.env`.

Corre uno a uno (cada `wrangler secret put` pide el valor por stdin — paga, pega, Enter):

```bash
npx wrangler secret put APP_ID
npx wrangler secret put APP_SECRET
npx wrangler secret put LONG_USER_TOKEN
npx wrangler secret put PAGE_ID
npx wrangler secret put PAGE_ACCESS_TOKEN
npx wrangler secret put IG_USER_ID
npx wrangler secret put PUBLISHER_PIN
```

**PUBLISHER_PIN**: elige una clave que vaya a compartir el equipo. Sugerido: 12+ caracteres, alfanumérica, fácil de comunicar oralmente (ej: `DailyGrind2026A` o `vol04-publisher-7`).

Para verificar que quedaron seteados:

```bash
npx wrangler secret list
```

---

## 4. Deploy

```bash
npx wrangler deploy
```

Eso publica:
- Worker actualizado con todas las rutas `/publisher/*`
- El Cron Trigger (corre cada 60 segundos)
- `publisher/index.html` servido como SPA en `https://dailygrind.cl/publisher/`

---

## 5. Sanity check

Abre **https://dailygrind.cl/publisher/**.

1. Pantalla de PIN → ingresa `PUBLISHER_PIN`. Te deja entrar.
2. Header muestra: `Daily Grind · X seguidores · IG @handle (Y)`. Si dice "Error consultando la cuenta", revisa los secrets.
3. Composer: elige **Texto**, escribe un mensaje de prueba, **Publicar ahora ↗**.
4. Aparece en Historial al toque (o en el próximo tick si fuiste por Agendar).

Logs del Worker en tiempo real:

```bash
npx wrangler tail
```

Cron Triggers en CF Dashboard:
- https://dash.cloudflare.com → Workers & Pages → `dg` → Triggers

---

## 6. Retirar el publisher local

Cuando confirmes que la versión web publica correctamente:

```bash
cd ~/Documents/agency/output/daily-grind/social-media-dept/publisher
./install_scheduler.sh uninstall
```

El directorio local queda como referencia (puedes archivar o borrar). El sistema vivo es ahora 100% Cloudflare.

---

## 7. Renovar tokens cada ~55 días

Mismo flujo que antes:

1. Ve a Graph API Explorer con la app **Daily Grind Publisher**.
2. Generate Access Token con los 7 scopes.
3. Copia el short-lived token.
4. Localmente:

   ```bash
   cd ~/Documents/agency/output/daily-grind/social-media-dept/publisher
   python3 bootstrap_tokens.py
   ```

5. Toma el `LONG_USER_TOKEN` y `PAGE_ACCESS_TOKEN` nuevos del `.env`.
6. Súbelos a Cloudflare:

   ```bash
   cd ~/Documents/agency/output/devwebs/thedailygrind
   npx wrangler secret put LONG_USER_TOKEN
   npx wrangler secret put PAGE_ACCESS_TOKEN
   ```

7. `npx wrangler deploy` (opcional — los secrets se aplican sin redeploy, pero deploy refresca todo).

---

## Troubleshooting

- **`Error: D1_ERROR: no such table`** → No corriste la migration. Aplícala con el comando del paso 1.
- **`unauthorized`** en /publisher/api/* → cookie expirada. Recarga `/publisher/` y vuelve a ingresar el PIN.
- **Cron no dispara** → revisa `npx wrangler tail` y CF Dashboard → Triggers. El cron `* * * * *` debe estar listado.
- **IG dice container ERROR** → la URL del video no cumple specs (ver README del repo `daily-grind/social-media-dept/publisher`). Specs IG Reel: MP4 H.264, 9:16, ≤ 90 min, ≤ 1 GB.

---

## Diagrama mental

```
[dailygrind.cl/publisher/]  ── PIN ──>  [Compositor]
                                          │
                                          ▼
                                  upload → R2 (dg-media)
                                          │
                                          ▼
                                  POST /queue → D1 (queue)
                                          │
[Cron cada 60s] ─────────────────────────→│
                                          ▼
                              processQueue(env)
                                          │
                                          ├──> Graph API (FB/IG)
                                          │
                          ┌── success ────┘
                          │              ┌── failure (3 intentos) ──┐
                          ▼              ▼                          │
                  D1 (history)   D1 (history status=failed)         │
                          │              │                          │
                          └────────  UI se actualiza  ──────────────┘
```
