# Advanced Crawler

Enterprise-grade authenticated browser mirroring with Node.js + TypeScript + Playwright.

## Commands

- `npm run login` manual login and auth-state capture.
- `npm run crawl` start fresh crawl from seed URL.
- `npm run resume` continue interrupted crawl from SQLite queue.
- `npm run clean` remove generated artifacts.
- `npm test` run tests.

## Runtime folders

- `auth/` session artifacts (`state.json`, `localStorage.json`, `sessionStorage.json`)
- `output/` rendered offline HTML pages
- `assets/` captured static/network assets
- `db/` SQLite persistence
- `logs/` crawler logs
- `screenshots/` optional page captures

## Architecture

- `src/config` typed config loader from env + JSON + validation
- `src/auth` auth capture/restore and init-storage hydration
- `src/storage` durable queue/visited/assets state in SQLite
- `src/core` crawl orchestration, navigation stability, scope checks
- `src/capture` response interception and asset persistence
- `src/rewrite` offline URL rewriting for saved pages
- `src/utils` shared URL normalization and logging

## Browser: Chromium vs Google Chrome

All commands (`login`, `crawl`, `resume`) use the same launch settings.

- **Bundled Chromium** (default): set `browserChannel` to `chromium` in `crawler.config.json`, or unset `PLAYWRIGHT_CHANNEL` in `.env`.
- **Installed Google Chrome**: set `PLAYWRIGHT_CHANNEL=chrome` in `.env` or `"browserChannel": "chrome"` in `crawler.config.json`. Chrome must be installed; you do **not** need `npx playwright install` for that channel.
- **Custom binary**: set `BROWSER_EXECUTABLE_PATH` to your `chrome.exe` full path.

### Why “Installation is not enabled” on the Chrome Web Store

Playwright’s **built‑in Chromium/Chrome launch flags include `--disable-extensions`**. With extensions disabled at the browser level, the Web Store cannot install anything and you see **“Installation is not enabled”** / download errors. **Developer mode** does not override that.

**Required for Web Store installs**

- `PLAYWRIGHT_ALLOW_EXTENSIONS=true` (or `"allowBrowserExtensions": true` in `crawler.config.json`) — strips the default `--disable-extensions` flag via `ignoreDefaultArgs`.

Also use a **persistent profile** and real Chrome (same as before):

- `PLAYWRIGHT_USER_DATA_DIR=.chrome-profile` — dedicated folder (do **not** point this at your normal Chrome “User Data” while Chrome is running; Playwright can corrupt it).
- `PLAYWRIGHT_CHANNEL=chrome`
- `PLAYWRIGHT_IGNORE_ENABLE_AUTOMATION=true` — omits Playwright’s `--enable-automation` default argument.
- `PLAYWRIGHT_CHROMIUM_SANDBOX=true` — enables the real Chromium sandbox so Playwright **does not** add `--no-sandbox` (removes Chrome’s yellow “unsupported command-line flag: --no-sandbox” banner). Use `false` only if the sandbox cannot start (some Docker/CI images).

### “Unsupported command-line flag: … AutomationControlled”

This project used to always pass `--disable-blink-features=AutomationControlled` (note spelling: **features**, not “featues”). Chrome warns about that flag. Set `PLAYWRIGHT_OMIT_AUTOMATION_CONTROLLED_ARG=true` to stop passing it (normal for extension/Web Store setup; crawls may prefer leaving it off only when you need fewer warnings).

After the first successful install from the Web Store into that profile, extensions stay in `.chrome-profile` for future `npm run login` / `crawl` / `resume` runs.

If it still fails, check **Windows / Chrome enterprise policies** (admin can disable the store or all extensions).

For **automated crawling only** (no Web Store / no extensions), set `PLAYWRIGHT_ALLOW_EXTENSIONS=false` so Playwright keeps `--disable-extensions` (slightly more isolated browser).

## Start

1. Copy `.env.example` to `.env`.
2. Set `BASE_URL` and optionally `LOGIN_URL`.
3. Run `npm run login` once.
4. Run `npm run crawl`.
5. Open generated files in `output/` offline.
