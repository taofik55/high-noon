import { expect, test } from "@playwright/test";

// Phase 12 step 1: the procedural asset viewer renders every asset without errors and reports its budget.
test("/dev/assets shows the characters, the Colt .45 and the saloon", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/dev/assets");
  await expect(page.getByTestId("asset-canvas")).toBeVisible({ timeout: 60_000 });
  for (const asset of ["cowboy", "colt45", "saloon"] as const) {
    await page.getByTestId(`asset-${asset}`).click();
    await expect(page.getByTestId("stat-triangles")).not.toHaveText("0", { timeout: 30_000 });
    const stats = await page.evaluate(() => (window as unknown as { __assetStats?: { triangles: number; drawCalls: number } }).__assetStats);
    expect(stats?.triangles).toBeGreaterThan(1000);
  }
  await page.getByTestId("asset-cowboy").click();
  for (const id of ["suzy_lafayette", "el_gringo", "slab_the_killer"]) {
    await page.getByTestId("character").selectOption(id);
    await page.waitForTimeout(800);
  }
  await page.getByTestId("clip").selectOption("Shoot");
  await page.getByTestId("gun-in-hand").check();
  await page.waitForTimeout(1000);
  expect(errors.filter((e) => !/instant|GL Driver|THREE\.Clock/.test(e))).toEqual([]);
});
