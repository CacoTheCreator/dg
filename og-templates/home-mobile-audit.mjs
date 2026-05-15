// Audit visual del home en mobile iOS user-agent para detectar arrows/emoji que
// renderizan con font emoji del sistema en lugar de texto editorial.

import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "mobile-shots");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });

// Simular iPhone con user agent real para que el sitio sirva versión mobile
const ctx = await browser.newContext({
  ...devices["iPhone 14 Pro"],
});
const page = await ctx.newPage();

console.log("→ https://dailygrind.cl/");
await page.goto("https://dailygrind.cl/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

// Viewport snapshot
await page.screenshot({
  path: resolve(OUT_DIR, "home-mobile-viewport.png"),
  fullPage: false,
  type: "png",
});

// Full page
await page.screenshot({
  path: resolve(OUT_DIR, "home-mobile-full.png"),
  fullPage: true,
  type: "png",
});

// Dump del HTML rendered en busca de chars sospechosos
const arrowChars = await page.evaluate(() => {
  const RE = /[←-⇿✀-➿☀-⛿⌀-⏿■-◿⤀-⥿⬀-⯿️]/g;
  const matches = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    const found = text.match(RE);
    if (found) {
      const parent = node.parentElement;
      matches.push({
        chars: found,
        codepoints: found.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')),
        snippet: text.trim().slice(0, 80),
        parentTag: parent ? parent.tagName.toLowerCase() : '?',
        parentClass: parent ? parent.className : '',
      });
    }
  }
  return matches;
});

console.log("\n=== Caracteres unicode tipo arrow/symbol en el body ===");
arrowChars.forEach(m => {
  console.log(`  ${m.chars.join('')} (${m.codepoints.join(', ')}) en <${m.parentTag}${m.parentClass ? '.'+m.parentClass.replace(/\s+/g, '.') : ''}>: "${m.snippet}"`);
});

await browser.close();
console.log("\nScreenshots saved.");
