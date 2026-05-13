export interface PageStableOptions {
  networkIdleMs: number;
  domQuietMs: number;
  timeoutMs: number;
}

/** Playwright `launch({ channel })` — use `chrome` for installed Google Chrome (Web Store extensions). */
export type PlaywrightBrowserChannel =
  | "chromium"
  | "chrome"
  | "chrome-beta"
  | "chrome-dev"
  | "chrome-canary"
  | "msedge"
  | "msedge-beta"
  | "msedge-dev"
  | "msedge-canary";

export interface CrawlConfig {
  baseUrl: string;
  loginUrl?: string;
  maxDepth: number;
  concurrency: number;
  delayMinMs: number;
  delayMaxMs: number;
  maxRetries: number;
  allowedDomains: string[];
  blockedDomains: string[];
  includePatterns: string[];
  excludePatterns: string[];
  blockedRoutes: string[];
  logoutRoutePatterns: string[];
  requestTimeoutMs: number;
  navigationTimeoutMs: number;
  pageStable: PageStableOptions;
  maxScrollIterations: number;
  maxAssetSizeBytes: number;
  saveScreenshots: boolean;
  debug: boolean;
  headful: boolean;
  blockServiceWorkers: boolean;
  /** `chromium` = Playwright’s bundled browser; `chrome` / `msedge` = system install. */
  browserChannel: PlaywrightBrowserChannel;
  /** Optional: full path to browser binary (overrides default resolution for that channel). */
  browserExecutablePath?: string;
  /**
   * Persistent Chrome/Edge profile directory (Playwright `launchPersistentContext`).
   * Use this for Chrome Web Store installs and “normal” extension behavior — avoids ephemeral automation profiles.
   */
  browserUserDataDir?: string;
  /**
   * Drop Playwright’s `--enable-automation` default (helps Web Store / extension installs with a persistent profile).
   * Ignored when not using a real Chrome-family channel + user data dir.
   */
  ignoreDefaultAutomationArgs: boolean;
  /**
   * When `true`, Playwright enables the real Chromium sandbox and does **not** inject `--no-sandbox`
   * (removes the “unsupported command-line flag: --no-sandbox” banner on Google Chrome).
   * Use `false` in locked-down CI/Docker where the sandbox cannot start.
   */
  chromiumSandbox: boolean;
  /**
   * Playwright’s default Chromium args include `--disable-extensions`, which blocks the Web Store
   * (“Installation is not enabled”). When `true`, that default is stripped via `ignoreDefaultArgs`.
   */
  allowBrowserExtensions: boolean;
  /**
   * When `false` (default for crawls), passes `--disable-blink-features=AutomationControlled`.
   * Set `true` to avoid Chrome’s warning about that flag (Web Store / manual extension setup).
   */
  omitAutomationControlledLaunchArg: boolean;
  outputDir: string;
  assetsDir: string;
  dbPath: string;
}

export interface QueueItem {
  url: string;
  depth: number;
  discoveredFrom?: string;
}
