# The Daily Grind — Contexto del proyecto

## Qué estamos construyendo

Sitio web de The Daily Grind. **Vol. 4 Café** ya está activo — la cafetería abierta, la camisa lanzada, y dentro del mismo universo viven sub-secciones (`/previews/`, `/laconsola/`, `/dailyback/`, `/menu`, `/promos`).

El stack es simple: HTML vanilla, CSS y JS inline. Sin frameworks. Se despliega como **Cloudflare Worker con static assets**.

---

## La marca en dos párrafos

The Daily Grind es una cafetería que convierte el desayuno en escenario para el arte. Nació desde dos artistas construyendo una carrera musical. La marca se despliega en **volúmenes**: Vol. 1 fue un álbum, Vol. 2 y 3 fueron poleras, **Vol. 4 es la cafetería + la camisa**. Sub-experiencias actuales dentro del Vol. 4: `/laconsola/` (arcade), `/eldiez` (loyalty `dailyback`), `/previews/` (WIP compartibles).

La declaración interna es "Daily Grind existe porque debe existir". Personalidad eneagrama 8 ala 7: firme, directa, curiosa. Se dirige a personas que crean, que valoran el buen gusto, que quieren que su rutina tenga un componente artístico constante.

---

## Identidad visual

```css
--navy:    #0e1e56   /* primario */
--navy-2:  #0b1845
--sky:     #51b5f2   /* acento */
--sky-lt:  #a6d9f8
--cream:   #f9f3ec   /* fondo */
--beige:   #e3ded9
--beige-2: #d9d4cf
--dark:    #212529
--mid:     #6C757D
--white:   #FFFFFF
```

Tipografía: `Syne` (400, 700) para títulos, `DM Sans` (300, 500, 300 italic) para cuerpo.
Google Fonts URL canónica (la que usa el sitio):
`https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,500;1,300&family=Syne:wght@400;700&display=swap`
Logo: `LogoTDG.svg` en la raíz del repo.

---

## Voz

- Declaraciones directas y positivas. Nunca "no solo... sino también".
- Títulos: solo mayúscula inicial + nombres propios.
- Sin clichés: nada de "tribu", "únete al movimiento", "no somos solo una marca".
- Tono: directo, seguro, con una dosis de juego. Como ese amigo que te lleva a lugares distintos.

---

## Infraestructura — fuente única de verdad

- **Hosting:** Cloudflare Worker llamado **`dg`** con static assets binding. **NO usar Cloudflare Pages** — el proyecto Pages `the-daily-grind` fue borrado el 13-05-2026 porque generaba confusión (no servía tráfico real). Cualquier deploy via `wrangler pages deploy` está fuera de spec.
- **Cuenta CF:** `juan@realestodo.com's Account` (id `9d84c31c5105d9dfaf43d3c66a2cccac`).
- **Ruta CF:** `dailygrind.cl/*` apunta al Worker `dg`. Las sub-rutas `/laconsola/*` y `/dailyback/*` viven en Workers separados y ganan por match más-específico de Cloudflare.
- **Repo:** este folder, `~/Documents/agency/output/devwebs/thedailygrind/`. GitHub `CacoTheCreator/dg`, branch `main`.
- **Form de registro:** envío vía `fetch` a Google Apps Script (URL en el JS, variable `SCRIPT_URL`).
- **Deploy command (único):**
  ```bash
  cd ~/Documents/agency/output/devwebs/thedailygrind
  npx wrangler deploy
  ```
- **Config:** `wrangler.toml` en la raíz declara name, route, assets directory y html_handling. No hace falta pasar flags.
- **Qué NO sube al deploy:** ver `.assetsignore`. Excluye `recursos/`, `CLAUDE.md`, `node_modules`, `.wrangler`, `wrangler.toml`, `src/`, `.assetsignore`, `package.json`. **`previews/` SÍ sube** desde 13-05-2026.

---

## Estado actual del repo

Archivos servidos al público:
- `index.html` — landing principal (hero + volúmenes + comic + form + discover-strip + footer)
- `menu.html` — carta (Vol. 4)
- `promos.html` — promos (Vol. 4)
- `previews/index.html` — index de la sección WIP
- `previews/hang-tag-vol4/index.html` — preview del hang tag del Vol. 4
- `LogoTDG.svg`, `robots.txt`, `img/*`

Archivos NO servidos (excluidos via `.assetsignore`):
- `recursos/` — fotos crudas / referencias / archivos fuente pesados
- `leadform.html` — versión legacy del form, no en producción
- `CLAUDE.md`, `CONTEXT_THE_DAILY_GRIND.md` — docs del repo
- `src/worker.js`, `wrangler.toml`, `package.json` — config de deploy

Todas las páginas servidas al público bajo `/previews/*` deben incluir `<meta name="robots" content="noindex,nofollow">`.

---

## Reglas del proyecto

- Mantener todo en archivos HTML standalone. CSS y JS inline, sin imports externos excepto Google Fonts.
- Mobile-first. Breakpoint principal: 480px.
- No usar frameworks. Vanilla JS.
- Mantener la estética y la voz de la marca en cada texto que se escriba.
- **Deploy mechanism:** solo `npx wrangler deploy` desde este repo. Ningún `wrangler pages deploy` ni nada que toque Cloudflare Pages.
- Si vas a agregar una página o asset, recuerda chequear `.assetsignore` por si está bloqueado.
- Cero emojis decorativos (`✓`, `❤`, etc.) en el copy editorial. Marcadores brand: `■`, `→`, `↗`, `·`.

---

## Publisher interno — `/publisher/`

Este repo además del sitio público hospeda un **panel privado de publicación a Facebook Page e Instagram Business**, vivo en `https://dailygrind.cl/publisher/`. Está montado sobre el mismo Worker `dg`. **No es público ni para clientes** — es herramienta interna del equipo Daily Grind.

### Topología

| Pieza | Ubicación |
|---|---|
| Frontend SPA | `publisher/index.html` (HTML+CSS+JS vanilla, estética Vol. 04, PIN gate, drag-drop, calendario, historial) |
| Routes API | `src/worker.js` bloque `/publisher/api/*` (auth, queue CRUD, upload, whoami, history) |
| Media proxy | `src/worker.js` bloque `/publisher/media/*` (R2 → HTTP, cache 1 año, X-Robots-Tag noindex) |
| Cron scheduler | `src/worker.js` export `scheduled()` (corre cada minuto via Cron Trigger del Worker) |
| Migrations | `migrations/0001_init.sql`, `0002_add_story.sql`, … (rebuild de tablas para CHECK constraints) |
| Schema D1 | tablas `queue`, `history`, `sessions`, `assets` |
| Storage R2 | bucket `dg-media`, sirve por `/publisher/media/{uuid}.{ext}` |
| Setup runbook | `SETUP.md` (one-time CF setup, secrets, deploy) |

### Bindings (en `wrangler.toml`)

- `[[d1_databases]] binding = "DB"` → database `publisher` (id `7347c39b-a3cc-4b90-97db-4acd57540c4b`)
- `[[r2_buckets]] binding = "MEDIA"` → bucket `dg-media`
- `[triggers] crons = ["* * * * *"]` → ejecuta `scheduled()` cada minuto

### Secrets (set via `npx wrangler secret put NAME`)

`APP_ID, APP_SECRET, LONG_USER_TOKEN, PAGE_ACCESS_TOKEN, PAGE_ID, IG_USER_ID, PUBLISHER_PIN`.

Los tokens vienen del flujo del local publisher en `~/Documents/agency/output/daily-grind/social-media-dept/publisher/` (folder archivada, ahí vive `bootstrap_tokens.py` para renovar).

### Reglas del Publisher

1. **No linkear desde páginas públicas.** El sidebar, footer e index.html del sitio público no deben mencionar `/publisher/`. Acceso solo por URL directa + PIN.
2. **PIN gate vía secret `PUBLISHER_PIN`.** Cookie `dg-publisher-session` Path=/publisher HttpOnly Secure 30 días.
3. **noindex obligado.** Tanto `publisher/index.html` (`<meta name="robots" content="noindex,nofollow">`) como `/publisher/media/*` (`X-Robots-Tag: noindex, nofollow`).
4. **Migrations son aditivas y reversibles.** Cada cambio de schema = nueva file `migrations/NNNN_*.sql` aplicada con `npx wrangler d1 execute publisher --remote --file=...`. Nunca editar las existentes.
5. **El Cron es la única vía de publicación.** No publicar desde el handler de `fetch` (riesgo de doble-post si el usuario clickea dos veces).
6. **Rate limit IG 25/24h respetado** dentro de `processQueue` (cuenta history). No alterar.
7. **Reintentos**: 3 attempts con backoff 5min × attempts para errores reales. Backoff 1 min para `pending: ...` (Meta aún procesando).
8. **`/publisher/media/*` no requiere auth** porque Meta debe poder fetchear los assets para publicar. Los nombres son UUIDs — discovery por fuerza bruta es inviable.
9. **Token renewal cada ~55 días.** El `LONG_USER_TOKEN` dura 60 días. Cuando vence, también muere el `PAGE_ACCESS_TOKEN`. Renovar con `bootstrap_tokens.py` local y reupload con `wrangler secret put`.
10. **Si agregás un kind nuevo** (ej. fb-reel, fb-story): hay que (a) extender `ALLOWED` en worker, (b) agregar handler `xxYy(env, params)`, (c) extender CHECK constraint via migration, (d) agregar card y KIND_FIELDS al frontend, (e) extender buildPayloads.

### Reglas que NO aplican al Publisher (excepciones al resto del repo)

- Las rutas `/publisher/*` SÍ son served por el Worker con lógica (no por `env.ASSETS.fetch`). El handler intercepta antes de caer a assets.
- `migrations/` y `SETUP.md` están excluidos en `.assetsignore` para no exponer SQL ni runbook.
- El Publisher tiene su propio look interno (más dashboard que editorial), pero hereda paleta + fuentes + voz castellano chileno.

### Comandos comunes

```bash
# Deploy (publica worker + sitio + publisher de una vez)
npx wrangler deploy

# Ver logs en vivo del Worker (cron + requests)
npx wrangler tail

# Estado de la cola
npx wrangler d1 execute publisher --remote --command="SELECT id, platform, kind, status, scheduled_at FROM queue;"

# Estado del historial
npx wrangler d1 execute publisher --remote --command="SELECT platform, kind, status, finalized_at, permalink, substr(error,1,80) as err FROM history ORDER BY finalized_at DESC LIMIT 20;"

# Aplicar nueva migration
npx wrangler d1 execute publisher --remote --file=migrations/NNNN_xxx.sql

# Rotar PIN
echo -n "nuevo-pin" | npx wrangler secret put PUBLISHER_PIN
```

### Memoria asociada

Si trabajás con memoria, ver: `project_daily_grind_publisher` (vínculo principal), `project_dailygrindcl_stack`, `project_dailygrindcl_real_repo`.
