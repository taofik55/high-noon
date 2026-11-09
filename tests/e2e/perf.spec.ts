import { expect, test } from "@playwright/test";

/**
 * Phase 13 performance report (docs/05 §9): renderer counters of the procedural table at each preset. Headless
 * Chromium renders in software, so fps here says little; draw calls and triangles are what the budget checks.
 */
test("perf report: TABLE view stays within the draw-call budget", async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto("/play/solo");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("setup-start")).toBeEnabled();
  await page.getByTestId("setup-name").fill("Perf");
  await page.getByTestId("setup-count").selectOption("7");
  await page.getByTestId("setup-difficulty").selectOption("easy");
  await page.getByTestId("setup-start").click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("cinematics").selectOption("off");
  const report: Record<string, unknown> = {};
  for (const q of ["low", "medium", "high", "ultra"]) {
    await page.getByTestId("quality").selectOption(q);
    await page.waitForTimeout(4000);
    const stats = await page.evaluate(() => window.__highnoonTest?.perf() ?? null);
    report[q] = stats;
    expect(stats?.drawCalls ?? 0).toBeGreaterThan(0);
    expect(stats?.drawCalls ?? 0).toBeLessThanOrEqual(400);
  }
  console.log(`PERF ${JSON.stringify(report)}`);
  test.info().annotations.push({ type: "perf", description: JSON.stringify(report) });
});
