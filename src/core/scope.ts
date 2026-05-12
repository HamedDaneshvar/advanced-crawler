import type { CrawlConfig } from "../types.js";

export function isUrlAllowed(url: string, config: CrawlConfig): boolean {
  const u = new URL(url);
  if (config.allowedDomains.length > 0 && !config.allowedDomains.includes(u.hostname)) return false;
  if (config.blockedDomains.includes(u.hostname)) return false;
  const full = u.toString();
  if (config.includePatterns.length > 0 && !config.includePatterns.some((p) => new RegExp(p).test(full))) return false;
  if (config.excludePatterns.some((p) => new RegExp(p).test(full))) return false;
  if (config.blockedRoutes.some((r) => u.pathname.includes(r))) return false;
  if (config.logoutRoutePatterns.some((r) => full.toLowerCase().includes(r.toLowerCase()))) return false;
  return true;
}
