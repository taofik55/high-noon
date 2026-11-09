import { expect, type Page } from "@playwright/test";

/** Opens the in-game settings dialog (if needed), sets a select, and closes the dialog again. */
export async function setSetting(page: Page, testId: "quality" | "cinematics" | "speed" | "language" | "reduce-motion", value: string): Promise<void> {
  const dialog = page.getByTestId("settings-dialog");
  if (!(await dialog.isVisible())) await page.getByTestId("btn-settings").click();
  await expect(dialog).toBeVisible();
  await page.getByTestId(testId).selectOption(value);
  await page.getByTestId("btn-settings-close").click();
  await expect(dialog).toHaveCount(0);
}

/** Skips the first-game tutorial if it is showing (fresh storage shows it once). */
export async function skipTutorial(page: Page): Promise<void> {
  const skip = page.getByTestId("tutorial-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
}
