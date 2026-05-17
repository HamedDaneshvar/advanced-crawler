import type { Page } from "playwright";

/**
 * Extracts all navigable links from a page, including:
 * - Standard <a href="..."> links (including those added by JavaScript)
 * - Links from data-href attributes
 * - Links from onclick handlers
 * 
 * This handles client-side routing where <a> elements don't have href
 * in the source HTML but get decorated with href or other navigation
 * data by JavaScript at runtime.
 */
export async function extractAllLinks(page: Page, baseUrl?: string): Promise<string[]> {
  const links = await page.evaluate((providedBase?: string) => {
    const linkSet = new Set<string>();

    // Determine base for resolving relative URLs
    const base = providedBase && providedBase !== '' ? providedBase : (document.baseURI || window.location.href);

    // Get all anchor elements in the page
    const anchors = document.querySelectorAll("a");

    for (const anchor of anchors) {
      // Try href attribute
      const href = anchor.getAttribute("href");
      if (href && href.trim() && !href.startsWith("javascript:") && !href.startsWith("#")) {
        try {
          const url = new URL(href, base);
          linkSet.add(url.href);
        } catch {
          // Invalid URL, skip
        }
      }

      // Try data-href attribute (common in some frameworks)
      const dataHref = anchor.getAttribute("data-href");
      if (dataHref && dataHref.trim()) {
        try {
          const url = new URL(dataHref, base);
          linkSet.add(url.href);
        } catch {
          // Invalid URL, skip
        }
      }

      // Try aria-href attribute (accessibility extension)
      const ariaHref = anchor.getAttribute("aria-href");
      if (ariaHref && ariaHref.trim()) {
        try {
          const url = new URL(ariaHref, base);
          linkSet.add(url.href);
        } catch {
          // Invalid URL, skip
        }
      }

      // Try onclick handler - extract URLs from common patterns
      const onclick = anchor.getAttribute("onclick");
      if (onclick) {
        // Match common patterns like: window.location='...', navigate('...')
        const patterns = [
          /window\.location\s*=\s*['"](.*?)['"]/,
          /window\.location\.href\s*=\s*['"](.*?)['"]/,
          /navigate\(['"](.*?)['"]\)/,
          /router\.push\(['"](.*?)['"]\)/,
          /location\.href\s*=\s*['"](.*?)['"]/
        ];

        for (const pattern of patterns) {
          const match = onclick.match(pattern);
          if (match?.[1]) {
            try {
              const url = new URL(match[1], base);
              linkSet.add(url.href);
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }

      // Check if element has role="link" or similar and analyze its structure
      const role = anchor.getAttribute("role");
      if (role === "link" || role === "button") {
        // Look for data attributes that might contain navigation info
        for (const attr of anchor.attributes) {
          if (attr.name.startsWith("data-") && (attr.name.includes("href") || attr.name.includes("url") || attr.name.includes("link"))) {
            if (attr.value && attr.value.trim()) {
              try {
                const url = new URL(attr.value, base);
                linkSet.add(url.href);
              } catch {
                // Invalid URL, skip
              }
            }
          }
        }
      }

      // Check for Next.js Link component - look for href in parent <a> wrapping element
      const nextLink = anchor.closest("a");
      if (nextLink && nextLink !== anchor) {
        const nextHref = nextLink.getAttribute("href");
        if (nextHref && nextHref.trim() && !nextHref.startsWith("javascript:") && !nextHref.startsWith("#")) {
          try {
            const url = new URL(nextHref, base);
            linkSet.add(url.href);
          } catch {
            // Invalid URL, skip
          }
        }
      }
    }

    return Array.from(linkSet);
  }, baseUrl);

  // If we already found links, attempt to detect JS-driven navigation too
  if (links.length === 0) {
    // Attempt to click potential clickable elements and capture navigation targets
    const captured = await page.evaluate((providedBase?: string) => {
      // Prepare capture storage
      // @ts-ignore
      window.__crawlerCapturedNavigations = window.__crawlerCapturedNavigations || [];

      // Patch navigation APIs to capture targets instead of navigating
      const originalAssign = window.location.assign;
      const originalReplace = window.location.replace;
      const originalOpen = window.open;
      const originalPush = history.pushState;

      try {
        // @ts-ignore
        window.location.assign = function (url: string) {
          // @ts-ignore
          window.__crawlerCapturedNavigations.push(String(url));
        } as any;
        // @ts-ignore
        window.location.replace = function (url: string) {
          // @ts-ignore
          window.__crawlerCapturedNavigations.push(String(url));
        } as any;
        // @ts-ignore
        window.open = function (url: string) {
          // @ts-ignore
          window.__crawlerCapturedNavigations.push(String(url));
          return null as any;
        } as any;
        // @ts-ignore
        history.pushState = function (state: any, title: string, url?: string | null) {
          if (url) {
            // @ts-ignore
            window.__crawlerCapturedNavigations.push(String(url));
          }
          return originalPush.apply(history, [state, title, url]);
        } as any;

        // Find candidate clickable elements: anchors without href, elements with onclick, or pointer cursor
        const candidates: Element[] = Array.from(document.querySelectorAll('a:not([href]), [onclick], [role="link"], [role="button"]'));

        for (const el of candidates) {
          try {
            // Try a synthetic click
            (el as HTMLElement).click?.();
          } catch {
            // ignore
          }
        }

        // Return captured navigations (unique)
        // @ts-ignore
        return Array.from(new Set(window.__crawlerCapturedNavigations.map((u: any) => {
          try { return new URL(u, providedBase || window.location.href).href; } catch { return null; }
        }).filter(Boolean)) as string[]);
      } finally {
        // Restore originals
        try { window.location.assign = originalAssign; } catch {};
        try { window.location.replace = originalReplace; } catch {};
        try { window.open = originalOpen; } catch {};
        try { history.pushState = originalPush; } catch {};
      }
    }, baseUrl);

    // Merge captured targets into links
    for (const c of captured) {
      if (c && !links.includes(c)) links.push(c);
    }
  }

  return links;
}
