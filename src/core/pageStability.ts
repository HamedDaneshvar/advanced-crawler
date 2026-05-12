import type { Page } from "playwright";
import type { PageStableOptions } from "../types.js";

export async function waitForPageStable(page: Page, opts: PageStableOptions): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const start = Date.now();
  let lastMutation = Date.now();

  await page.exposeFunction("__crawlerMutationPing", () => { lastMutation = Date.now(); });
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      // @ts-expect-error runtime injected function
      window.__crawlerMutationPing?.();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    setTimeout(() => observer.disconnect(), 120000);
  });

  while (Date.now() - start < opts.timeoutMs) {
    const networkIdle = await page.waitForLoadState("networkidle", { timeout: opts.networkIdleMs }).then(() => true).catch(() => false);
    if (networkIdle && Date.now() - lastMutation >= opts.domQuietMs) return;
    await page.waitForTimeout(150);
  }
}

export async function autoScrollUntilStable(page: Page, maxIterations: number): Promise<void> {
  let previousHeight = 0;
  for (let i = 0; i < maxIterations; i += 1) {
    await page.mouse.wheel(0, 1300);
    await page.waitForTimeout(500);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === previousHeight) break;
    previousHeight = height;
  }
  await page.mouse.wheel(0, -999999);
}
