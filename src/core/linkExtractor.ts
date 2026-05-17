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
export async function extractAllLinks(page: Page): Promise<string[]> {
  const links = await page.evaluate(() => {
    const linkSet = new Set<string>();

    // Get all anchor elements in the page
    const anchors = document.querySelectorAll("a");

    for (const anchor of anchors) {
      // Try href attribute
      const href = anchor.getAttribute("href");
      if (href && href.trim() && !href.startsWith("javascript:") && !href.startsWith("#")) {
        try {
          const url = new URL(href, window.location.href);
          linkSet.add(url.href);
        } catch {
          // Invalid URL, skip
        }
      }

      // Try data-href attribute (common in some frameworks)
      const dataHref = anchor.getAttribute("data-href");
      if (dataHref && dataHref.trim()) {
        try {
          const url = new URL(dataHref, window.location.href);
          linkSet.add(url.href);
        } catch {
          // Invalid URL, skip
        }
      }

      // Try aria-href attribute (accessibility extension)
      const ariaHref = anchor.getAttribute("aria-href");
      if (ariaHref && ariaHref.trim()) {
        try {
          const url = new URL(ariaHref, window.location.href);
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
              const url = new URL(match[1], window.location.href);
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
                const url = new URL(attr.value, window.location.href);
                linkSet.add(url.href);
              } catch {
                // Invalid URL, skip
              }
            }
          }
        }
      }
    }

    return Array.from(linkSet);
  });

  return links;
}
