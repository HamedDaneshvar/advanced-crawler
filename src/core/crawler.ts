import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import PQueue from "p-queue";
import type winston from "winston";
import type { CrawlConfig } from "../types.js";
import { SessionManager } from "../auth/sessionManager.js";
import { AssetStore } from "../capture/assetStore.js";
import { RewriteEngine } from "../rewrite/rewriteEngine.js";
import { CrawlDatabase } from "../storage/database.js";
import { waitForPageStable, autoScrollUntilStable } from "./pageStability.js";
import { isUrlAllowed } from "./scope.js";
import { isSameOrigin, normalizeUrl, toOfflineHtmlPath } from "../utils/url.js";
import { waitForLine } from "../utils/waitForLine.js";

export class MirrorCrawler {
  private readonly db: CrawlDatabase;
  private readonly session = new SessionManager();
  private readonly queue: PQueue;
  /** Set only when using `chromium.launch` + `newContext` (must close after `context.close()`). */
  private ephemeralBrowser: Browser | undefined;

  constructor(private readonly config: CrawlConfig, private readonly logger: winston.Logger) {
    this.db = new CrawlDatabase(config.dbPath);
    this.queue = new PQueue({ concurrency: config.concurrency });
  }

  async loginOnly(): Promise<void> {
    let context: BrowserContext | undefined;
    try {
      context = await this.newContext();
      const page = await context.newPage();
      await page.goto(this.config.loginUrl ?? this.config.baseUrl, { waitUntil: "domcontentloaded" });
      this.logger.info("Complete login and press Enter.");
      await waitForLine();
      await this.session.save(context, page);
    } finally {
      if (context) {
        await context.close().catch(() => {});
        await this.closeEphemeralBrowserIfAny();
      }
    }
  }

  dispose(): void {
    this.db.close();
  }

  async crawl(mode: "crawl" | "resume"): Promise<void> {
    this.db.resetInProgressToPending();
    if (mode === "crawl") {
      this.db.enqueue({ url: normalizeUrl(this.config.baseUrl, this.config.baseUrl), depth: 0 });
    }

    let context: BrowserContext | undefined;
    try {
      context = await this.newContext();
      const page = await context.newPage();
      const assets = new AssetStore(this.config.assetsDir, this.db, this.config.maxAssetSizeBytes);
      const rewrite = new RewriteEngine(this.db);

      page.on("response", async (response) => {
        try {
          await assets.saveFromResponse(response);
        } catch {
          // Skip malformed or inaccessible response bodies.
        }
      });

      while (this.db.pendingCount() > 0) {
        const item = this.db.nextPending();
        if (!item) break;
        await this.queue.add(async () => this.processOne(page, item.url, item.depth, rewrite));
        await randomDelay(this.config.delayMinMs, this.config.delayMaxMs);
      }

      await this.queue.onIdle();
    } finally {
      if (context) {
        await context.close().catch(() => {});
        await this.closeEphemeralBrowserIfAny();
      }
    }
  }

  private async processOne(page: Page, url: string, depth: number, rewrite: RewriteEngine): Promise<void> {
    if (depth > this.config.maxDepth) return;

    const retries = this.db.getRetries(url);
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.navigationTimeoutMs });
      if (!response) throw new Error("No navigation response");

      const current = normalizeUrl(page.url(), this.config.baseUrl);
      if (!isSameOrigin(current, this.config.baseUrl)) {
        this.db.markDone(url, "external-skipped");
        return;
      }

      if (this.config.loginUrl && current.startsWith(this.config.loginUrl)) {
        throw new Error("Authentication expired; run login and resume.");
      }

      await waitForPageStable(page, this.config.pageStable);
      await autoScrollUntilStable(page, this.config.maxScrollIterations);

      const html = await page.content();
      const htmlPath = toOfflineHtmlPath(current, this.config.outputDir);
      const rewritten = rewrite.rewriteHtml(html, current, htmlPath);
      rewrite.saveRewrittenHtml(htmlPath, rewritten);

      if (this.config.saveScreenshots) {
        const shotPath = path.resolve("screenshots", `${Buffer.from(current).toString("base64url")}.png`);
        fs.mkdirSync(path.dirname(shotPath), { recursive: true });
        await page.screenshot({ path: shotPath, fullPage: true });
      }

      const links = await page.$$eval("a[href]", (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
      for (const href of links) {
        const next = normalizeUrl(href, current);
        if (!isSameOrigin(next, this.config.baseUrl)) continue;
        if (!isUrlAllowed(next, this.config)) continue;
        if (this.db.isVisited(next)) continue;
        this.db.enqueue({ url: next, depth: depth + 1, discoveredFrom: current });
      }

      this.db.markDone(url, htmlPath);
      this.logger.info("saved page", { url: current, htmlPath });
    } catch (error) {
      if (retries < this.config.maxRetries) {
        this.db.retry(url, retries + 1);
      } else {
        this.db.markFailed(url, String(error), retries);
      }
      this.logger.error("page failed", { url, retries, error: String(error) });
    }
  }

  private async newContext(): Promise<BrowserContext> {
    const usePersistent = Boolean(this.config.browserUserDataDir);
    const useChromeFamily = this.config.browserChannel !== "chromium";
    const shared = this.sharedLaunchOptions();

    if (usePersistent) {
      const userDataDir = path.resolve(this.config.browserUserDataDir!);
      fs.mkdirSync(userDataDir, { recursive: true });
      this.logger.info("Using persistent browser profile", { userDataDir });

      const context = await chromium.launchPersistentContext(userDataDir, {
        ...shared,
        serviceWorkers: this.config.blockServiceWorkers ? "block" : "allow",
        viewport: useChromeFamily ? null : randomViewport(),
        ...(useChromeFamily ? {} : { userAgent: randomUserAgent() })
      });

      await this.session.applySavedCookies(context);
      this.session.injectStorageInitScript(context);
      context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);
      context.setDefaultTimeout(this.config.requestTimeoutMs);
      return context;
    }

    const browser = await chromium.launch(shared);
    this.ephemeralBrowser = browser;
    const context = await browser.newContext({
      storageState: this.session.hasState() ? this.session.statePath() : undefined,
      serviceWorkers: this.config.blockServiceWorkers ? "block" : "allow",
      userAgent: randomUserAgent(),
      viewport: randomViewport()
    });

    this.session.injectStorageInitScript(context);
    context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);
    context.setDefaultTimeout(this.config.requestTimeoutMs);
    return context;
  }

  private async closeEphemeralBrowserIfAny(): Promise<void> {
    if (!this.ephemeralBrowser) return;
    try {
      await this.ephemeralBrowser.close();
    } finally {
      this.ephemeralBrowser = undefined;
    }
  }

  /** Options shared by `chromium.launch` and `chromium.launchPersistentContext`. */
  private sharedLaunchOptions(): Parameters<typeof chromium.launch>[0] {
    const useChromeFamily = this.config.browserChannel !== "chromium";
    const extraArgs: string[] = [];
    if (!this.config.omitAutomationControlledLaunchArg) {
      extraArgs.push("--disable-blink-features=AutomationControlled");
    }

    const opts: Parameters<typeof chromium.launch>[0] = {
      headless: !this.config.headful,
      args: extraArgs,
      ...(this.config.chromiumSandbox ? { chromiumSandbox: true } : {})
    };
    if (this.config.browserChannel !== "chromium") {
      opts.channel = this.config.browserChannel;
    }
    if (this.config.browserExecutablePath) {
      opts.executablePath = this.config.browserExecutablePath;
    }
    const ignoreDefaults: string[] = [];
    if (this.config.ignoreDefaultAutomationArgs && useChromeFamily) {
      ignoreDefaults.push("--enable-automation");
    }
    if (this.config.allowBrowserExtensions) {
      ignoreDefaults.push("--disable-extensions");
    }
    if (ignoreDefaults.length > 0) {
      opts.ignoreDefaultArgs = ignoreDefaults;
    }
    return opts;
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUserAgent(): string {
  const list = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  ];
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function randomViewport(): { width: number; height: number } {
  const widths = [1366, 1440, 1536, 1600];
  const heights = [768, 900, 960, 1024];
  return {
    width: widths[Math.floor(Math.random() * widths.length)] ?? 1366,
    height: heights[Math.floor(Math.random() * heights.length)] ?? 768
  };
}
