import { expect, test } from "@playwright/test";

test("home page shows the game title and is not indexable", async ({ page }) => {
  await page.goto("/");
  const title = process.env.NEXT_PUBLIC_GAME_TITLE ?? "High Noon";
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("robots.txt disallows all crawlers", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBe(true);
  expect(await res.text()).toMatch(/Disallow: \/\s*$/m);
});

test("credits are reachable from the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("link-credits").click();
  await expect(page).toHaveURL(/\/credits$/);
  await expect(page.getByTestId("credits")).toContainText("Bang!");
});
