import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Real-database integration tests. Needs a PostgreSQL server (see
 * src/test/integration/database.integration.test.ts). Deliberately separate from the default
 * config so `npm test` stays fast and needs no external services.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
