import path from "node:path";

const TRACKING_PARAM_PATTERNS = [/^utm_/i, /^fbclid$/i, /^gclid$/i];

export function normalizeUrl(input: string, baseUrl: string): string {
  const u = new URL(input, baseUrl);
  u.hash = "";
  const keys = [...u.searchParams.keys()];
  for (const key of keys) {
    if (TRACKING_PARAM_PATTERNS.some((p) => p.test(key))) u.searchParams.delete(key);
  }

  u.pathname = decodeURIComponent(u.pathname);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  const qs = u.searchParams.toString();
  u.search = qs ? `?${qs}` : "";
  return u.toString();
}

export function isSameOrigin(target: string, base: string): boolean {
  return new URL(target).origin === new URL(base).origin;
}

export function sanitizeForPath(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function toOfflineHtmlPath(url: string, outputDir: string): string {
  const u = new URL(url);
  const pathname = u.pathname === "/" ? "/index" : u.pathname;
  const clean = pathname.endsWith("/") ? `${pathname}index` : pathname;
  const querySuffix = u.search ? `__q_${sanitizeForPath(u.search.slice(1))}` : "";
  return path.join(outputDir, clean + querySuffix, "index.html");
}
