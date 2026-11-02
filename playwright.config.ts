import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Each 3D test compiles and renders a WebGL scene on the dev server; more than two at once starves it.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /(lobby|online)\.spec\.ts$/ },
    // Multi-browser online suites depend on realtime timing: run them after the CPU-heavy 3D suites, not beside them.
    { name: "online", use: { ...devices["Desktop Chrome"] }, testMatch: /(lobby|online)\.spec\.ts$/, dependencies: ["chromium"] },
  ],
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
