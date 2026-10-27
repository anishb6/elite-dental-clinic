/** Pure builders for `/sitemap.xml` and `/robots.txt` (the routes are thin wrappers). */
import { absoluteUrl } from "./seo";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** One `<url>` per path. `lastmod` is deliberately omitted: we have no reliable value for it. */
export function buildSitemapXml(paths: readonly string[], origin?: string): string {
  const entries = paths
    .map((path) => `  <url>\n    <loc>${escapeXml(absoluteUrl(path, origin))}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildRobotsTxt(origin?: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin/",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml", origin)}`,
    "",
  ].join("\n");
}
