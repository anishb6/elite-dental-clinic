import { createFileRoute } from "@tanstack/react-router";
import { buildRobotsTxt } from "@/lib/sitemap";

/** GET /robots.txt - generated so the `Sitemap:` line uses the configured production origin. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildRobotsTxt(), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
