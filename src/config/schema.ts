import { z } from "zod";

export const crawlConfigSchema = z.object({
  baseUrl: z.string().url(),
  loginUrl: z.string().url().optional(),
  maxDepth: z.number().int().nonnegative().default(3),
  concurrency: z.number().int().positive().default(1),
  delayMinMs: z.number().int().nonnegative().default(2000),
  delayMaxMs: z.number().int().nonnegative().default(5000),
  maxRetries: z.number().int().nonnegative().default(3),
  allowedDomains: z.array(z.string()).default([]),
  blockedDomains: z.array(z.string()).default([]),
  includePatterns: z.array(z.string()).default([]),
  excludePatterns: z.array(z.string()).default([]),
  blockedRoutes: z.array(z.string()).default([]),
  logoutRoutePatterns: z.array(z.string()).default([]),
  requestTimeoutMs: z.number().int().positive().default(45000),
  navigationTimeoutMs: z.number().int().positive().default(60000),
  pageStable: z.object({
    networkIdleMs: z.number().int().positive().default(1500),
    domQuietMs: z.number().int().positive().default(1000),
    timeoutMs: z.number().int().positive().default(30000)
  }).default({ networkIdleMs: 1500, domQuietMs: 1000, timeoutMs: 30000 }),
  maxScrollIterations: z.number().int().positive().default(15),
  maxAssetSizeBytes: z.number().int().positive().default(20 * 1024 * 1024),
  saveScreenshots: z.boolean().default(true),
  debug: z.boolean().default(false),
  headful: z.boolean().default(true),
  blockServiceWorkers: z.boolean().default(true),
  outputDir: z.string().default("output"),
  assetsDir: z.string().default("assets"),
  dbPath: z.string().default("db/crawler.db")
});
