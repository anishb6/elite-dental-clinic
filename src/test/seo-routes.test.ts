import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { INDEXABLE_PATHS } from "@/config/site";
import { absoluteUrl } from "@/lib/seo";
import { createQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";

// Paths that exist in the route tree but are not public indexable pages:
// API endpoints, crawler configuration routes, and staff-only administrative routes.
const NON_INDEXABLE_PATHS = new Set([
  "/api/create-appointment",
  "/api/notify-appointment",
  "/api/retry-notifications",
  "/api/admin/appointments",
  "/api/admin/retry-outbox",
  "/admin",
  "/admin/login",
  "/sitemap.xml",
  "/robots.txt",
]);

type HeadResult = { meta?: Record<string, string>[]; links?: { rel: string; href: string }[] };
type RouteLike = { options: { head?: (ctx: unknown) => HeadResult } };

const router = createRouter({ routeTree, context: { queryClient: createQueryClient() } });
const routes = Object.entries(router.routesByPath) as [string, RouteLike][];

function headFor(path: string): HeadResult {
  const route = routes.find(([routePath]) => routePath === path)?.[1];
  return route?.options.head?.({}) ?? {};
}

describe("SEO / route consistency", () => {
  it("sitemap paths are exactly the real page routes", () => {
    const pageRoutes = routes
      .map(([path]) => path)
      .filter((path) => !NON_INDEXABLE_PATHS.has(path));
    expect([...pageRoutes].sort()).toEqual([...INDEXABLE_PATHS].sort());
  });

  it.each(INDEXABLE_PATHS)("%s has exactly one canonical link on the production origin", (path) => {
    const canonicals = (headFor(path).links ?? []).filter((link) => link.rel === "canonical");

    expect(canonicals).toEqual([{ rel: "canonical", href: absoluteUrl(path) }]);
  });

  it("endpoints, admin, and crawler files carry no canonical link", () => {
    for (const path of NON_INDEXABLE_PATHS) {
      expect(headFor(path).links ?? []).toEqual([]);
    }
  });

  it("every page has a unique title and description", () => {
    const metas = INDEXABLE_PATHS.map((path) => headFor(path).meta ?? []);
    const titles = metas.map((meta) => meta.find((tag) => "title" in tag)?.["title"]);
    const descriptions = metas.map(
      (meta) => meta.find((tag) => tag["name"] === "description")?.["content"],
    );

    for (const values of [titles, descriptions]) {
      expect(values.every(Boolean)).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
