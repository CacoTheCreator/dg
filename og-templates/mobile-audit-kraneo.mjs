import { chromium, devices } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = resolve(__dirname, "mobile-shots-kraneo");
await mkdir(SHOT_DIR, { recursive: true });

const iphone = devices["iPhone 13"];

const targets = [
  { url: "https://dailygrind.cl/kraneo/",                  name: "01-kraneo-gate",         unlock: false },
  { url: "https://dailygrind.cl/kraneo/",                  name: "02-kraneo-portal",       unlock: true  },
  { url: "https://dailygrind.cl/kraneo/dg-007/",           name: "03-dg-007-propuesta",    unlock: true  },
  { url: "https://dailygrind.cl/kraneo/dg-006/",           name: "08-dg-006-wrapper",      unlock: true  },
  { url: "https://dailygrind.cl/previews/",                name: "04-previews-gallery",    unlock: false },
  { url: "https://dailygrind.cl/previews/packaging-vol4/", name: "05-packaging-sleeve",    unlock: false },
  { url: "https://dailygrind.cl/previews/hang-tag-vol4/",  name: "06-hang-tag",            unlock: false },
  { url: "https://dailygrind.cl/previews/feed-vol4/",      name: "07-feed-vol4",           unlock: false },
];

const browser = await chromium.launch({ channel: "chrome" });

for (const t of targets) {
  const ctx = await browser.newContext({ ...iphone });
  const page = await ctx.newPage();

  // Pre-set sessionStorage if we want the unlocked state of /kraneo
  if (t.unlock) {
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem("tdg.kraneo.unlocked", "1"); } catch (_) {}
    });
  }

  await page.goto(t.url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);

  const fold = resolve(SHOT_DIR, `${t.name}-fold.png`);
  const full = resolve(SHOT_DIR, `${t.name}-full.png`);
  await page.screenshot({ path: fold, type: "png" });
  await page.screenshot({ path: full, type: "png", fullPage: true });
  console.log(`✓ ${t.name}`);

  await ctx.close();
}

await browser.close();
console.log(`\nShots saved to: ${SHOT_DIR}`);
