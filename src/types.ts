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
  outputDir: string;
  assetsDir: string;
  dbPath: string;
}

export interface QueueItem {
  url: string;
  depth: number;
  discoveredFrom?: string;
}
