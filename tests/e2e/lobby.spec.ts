import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";

// The dev server is shared with the 3D suites, so API calls can be slow; 10 s still stays under the lobby's 15 s
// fallback poll, so passing checks on the other browser prove the realtime path.
const expect = baseExpect.configure({ timeout: 10_000 });

// Two separate browser contexts stand in for "normal + incognito" (Phase 10 done criterion). Needs the local
// Supabase stack (pnpm db:start) and .env.local, like the dev server the tests run against.
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

async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function signIn(page: Page, name: string): Promise<void> {
  await expect(page.getByTestId("nickname-form")).toBeVisible();
  await page.getByTestId("nickname-input").fill(name);
  await page.getByTestId("nickname-submit").click();
}

async function hostRoom(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await signIn(page, name);
  await page.getByTestId("create-room").click();
  await expect(page).toHaveURL(/\/r\/[A-HJ-NP-Z2-9]{6}$/, { timeout: 20_000 });
  await expect(page.getByTestId("lobby")).toBeVisible();
  return (await page.getByTestId("lobby-code").textContent()) ?? "";
}

async function joinByLink(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`/r/${code}`);
  await signIn(page, name);
  await page.getByTestId("join-room").click();
  await expect(page.getByTestId("lobby")).toBeVisible();
}

test.describe("rooms and lobby (docs/01 §5.2)", () => {
  // Two signed-in browsers per test on a dev server that may be busy compiling the 3D suites.
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "local Supabase is not running (pnpm db:start)");
  });

  test("two browsers create, join, fill with bots, ready up and start", async ({ browser }) => {
    const ana = await newPlayer(browser);
    const budi = await newPlayer(browser);

    const code = await hostRoom(ana, "Ana");
    await joinByLink(budi, code, "Budi");

    // Live slots and presence on both sides.
    await expect(ana.getByTestId("slot-1")).toContainText("Budi");
    await expect(ana.getByTestId("presence-1")).toHaveAttribute("data-online", "true", { timeout: 15_000 });
    await expect(budi.getByTestId("presence-0")).toHaveAttribute("data-online", "true", { timeout: 15_000 });

    await ana.getByTestId("add-npc-2").click();
    await expect(ana.getByTestId("slot-2")).toContainText("(Bot)");
    await ana.getByTestId("add-npc-3").click();
    await expect(budi.getByTestId("slot-3")).toContainText("(Bot)");
    await ana.getByTestId("npc-difficulty-3").selectOption("hard");
    await expect(budi.getByTestId("slot-3")).toContainText("Sulit");

    // Settings are the host's; everyone sees them change.
    await ana.getByTestId("setting-timer").selectOption("30");
    await expect(budi.getByTestId("setting-timer")).toHaveValue("30");
    await expect(budi.getByTestId("setting-timer")).toBeDisabled();
    await expect(budi.getByTestId("add-npc-4")).toHaveCount(0);

    // Start waits for every human but the host.
    await expect(ana.getByTestId("start-game")).toBeDisabled();
    await budi.getByTestId("ready-toggle").click();
    await expect(ana.getByTestId("ready-1")).toHaveText("Siap");
    await expect(ana.getByTestId("start-game")).toBeEnabled();
    await ana.getByTestId("start-game").click();

    // Both land on the same game, each seeing only their own view.
    await expect(ana).toHaveURL(/\/play\/online\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    await expect(budi).toHaveURL(ana.url(), { timeout: 20_000 });
    for (const page of [ana, budi]) {
      await expect(page.getByTestId("online-game")).toBeVisible();
      await expect(page.getByTestId("online-role")).not.toHaveText("Role tersembunyi");
      await expect(page.locator('[data-testid^="online-seat-"]')).toHaveCount(4);
    }
  });

  test("the host can kick a player, who is told so", async ({ browser }) => {
    const host = await newPlayer(browser);
    const guest = await newPlayer(browser);
    const code = await hostRoom(host, "Hana");
    await joinByLink(guest, code, "Gani");
    await expect(host.getByTestId("slot-1")).toContainText("Gani");
    await host.getByTestId("kick-1").click();
    await expect(guest.getByTestId("lobby-gone")).toBeVisible({ timeout: 20_000 });
    await expect(host.getByTestId("slot-1")).toContainText("Kursi kosong");
  });

  test("joining by code from the home menu and unknown codes", async ({ browser }) => {
    const host = await newPlayer(browser);
    const guest = await newPlayer(browser);
    const code = await hostRoom(host, "Hadi");
    await guest.goto("/");
    await signIn(guest, "Gita");
    await guest.getByTestId("join-code").fill("ZZZZZZ");
    await guest.getByTestId("join-submit").click();
    await expect(guest.getByTestId("room-error")).toHaveText("Room dengan kode itu tidak ada.");
    await guest.getByTestId("join-code").fill(code.toLowerCase());
    await guest.getByTestId("join-submit").click();
    await expect(guest).toHaveURL(new RegExp(`/r/${code}$`));
    await expect(guest.getByTestId("lobby")).toBeVisible();
    await expect(host.getByTestId("slot-1")).toContainText("Gita");
  });
});
