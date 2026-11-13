// Staff-only physical visit registry. The caller enforces the existing panel session.
export const ORIGENES = Object.freeze({
  instagram: 'Instagram', google: 'Google', paso: 'Iba pasando',
  recomendacion: 'Recomendación', habitual: 'Ya conocía el local',
  otro: 'Otro origen', sin_respuesta: 'Sin respuesta'
});

export function hoyChile(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

export function fechaValida(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return !isNaN(parsed) && parsed.toISOString().slice(0, 10) === value;
}

function respuesta(data, status = 200) {
  return Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
}

export async function handleVisitas(request, env, url) {
  const ruta = url.pathname.slice('/panel/api/visitas'.length);
  const hoy = hoyChile();
  if (request.method !== 'GET') {
    if (request.headers.get('Origin') !== url.origin ||
        !request.headers.get('Content-Type')?.startsWith('application/json')) {
      return respuesta({error: 'Abre el registro desde el panel para guardar.'}, 403);
    }
  }
  try {
    if ((ruta === '' || ruta === '/exportar') && request.method === 'GET') {
      const desde = url.searchParams.get('desde') || hoy;
      const hasta = url.searchParams.get('hasta') || hoy;
      if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta || hasta > hoy ||
          (Date.parse(hasta) - Date.parse(desde)) / 86400000 > 365) {
        return respuesta({error: 'Elige un período válido de hasta 366 días, sin fechas futuras.'}, 400);
      }
      const agrupado = await env.DB.prepare(
        'SELECT fecha, origen, COUNT(*) AS cantidad FROM visitas WHERE fecha BETWEEN ? AND ? AND anulado = 0 GROUP BY fecha, origen ORDER BY fecha, origen'
      ).bind(desde, hasta).all();
      const filas = agrupado.results || [];
      if (ruta === '/exportar') {
        const csv = '\ufeffFecha,Origen,Visitas (personas o grupos atendidos)\r\n' +
          filas.map(r => [r.fecha, ORIGENES[r.origen], r.cantidad].join(',')).join('\r\n');
        return new Response(csv, {headers: {
          'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="visitas-${desde}-${hasta}.csv"`
        }});
      }
      const porOrigen = Object.fromEntries(Object.keys(ORIGENES).map(k => [k, 0]));
      filas.forEach(r => { porOrigen[r.origen] += r.cantidad; });
      const total = Object.values(porOrigen).reduce((a, b) => a + b, 0);
      const conocidas = total - porOrigen.sin_respuesta;
      const ultimas = await env.DB.prepare(
        'SELECT id, fecha, origen, creado, anulado FROM visitas WHERE fecha BETWEEN ? AND ? ORDER BY creado DESC, id DESC LIMIT 100'
      ).bind(desde, hasta).all();
      return respuesta({hoy, desde, hasta, total, conocidas, sinRespuesta: porOrigen.sin_respuesta,
        cobertura: total ? conocidas / total : null, origenes: ORIGENES, porOrigen,
        ultimas: ultimas.results || []});
    }
    if (ruta === '' && request.method === 'POST') {
      const b = await request.json().catch(() => null);
      if (!b || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.id || '') || !fechaValida(b.fecha) || b.fecha > hoy ||
          !Object.hasOwn(ORIGENES, b.origen)) {
        return respuesta({error: 'Revisa la fecha y el origen de la visita.'}, 400);
      }
      const now = Date.now();
      await env.DB.prepare(
        'INSERT INTO visitas(id, fecha, origen, creado, actualizado) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING'
      ).bind(b.id, b.fecha, b.origen, now, now).run();
      const visita = await env.DB.prepare('SELECT id, fecha, origen, creado, anulado FROM visitas WHERE id = ?').bind(b.id).first();
      if (visita.fecha !== b.fecha || visita.origen !== b.origen) {
        return respuesta({error: 'Ese registro ya existe con otros datos. Recarga el panel.'}, 409);
      }
      return respuesta({ok: true, visita});
    }
    const cambio = ruta.match(/^\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(anular|restaurar)$/i);
    if (cambio && request.method === 'POST') {
      const result = await env.DB.prepare('UPDATE visitas SET anulado = ?, actualizado = ? WHERE id = ?')
        .bind(cambio[2] === 'anular' ? 1 : 0, Date.now(), cambio[1]).run();
      return result.meta.changes ? respuesta({ok: true}) : respuesta({error: 'Visita no encontrada.'}, 404);
    }
    return respuesta({error: 'Ruta no encontrada.'}, 404);
  } catch (error) {
    console.error('Visit registry request failed', error?.message);
    return respuesta({error: 'No se pudo confirmar el registro. Reintenta; la misma visita no se duplicará.'}, 503);
  }
}
