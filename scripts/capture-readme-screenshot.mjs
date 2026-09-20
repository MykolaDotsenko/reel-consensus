import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const outputDir = "docs/screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1120 },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /one movie/i }).waitFor();
  await page.waitForTimeout(350);

  await page.screenshot({
    path: `${outputDir}/reel-consensus-desktop.png`,
    fullPage: false,
  });

  await context.close();
} finally {
  await browser.close();
}
