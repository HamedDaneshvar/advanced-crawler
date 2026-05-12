import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";
import type { APIResponse, Response } from "playwright";
import type { CrawlDatabase } from "../storage/database.js";
import { sanitizeForPath } from "../utils/url.js";

export class AssetStore {
  constructor(private readonly assetsRoot: string, private readonly db: CrawlDatabase, private readonly maxAssetSizeBytes: number) {
    fs.mkdirSync(path.resolve(assetsRoot), { recursive: true });
  }

  async saveFromResponse(response: Response | APIResponse): Promise<void> {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    const mimeType = headers["content-type"]?.split(";")[0] ?? "application/octet-stream";
    const body = await response.body();
    if (body.length > this.maxAssetSizeBytes) return;
    const hash = crypto.createHash("sha256").update(body).digest("hex");
    const localPath = this.toAssetPath(url, mimeType, hash);
    const abs = path.resolve(localPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, body);
    this.db.saveAsset({ originalUrl: url, localPath, mimeType, status, hash });
  }

  private toAssetPath(rawUrl: string, mimeType: string, hash: string): string {
    const u = new URL(rawUrl);
    const extFromMime = mime.extension(mimeType) || "bin";
    const base = sanitizeForPath(u.pathname === "/" ? "root" : u.pathname);
    const q = u.search ? `__q_${sanitizeForPath(u.search.slice(1))}` : "";
    const filename = `${base}${q}__${hash.slice(0, 12)}.${extFromMime}`;
    return path.join(this.assetsRoot, sanitizeForPath(u.host), filename);
  }
}
