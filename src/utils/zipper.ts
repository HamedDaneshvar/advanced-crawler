import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Creates a zip file from a directory
 * @param sourceDir Directory to zip
 * @param outputPath Path where the zip file will be created
 * @returns Promise that resolves to the absolute path of the created zip
 */
export async function zipDirectory(sourceDir: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    
    let archive: any;
    try {
      // Use require to import archiver (CommonJS)
      const Archiver = require("archiver");
      archive = Archiver("zip", {
        zlib: { level: 9 } // Maximum compression
      });
    } catch (err) {
      reject(new Error(`Failed to initialize archiver: ${String(err)}`));
      return;
    }

    output.on("close", () => {
      resolve(path.resolve(outputPath));
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    output.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    if (fs.existsSync(sourceDir)) {
      archive.directory(sourceDir, false);
    }

    archive.finalize().catch(reject);
  });
}

/**
 * Creates a zip file containing multiple directories
 * @param directories Array of {path, name} objects to include in the zip
 * @param outputPath Path where the zip file will be created
 * @returns Promise that resolves to the absolute path of the created zip
 */
export async function zipMultipleDirectories(
  directories: Array<{ path: string; name: string }>,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    
    let archive: any;
    try {
      // Use require to import archiver (CommonJS)
      const Archiver = require("archiver");
      archive = Archiver("zip", {
        zlib: { level: 9 } // Maximum compression
      });
    } catch (err) {
      reject(new Error(`Failed to initialize archiver: ${String(err)}`));
      return;
    }

    output.on("close", () => {
      resolve(path.resolve(outputPath));
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    output.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    for (const dir of directories) {
      if (fs.existsSync(dir.path)) {
        archive.directory(dir.path, dir.name);
      }
    }

    archive.finalize().catch(reject);
  });
}
