// dg — Cloudflare Worker que sirve dailygrind.cl como sitio estático
// + Publisher (FB Page + IG Business via Graph API, cola en D1, media en R2).
//
// Source canónico bajo control editorial; redeploy con `npx wrangler deploy`.

const GRAPH = (env) => `https://graph.facebook.com/${env.META_GRAPH_VERSION || "v23.0"}`;

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Compat: links viejos /previews/kraneo-dg-XXX → /kraneo/dg-XXX
    const krMatch = url.pathname.match(/^\/previews\/kraneo-dg-(\d{3})(\/.*)?$/);
    if (krMatch) {
      const slug = krMatch[1];
      const rest = krMatch[2] || "/";
      let mapped = rest;
      if (rest === "/propuesta.html" || rest === "/propuesta") mapped = "/";
      if (rest === "/propuesta.pdf") mapped = "/propuesta.pdf";
      const target = new URL(`/kraneo/dg-${slug}${mapped}`, url);
      return Response.redirect(target.toString(), 301);
    }

    // Previews gate (PIN simple, sin correo)
    if (url.pathname === "/previews" || url.pathname.startsWith("/previews/")) {
      const gated = await handlePreviewsGate(request, env, url);
      if (gated) return gated;
    }

    // La Comanda — cola compartida entre los aparatos que atienden
    if (url.pathname.startsWith("/comanda/api/")) {
      return handleComanda(request, env, url);
    }

    // Publisher API
    if (url.pathname.startsWith("/publisher/api/")) {
      return handleApi(request, env, ctx);
    }
    // Media proxy (R2)
    if (url.pathname.startsWith("/publisher/media/")) {
      return handleMedia(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  /**
   * Cron Trigger: corre cada minuto, procesa items debidos en la cola.
   * @param {ScheduledEvent} event
   * @param {Env} env
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processQueue(env));
  },
};

// ============================================================================
// API router
// ============================================================================

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/publisher\/api/, "");

  try {
    // Público: auth
    if (path === "/auth" && request.method === "POST") return apiAuth(request, env);

    // Protegidos
    const session = await getSession(request, env);
    if (!session) return json({ error: "unauthorized" }, 401);

    if (path === "/me" && request.method === "GET") return json({ ok: true, expires_at: session.expires_at });
    if (path === "/logout" && request.method === "POST") return apiLogout(request, env, session);

    if (path === "/queue" && request.method === "GET") return apiQueueList(env);
    if (path === "/queue" && request.method === "POST") return apiQueueAdd(request, env);
    if (path === "/history" && request.method === "GET") return apiHistory(request, env);
    if (path === "/upload" && request.method === "POST") return apiUpload(request, env);
    if (path === "/whoami" && request.method === "GET") return apiWhoami(env);

    const idMatch = path.match(/^\/queue\/([a-z0-9-]+)(\/publish-now)?$/);
    if (idMatch) {
      const id = idMatch[1];
      const publishNow = !!idMatch[2];
      if (publishNow && request.method === "POST") return apiQueuePublishNow(env, id);
      if (request.method === "DELETE") return apiQueueCancel(env, id);
      if (request.method === "PATCH") return apiQueueReschedule(request, env, id);
    }

    const statsMatch = path.match(/^\/history\/([a-z0-9-]+)\/stats$/);
    if (statsMatch) {
      const id = statsMatch[1];
      const refresh = url.searchParams.get("refresh") === "true";
      if (request.method === "GET") return apiHistoryStats(env, id, refresh);
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: e.message, stack: e.stack }, 500);
  }
}

// ============================================================================
// Auth
// ============================================================================

async function apiAuth(request, env) {
  const { pin } = await request.json().catch(() => ({}));
  if (!pin || !env.PUBLISHER_PIN) return json({ error: "missing" }, 400);
  if (pin !== env.PUBLISHER_PIN) {
    await sleep(800 + Math.random() * 400); // small constant delay
    return json({ error: "wrong_pin" }, 401);
  }
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const ttlDays = parseInt(env.SESSION_TTL_DAYS || "30", 10);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 86400_000);
  await env.DB.prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(token, now.toISOString(), expires.toISOString()).run();
  return new Response(JSON.stringify({ ok: true, expires_at: expires.toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `dg-publisher-session=${token}; Path=/publisher; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlDays * 86400}`,
    },
  });
}

async function apiLogout(request, env, session) {
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(session.token).run();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `dg-publisher-session=deleted; Path=/publisher; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

async function getSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/dg-publisher-session=([^;]+)/);
  if (!m) return null;
  const token = m[1];
  const row = await env.DB.prepare(
    "SELECT token, created_at, expires_at, label FROM sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, new Date().toISOString()).first();
  return row || null;
}

// ============================================================================
// Previews gate — PIN compartido, cookie firmada stateless (sin DB)
// ============================================================================

const PREVIEWS_COOKIE = "dg-previews-session";

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Token = HMAC-SHA256(PREVIEWS_PIN, "dg-previews-v1"). No adivinable sin el PIN;
// rotar el PIN invalida cookies viejas automáticamente.
async function previewsToken(env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.PREVIEWS_PIN || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("dg-previews-v1"));
  return bufToHex(sig);
}

// Solo rutas internas dentro de /previews; nunca el propio __gate.
function safeNext(raw) {
  if (!raw) return "/previews/";
  try {
    const dec = decodeURIComponent(String(raw));
    if (dec.startsWith("/previews/__gate")) return "/previews/";
    if (dec.startsWith("/previews") && !dec.startsWith("//")) return dec;
  } catch (_) { /* noop */ }
  return "/previews/";
}

async function handlePreviewsGate(request, env, url) {
  // Sin PIN configurado: no gatear (fail-open evita lockout accidental).
  if (!env.PREVIEWS_PIN) return null;

  const expected = await previewsToken(env);
  const ttlDays = parseInt(env.SESSION_TTL_DAYS || "30", 10);

  // Submit del formulario de PIN.
  if (request.method === "POST" && url.pathname === "/previews/__gate") {
    const form = await request.formData().catch(() => null);
    const pin = form ? String(form.get("pin") || "") : "";
    const next = safeNext(form ? form.get("next") : "/previews/");
    if (pin && pin === env.PREVIEWS_PIN) {
      return new Response(null, {
        status: 303,
        headers: {
          "Location": next,
          "Set-Cookie": `${PREVIEWS_COOKIE}=${expected}; Path=/previews; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlDays * 86400}`,
        },
      });
    }
    return previewsLoginPage(next, true);
  }

  // Resto: verificar cookie.
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`${PREVIEWS_COOKIE}=([a-f0-9]+)`));
  if (m && m[1] === expected) return null; // autenticado → seguir a ASSETS

  // No autenticado → mostrar login.
  return previewsLoginPage(safeNext(url.pathname + url.search), false);
}

function previewsLoginPage(next, error) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>Avances · The Daily Grind</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;500&family=Syne:wght@700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#0e1e56;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .gate{width:100%;max-width:360px;text-align:center}
    .gate img{height:52px;width:auto;margin-bottom:32px}
    .gate h1{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;margin-bottom:8px}
    .gate p{font-size:14px;font-weight:300;color:#a6d9f8;margin-bottom:26px;line-height:1.6}
    .gate input[type=password]{width:100%;border:1.5px solid rgba(255,255,255,.18);background:#0b1845;color:#fff;border-radius:10px;padding:14px 16px;font-size:18px;font-family:'DM Sans',sans-serif;text-align:center;letter-spacing:.3em;outline:none;margin-bottom:14px}
    .gate input[type=password]:focus{border-color:#51b5f2}
    .gate button{width:100%;border:none;border-radius:10px;padding:14px;background:#51b5f2;color:#0e1e56;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:background .2s}
    .gate button:hover{background:#a6d9f8}
    .err{color:#ff8a9b;font-size:13px;margin-bottom:14px;min-height:18px}
  </style>
</head>
<body>
  <form class="gate" method="POST" action="/previews/__gate">
    <img src="/LogoTDG.svg" alt="The Daily Grind">
    <h1>Avances de la casa</h1>
    <p>Esto todavía está en el horno. Ingresa el PIN para ver lo que viene.</p>
    <div class="err">${error ? "PIN incorrecto. Intenta de nuevo." : ""}</div>
    <input type="password" name="pin" inputmode="numeric" autocomplete="off" placeholder="••••" autofocus>
    <input type="hidden" name="next" value="${htmlEscape(next)}">
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}

// ============================================================================
// Queue API
// ============================================================================

const ALLOWED = {
  fb: ["text", "link", "photo"],
  ig: ["photo", "reel", "carousel", "story"],
};

async function apiQueueList(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, platform, kind, params, scheduled_at, status, attempts, last_error, created_at FROM queue ORDER BY scheduled_at ASC"
  ).all();
  return json({ items: results.map(decodeItem) });
}

async function apiQueueAdd(request, env) {
  const body = await request.json().catch(() => ({}));
  const { platform, kind, params, scheduled_at } = body;
  if (!ALLOWED[platform] || !ALLOWED[platform].includes(kind)) {
    return json({ error: "platform_kind_invalido" }, 400);
  }
  if (!scheduled_at || isNaN(Date.parse(scheduled_at))) {
    return json({ error: "scheduled_at_invalido" }, 400);
  }
  validateParams(platform, kind, params || {});

  const id = crypto.randomUUID().slice(0, 8);
  const whenUtc = new Date(scheduled_at).toISOString();
  await env.DB.prepare(
    "INSERT INTO queue (id, platform, kind, params, scheduled_at, status, attempts, created_at) VALUES (?,?,?,?,?,'pending',0,?)"
  ).bind(id, platform, kind, JSON.stringify(params), whenUtc, new Date().toISOString()).run();
  return json({ ok: true, id });
}

async function apiQueueCancel(env, id) {
  await env.DB.prepare("DELETE FROM queue WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function apiQueueReschedule(request, env, id) {
  const { scheduled_at } = await request.json().catch(() => ({}));
  if (!scheduled_at || isNaN(Date.parse(scheduled_at))) return json({ error: "scheduled_at_invalido" }, 400);
  const whenUtc = new Date(scheduled_at).toISOString();
  await env.DB.prepare(
    "UPDATE queue SET scheduled_at = ?, status = 'pending', attempts = 0, last_error = NULL WHERE id = ?"
  ).bind(whenUtc, id).run();
  return json({ ok: true });
}

async function apiQueuePublishNow(env, id) {
  await env.DB.prepare("UPDATE queue SET scheduled_at = ?, status = 'pending' WHERE id = ?")
    .bind(new Date().toISOString(), id).run();
  return json({ ok: true });
}

async function apiHistory(request, env) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
  const { results } = await env.DB.prepare(
    `SELECT h.id, h.platform, h.kind, h.params, h.scheduled_at, h.status, h.attempts,
            h.media_id, h.post_id, h.permalink, h.error, h.finalized_at,
            s.likes, s.comments, s.shares, s.saves, s.reach, s.views, s.total_interactions,
            s.fetched_at as stats_fetched_at
     FROM history h LEFT JOIN stats s ON s.history_id = h.id
     ORDER BY h.finalized_at DESC LIMIT ?`
  ).bind(limit).all();
  return json({ items: results.map(decodeItem) });
}

// ============================================================================
// Stats por post (Meta insights)
// ============================================================================

const STATS_TTL_MS = 3600_000; // 1h

async function apiHistoryStats(env, id, refresh) {
  const item = await env.DB.prepare("SELECT * FROM history WHERE id = ?").bind(id).first();
  if (!item) return json({ error: "not_found" }, 404);
  if (item.status !== "published") return json({ error: "not_published" }, 400);

  if (!refresh) {
    const cached = await env.DB.prepare(
      "SELECT * FROM stats WHERE history_id = ? AND fetched_at > ?"
    ).bind(id, new Date(Date.now() - STATS_TTL_MS).toISOString()).first();
    if (cached) {
      return json({
        cached: true, fetched_at: cached.fetched_at,
        likes: cached.likes, comments: cached.comments, shares: cached.shares,
        saves: cached.saves, reach: cached.reach, views: cached.views,
        total_interactions: cached.total_interactions,
        data: JSON.parse(cached.data || "{}"),
      });
    }
  }

  let stats;
  try {
    stats = await fetchPostStats(env, item);
  } catch (e) {
    return json({ error: "fetch_failed", message: e.message }, 502);
  }

  await env.DB.prepare(
    `INSERT OR REPLACE INTO stats
      (history_id, fetched_at, likes, comments, shares, saves, reach, views, total_interactions, data)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, new Date().toISOString(),
    stats.likes || 0, stats.comments || 0, stats.shares || 0,
    stats.saves || 0, stats.reach || 0, stats.views || 0,
    stats.total_interactions || 0, JSON.stringify(stats.raw || {})
  ).run();

  return json({ cached: false, fetched_at: new Date().toISOString(), ...stats });
}

async function fetchPostStats(env, item) {
  const token = env.PAGE_ACCESS_TOKEN;
  if (item.platform === "fb") {
    // Probar primero post_id (formato pageid_postid), luego media_id (foto), luego ambos
    const candidates = [item.post_id, item.media_id].filter(Boolean);
    let data = null, lastErr = null, usedId = null;
    for (const cand of candidates) {
      try {
        data = await metaGet(`/${cand}`, {
          fields: "message,created_time,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
          access_token: token,
        }, env);
        usedId = cand; break;
      } catch (e) { lastErr = e; }
    }
    if (!data) {
      return {
        likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, views: 0, total_interactions: 0,
        raw: { error: String(lastErr?.message || "fetch failed"), tried: candidates },
      };
    }
    let insights = {};
    try {
      const ins = await metaGet(`/${usedId}/insights`, {
        metric: "post_impressions_unique,post_clicks",
        access_token: token,
      }, env);
      for (const m of ins.data || []) insights[m.name] = m.values?.[0]?.value;
    } catch (_) { /* photo posts a veces no soportan insights */ }
    return {
      likes: data.reactions?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
      reach: insights.post_impressions_unique || 0,
      views: insights.post_clicks || 0,
      saves: 0,
      total_interactions: (data.reactions?.summary?.total_count || 0) + (data.comments?.summary?.total_count || 0) + (data.shares?.count || 0),
      raw: { ...data, insights, used_id: usedId },
    };
  }
  if (item.platform === "ig") {
    const mediaId = item.media_id;
    if (!mediaId) return { likes: 0, comments: 0, raw: { note: "no media_id" } };
    const fields = "id,caption,media_type,media_product_type,like_count,comments_count,permalink,timestamp,thumbnail_url";
    let data;
    try {
      data = await metaGet(`/${mediaId}`, { fields, access_token: token }, env);
    } catch (e) {
      return { likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, views: 0, total_interactions: 0, raw: { error: String(e.message) } };
    }
    let insights = {};
    try {
      const metricList = item.kind === "reel"
        ? "reach,plays,likes,comments,shares,saved,total_interactions"
        : item.kind === "story"
          ? "reach,impressions,replies"
          : "reach,saved,likes,comments,shares,total_interactions";
      const ins = await metaGet(`/${mediaId}/insights`, { metric: metricList, access_token: token }, env);
      for (const m of ins.data || []) insights[m.name] = m.values?.[0]?.value;
    } catch (_) { /* scope instagram_manage_insights faltante o medio no soporta */ }
    const likes = (typeof insights.likes === "number") ? insights.likes : (data.like_count || 0);
    const comments = (typeof insights.comments === "number") ? insights.comments : (data.comments_count || 0);
    return {
      likes, comments,
      shares: insights.shares || 0,
      saves: insights.saved || 0,
      reach: insights.reach || 0,
      views: insights.plays || insights.impressions || 0,
      total_interactions: insights.total_interactions || (likes + comments),
      raw: { ...data, insights },
    };
  }
  return { likes: 0, comments: 0, raw: { note: "unknown_platform" } };
}

function decodeItem(row) {
  try { row.params = JSON.parse(row.params); } catch { /* keep raw */ }
  return row;
}

function validateParams(platform, kind, p) {
  const req = (k) => { if (!p[k]) throw new Error(`params.${k} requerido`); };
  if (platform === "fb" && kind === "text") req("message");
  if (platform === "fb" && kind === "link") req("url");
  if (platform === "fb" && kind === "photo") req("image_url");
  if (platform === "ig" && kind === "photo") req("image_url");
  if (platform === "ig" && kind === "reel") req("video_url");
  if (platform === "ig" && kind === "carousel") {
    if (!Array.isArray(p.image_urls) || p.image_urls.length < 2 || p.image_urls.length > 10) {
      throw new Error("carousel requiere image_urls array entre 2 y 10");
    }
  }
  if (platform === "ig" && kind === "story") {
    if (!p.image_url && !p.video_url) throw new Error("story requiere image_url o video_url");
  }
}

// ============================================================================
// Upload → R2
// ============================================================================

async function apiUpload(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "no_file" }, 400);
  const name = file.name || "blob";
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  await env.DB.prepare(
    "INSERT INTO assets (key, content_type, size_bytes, uploaded_at) VALUES (?,?,?,?)"
  ).bind(key, file.type || "", file.size || 0, new Date().toISOString()).run();
  return json({
    ok: true,
    key,
    url: `https://dailygrind.cl/publisher/media/${key}`,
    contentType: file.type,
    size: file.size,
  });
}

async function handleMedia(request, env) {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace("/publisher/media/", ""));
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

// ============================================================================
// Whoami
// ============================================================================

async function apiWhoami(env) {
  const r = await metaGet(`/${env.PAGE_ID}`, {
    fields: "name,id,followers_count,fan_count,instagram_business_account{id,username,name,followers_count,follows_count,media_count,profile_picture_url}",
    access_token: env.PAGE_ACCESS_TOKEN,
  }, env);
  return json(r);
}

// ============================================================================
// Cron: scheduled publisher
// ============================================================================

async function processQueue(env) {
  const nowIso = new Date().toISOString();
  const dueLimit = 10;
  // Recuperar items stuck en 'publishing' por más de 5 min (cron crashed mid-process).
  // Safe porque cron es singleton — no hay otro tick procesando simultáneamente.
  const staleIso = new Date(Date.now() - 5 * 60_000).toISOString();
  await env.DB.prepare(
    "UPDATE queue SET status='retrying' WHERE status='publishing' AND scheduled_at < ?"
  ).bind(staleIso).run();

  const { results } = await env.DB.prepare(
    "SELECT id, platform, kind, params, scheduled_at, status, attempts FROM queue WHERE status IN ('pending','retrying') AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT ?"
  ).bind(nowIso, dueLimit).all();
  if (!results.length) return;

  // Rate limit IG en las últimas 24h
  const rateLimit = parseInt(env.IG_RATE_LIMIT_24H || "25", 10);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const igCountRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM history WHERE platform='ig' AND status='published' AND finalized_at > ?"
  ).bind(since).first();
  let igPublishedLast24h = igCountRow?.n || 0;

  for (const raw of results) {
    const item = decodeItem({ ...raw });
    if (item.platform === "ig" && igPublishedLast24h >= rateLimit) {
      // posponer 30 min, no quemar intentos
      const newWhen = new Date(Date.now() + 30 * 60_000).toISOString();
      await env.DB.prepare("UPDATE queue SET scheduled_at = ? WHERE id = ?").bind(newWhen, item.id).run();
      continue;
    }
    await env.DB.prepare("UPDATE queue SET status = 'publishing' WHERE id = ?").bind(item.id).run();

    try {
      const result = await publishItem(env, item);
      // OK: insert history, delete queue
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO history (id, platform, kind, params, scheduled_at, status, attempts, media_id, post_id, permalink, created_at, finalized_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(
          item.id, item.platform, item.kind, JSON.stringify(item.params),
          item.scheduled_at, "published", item.attempts + 1,
          result.media_id || null, result.post_id || null, result.permalink || null,
          raw.created_at || new Date().toISOString(), new Date().toISOString()
        ),
        env.DB.prepare("DELETE FROM queue WHERE id = ?").bind(item.id),
      ]);
      if (item.platform === "ig") igPublishedLast24h++;
    } catch (e) {
      const attempts = item.attempts + 1;
      const MAX_ATTEMPTS = 3;
      const errMsg = String(e.message || e).slice(0, 1000);
      const isPending = errMsg.startsWith("pending:");
      if (attempts >= MAX_ATTEMPTS && !isPending) {
        // final failure
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO history (id, platform, kind, params, scheduled_at, status, attempts, error, created_at, finalized_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
          ).bind(
            item.id, item.platform, item.kind, JSON.stringify(item.params),
            item.scheduled_at, "failed", attempts, errMsg,
            raw.created_at || new Date().toISOString(), new Date().toISOString()
          ),
          env.DB.prepare("DELETE FROM queue WHERE id = ?").bind(item.id),
        ]);
      } else {
        const backoffMin = isPending ? 1 : 5 * attempts;
        const newWhen = new Date(Date.now() + backoffMin * 60_000).toISOString();
        await env.DB.prepare(
          "UPDATE queue SET status = 'retrying', attempts = ?, scheduled_at = ?, last_error = ?, params = ? WHERE id = ?"
        ).bind(isPending ? item.attempts : attempts, newWhen, errMsg, JSON.stringify(item.params), item.id).run();
      }
    }
  }
}

// ============================================================================
// Graph API (FB + IG)
// ============================================================================

async function publishItem(env, item) {
  const { platform, kind, params } = item;
  if (platform === "fb") {
    if (kind === "text") return fbFeed(env, { message: params.message });
    if (kind === "link") return fbFeed(env, { link: params.url, message: params.message });
    if (kind === "photo") return fbPhoto(env, params.image_url, params.caption);
  }
  if (platform === "ig") {
    if (kind === "photo") return igPhoto(env, params);
    if (kind === "reel") return igReel(env, item, params);
    if (kind === "carousel") return igCarousel(env, item, params);
    if (kind === "story") return igStory(env, params);
  }
  throw new Error(`platform/kind no soportado: ${platform}/${kind}`);
}

async function fbFeed(env, { message, link }) {
  const r = await metaPost(`/${env.PAGE_ID}/feed`, {
    message, link, access_token: env.PAGE_ACCESS_TOKEN,
  }, env);
  return { post_id: r.id, permalink: `https://www.facebook.com/${r.id}` };
}

async function fbPhoto(env, imageUrl, caption) {
  requirePublicUrl(imageUrl);
  const r = await metaPost(`/${env.PAGE_ID}/photos`, {
    url: imageUrl, caption, access_token: env.PAGE_ACCESS_TOKEN,
  }, env);
  return { post_id: r.post_id, media_id: r.id, permalink: r.post_id ? `https://www.facebook.com/${r.post_id}` : null };
}

async function igPhoto(env, params) {
  requirePublicUrl(params.image_url);
  // Si ya hay container creado en intento anterior, reusarlo
  if (!params._container) {
    const c = await metaPost(`/${env.IG_USER_ID}/media`, {
      image_url: params.image_url, caption: params.caption, access_token: env.PAGE_ACCESS_TOKEN,
    }, env);
    params._container = c.id;
  }
  const status = await igStatus(env, params._container);
  if (status === "ERROR") throw new Error(`container ERROR`);
  if (status !== "FINISHED") throw new Error(`pending: ${status}`);
  const pub = await igPublishContainer(env, params);
  return { media_id: pub.id, permalink: await resolvePermalink(env, pub.id) };
}

async function igReel(env, item, params) {
  requirePublicUrl(params.video_url);
  if (!params._container) {
    const c = await metaPost(`/${env.IG_USER_ID}/media`, {
      media_type: "REELS",
      video_url: params.video_url,
      caption: params.caption,
      share_to_feed: params.share_to_feed ? "true" : "false",
      access_token: env.PAGE_ACCESS_TOKEN,
    }, env);
    params._container = c.id;
  }
  const status = await igStatus(env, params._container);
  if (status === "ERROR") throw new Error("container ERROR");
  if (status !== "FINISHED") throw new Error(`pending: ${status}`);
  const pub = await igPublishContainer(env, params);
  return { media_id: pub.id, permalink: await resolvePermalink(env, pub.id) };
}

async function igStory(env, params) {
  const isVideo = !!params.video_url;
  const mediaUrl = params.video_url || params.image_url;
  if (!mediaUrl) throw new Error("story requires image_url or video_url");
  requirePublicUrl(mediaUrl);
  if (!params._container) {
    const payload = {
      media_type: "STORIES",
      access_token: env.PAGE_ACCESS_TOKEN,
    };
    if (isVideo) payload.video_url = mediaUrl;
    else payload.image_url = mediaUrl;
    const c = await metaPost(`/${env.IG_USER_ID}/media`, payload, env);
    params._container = c.id;
  }
  const status = await igStatus(env, params._container);
  if (status === "ERROR") throw new Error("container ERROR");
  if (status !== "FINISHED") throw new Error(`pending: ${status}`);
  const pub = await igPublishContainer(env, params);
  return { media_id: pub.id, permalink: await resolvePermalink(env, pub.id) };
}

async function igCarousel(env, item, params) {
  for (const u of params.image_urls) requirePublicUrl(u);
  if (!params._children) {
    const children = [];
    for (const u of params.image_urls) {
      const c = await metaPost(`/${env.IG_USER_ID}/media`, {
        image_url: u, is_carousel_item: "true", access_token: env.PAGE_ACCESS_TOKEN,
      }, env);
      children.push(c.id);
    }
    params._children = children;
  }
  for (const cid of params._children) {
    const s = await igStatus(env, cid);
    if (s === "ERROR") throw new Error("child container ERROR");
    if (s !== "FINISHED") throw new Error(`pending: child ${cid} ${s}`);
  }
  if (!params._container) {
    const c = await metaPost(`/${env.IG_USER_ID}/media`, {
      media_type: "CAROUSEL", children: params._children.join(","),
      caption: params.caption, access_token: env.PAGE_ACCESS_TOKEN,
    }, env);
    params._container = c.id;
  }
  const s = await igStatus(env, params._container);
  if (s === "ERROR") throw new Error("carousel ERROR");
  if (s !== "FINISHED") throw new Error(`pending: carousel ${s}`);
  const pub = await igPublishContainer(env, params);
  return { media_id: pub.id, permalink: await resolvePermalink(env, pub.id) };
}

// Publica un container IG. Si Meta lo invalida entre create y publish
// (code 100 / subcode 33), borra _container para que el próximo retry
// cree uno fresco en vez de pegar contra el container muerto.
async function igPublishContainer(env, params) {
  try {
    return await metaPost(`/${env.IG_USER_ID}/media_publish`, {
      creation_id: params._container, access_token: env.PAGE_ACCESS_TOKEN,
    }, env);
  } catch (e) {
    const msg = String(e.message || "");
    if (/"code":100/.test(msg) && /"error_subcode":33/.test(msg)) {
      delete params._container;
      throw new Error(`container invalidated by Meta, will recreate: ${msg}`);
    }
    throw e;
  }
}

async function igStatus(env, containerId) {
  const r = await metaGet(`/${containerId}`, {
    fields: "status_code", access_token: env.PAGE_ACCESS_TOKEN,
  }, env);
  return r.status_code;
}

async function resolvePermalink(env, mediaId) {
  try {
    const r = await metaGet(`/${mediaId}`, {
      fields: "permalink", access_token: env.PAGE_ACCESS_TOKEN,
    }, env);
    return r.permalink || null;
  } catch { return null; }
}

async function metaGet(path, params, env) {
  const url = new URL(`${GRAPH(env)}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) url.searchParams.append(k, String(v));
  }
  const resp = await fetch(url.toString());
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Graph ${resp.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

async function metaPost(path, params, env) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) body.append(k, String(v));
  }
  const resp = await fetch(`${GRAPH(env)}${path}`, { method: "POST", body });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Graph ${resp.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

// ============================================================================
// Util
// ============================================================================

function requirePublicUrl(u) {
  if (!u || typeof u !== "string") throw new Error("url vacia");
  if (!/^https?:\/\//.test(u)) throw new Error(`url no http(s): ${u}`);
  if (/localhost|127\.0\.0\.1/.test(u)) throw new Error("url localhost no es publica");
}

// ============================================================================
// La Comanda — cola compartida
//
// El navegador dejo de ser el dueño del pedido y paso a ser una vista. Todos
// los aparatos que abren /comanda leen y escriben la misma cola, asi que el
// correlativo es uno solo y lo que uno marca entregado lo ven los demas.
//
// Las bajas son logicas (borrado = 1) y no DELETE: un aparato que estaba sin
// señal necesita enterarse de que la fila se fue, y una fila que desaparece
// del resultado es indistinguible de una que nunca sincronizo.
// ============================================================================

const COMANDA_ESTADOS = ["pendiente", "listo"];

async function handleComanda(request, env, url) {
  const ruta = url.pathname.replace(/^\/comanda\/api/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: comandaCors() });
  }
  if (!env.DB) return comandaJson({ error: "sin base de datos" }, 503);

  try {
    // GET /pedidos?desde=<epoch ms>&fecha=<dd-mm-aaaa>
    // Sin `desde` devuelve el dia completo; con `desde` solo lo que cambio.
    if (ruta === "/pedidos" && request.method === "GET") {
      const fecha = url.searchParams.get("fecha") || "";
      const desde = Number(url.searchParams.get("desde") || 0) || 0;
      if (!/^\d{2}-\d{2}-\d{4}$/.test(fecha)) {
        return comandaJson({ error: "fecha invalida" }, 400);
      }
      const res = await env.DB.prepare(
        "SELECT * FROM comanda_pedidos WHERE fecha = ? AND actualizado > ? ORDER BY t ASC"
      ).bind(fecha, desde).all();
      return comandaJson({
        pedidos: (res.results || []).map(comandaFila),
        servidor: Date.now(),
      });
    }

    // POST /pedidos — crea. El correlativo lo asigna el servidor.
    if (ruta === "/pedidos" && request.method === "POST") {
      const b = await request.json().catch(() => null);
      const error = comandaValida(b);
      if (error) return comandaJson({ error }, 400);

      // Reintento por señal mala: si el id ya existe, devolver lo guardado
      // en vez de crear un pedido gemelo con otro numero.
      const previo = await env.DB.prepare(
        "SELECT * FROM comanda_pedidos WHERE id = ?"
      ).bind(b.id).first();
      if (previo) return comandaJson({ pedido: comandaFila(previo), repetido: true });

      const ahora = Date.now();
      const fila = await env.DB.prepare(
        "SELECT COALESCE(MAX(n), 0) AS tope FROM comanda_pedidos WHERE fecha = ?"
      ).bind(b.fecha).first();
      const n = (fila?.tope || 0) + 1;

      await env.DB.prepare(
        `INSERT INTO comanda_pedidos
           (id, n, fecha, hora, t, estado, nombre, dscto, total, lineas, borrado, actualizado)
         VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, 0, ?)`
      ).bind(
        b.id, n, b.fecha, String(b.hora || "").slice(0, 5), Number(b.t) || ahora,
        String(b.nombre || "").slice(0, 60), String(b.dscto || ""),
        Math.round(Number(b.total) || 0), JSON.stringify(b.lineas), ahora
      ).run();

      const creado = await env.DB.prepare(
        "SELECT * FROM comanda_pedidos WHERE id = ?"
      ).bind(b.id).first();
      return comandaJson({ pedido: comandaFila(creado) });
    }

    // POST /pedidos/<id>/estado — entregado o de vuelta a la cola.
    const mEstado = ruta.match(/^\/pedidos\/([\w-]{1,64})\/estado$/);
    if (mEstado && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!COMANDA_ESTADOS.includes(b.estado)) {
        return comandaJson({ error: "estado invalido" }, 400);
      }
      const r = await env.DB.prepare(
        "UPDATE comanda_pedidos SET estado = ?, actualizado = ? WHERE id = ? AND borrado = 0"
      ).bind(b.estado, Date.now(), mEstado[1]).run();
      if (!r.meta?.changes) return comandaJson({ error: "no existe" }, 404);
      return comandaJson({ ok: true });
    }

    // POST /pedidos/<id>/borrar — saca la venta del historial.
    const mBorrar = ruta.match(/^\/pedidos\/([\w-]{1,64})\/borrar$/);
    if (mBorrar && request.method === "POST") {
      const r = await env.DB.prepare(
        "UPDATE comanda_pedidos SET borrado = 1, actualizado = ? WHERE id = ?"
      ).bind(Date.now(), mBorrar[1]).run();
      if (!r.meta?.changes) return comandaJson({ error: "no existe" }, 404);
      return comandaJson({ ok: true });
    }

    // POST /dia/borrar — vacia un dia entero. Siempre acotado por fecha:
    // nunca un UPDATE sin WHERE sobre la tabla.
    if (ruta === "/dia/borrar" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!/^\d{2}-\d{2}-\d{4}$/.test(b.fecha || "")) {
        return comandaJson({ error: "fecha invalida" }, 400);
      }
      const r = await env.DB.prepare(
        "UPDATE comanda_pedidos SET borrado = 1, actualizado = ? WHERE fecha = ? AND borrado = 0"
      ).bind(Date.now(), b.fecha).run();
      return comandaJson({ ok: true, borrados: r.meta?.changes || 0 });
    }

    // GET /dias — los dias que tienen ventas, para el selector del historial.
    if (ruta === "/dias" && request.method === "GET") {
      const res = await env.DB.prepare(
        `SELECT fecha, MAX(t) AS ultimo FROM comanda_pedidos
          WHERE borrado = 0 GROUP BY fecha ORDER BY ultimo DESC LIMIT 60`
      ).all();
      return comandaJson({ dias: (res.results || []).map((r) => r.fecha) });
    }

    return comandaJson({ error: "ruta desconocida" }, 404);
  } catch (e) {
    return comandaJson({ error: String(e && e.message ? e.message : e) }, 500);
  }
}

function comandaValida(b) {
  if (!b || typeof b !== "object") return "cuerpo invalido";
  if (!/^[\w-]{8,64}$/.test(b.id || "")) return "id invalido";
  if (!/^\d{2}-\d{2}-\d{4}$/.test(b.fecha || "")) return "fecha invalida";
  if (!Array.isArray(b.lineas) || !b.lineas.length) return "pedido sin lineas";
  if (b.lineas.length > 60) return "demasiadas lineas";
  if (!Number.isFinite(Number(b.total)) || Number(b.total) < 0) return "total invalido";
  return null;
}

function comandaFila(r) {
  let lineas = [];
  try { lineas = JSON.parse(r.lineas); } catch (e) { lineas = []; }
  return {
    id: r.id, n: r.n, fecha: r.fecha, hora: r.hora, t: r.t,
    estado: r.estado, nombre: r.nombre || "", dscto: r.dscto || "",
    total: r.total, lineas,
    borrado: !!r.borrado, actualizado: r.actualizado,
  };
}

function comandaCors() {
  return {
    "Access-Control-Allow-Origin": "https://dailygrind.cl",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function comandaJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...comandaCors(),
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
