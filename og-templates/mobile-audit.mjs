// Mobile audit: captura las pantallas de las rutas /previews/* en viewport iPhone
// para detectar cortes y bugs responsive. Output en og-templates/mobile-shots/.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "mobile-shots");
mkdirSync(OUT_DIR, { recursive: true });

const URLS = [
  { url: "https://dailygrind.cl/previews/", slug: "index" },
  { url: "https://dailygrind.cl/previews/hang-tag-vol4/", slug: "hang-tag" },
  { url: "https://dailygrind.cl/previews/feed-vol4/", slug: "feed" },
  { url: "https://dailygrind.cl/previews/k03-latte-art/", slug: "k03" },
];

const browser = await chromium.launch({ channel: "chrome" });
// iPhone 14 Pro size
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
});
const page = await ctx.newPage();

for (const t of URLS) {
  console.log(`→ ${t.url}`);
  await page.goto(t.url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  // Captura full page para ver scroll completo
  await page.screenshot({
    path: resolve(OUT_DIR, `${t.slug}-full.png`),
    fullPage: true,
    type: "png",
  });
  // Captura viewport solo para ver qué ve al abrir
  await page.screenshot({
    path: resolve(OUT_DIR, `${t.slug}-viewport.png`),
    fullPage: false,
    type: "png",
  });
  console.log(`   ✓ ${t.slug}-full.png + ${t.slug}-viewport.png`);
}

await browser.close();
console.log("Done.");
