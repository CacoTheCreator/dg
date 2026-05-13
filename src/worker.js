// dg — Cloudflare Worker que sirve dailygrind.cl como sitio estático.
// Source canónico bajo control editorial; redeploy con `npx wrangler deploy`.
// Las rutas /laconsola/* son manejadas por el Worker dailygrind-laconsola
// porque son más específicas — Cloudflare hace match más-específico primero.

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (req: Request) => Promise<Response> } }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    // Compatibilidad: el mundo Kraneo se mudó de /previews/kraneo-dg-XXX
    // a /kraneo/dg-XXX. Redirigimos links viejos ya compartidos.
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

    return env.ASSETS.fetch(request);
  },
};
