import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database tests against the local Supabase stack (`pnpm db:start`), with the local keys from .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the tests report the missing configuration themselves.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The marker package throws outside React Server Components; tests run server code directly.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One shared database: keep files sequential.
    fileParallelism: false,
  },
});
