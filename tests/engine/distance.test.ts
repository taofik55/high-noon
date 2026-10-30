import { describe, expect, it } from "vitest";
import { applyAction, effectiveDistance, getLegalActions, seatDistance, weaponRange, type LegalAction } from "@/engine";
import { firstInHand, player, scenario } from "./helpers/scenario";

function bangTargets(legal: LegalAction[]): number[] {
  const option = legal.find((l) => l.type === "PLAY_CARD" && l.targets !== null);
  return option?.type === "PLAY_CARD" ? (option.targets ?? []).map((t) => t.seat ?? -1).sort() : [];
}

describe("distance & range (docs/02 §3)", () => {
  it("T-6 seat distance in a 7-player circle", () => {
    const s = scenario({ players: 7 });
    expect(seatDistance(s, 0, 1)).toBe(1);
    expect(seatDistance(s, 0, 2)).toBe(2);
    expect(seatDistance(s, 0, 3)).toBe(3);
    expect(seatDistance(s, 0, 4)).toBe(3);
    expect(seatDistance(s, 0, 6)).toBe(1);
    expect(seatDistance(s, 2, 5)).toBe(3);
    expect(seatDistance(s, 1, 6)).toBe(2);
    expect(seatDistance(s, 3, 3)).toBe(0);
  });

  it("T-6 distance is recalculated after eliminations", () => {
    const s = scenario({ players: [{}, { alive: false }, { alive: false }, {}, {}, {}, {}] });
    expect(seatDistance(s, 0, 3)).toBe(1);
    expect(seatDistance(s, 0, 4)).toBe(2);
    expect(seatDistance(s, 3, 6)).toBe(2);
    expect(seatDistance(s, 0, 6)).toBe(1);
  });

  it("T-7 Mustang +1, Scope −1, Paul Regret / Rose Doolan stack with the cards (R-2), minimum 1", () => {
    const base = { character: "lucky_duke" } as const;
    let s = scenario({ players: [base, base, base, base, base, base, base] });
    expect(effectiveDistance(s, 0, 2)).toBe(2);

    s = scenario({ players: [base, base, { ...base, inPlay: ["mustang"] }, base, base, base, base] });
    expect(effectiveDistance(s, 0, 2)).toBe(3);
    expect(effectiveDistance(s, 2, 0)).toBe(2); // Mustang only affects how others see you.

    s = scenario({ players: [base, base, { character: "paul_regret", inPlay: ["mustang"] }, base, base, base, base] });
    expect(effectiveDistance(s, 0, 2)).toBe(4);

    s = scenario({ players: [{ ...base, inPlay: ["scope"] }, base, base, base, base, base, base] });
    expect(effectiveDistance(s, 0, 3)).toBe(2);
    expect(effectiveDistance(s, 3, 0)).toBe(3); // Scope only affects how you see others.

    s = scenario({ players: [{ character: "rose_doolan", inPlay: ["scope"] }, base, base, base, base, base, base] });
    expect(effectiveDistance(s, 0, 3)).toBe(1);
    expect(effectiveDistance(s, 0, 1)).toBe(1); // 1 − 2 clamps to 1.
  });

  it("T-8 BANG! is illegal beyond range and legal after equipping a longer weapon", () => {
    const players = Array.from({ length: 7 }, () => ({ character: "lucky_duke" as const }));
    const colt = scenario({ players: [{ ...players[0], hand: ["bang"] }, ...players.slice(1)] });
    expect(weaponRange(player(colt, 0))).toBe(1);
    expect(bangTargets(getLegalActions(colt, 0))).toEqual([1, 6]);
    const bang = firstInHand(colt, 0, "bang");
    expect(() => applyAction(colt, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 2 } })).toThrow(/not valid/);

    const schofield = scenario({ players: [{ ...players[0], hand: ["bang"], inPlay: ["schofield"] }, ...players.slice(1)] });
    expect(weaponRange(player(schofield, 0))).toBe(2);
    expect(bangTargets(getLegalActions(schofield, 0))).toEqual([1, 2, 5, 6]);
    const bang2 = firstInHand(schofield, 0, "bang");
    expect(() => applyAction(schofield, 0, { type: "PLAY_CARD", cardId: bang2, target: { seat: 2 } })).not.toThrow();
    expect(() => applyAction(schofield, 0, { type: "PLAY_CARD", cardId: bang2, target: { seat: 3 } })).toThrow(/not valid/);

    const winchester = scenario({ players: [{ ...players[0], hand: ["bang"], inPlay: ["winchester"] }, ...players.slice(1)] });
    expect(bangTargets(getLegalActions(winchester, 0))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
