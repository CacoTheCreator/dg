import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { copyFile } from "node:fs/promises";

const SRC_HTML = resolve(
  "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/feed-reapertura-vol4/feed-07-apparel-stodak.html",
);
const OUT_PNG_SOURCE = resolve(
  "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/feed-reapertura-vol4/png/feed-07-apparel-stodak.png",
);
const OUT_PNG_PREVIEW = resolve(
  "/Users/cacothecreator/Documents/agency/output/devwebs/thedailygrind/previews/feed-vol4/apparel-stodak.png",
);

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(SRC_HTML).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({
  path: OUT_PNG_SOURCE,
  type: "png",
  clip: { x: 0, y: 0, width: 1080, height: 1080 },
});
await copyFile(OUT_PNG_SOURCE, OUT_PNG_PREVIEW);
await browser.close();
console.log(`Rendered: ${OUT_PNG_SOURCE}`);
console.log(`Copied to: ${OUT_PNG_PREVIEW}`);
