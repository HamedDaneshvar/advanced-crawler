import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { crawlConfigSchema } from "./schema.js";
import type { CrawlConfig } from "../types.js";

dotenv.config();

export function loadConfig(configPath = "crawler.config.json"): CrawlConfig {
  const abs = path.resolve(configPath);
  const file = existsSync(abs) ? JSON.parse(readFileSync(abs, "utf-8")) : {};

  const merged = {
    ...file,
    baseUrl: process.env.BASE_URL ?? file.baseUrl,
    loginUrl: process.env.LOGIN_URL ?? file.loginUrl,
    maxDepth: toNum(process.env.MAX_DEPTH, file.maxDepth),
    concurrency: toNum(process.env.CONCURRENCY, file.concurrency),
    delayMinMs: toNum(process.env.DELAY_MIN_MS, file.delayMinMs),
    delayMaxMs: toNum(process.env.DELAY_MAX_MS, file.delayMaxMs),
    maxRetries: toNum(process.env.MAX_RETRIES, file.maxRetries),
    outputDir: process.env.OUTPUT_DIR ?? file.outputDir,
    assetsDir: process.env.ASSETS_DIR ?? file.assetsDir,
    dbPath: process.env.DB_PATH ?? file.dbPath,
    headful: toBool(process.env.HEADFUL, file.headful),
    blockServiceWorkers: toBool(process.env.BLOCK_SERVICE_WORKERS, file.blockServiceWorkers),
    browserChannel: trimOrUndef(process.env.PLAYWRIGHT_CHANNEL) ?? file.browserChannel,
    browserExecutablePath: trimOrUndef(process.env.BROWSER_EXECUTABLE_PATH) ?? file.browserExecutablePath,
    browserUserDataDir: trimOrUndef(process.env.PLAYWRIGHT_USER_DATA_DIR) ?? file.browserUserDataDir,
    ignoreDefaultAutomationArgs: toBool(process.env.PLAYWRIGHT_IGNORE_ENABLE_AUTOMATION, file.ignoreDefaultAutomationArgs),
    chromiumSandbox: toBool(process.env.PLAYWRIGHT_CHROMIUM_SANDBOX, file.chromiumSandbox),
    allowBrowserExtensions: toBool(process.env.PLAYWRIGHT_ALLOW_EXTENSIONS, file.allowBrowserExtensions),
    omitAutomationControlledLaunchArg: toBool(
      process.env.PLAYWRIGHT_OMIT_AUTOMATION_CONTROLLED_ARG,
      file.omitAutomationControlledLaunchArg
    )
  };

  return crawlConfigSchema.parse(merged);
}

function toNum(raw: string | undefined, fallback: number | undefined): number | undefined {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(raw: string | undefined, fallback: boolean | undefined): boolean | undefined {
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

function trimOrUndef(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  return t === "" ? undefined : t;
}
