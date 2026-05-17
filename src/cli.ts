import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import { MirrorCrawler } from "./core/crawler.js";
import { createLogger } from "./utils/logger.js";
import { shutdownLogger } from "./utils/shutdownLogger.js";
import { zipMultipleDirectories } from "./utils/zipper.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.debug);
  const command = process.argv[2] ?? "crawl";

  // For clear-all, don't initialize crawler since we're just deleting files
  if (command === "clear-all") {
    clearAllCrawlData(config);
    logger.info("all crawl data cleared");
    await shutdownLogger(logger).catch(() => {});
    return;
  }

  let crawler: MirrorCrawler | undefined;
  try {
    crawler = new MirrorCrawler(config, logger);

    switch (command) {
      case "login":
        await crawler.loginOnly();
        return;
      case "resume":
        await crawler.crawl("resume");
        await createCrawlZip(config, logger);
        return;
      case "clean":
        cleanRuntime();
        logger.info("clean completed");
        return;
      case "crawl":
      default:
        await crawler.crawl("crawl");
        await createCrawlZip(config, logger);
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

function clearAllCrawlData(config: ReturnType<typeof loadConfig>): void {
  const dirsToClean = [
    config.outputDir,
    config.assetsDir,
    config.dbPath ? path.dirname(config.dbPath) : null,
    "logs",
    "cache",
    "screenshots",
    "auth"
  ].filter((dir): dir is string => dir !== null && dir !== undefined);

  for (const dir of dirsToClean) {
    const abs = path.resolve(dir);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { recursive: true, force: true });
    }
  }
}

async function createCrawlZip(config: ReturnType<typeof loadConfig>, logger: ReturnType<typeof createLogger>): Promise<void> {
  try {
    // Check if there's content to zip
    const outputExists = fs.existsSync(config.outputDir) && fs.readdirSync(config.outputDir).length > 0;
    const assetsExist = fs.existsSync(config.assetsDir) && fs.readdirSync(config.assetsDir).length > 0;

    if (!outputExists && !assetsExist) {
      logger.info("No crawl data to zip");
      return;
    }

    // Create a timestamped zip filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const domain = new URL(config.baseUrl).hostname.replace(/[^a-z0-9]/gi, "-");
    const zipFilename = `crawl-${domain}-${timestamp}.zip`;
    const zipPath = path.resolve("output", zipFilename);

    logger.info("Creating zip archive...", { zipPath });

    // Prepare directories to include in the zip
    const directories: Array<{ path: string; name: string }> = [];

    if (outputExists) {
      directories.push({ path: config.outputDir, name: "output" });
    }
    if (assetsExist) {
      directories.push({ path: config.assetsDir, name: "assets" });
    }

    // Create the zip file
    const finalZipPath = await zipMultipleDirectories(directories, zipPath);

    // Get zip file size
    const zipStats = fs.statSync(finalZipPath);
    const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);

    logger.info("Zip archive created successfully", {
      zipPath: finalZipPath,
      sizeInMB: zipSizeMB
    });

    // Print to console for user visibility
    console.log("\n" + "=".repeat(70));
    console.log("✅ Crawl completed and archived!");
    console.log("=".repeat(70));
    console.log(`📦 Zip file: ${finalZipPath}`);
    console.log(`📊 Size: ${zipSizeMB} MB`);
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    logger.error("Failed to create zip archive", { error: String(error) });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
