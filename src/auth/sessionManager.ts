import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Cookie, Page } from "playwright";

const AUTH_DIR = path.resolve("auth");
const STATE_PATH = path.join(AUTH_DIR, "state.json");
const LOCAL_STORAGE_PATH = path.join(AUTH_DIR, "localStorage.json");
const SESSION_STORAGE_PATH = path.join(AUTH_DIR, "sessionStorage.json");

export class SessionManager {
  ensureDir(): void { fs.mkdirSync(AUTH_DIR, { recursive: true }); }
  hasState(): boolean { return fs.existsSync(STATE_PATH); }
  statePath(): string { return STATE_PATH; }

  async save(context: BrowserContext, page: Page): Promise<void> {
    this.ensureDir();
    await context.storageState({ path: STATE_PATH });
    const localStorageData = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key) out[key] = window.localStorage.getItem(key) ?? "";
      }
      return out;
    });
    const sessionStorageData = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key) out[key] = window.sessionStorage.getItem(key) ?? "";
      }
      return out;
    });
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(localStorageData, null, 2));
    fs.writeFileSync(SESSION_STORAGE_PATH, JSON.stringify(sessionStorageData, null, 2));
  }

  injectStorageInitScript(context: BrowserContext): void {
    const local = this.readStorageFile(LOCAL_STORAGE_PATH);
    const session = this.readStorageFile(SESSION_STORAGE_PATH);
    context.addInitScript(({ localData, sessionData }) => {
      for (const [k, v] of Object.entries(localData)) window.localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(sessionData)) window.sessionStorage.setItem(k, v);
    }, { localData: local, sessionData: session });
  }

  /**
   * `launchPersistentContext` does not accept `storageState` in this Playwright version; restore cookies from `state.json`.
   */
  async applySavedCookies(context: BrowserContext): Promise<void> {
    if (!this.hasState()) return;
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as { cookies?: Cookie[] };
    if (!data.cookies?.length) return;
    await context.addCookies(data.cookies);
  }

  private readStorageFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
  }
}
