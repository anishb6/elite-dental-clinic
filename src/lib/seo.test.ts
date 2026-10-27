import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL } from "@/config/site";
import { absoluteUrl, buildPageHead } from "./seo";
import { buildRobotsTxt, buildSitemapXml } from "./sitemap";

describe("absoluteUrl", () => {
  it("joins the origin and path without doubled or missing slashes", () => {
    expect(absoluteUrl("/about", "https://example.com")).toBe("https://example.com/about");
    expect(absoluteUrl("/", "https://example.com")).toBe("https://example.com/");
    expect(absoluteUrl("/about", "https://example.com/")).toBe("https://example.com/about");
  });

  it("uses the configured production origin by default", () => {
    expect(absoluteUrl("/")).toBe(`${DEFAULT_SITE_URL}/`);
  });
});

describe("buildPageHead", () => {
  const head = buildPageHead({ path: "/services", title: "T", description: "D" });

  it("emits exactly one canonical link on the production origin", () => {
    expect(head.links).toEqual([{ rel: "canonical", href: `${DEFAULT_SITE_URL}/services` }]);
  });

  it("keeps og:url in step with the canonical URL", () => {
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: `${DEFAULT_SITE_URL}/services`,
    });
  });
});

describe("buildSitemapXml", () => {
  const xml = buildSitemapXml(["/", "/about"], "https://example.com");

  it("lists each path as an absolute <loc>", () => {
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  it("is a well-formed urlset", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });
});

describe("buildRobotsTxt", () => {
  it("points at the sitemap on the production origin and hides the API", () => {
    const txt = buildRobotsTxt("https://example.com");
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(txt).toContain("Disallow: /api/");
  });
});
