// Render Facebook cover (1640x624) for The Daily Grind page.
// Lives in the repo so playwright resolves naturally. Output goes to the
// agency social-media-dept output folder, not into the public site.
//
// Run (from repo root):  node og-templates/render-facebook-cover.mjs

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const TEMPLATE = "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/facebook-cover/cover.html";
const OUT_PNG = "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/facebook-cover/daily-grind-facebook-cover-1640x624.png";

const VIEWPORT = { width: 1640, height: 624 };

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

console.log(`-> Rendering ${TEMPLATE}`);
await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

await page.screenshot({
  path: OUT_PNG,
  type: "png",
  clip: { x: 0, y: 0, ...VIEWPORT },
});
console.log(`   v ${OUT_PNG}`);

await browser.close();
