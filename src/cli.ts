import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import { MirrorCrawler } from "./core/crawler.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "crawl";
  const config = loadConfig();
  const logger = createLogger(config.debug);
  const crawler = new MirrorCrawler(config, logger);

  switch (command) {
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
