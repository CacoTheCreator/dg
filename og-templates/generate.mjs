// Genera las 3 OG images del sitio dailygrind.cl desde templates HTML locales.
// Output: img/og-home.jpg, img/og-previews.jpg, img/og-laconsola.jpg
//
// Uso (desde la raíz del repo): node og-templates/generate.mjs
//
// Requiere: playwright (instalado globally o via `npx playwright install chromium`).

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const TARGETS = [
  { template: "home.html",      out: "img/og-home.jpg" },
  { template: "previews.html",  out: "img/og-previews.jpg" },
  { template: "laconsola.html", out: "img/og-laconsola.jpg" },
];

const VIEWPORT = { width: 1200, height: 630 };
const QUALITY = 86; // JPEG quality — 86 da buen balance peso/visual

// Usamos el Chrome del sistema (/Applications/Google Chrome.app) para no
// requerir descarga de chromium de playwright.
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

for (const t of TARGETS) {
  const templatePath = resolve(__dirname, t.template);
  const outPath = resolve(repoRoot, t.out);
  const url = pathToFileURL(templatePath).href;

  console.log(`→ Rendering ${t.template} → ${t.out}`);
  await page.goto(url, { waitUntil: "networkidle" });
  // Esperar fonts cargadas
  await page.evaluate(() => document.fonts.ready);
  // Un pequeño delay extra para garantizar layout estable
  await page.waitForTimeout(300);

  await page.screenshot({
    path: outPath,
    type: "jpeg",
    quality: QUALITY,
    clip: { x: 0, y: 0, ...VIEWPORT },
  });
  console.log(`   ✓ ${outPath}`);
}

await browser.close();
console.log("Done.");
