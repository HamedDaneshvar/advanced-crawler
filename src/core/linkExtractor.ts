import type { Page } from "playwright";

type ExtractOptions = {
  baseUrl?: string;
  autoClick?: boolean;
  clickLimit?: number;
  waitAfterClickMs?: number;
};

/**
 * Production-grade link extractor for:
 * - Next.js
 * - React SPA
 * - Vue
 * - Client-side routers
 * - Hydrated hrefs
 * - Hidden routes
 * - router.push()
 * - history.pushState()
 * - Prefetched routes
 *
 * Features:
 * - Runtime href extraction
 * - __NEXT_DATA__ parsing
 * - Network interception
 * - Navigation API interception
 * - Auto-click discovery
 * - Dynamic route extraction
 */
export async function extractAllLinks(
  page: Page,
  options: ExtractOptions = {}
): Promise<string[]> {
  const {
    baseUrl,
    autoClick = true,
    clickLimit = 200,
    waitAfterClickMs = 300,
  } = options;

  const finalLinks = new Set<string>();

  // =========================================================
  // BASE URL
  // =========================================================

  const resolvedBase =
    baseUrl ||
    page.url() ||
    "http://localhost";

  // =========================================================
  // NETWORK INTERCEPTION
  // =========================================================

  const networkLinks = new Set<string>();

  page.on("response", async (response) => {
    try {
      const url = response.url();

      // Store response URL itself
      addUrl(url);

      const contentType =
        response.headers()["content-type"] || "";

      // Only inspect text/json
      if (
        !contentType.includes("json") &&
        !contentType.includes("javascript") &&
        !contentType.includes("text")
      ) {
        return;
      }

      const text = await response.text();

      extractUrlsFromText(text);
    } catch {
      //
    }
  });

  // =========================================================
  // INJECT NAVIGATION HOOKS BEFORE PAGE LOAD
  // =========================================================

  await page.addInitScript(() => {
    // @ts-ignore
    window.__CRAWLER_CAPTURED_URLS__ = [];

    const capture = (url: any) => {
      try {
        if (!url) return;

        // @ts-ignore
        window.__CRAWLER_CAPTURED_URLS__.push(String(url));
      } catch {
        //
      }
    };

    // =========================================
    // history.pushState
    // =========================================

    const originalPushState = history.pushState;

    history.pushState = function (
      state: any,
      title: string,
      url?: string | URL | null
    ) {
      if (url) capture(url);

      return originalPushState.apply(this, [
        state,
        title,
        url,
      ]);
    };

    // =========================================
    // history.replaceState
    // =========================================

    const originalReplaceState = history.replaceState;

    history.replaceState = function (
      state: any,
      title: string,
      url?: string | URL | null
    ) {
      if (url) capture(url);

      return originalReplaceState.apply(this, [
        state,
        title,
        url,
      ]);
    };

    // =========================================
    // window.open
    // =========================================

    const originalOpen = window.open;

    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string
    ) {
      if (url) capture(url);

      return originalOpen.call(
        window,
        url,
        target,
        features
      );
    };

    // =========================================
    // location.assign
    // =========================================

    const originalAssign = window.location.assign;

    window.location.assign = function (
      url: string | URL
    ) {
      capture(url);

      return originalAssign.call(window.location, url);
    };

    // =========================================
    // location.replace
    // =========================================

    const originalReplace = window.location.replace;

    window.location.replace = function (
      url: string | URL
    ) {
      capture(url);

      return originalReplace.call(window.location, url);
    };
  });

  // =========================================================
  // WAIT FOR HYDRATION
  // =========================================================

  try {
    await page.waitForLoadState("networkidle", {
      timeout: 15000,
    });
  } catch {
    //
  }

  // =========================================================
  // EXTRACT FROM DOM + NEXT DATA
  // =========================================================

  const extracted = await page.evaluate(
    ({ base }) => {
      const found = new Set<string>();

      const normalize = (url: string) => {
        try {
          return new URL(url, base).href;
        } catch {
          return null;
        }
      };

      const add = (url?: string | null) => {
        if (!url) return;

        if (
          url.startsWith("javascript:") ||
          url.startsWith("#") ||
          url.startsWith("mailto:") ||
          url.startsWith("tel:")
        ) {
          return;
        }

        const normalized = normalize(url);

        if (normalized) {
          found.add(normalized);
        }
      };

      // =====================================================
      // A TAGS (IMPORTANT: USE .href NOT getAttribute)
      // =====================================================

      const anchors = document.querySelectorAll("a");

      for (const anchor of anchors) {
        const href = (anchor as HTMLAnchorElement).href;

        add(href);

        // Extra attributes
        for (const attr of anchor.attributes) {
          if (
            attr.name.includes("href") ||
            attr.name.includes("url") ||
            attr.name.includes("link")
          ) {
            add(attr.value);
          }
        }
      }

      // =====================================================
      // ALL CLICKABLE ELEMENTS
      // =====================================================

      const clickable = document.querySelectorAll(`
        [onclick],
        [role="link"],
        [role="button"],
        button,
        div,
        span
      `);

      for (const el of clickable) {
        for (const attr of el.attributes) {
          const name = attr.name.toLowerCase();

          if (
            name.includes("href") ||
            name.includes("url") ||
            name.includes("link") ||
            name.includes("route") ||
            name.includes("path")
          ) {
            add(attr.value);
          }
        }
      }

      // =====================================================
      // PARSE __NEXT_DATA__
      // =====================================================

      const nextData =
        document.querySelector("#__NEXT_DATA__");

      if (nextData?.textContent) {
        try {
          const data = JSON.parse(
            nextData.textContent
          );

          const walk = (obj: any) => {
            if (!obj) return;

            if (typeof obj === "string") {
              if (
                obj.startsWith("/") ||
                obj.startsWith("http")
              ) {
                add(obj);
              }

              return;
            }

            if (Array.isArray(obj)) {
              obj.forEach(walk);
              return;
            }

            if (typeof obj === "object") {
              Object.values(obj).forEach(walk);
            }
          };

          walk(data);
        } catch {
          //
        }
      }

      // =====================================================
      // SEARCH WHOLE HTML FOR URL PATTERNS
      // =====================================================

      const html = document.documentElement.outerHTML;

      const regexes = [
        /https?:\/\/[^\s"'<>]+/g,
        /"\/[^"]+"/g,
        /'\/[^']+'/g,
      ];

      for (const regex of regexes) {
        const matches = html.match(regex);

        if (!matches) continue;

        for (const match of matches) {
          const cleaned = match.replace(/^['"]|['"]$/g, "");

          add(cleaned);
        }
      }

      return Array.from(found);
    },
    {
      base: resolvedBase,
    }
  );

  extracted.forEach((x) => finalLinks.add(x));

  // =========================================================
  // AUTO CLICK DISCOVERY
  // =========================================================

  if (autoClick) {
    const candidates = await page.locator(`
      a,
      button,
      [role="button"],
      [role="link"],
      [onclick]
    `).all();

    const limited = candidates.slice(0, clickLimit);

    for (const el of limited) {
      try {
        await el.scrollIntoViewIfNeeded();

        // Trial click first
        await el.click({
          trial: true,
          timeout: 1000,
        });

        // Real click
        await el.click({
          timeout: 1000,
          force: true,
        });

        await page.waitForTimeout(
          waitAfterClickMs
        );
      } catch {
        //
      }
    }
  }

  // =========================================================
  // READ CAPTURED CLIENT NAVIGATION
  // =========================================================

  const capturedUrls = await page.evaluate(() => {
    // @ts-ignore
    return window.__CRAWLER_CAPTURED_URLS__ || [];
  });

  for (const url of capturedUrls) {
    addUrl(url);
  }

  // =========================================================
  // MERGE NETWORK LINKS
  // =========================================================

  networkLinks.forEach((x) => {
    finalLinks.add(x);
  });

  // =========================================================
  // HELPERS
  // =========================================================

  function addUrl(url?: string | null) {
    if (!url) return;

    try {
      const normalized = new URL(
        url,
        resolvedBase
      ).href;

      finalLinks.add(normalized);
      networkLinks.add(normalized);
    } catch {
      //
    }
  }

  function extractUrlsFromText(text: string) {
    const regexes = [
      /https?:\/\/[^\s"'<>]+/g,
      /\/[a-zA-Z0-9_\-/]+/g,
    ];

    for (const regex of regexes) {
      const matches = text.match(regex);

      if (!matches) continue;

      for (const match of matches) {
        addUrl(match);
      }
    }
  }

  // =========================================================
  // FILTER JUNK
  // =========================================================

  const cleaned = Array.from(finalLinks).filter(
    (url) => {
      return !(
        url.includes(".png") ||
        url.includes(".jpg") ||
        url.includes(".jpeg") ||
        url.includes(".gif") ||
        url.includes(".svg") ||
        url.includes(".webp") ||
        url.includes(".css") ||
        url.includes(".woff") ||
        url.includes(".woff2") ||
        url.includes(".ttf") ||
        url.includes(".ico")
      );
    }
  );

  return cleaned.sort();
}
