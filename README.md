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

## Start

1. Copy `.env.example` to `.env`.
2. Set `BASE_URL` and optionally `LOGIN_URL`.
3. Run `npm run login` once.
4. Run `npm run crawl`.
5. Open generated files in `output/` offline.
