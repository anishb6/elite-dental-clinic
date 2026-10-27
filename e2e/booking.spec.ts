import { expect, test, type Page, type Route } from "@playwright/test";

const API = "**/api/create-appointment";

function futureDate(daysAhead = 7): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ok(route: Route, delayMs = 0) {
  const respond = () =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: "00000000-0000-4000-8000-000000000001",
          saved: true,
        },
      }),
    });

  return delayMs
    ? new Promise<void>((resolve) => setTimeout(() => resolve(respond()), delayMs))
    : respond();
}

async function fillValidForm(page: Page) {
  await page.getByLabel("Full name").fill("Asha Test");
  await page.getByLabel("Phone").fill("9147718046");
  await page.getByLabel("Preferred date").fill(futureDate());
  await page.getByLabel("Preferred time").selectOption("Morning");
  await page.getByLabel(/I consent to Elite Dental Clinic/).check();
}

const submit = (page: Page) => page.getByRole("button", { name: "Request Appointment" });

test.describe("booking form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
    await expect(page.getByRole("heading", { name: /Book your visit/i })).toBeVisible();
  });

  test("an empty submit shows errors, sends nothing and focuses the first invalid field", async ({
    page,
  }) => {
    let requests = 0;

    await page.route(API, (route) => {
      requests += 1;
      return ok(route);
    });

    await submit(page).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeFocused();
    await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  test("consent is mandatory", async ({ page }) => {
    await page.route(API, (route) => ok(route));

    await fillValidForm(page);
    await page.getByLabel(/I consent to Elite Dental Clinic/).uncheck();
    await submit(page).click();

    await expect(page.getByText(/You must consent to the privacy policy/)).toBeVisible();
    await expect(page.getByText("Thank you!")).toHaveCount(0);
  });

  test("a valid booking is sent once with the entered details and shows the thank-you state", async ({
    page,
  }) => {
    const bodies: Record<string, unknown>[] = [];

    // Capture browser console messages and uncaught JavaScript errors.
    page.on("console", (msg) => {
      console.log(`[browser console:${msg.type()}] ${msg.text()}`);
    });

    page.on("pageerror", (error) => {
      console.log(`[browser error] ${error.message}`);
    });

    // Record every request to the appointment endpoint.
    page.on("request", (request) => {
      if (request.url().includes("/api/create-appointment")) {
        console.log(`[booking request] ${request.method()} ${request.url()}`);
      }
    });

    await page.route(API, (route) => {
      console.log("[diagnostic] API route intercepted");

      const body = route.request().postDataJSON() as Record<string, unknown>;
      bodies.push(body);
      console.log("[diagnostic] Request body:", JSON.stringify(body));

      return ok(route);
    });

    await fillValidForm(page);

    console.log("[diagnostic] Button enabled before click:", await submit(page).isEnabled());

    await submit(page).click();

    // If success doesn't appear, print useful state before failing.
    try {
      await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible({
        timeout: 5000,
      });
    } catch (error) {
      console.log("[diagnostic] Current URL:", page.url());

      console.log(
        "[diagnostic] Button enabled after click:",
        await submit(page)
          .isEnabled()
          .catch(() => "button not found"),
      );

      console.log(
        "[diagnostic] Form state:",
        await page
          .locator("form")
          .evaluate((form) => ({
            validity: (form as HTMLFormElement).checkValidity(),
            html: form.outerHTML.slice(0, 3000),
          }))
          .catch((e: Error) => `Unable to inspect form: ${e.message}`),
      );

      console.log("[diagnostic] Captured API request bodies:", bodies);

      throw error;
    }

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      name: "Asha Test",
      preferred_time: "Morning",
    });
    expect(bodies[0]).not.toHaveProperty("website");
  });

  test("a double click sends a single request", async ({ page }) => {
    let requests = 0;

    await page.route(API, (route) => {
      requests += 1;
      return ok(route, 400);
    });

    await fillValidForm(page);
    await submit(page).dblclick();

    await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();

    expect(requests).toBe(1);
  });

  test("a server error shows the call-us message and keeps what the visitor typed", async ({
    page,
  }) => {
    await page.route(API, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "SERVER",
            message: "Something went wrong. Please call us instead.",
          },
        }),
      }),
    );

    await fillValidForm(page);
    await submit(page).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "Please call us instead",
      }),
    ).toBeVisible();

    await expect(page.getByLabel("Full name")).toHaveValue("Asha Test");
    await expect(submit(page)).toBeEnabled();
  });

  test("a filled honeypot is discarded without any request or success message", async ({
    page,
  }) => {
    let requests = 0;

    await page.route(API, (route) => {
      requests += 1;
      return ok(route);
    });

    await fillValidForm(page);
    await page.locator("#website-hp").fill("https://spam.example");
    await submit(page).click();

    await expect(page.getByText("Thank you!")).toHaveCount(0);
    expect(requests).toBe(0);
  });
});
