import { expect, test } from "@playwright/test";

test.describe("/dev/table solo game", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/table");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("a full solo game runs to the game-over screen (autoplay, bots in a Web Worker)", async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByTestId("setup-name").fill("Tester");
    await page.getByTestId("setup-count").selectOption("4");
    await page.getByTestId("setup-difficulty").selectOption("easy");
    await page.getByTestId("setup-start").click();

    await expect(page.getByTestId("game-table")).toBeVisible();
    await expect(page.getByTestId("seat-0")).toContainText("Tester");
    await expect(page.getByTestId("hand-card").first()).toBeVisible();

    await page.getByTestId("toggle-fast").check();
    await page.getByTestId("toggle-autoplay").check();

    await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("winner")).not.toBeEmpty();
    await expect(page.getByTestId("game-log")).toContainText("Permainan selesai");

    await page.getByTestId("btn-play-again").click();
    await expect(page.getByTestId("setup-start")).toBeVisible();
  });

  test("a refresh in the middle of a game resumes it", async ({ page }) => {
    await page.getByTestId("setup-name").fill("Resumer");
    await page.getByTestId("setup-start").click();
    await expect(page.getByTestId("game-table")).toBeVisible();
    await expect(page.getByTestId("hand-card").first()).toBeVisible();

    await page.reload();
    await page.getByTestId("setup-resume").click();
    await expect(page.getByTestId("game-table")).toBeVisible();
    await expect(page.getByTestId("seat-0")).toContainText("Resumer");
  });

  test("the human can end their turn when it is their move", async ({ page }) => {
    await page.getByTestId("setup-start").click();
    await page.getByTestId("toggle-fast").check();
    // Answer whatever the bots throw at us until our own play phase comes up.
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId("btn-end-turn").isVisible()) break;
      if (await page.getByTestId("game-over").isVisible()) return;
      const choice = page.getByTestId("choice-option").first();
      if (await page.getByTestId("btn-pass").isVisible()) await page.getByTestId("btn-pass").click();
      else if (await choice.isVisible()) await choice.click();
      await page.waitForTimeout(250);
    }
    await page.getByTestId("btn-end-turn").click();
    await expect(page.getByTestId("btn-end-turn")).toBeHidden();
  });
});
