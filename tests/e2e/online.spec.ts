import { expect as baseExpect, test, type Page } from "@playwright/test";
import { closePlayers, hostRoom, joinByLink, newPlayer, supabaseUp } from "./onlineHelpers";
import { setSetting } from "./settingsHelpers";

// Realtime round trips between two browsers on a busy dev server: allow more than the 5 s default.
const expect = baseExpect.configure({ timeout: 15_000 });

// Phase 11 done criteria: a full online game (2 humans + 2 NPCs, cinematics off) through the server, a refresh that
// resumes, a rematch, and no hidden information in anything the browsers receive.

/** Keys that exist only in the full GameState / ServerGame, never in a PlayerView or a redacted event. */
const SECRET_KEYS = /"(hand|deck|rng|rngs|memories|ai|seed)":/;

/** Records every Supabase REST/realtime payload and game API response a page receives. */
function watchTraffic(page: Page): string[] {
  const leaks: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/rest\/v1\/|\/api\/(games|rooms)\//.test(url)) return;
    const body = await res.text().catch(() => "");
    if (SECRET_KEYS.test(body)) leaks.push(`${url}: ${body.slice(0, 200)}`);
  });
  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      const text = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8");
      if (SECRET_KEYS.test(text)) leaks.push(`ws: ${text.slice(0, 200)}`);
    });
  });
  return leaks;
}

async function startGame(ana: Page, budi: Page): Promise<string> {
  const code = await hostRoom(ana, "Ana");
  await joinByLink(budi, code, "Budi");
  await ana.getByTestId("add-npc-2").click();
  await expect(ana.getByTestId("slot-2")).toContainText("(Bot)");
  await ana.getByTestId("add-npc-3").click();
  await expect(ana.getByTestId("slot-3")).toContainText("(Bot)");
  await ana.getByTestId("setting-timer").selectOption("0");
  await expect(budi.getByTestId("setting-timer")).toHaveValue("0");
  await budi.getByTestId("ready-toggle").click();
  await expect(ana.getByTestId("start-game")).toBeEnabled({ timeout: 10_000 });
  await ana.getByTestId("start-game").click();
  await expect(ana).toHaveURL(/\/play\/online\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(budi).toHaveURL(ana.url(), { timeout: 30_000 });
  return ana.url();
}

/** The 3D table, with cinematics off. */
async function toTable(page: Page): Promise<void> {
  await expect(page.getByTestId("game-table")).toBeVisible({ timeout: 60_000 });
  await setSetting(page, "cinematics", "off");
}

/**
 * The same game on the plain 2D table (`?table=2d`): two software-rendered 3D pages starve a headless CPU, and the
 * adapter, store and server path under test are identical.
 */
async function to2d(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?table=2d`);
  await expect(page.getByTestId("game-table")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("toggle-fast").check();
  await page.getByTestId("toggle-autoplay").check();
}

test.describe("online play (docs/03 §5)", () => {
  test.describe.configure({ timeout: 600_000 });
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "local Supabase is not running (pnpm db:start)");
  });
  test.afterEach(closePlayers);

  test("two humans and two bots play to game over, resume after a refresh, and rematch", async ({ browser }) => {
    const ana = await newPlayer(browser);
    const budi = await newPlayer(browser);
    const anaLeaks = watchTraffic(ana);
    const budiLeaks = watchTraffic(budi);

    const gameUrl = await startGame(ana, budi);
    await to2d(ana, gameUrl);
    await to2d(budi, gameUrl);

    // Refresh mid-game: the table comes back and play continues.
    await expect(budi.getByTestId("game-table")).toContainText(/Giliran [3-9]|Giliran \d\d/, { timeout: 180_000 });
    await to2d(budi, gameUrl);

    await expect(ana.getByTestId("game-over")).toBeVisible({ timeout: 420_000 });
    await expect(budi.getByTestId("game-over")).toBeVisible({ timeout: 60_000 });
    await expect(ana.getByTestId("winner")).toHaveText(await budi.getByTestId("winner").innerText());

    expect([...anaLeaks, ...budiLeaks], "hidden information reached a browser").toEqual([]);

    // Only the host deals again; everyone follows to the new game, on the 3D table.
    await expect(budi.getByTestId("wait-host")).toBeVisible();
    await expect(budi.getByTestId("btn-rematch")).toHaveCount(0);
    await ana.getByTestId("btn-rematch").click();
    await expect(ana).toHaveURL(/\/play\/online\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    expect(ana.url()).not.toBe(gameUrl);
    await expect(budi).toHaveURL(ana.url(), { timeout: 30_000 });
    await toTable(budi);
    await toTable(ana);

    // A refresh on the 3D table resumes the same game.
    await budi.reload();
    await toTable(budi);
    await expect(budi.getByTestId("game-table")).toContainText("Giliran");
  });
});
