import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser tests (Chromium) against the running site.
 *
 * - By default Playwright starts `npm run dev` itself, wired to DUMMY Supabase credentials, so the
 *   suite can never touch a real database. The booking API is intercepted per test.
 * - To test an already-deployed or preview URL instead, set E2E_BASE_URL; no server is started.
 *   (Only the read-only checks make sense against production - the booking specs mock the API.)
 *
 * Setup once:  npm install -D @playwright/test && npx playwright install chromium
 * Run:         npm run test:e2e
 */
const PORT = Number(process.env["E2E_PORT"] ?? 4173);
const externalBaseUrl = process.env["E2E_BASE_URL"];
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
          env: {
            VITE_SUPABASE_URL: "http://127.0.0.1:9",
            VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-dummy-publishable-key",
            VITE_SUPABASE_PROJECT_ID: "e2e-dummy",
            VITE_SITE_URL: baseURL,
            VITE_CLOUDFLARE_TURNSTILE_SITE_KEY: "",
            SUPABASE_URL: "http://127.0.0.1:9",
            SUPABASE_SERVICE_ROLE_KEY: "e2e-dummy-service-role-key",
          },
        },
      }),
});
