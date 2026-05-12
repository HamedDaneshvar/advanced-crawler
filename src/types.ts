export interface PageStableOptions {
  networkIdleMs: number;
  domQuietMs: number;
  timeoutMs: number;
}

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
  outputDir: string;
  assetsDir: string;
  dbPath: string;
}

export interface QueueItem {
  url: string;
  depth: number;
  discoveredFrom?: string;
}
