import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import type { CrawlDatabase } from "../storage/database.js";

const URL_ATTRS: Array<[string, string]> = [["img", "src"], ["script", "src"], ["link", "href"], ["source", "src"], ["iframe", "src"], ["a", "href"]];

export class RewriteEngine {
  constructor(private readonly db: CrawlDatabase) {}

  rewriteHtml(html: string, pageUrl: string, htmlPath: string): string {
    const $ = cheerio.load(html);
    for (const [tag, attr] of URL_ATTRS) {
      $(tag).each((_, el) => {
        const v = $(el).attr(attr);
        if (!v) return;
        const absolute = resolveMaybeAbsolute(v, pageUrl);
        if (!absolute) return;
        const local = this.db.getAssetLocalPath(absolute);
        if (!local) return;
        const rel = path.relative(path.dirname(path.resolve(htmlPath)), path.resolve(local)).split(path.sep).join("/");
        $(el).attr(attr, rel.startsWith(".") ? rel : `./${rel}`);
      });
    }
    return $.html();
  }

  saveRewrittenHtml(htmlPath: string, html: string): void {
    const abs = path.resolve(htmlPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html, "utf-8");
  }
}

function resolveMaybeAbsolute(resource: string, pageUrl: string): string | null {
  if (resource.startsWith("data:") || resource.startsWith("javascript:")) return null;
  try { return new URL(resource, pageUrl).toString(); } catch { return null; }
}
