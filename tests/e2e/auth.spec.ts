import { expect, test } from "@playwright/test";

// Needs the local Supabase stack (pnpm db:start) and .env.local, like the dev server the tests run against.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env: the suite skips itself below
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function supabaseUp(): Promise<boolean> {
  if (!SUPABASE_URL) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe("first visit: nickname → anonymous account → home menu (docs/01 §7)", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "local Supabase is not running (pnpm db:start)");
  });

  test("a nickname creates an anonymous account that survives a reload, and can be renamed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nickname-form")).toBeVisible();
    await page.getByTestId("nickname-input").fill("Tester");
    await page.getByTestId("nickname-submit").click();
    await expect(page.getByTestId("hello")).toHaveText("Halo, Tester!");
    await expect(page.getByTestId("home-menu")).toContainText("Akun tamu");

    // The session lives in cookies: a reload keeps the same account.
    await page.reload();
    await expect(page.getByTestId("hello")).toHaveText("Halo, Tester!");

    await page.getByTestId("rename").click();
    await page.getByTestId("rename-input").fill("Penembak");
    await page.getByTestId("rename-save").click();
    await expect(page.getByTestId("hello")).toHaveText("Halo, Penembak!");
    await page.reload();
    await expect(page.getByTestId("hello")).toHaveText("Halo, Penembak!");
  });

  test("rejects too-short nicknames and keeps solo play one click away", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nickname-input").fill("A");
    await expect(page.getByTestId("nickname-submit")).toBeDisabled();
    await page.getByTestId("menu-solo").click();
    await expect(page).toHaveURL(/\/play\/solo$/);
  });
});
