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
    return env.ASSETS.fetch(request);
  },
};
