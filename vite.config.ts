import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Build configuration.
 *
 * - Dev server: `npm run dev` (port 8080; Playwright overrides it).
 * - Production: Nitro bundles the SSR server and targets Cloudflare Workers by default. It merges
 *   `wrangler.jsonc` into the generated `.output/server/wrangler.json`.
 * - `VITE_*` variables are inlined by Vite itself; see `src/config/env.public.ts` and `.env.example`.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Fail the build if browser code reaches a `server/` folder. Secrets live in those modules.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Nitro only participates in production builds.
    ...(command === "build"
      ? [
          nitro({
            defaultPreset: "cloudflare-module",
            // Cron Trigger: retry failed notification emails every 5 minutes. Nitro writes the
            // schedule into the generated Wrangler config, so no dashboard setup is needed.
            experimental: { tasks: true },
            tasks: {
              "notifications:retry": {
                handler: fileURLToPath(
                  new URL("./src/server/tasks/retry-notifications.ts", import.meta.url),
                ),
                description: "Retry clinic email notifications that failed or were left unsent",
              },
            },
            scheduledTasks: { "*/5 * * * *": ["notifications:retry"] },
          }),
        ]
      : []),
    // React's plugin must come after TanStack Start.
    viteReact(),
  ],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  css: { transformer: "lightningcss" },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
    // Wait for editors that save in several steps before triggering a reload.
    watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
  },
}));
