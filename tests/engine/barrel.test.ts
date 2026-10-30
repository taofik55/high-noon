import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions } from "@/engine";
import { startBangResponse } from "@/engine/rules/bangResponse";
import type { Ctx } from "@/engine/rules/context";
import { eventsOf, firstInHand, player, scenario } from "./helpers/scenario";

const HEART = { suit: "hearts" } as const;
const SPADE = { suit: "spades" } as const;

describe("Barrel (docs/02 §5, R-9)", () => {
  it("T-20 a Hearts draw! cancels the BANG! automatically, with no prompt", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { inPlay: ["barrel"], hand: ["missed"] }, {}, {}], deckTop: [HEART] });
    const heart = s.deck[0]!;
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } });
    expect(eventsOf(events, "DRAW_CHECK")).toEqual([
      { t: "DRAW_CHECK", seat: 1, reason: "barrel", cardIds: [heart], chosen: heart, success: true },
    ]);
    expect(eventsOf(events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "barrel" }]);
    expect(currentActor(state)).toBe(0);
    expect(player(state, 1).life).toBe(player(s, 1).life);
    expect(player(state, 1).hand).toEqual(player(s, 1).hand); // the Missed! was not needed
    expect(state.discard.at(-1)).toBe(heart);
  });

  it("T-20 a failed draw! still lets the target respond, checked before the prompt", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { inPlay: ["barrel"], hand: ["missed"] }, {}, {}], deckTop: [SPADE] });
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } });
    expect(eventsOf(events, "DRAW_CHECK")[0]?.success).toBe(false);
    expect(eventsOf(events, "MISSED")).toEqual([]);
    expect(state.stack.at(-1)).toEqual({ kind: "RESPOND_BANG", seat: 1, attacker: 0, source: "bang", needed: 1, got: 0 });
    const missed = firstInHand(s, 1, "missed");
    expect(getLegalActions(state, 1)).toEqual([{ type: "RESPOND", cardIds: [missed], count: 1 }, { type: "PASS" }]);
  });

  it("T-20 Barrel works against each Gatling target", () => {
    const s = scenario({ players: [{ hand: ["gatling"] }, { inPlay: ["barrel"] }, {}, {}], deckTop: [HEART] });
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "gatling") });
    expect(eventsOf(events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "barrel" }]);
    expect(currentActor(state)).toBe(2);
  });

  it("R-10 a Barrel success counts as one of two needed Missed! effects", () => {
    const s = scenario({ players: [{}, { inPlay: ["barrel"], hand: ["missed", "missed"] }, {}, {}], deckTop: [HEART] });
    const ctx: Ctx = { s: structuredClone(s), events: [] };
    startBangResponse(ctx, 1, 0, "bang", 2);
    expect(ctx.s.stack.at(-1)).toEqual({ kind: "RESPOND_BANG", seat: 1, attacker: 0, source: "bang", needed: 2, got: 1 });
    // Only one more Missed! is asked for.
    expect(getLegalActions(ctx.s, 1)[0]).toMatchObject({ type: "RESPOND", count: 1 });
  });

  it("T-20 Barrel does nothing against Indians! or Duel", () => {
    const s = scenario({ players: [{ hand: ["indians"] }, { inPlay: ["barrel"] }, {}, {}], deckTop: [HEART] });
    const { events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "indians") });
    expect(eventsOf(events, "DRAW_CHECK")).toEqual([]);
  });
});
