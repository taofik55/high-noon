import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    include: ["tests/**/*.test.ts"],
    // tests/db needs a running local Supabase: run it with `pnpm test:db`.
    exclude: ["tests/e2e/**", "tests/db/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/ai/**"],
    },
  },
});
