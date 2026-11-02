import { describe, expect, it } from "vitest";
import { createGame, redactEvent, toPlayerView, type GameEventType } from "@/engine";
import { formatEvent } from "@/ui/log/formatEvent";
import { t } from "@/ui/i18n";
import { playRandom } from "../engine/helpers/invariants";

describe("game log formatting", () => {
  it("formats every event of many random games without leftover placeholders", () => {
    const seen = new Set<GameEventType>();
    for (let i = 0; i < 40; i++) {
      const { state, events } = createGame(
        { players: Array.from({ length: 4 + (i % 4) }, (_, s) => ({ name: `P${s}`, isNpc: s > 0 })), characterMode: i % 2 ? "random" : "choose_of_2" },
        `log-${i}`,
      );
      const r = playRandom(state, `log-actions-${i}`, 2000);
      const view = toPlayerView(r.state, 0);
      for (const e of [...events, ...r.events]) {
        const visible = redactEvent(e, 0);
        if (!visible) continue;
        seen.add(visible.t);
        const line = formatEvent(visible, view);
        if (line) {
          expect(line.text).not.toMatch(/\{\w+\}/);
          expect(line.text.length).toBeGreaterThan(3);
        }
      }
    }
    // The random games reach most of the event vocabulary.
    expect(seen.size).toBeGreaterThan(25);
  }, 30_000);

  it("names the viewer 'Kamu' and keeps card names in English", () => {
    const { state } = createGame({ players: Array.from({ length: 4 }, (_, s) => ({ name: `P${s}`, isNpc: s > 0 })), characterMode: "random" }, "names");
    const view = toPlayerView(state, 0);
    expect(formatEvent({ t: "DAMAGED", seat: 0, amount: 1, source: 1, cause: "bang" }, view)?.text).toBe(t("log.damaged", { name: "Kamu", amount: 1 }));
    expect(formatEvent({ t: "CARD_PLAYED", seat: 1, cardId: "c01", target: { seat: 0 } }, view)?.text).toContain("BANG!");
  });

  it("t() fills placeholders and falls back to English", () => {
    expect(t("table.turn", { n: 3 })).toBe("Giliran 3");
    expect(t("table.empty")).toBe("—");
  });
});
