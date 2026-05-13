import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { QueueItem } from "../types.js";

export class CrawlDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    const abs = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    this.db = new Database(abs);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS queue (
        url TEXT PRIMARY KEY,
        depth INTEGER NOT NULL,
        discovered_from TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        retries INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS visited (
        url TEXT PRIMARY KEY,
        html_path TEXT,
        visited_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assets (
        original_url TEXT PRIMARY KEY,
        local_path TEXT NOT NULL,
        mime_type TEXT,
        status INTEGER,
        hash TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS failed (
        url TEXT PRIMARY KEY,
        error TEXT,
        retries INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  enqueue(item: QueueItem): void {
    this.db.prepare(`INSERT INTO queue (url, depth, discovered_from) VALUES (@url, @depth, @discoveredFrom) ON CONFLICT(url) DO NOTHING`).run({
      url: item.url,
      depth: item.depth,
      discoveredFrom: item.discoveredFrom ?? null
    });
  }
  nextPending(): QueueItem | null {
    const row = this.db.prepare("SELECT url, depth, discovered_from as discoveredFrom FROM queue WHERE status='pending' ORDER BY depth ASC, rowid ASC LIMIT 1").get() as QueueItem | undefined;
    if (!row) return null;
    this.db.prepare("UPDATE queue SET status='in_progress' WHERE url=?").run(row.url);
    return row;
  }
  markDone(url: string, htmlPath: string): void {
    this.db.prepare("UPDATE queue SET status='done' WHERE url=?").run(url);
    this.db.prepare("INSERT OR REPLACE INTO visited (url, html_path, visited_at) VALUES (?, ?, datetime('now'))").run(url, htmlPath);
  }
  markFailed(url: string, error: string, retries: number): void {
    this.db.prepare("UPDATE queue SET status='failed', retries=?, last_error=? WHERE url=?").run(retries, error, url);
    this.db.prepare("INSERT OR REPLACE INTO failed (url, error, retries, updated_at) VALUES (?, ?, ?, datetime('now'))").run(url, error, retries);
  }
  resetInProgressToPending(): void { this.db.prepare("UPDATE queue SET status='pending' WHERE status='in_progress'").run(); }
  retry(url: string, retries: number): void { this.db.prepare("UPDATE queue SET status='pending', retries=? WHERE url=?").run(retries, url); }
  getRetries(url: string): number { return (this.db.prepare("SELECT retries FROM queue WHERE url=?").get(url) as { retries: number } | undefined)?.retries ?? 0; }
  isVisited(url: string): boolean { return Boolean(this.db.prepare("SELECT 1 FROM visited WHERE url=?").get(url)); }
  saveAsset(record: { originalUrl: string; localPath: string; mimeType: string; status: number; hash: string }): void {
    this.db.prepare("INSERT OR REPLACE INTO assets (original_url, local_path, mime_type, status, hash, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
      .run(record.originalUrl, record.localPath, record.mimeType, record.status, record.hash);
  }
  getAssetLocalPath(originalUrl: string): string | undefined {
    return (this.db.prepare("SELECT local_path as localPath FROM assets WHERE original_url=?").get(originalUrl) as { localPath: string } | undefined)?.localPath;
  }
  pendingCount(): number { return (this.db.prepare("SELECT COUNT(*) as c FROM queue WHERE status='pending'").get() as { c: number }).c; }

  close(): void {
    try {
      this.db.close();
    } catch {
      // Already closed.
    }
  }
}
