import { setSetting, skipTutorial } from "./settingsHelpers";
import { expect, test, type Page } from "@playwright/test";

type HandCard = { cardId: string; x: number; y: number; state: string };
type SeatPos = { seat: number; x: number; y: number; targetable: boolean };

const handCards = (page: Page) => page.evaluate(() => window.__highnoonTest?.handCards() ?? []) as Promise<HandCard[]>;
const seats = (page: Page) => page.evaluate(() => window.__highnoonTest?.seats() ?? []) as Promise<SeatPos[]>;

/** Cinematics off at 2x: the scenes are skipped, so tests run at game speed (docs/05 §6 "off"). */
async function fastPresentation(page: Page) {
  await setSetting(page, "cinematics", "off");
  await setSetting(page, "speed", "2");
}

/** Collects page errors and console errors (three.js deprecation warnings are fine). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

/**
 * Interaction tests use the primitive placeholders (`?placeholders=1`, Golden rule 6): headless Chromium renders in
 * software and the procedural town is too slow there. "procedural table" below covers the real models.
 */
async function startGame(page: Page, players = "4", url = "/play/solo?placeholders=1") {
  await page.goto(url);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // Typing before hydration would be wiped; Start is enabled once React owns the form.
  await expect(page.getByTestId("setup-start")).toBeEnabled();
  await page.getByTestId("setup-name").fill("Tester");
  await page.getByTestId("setup-count").selectOption(players);
  await page.getByTestId("setup-difficulty").selectOption("easy");
  await page.getByTestId("setup-start").click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("tutorial-skip").click();
  // Headless Chromium renders in software: without shadow passes the full procedural town stays interactive.
  await setSetting(page, "quality", "low");
  await expect.poll(async () => (await handCards(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
}

/**
 * True once `cardId` has left the hand. A Panic! / Cat Balou dropped on a player may first ask which card to take
 * (the panel re-renders a moment later), so answer that with the first offer while polling.
 */
async function cardPlayedOrAnswerPanel(page: Page, cardId: string): Promise<boolean> {
  const option = page.getByTestId("target-option").first();
  if (await option.isVisible()) await option.click();
  return !(await handCards(page)).some((c) => c.cardId === cardId);
}

/**
 * Answers whatever non-play prompt is ours, like a passive player would: take the hit / give up, take the first
 * choice, or discard down to life by clicking cards in the 3D hand. Returns true if it did something.
 */
async function answerPrompt(page: Page): Promise<boolean> {
  if (await page.getByTestId("btn-pass").isVisible()) {
    await page.getByTestId("btn-pass").click();
    return true;
  }
  const choice = page.getByTestId("choice-option").first();
  if (await choice.isVisible()) {
    await choice.click();
    return true;
  }
  if (await page.getByText(/^Buang \d+ kartu/).isVisible()) {
    const confirm = page.getByTestId("btn-confirm");
    for (const card of await handCards(page)) {
      if (card.state !== "playable") continue;
      await page.mouse.click(card.x, card.y);
      await page.waitForTimeout(150);
      // Discarding a single card is sent on click; several need the confirm button.
      if (!(await confirm.isVisible()) || (await confirm.isEnabled())) break;
    }
    if ((await confirm.isVisible()) && (await confirm.isEnabled())) await confirm.click();
    return true;
  }
  return false;
}

/** Answers prompts with the panel until it is our play phase (or the game ends). */
async function reachMyPlayPhase(page: Page): Promise<boolean> {
  for (let i = 0; i < 300; i++) {
    if (await page.getByTestId("game-over").isVisible()) return false;
    if (await page.getByTestId("btn-end-turn").isVisible()) return true;
    await answerPrompt(page);
    await page.waitForTimeout(200);
  }
  return false;
}

test.describe("/play/solo 3D table", () => {
  test("renders the town and plays a full game to game over without errors", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await startGame(page);
    await expect(page.getByTestId("seat-badge-0")).toContainText("Tester");
    await fastPresentation(page);
    await page.getByTestId("toggle-autoplay").check();
    await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 200_000 });
    expect(errors).toEqual([]);
  });

  test("click a card in the 3D hand, then a glowing player, to play it", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await startGame(page);
    await fastPresentation(page);

    // Several of our turns may pass before we hold a card that targets someone; try a few.
    let played = false;
    for (let turn = 0; turn < 10 && !played; turn++) {
      if (!(await reachMyPlayPhase(page))) break;
      for (const card of await handCards(page)) {
        if (card.state !== "playable") continue;
        await page.mouse.click(card.x, card.y);
        await page.waitForTimeout(300);
        const target = (await seats(page)).find((s) => s.targetable);
        if (!target) {
          if (await page.getByRole("button", { name: /Batal/ }).isVisible()) await page.getByRole("button", { name: /Batal/ }).click();
          continue;
        }
        await page.mouse.click(target.x, target.y);
        await expect.poll(() => cardPlayedOrAnswerPanel(page, card.cardId), { timeout: 10_000 }).toBe(true);
        played = true;
        break;
      }
      if (!played && (await page.getByTestId("btn-end-turn").isVisible())) await page.getByTestId("btn-end-turn").click();
    }
    expect(played).toBe(true);
    expect(errors).toEqual([]);
  });

  test("drag a card from the 3D hand onto a glowing player", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await startGame(page);
    await fastPresentation(page);

    let played = false;
    for (let turn = 0; turn < 10 && !played; turn++) {
      if (!(await reachMyPlayPhase(page))) break;
      for (const card of await handCards(page)) {
        if (card.state !== "playable") continue;
        await page.mouse.move(card.x, card.y);
        await page.mouse.down();
        await page.mouse.move(card.x, card.y - 60, { steps: 5 });
        await page.waitForTimeout(150);
        const target = (await seats(page)).find((s) => s.targetable);
        if (!target) {
          // Not a targeted card: drop it back on the hand area (cancels).
          await page.mouse.move(card.x, card.y, { steps: 3 });
          await page.mouse.up();
          continue;
        }
        await page.mouse.move(target.x, target.y, { steps: 10 });
        const before = await page.evaluate(() => window.__highnoonTest?.ui());
        await page.mouse.up();
        await expect
          .poll(() => cardPlayedOrAnswerPanel(page, card.cardId), {
            timeout: 10_000,
            message: `drop of ${card.cardId} on ${JSON.stringify(target)}; ui before release ${JSON.stringify(before)}`,
          })
          .toBe(true);
        played = true;
        break;
      }
      if (!played && (await page.getByTestId("btn-end-turn").isVisible())) await page.getByTestId("btn-end-turn").click();
    }
    expect(played).toBe(true);
    expect(errors).toEqual([]);
  });

  test("full cinematics play scenes; Space skips straight to the player's next decision", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await startGame(page, "5");
    await setSetting(page, "cinematics", "full");
    // Make the bots act (answer whatever is ours first, e.g. the Sheriff's opening turn), until a scene is playing.
    await expect
      .poll(
        async () => {
          if (await page.getByTestId("btn-skip").isEnabled()) return true;
          if (await page.getByTestId("btn-end-turn").isVisible()) await page.getByTestId("btn-end-turn").click();
          else await answerPrompt(page);
          return false;
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    await expect(page.getByTestId("director-banner").or(page.locator("canvas")).first()).toBeVisible();
    // Space finishes the scene and fast-forwards the queue until a human decision (or the game end) is due.
    for (let i = 0; i < 20 && (await page.getByTestId("btn-skip").isEnabled()); i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId("btn-skip")).toBeDisabled({ timeout: 15_000 });
    await expect(page.locator('[data-testid="btn-end-turn"], [data-testid="btn-pass"], [data-testid="choice-option"], [data-testid="game-over"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a refresh resumes the game in 3D", async ({ page }) => {
    test.setTimeout(120_000);
    await startGame(page);
    await page.reload();
    await page.getByTestId("setup-resume").click();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("seat-badge-0")).toContainText("Tester");
  });

  test("settings dialog: volumes and accessibility persist, credits open, language switches in place", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await startGame(page);
    // The first click also unlocks Web Audio (music starts); headless Chromium has an audio backend.
    await page.getByTestId("btn-settings").click();
    await expect(page.getByTestId("settings-dialog")).toBeVisible();
    await expect(page.getByTestId("audio-master")).toHaveValue("80");
    await expect(page.getByTestId("audio-music")).toHaveValue("50");
    await page.getByTestId("audio-music").fill("20");
    await page.getByTestId("large-text").check();
    await expect(page.locator("html")).toHaveClass(/large-text/);
    await page.getByTestId("color-blind-suits").check();
    await page.getByTestId("reduce-motion").selectOption("on");
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    await page.getByTestId("btn-credits").click();
    await expect(page.getByTestId("credits")).toBeVisible();
    await page.getByTestId("btn-credits-close").click();
    await page.getByTestId("btn-settings-close").click();
    await page.reload();
    await page.getByTestId("setup-resume").click();
    await page.getByTestId("btn-settings").click();
    await expect(page.getByTestId("audio-music")).toHaveValue("20");
    await expect(page.getByTestId("large-text")).toBeChecked();
    await expect(page.getByTestId("color-blind-suits")).toBeChecked();
    // English: the app re-renders in place; the game is saved and resumes.
    await page.getByTestId("language").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByTestId("setup-resume").click();
    await expect(page.getByTestId("btn-settings")).toHaveText("Settings");
    expect(errors.filter((e) => !/THREE\.Clock|GL Driver|instant/.test(e))).toEqual([]);
  });

  test("first-game tutorial steps through, stays done, and can be turned back on; badges show player tooltips", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/play/solo?placeholders=1");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByTestId("setup-start")).toBeEnabled();
    await page.getByTestId("setup-name").fill("Tester");
    await page.getByTestId("setup-start").click();
    await expect(page.getByTestId("tutorial")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("tutorial")).toContainText("1/8");
    for (let i = 0; i < 7; i++) await page.getByTestId("tutorial-next").click();
    await expect(page.getByTestId("tutorial")).toContainText("8/8");
    await page.getByTestId("tutorial-next").click();
    await expect(page.getByTestId("tutorial")).toHaveCount(0);
    await page.reload();
    await page.getByTestId("setup-resume").click();
    await expect(page.getByTestId("game-table")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("tutorial")).toHaveCount(0);
    // Keyboard: focusing a seat badge shows that player's ability.
    // Badges stay hidden until the scene has placed them on screen.
    await expect(page.getByTestId("seat-badge-1")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("seat-badge-1").focus();
    await expect(page.getByTestId("player-tooltip")).toBeVisible();
    await page.getByTestId("seat-badge-1").blur();
    await expect(page.getByTestId("player-tooltip")).toHaveCount(0);
    // Turned back on from the settings.
    await page.getByTestId("btn-settings").click();
    await page.getByTestId("tutorial-again").check();
    await page.getByTestId("btn-settings-close").click();
    await expect(page.getByTestId("tutorial")).toBeVisible();
  });

  test("procedural table: real characters, weapons and town render without errors", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await startGame(page, "5", "/play/solo");
    await expect(page.getByTestId("game-table")).toBeVisible();
    // The town and the characters stream in behind the loading screen, which then lifts.
    await expect(page.getByTestId("loading-screen")).toHaveCount(0, { timeout: 180_000 });
    // A few seconds of the idle loop with skinned characters, the town and the buckboard.
    await page.waitForTimeout(5000);
    expect(errors.filter((e) => !/THREE\.Clock|GL Driver|instant/.test(e))).toEqual([]);
  });
});
