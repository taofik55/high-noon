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
  // The dev server compiles /credits on its first visit: slow while other tests run.
  await expect(page).toHaveURL(/\/credits$/, { timeout: 30_000 });
  await expect(page.getByTestId("credits")).toContainText("Bang!", { timeout: 30_000 });
});

test("the settings page switches the language, which survives a reload", async ({ page }) => {
  await page.goto("/settings");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pengaturan");
  await page.getByTestId("language").selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await page.getByTestId("settings-back").click();
  await expect(page.getByTestId("link-settings")).toHaveText("Settings", { timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId("link-settings")).toHaveText("Settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
