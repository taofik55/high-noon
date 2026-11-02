import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Shared by the online suites. They need the local Supabase stack (pnpm db:start) and .env.local, like the dev server
// the tests run against; without it they skip themselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env: supabaseUp() reports false
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function supabaseUp(): Promise<boolean> {
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

const open: BrowserContext[] = [];

/** A fresh browser context: its own cookies, so its own anonymous account. Close it with closePlayers(). */
export async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  open.push(context);
  return context.newPage();
}

/** Contexts outlive a test unless closed; a forgotten 3D table keeps rendering and starves the next test. */
export async function closePlayers(): Promise<void> {
  await Promise.all(open.splice(0).map((c) => c.close().catch(() => undefined)));
}

export async function signIn(page: Page, name: string): Promise<void> {
  await expect(page.getByTestId("nickname-form")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("nickname-input").fill(name);
  await page.getByTestId("nickname-submit").click();
}

export async function hostRoom(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await signIn(page, name);
  await page.getByTestId("create-room").click();
  await expect(page).toHaveURL(/\/r\/[A-HJ-NP-Z2-9]{6}$/, { timeout: 20_000 });
  await expect(page.getByTestId("lobby")).toBeVisible({ timeout: 15_000 });
  return (await page.getByTestId("lobby-code").textContent()) ?? "";
}

export async function joinByLink(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`/r/${code}`);
  await signIn(page, name);
  await page.getByTestId("join-room").click();
  await expect(page.getByTestId("lobby")).toBeVisible({ timeout: 15_000 });
}
