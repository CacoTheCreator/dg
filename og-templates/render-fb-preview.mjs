// Render a Facebook-page mockup with profile picture overlaid on cover,
// so the human can validate the composition harmonizes with the logo circle.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const TEMPLATE = "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/facebook-cover/preview-with-logo.html";
const OUT_PNG = "/Users/cacothecreator/Documents/agency/output/the-daily-grind/social-media-dept/facebook-cover/preview-facebook-page-mockup.png";

const VIEWPORT = { width: 1640, height: 904 };

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

await page.screenshot({
  path: OUT_PNG,
  type: "png",
  fullPage: true,
});
console.log(`v ${OUT_PNG}`);

await browser.close();
