import { expect, test, type Page } from "@playwright/test";

type HandCard = { cardId: string; x: number; y: number; state: string };
type SeatPos = { seat: number; x: number; y: number; targetable: boolean };

const handCards = (page: Page) => page.evaluate(() => window.__highnoonTest?.handCards() ?? []) as Promise<HandCard[]>;
const seats = (page: Page) => page.evaluate(() => window.__highnoonTest?.seats() ?? []) as Promise<SeatPos[]>;

/** Cinematics off at 2x: the scenes are skipped, so tests run at game speed (docs/05 §6 "off"). */
async function fastPresentation(page: Page) {
  await page.getByTestId("cinematics").selectOption("off");
  await page.getByTestId("speed").selectOption("2");
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

async function startGame(page: Page, players = "4") {
  await page.goto("/play/solo");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // Typing before hydration would be wiped; Start is enabled once React owns the form.
  await expect(page.getByTestId("setup-start")).toBeEnabled();
  await page.getByTestId("setup-name").fill("Tester");
  await page.getByTestId("setup-count").selectOption(players);
  await page.getByTestId("setup-difficulty").selectOption("easy");
  await page.getByTestId("setup-start").click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
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
    await page.getByTestId("cinematics").selectOption("full");
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
});
