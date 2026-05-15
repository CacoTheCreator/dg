#!/usr/bin/env bash
# Daily Grind Publisher — backup operacional read-only.
# Respalda D1 (queue + history + sessions + assets + stats) y R2 (media)
# a una carpeta FUERA del repo. No commitea nada. No toca producción.
#
# Uso:
#   scripts/backup.sh                  # backup full hoy
#   scripts/backup.sh --d1-only        # solo dump SQL del D1
#   scripts/backup.sh --r2-only        # solo sync R2 → local
#   scripts/backup.sh --prune-days 30  # borra backups anteriores a 30 días
#
# Destino: $DG_BACKUPS_ROOT  (default: $HOME/dailygrind-backups)

set -euo pipefail

REPO_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
ROOT="${DG_BACKUPS_ROOT:-$HOME/dailygrind-backups}"
TODAY=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%dT%H-%M-%S)
DEST="$ROOT/$TODAY"
D1_NAME="publisher"
R2_BUCKET="dg-media"

mkdir -p "$DEST" "$ROOT/r2-mirror"
cd "$REPO_ROOT"

mode="full"
prune_days=""
for arg in "$@"; do
  case "$arg" in
    --d1-only) mode="d1" ;;
    --r2-only) mode="r2" ;;
    --prune-days) shift; prune_days="$1" ;;
    --prune-days=*) prune_days="${arg#*=}" ;;
  esac
done

dump_d1() {
  local out="$DEST/d1-${D1_NAME}-${TS}.sql"
  echo "→ Exportando D1 $D1_NAME a $out"
  npx wrangler d1 export "$D1_NAME" --remote --output "$out" 2>&1 | tail -3
  local size=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
  echo "   OK $size bytes"
}

sync_r2() {
  local mirror="$ROOT/r2-mirror"
  local listing="$DEST/r2-listing-${TS}.json"
  mkdir -p "$mirror"
  echo "→ Listando assets registrados en D1 (fuente de verdad: tabla assets)"
  # wrangler 3.x/4.x no exponen `r2 object list`. Usamos la tabla assets del
  # propio Publisher como catálogo: cada upload se registra ahí con su key R2.
  if ! npx wrangler d1 execute "$D1_NAME" --remote --json \
        --command="SELECT key, content_type, size_bytes FROM assets ORDER BY uploaded_at;" \
        > "$listing" 2>/dev/null; then
    echo "   ✘ falla listando assets en D1 — abortando sync R2"
    return 1
  fi
  local count
  count=$(python3 -c "
import json, sys
data = json.load(open('$listing'))
rows = data[0]['results'] if isinstance(data, list) and data else data.get('result', [{}])[0].get('results', [])
print(len(rows))
" 2>/dev/null || echo 0)
  echo "   $count keys registradas en assets"
  python3 - <<PYEOF
import json, os, subprocess
data = json.load(open('$listing'))
rows = data[0]['results'] if isinstance(data, list) and data else data.get('result', [{}])[0].get('results', [])
mirror = '$mirror'
new = 0
errors = 0
for row in rows:
    key = row.get('key')
    if not key: continue
    dest = os.path.join(mirror, key)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        continue
    print(f'  · descargando {key}')
    r = subprocess.run(
        ['npx','wrangler','r2','object','get', f'$R2_BUCKET/{key}','--file', dest],
        capture_output=True, text=True
    )
    if r.returncode != 0 or not (os.path.exists(dest) and os.path.getsize(dest) > 0):
        print(f'    ✘ falla: {r.stderr.strip()[:120]}')
        errors += 1
        if os.path.exists(dest) and os.path.getsize(dest) == 0:
            os.remove(dest)
    else:
        new += 1
print(f'   {new} objetos nuevos descargados, {errors} errores')
if errors: raise SystemExit(1)
PYEOF
}

prune() {
  [ -z "$prune_days" ] && return 0
  echo "→ Limpiando backups anteriores a $prune_days días"
  find "$ROOT" -maxdepth 1 -type d -name "20*" -mtime "+$prune_days" -print -exec rm -rf {} \; 2>/dev/null || true
}

echo "Daily Grind Publisher · backup · $TS"
echo "  Repo:     $REPO_ROOT"
echo "  Destino:  $DEST"
echo

case "$mode" in
  d1)  dump_d1 ;;
  r2)  sync_r2 ;;
  full) dump_d1; sync_r2 ;;
esac

prune

echo
echo "Done. Total en $ROOT:"
du -sh "$ROOT"/* 2>/dev/null | tail -5
