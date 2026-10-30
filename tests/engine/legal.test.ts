import { describe, expect, it } from "vitest";
import { IllegalActionError, applyAction, expandLegalActions, isActionLegal, whyIllegal } from "@/engine";
import { firstInHand, scenario } from "./helpers/scenario";

describe("legal actions & validation", () => {
  it("throws IllegalActionError with a reason", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { hand: ["beer"] }, {}, {}] });
    const beerOfOther = firstInHand(s, 1, "beer");
    try {
      applyAction(s, 0, { type: "PLAY_CARD", cardId: beerOfOther });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalActionError);
      expect((e as IllegalActionError).reason).toMatch(/not in hand/);
    }
  });

  it("reports why an action is illegal and accepts legal ones", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, {}, {}, {}] });
    const bang = firstInHand(s, 0, "bang");
    expect(whyIllegal(s, 0, { type: "PASS" })).toMatch(/PASS is not allowed/);
    expect(whyIllegal(s, 0, { type: "RESPOND", cardIds: [bang] })).toMatch(/no response/);
    expect(whyIllegal(s, 0, { type: "DISCARD", cardIds: [bang] })).toMatch(/not possible/);
    expect(isActionLegal(s, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 1 } })).toBe(true);
    expect(isActionLegal(s, 0, { type: "END_TURN" })).toBe(true);
  });

  it("rejects duplicate cards in a pick", () => {
    const s = scenario({ players: [{ life: 1, hand: ["bang", "bang", "missed"] }, {}, {}, {}] });
    const { state } = applyAction(s, 0, { type: "END_TURN" });
    const bang = firstInHand(state, 0, "bang");
    expect(whyIllegal(state, 0, { type: "DISCARD", cardIds: [bang, bang] })).toMatch(/duplicate/);
  });

  it("expandLegalActions enumerates every target and every card combination", () => {
    const actions = expandLegalActions([
      { type: "PLAY_CARD", cardId: "c01", targets: [{ seat: 1 }, { seat: 3 }] },
      { type: "PLAY_CARD", cardId: "c40", targets: null },
      { type: "DISCARD", cardIds: ["c01", "c02", "c03", "c04"], count: 2 },
      { type: "END_TURN" },
    ]);
    expect(actions.filter((a) => a.type === "PLAY_CARD")).toHaveLength(3);
    expect(actions.filter((a) => a.type === "DISCARD")).toHaveLength(6);
    expect(actions.at(-1)).toEqual({ type: "END_TURN" });
  });
});
