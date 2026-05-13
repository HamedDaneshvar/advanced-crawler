import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import { MirrorCrawler } from "./core/crawler.js";
import { createLogger } from "./utils/logger.js";
import { shutdownLogger } from "./utils/shutdownLogger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.debug);
  let crawler: MirrorCrawler | undefined;
  try {
    crawler = new MirrorCrawler(config, logger);

    switch (process.argv[2] ?? "crawl") {
      case "login":
        await crawler.loginOnly();
        return;
      case "resume":
        await crawler.crawl("resume");
        return;
      case "clean":
        cleanRuntime();
        logger.info("clean completed");
        return;
      case "crawl":
      default:
        await crawler.crawl("crawl");
    }
  } finally {
    crawler?.dispose();
    await shutdownLogger(logger).catch(() => {});
  }
}

function cleanRuntime(): void {
  for (const dir of ["output", "assets", "logs", "cache", "screenshots"]) {
    const abs = path.resolve(dir);
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
