import { createFileRoute } from "@tanstack/react-router";
import { INDEXABLE_PATHS } from "@/config/site";
import { buildSitemapXml } from "@/lib/sitemap";

/** GET /sitemap.xml - lists the public pages in `INDEXABLE_PATHS` on the configured origin. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemapXml(INDEXABLE_PATHS), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
