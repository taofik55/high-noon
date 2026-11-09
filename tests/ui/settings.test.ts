import { afterEach, describe, expect, it } from "vitest";
import { suitColor } from "@/ui/cards";
import { setActiveLocale, t } from "@/ui/i18n";
import { effectiveCinematics, reducedMotion, useSettings } from "@/game3d/settings/settingsStore";

afterEach(() => setActiveLocale("id"));

describe("language (docs/01 §6)", () => {
  it("defaults to Bahasa Indonesia and follows the active locale", () => {
    expect(useSettings.getState().locale).toBe("id");
    expect(t("settings.title")).toBe("Pengaturan");
    setActiveLocale("en");
    expect(t("settings.title")).toBe("Settings");
    // An explicit locale still wins.
    expect(t("settings.title", undefined, "id")).toBe("Pengaturan");
  });
});

describe("accessibility settings", () => {
  it("reduced motion caps cinematics at short and leaves short/off alone", () => {
    expect(effectiveCinematics("full", true)).toBe("short");
    expect(effectiveCinematics("short", true)).toBe("short");
    expect(effectiveCinematics("off", true)).toBe("off");
    expect(effectiveCinematics("full", false)).toBe("full");
  });

  it("an explicit reduce-motion choice overrides the system setting", () => {
    useSettings.getState().setReduceMotion("on");
    expect(reducedMotion()).toBe(true);
    useSettings.getState().setReduceMotion("off");
    expect(reducedMotion()).toBe(false);
    // "system" without a browser: no preference.
    useSettings.getState().setReduceMotion("system");
    expect(reducedMotion()).toBe(false);
  });

  it("four-colour suits give every suit its own colour; classic keeps red and black", () => {
    const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
    expect(new Set(suits.map((s) => suitColor(s, true))).size).toBe(4);
    expect(suitColor("hearts", false)).toBe(suitColor("diamonds", false));
    expect(suitColor("clubs", false)).toBe(suitColor("spades", false));
    expect(suitColor("hearts", false)).not.toBe(suitColor("spades", false));
  });

  it("new settings default off and the tutorial is not done yet", () => {
    const s = useSettings.getState();
    expect([s.largeText, s.colorBlindSuits, s.tutorialDone]).toEqual([false, false, false]);
  });
});
