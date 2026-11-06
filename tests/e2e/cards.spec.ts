import { expect, test } from "@playwright/test";

// Phase 12: every card type gets procedural art; the gallery draws one card per type plus the back.
test("/dev/cards draws all 22 card types and the back without errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/dev/cards");
  await expect(page.getByTestId("card-back")).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId("card-gallery").locator("img")).toHaveCount(23);
  expect(errors.filter((e) => !/GL Driver|instant|THREE\.Clock/.test(e))).toEqual([]);
});
