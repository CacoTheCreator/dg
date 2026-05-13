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
