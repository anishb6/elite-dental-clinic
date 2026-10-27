import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  for (const path of ["/", "/services", "/about", "/reviews", "/gallery", "/contact", "/privacy"]) {
    test(`${path} renders without uncaught errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page).toHaveTitle(/Elite Dental Clinic/);
      expect(errors).toEqual([]);
    });
  }

  test("an unknown route shows the 404 page", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("has a canonical link on the configured origin", async ({ page, baseURL }) => {
    await page.goto("/services");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe(`${new URL(baseURL!).origin}/services`);
  });
});

test.describe("crawler and API surface", () => {
  test("robots.txt hides /admin and /api and points at the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/Disallow:\s*\/admin/i);
    expect(body).toMatch(/Disallow:\s*\/api/i);
    expect(body).toMatch(/Sitemap:\s*https?:\/\//i);
  });

  test("sitemap.xml is valid and excludes private paths", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("/admin");
    expect(body).not.toContain("/api/");
  });

  test("the admin API rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/admin/appointments");
    expect(response.status()).toBe(401);
  });
});
