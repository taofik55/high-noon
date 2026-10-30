import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, player, run, scenario } from "./helpers/scenario";

describe("Beer (docs/02 §6.7)", () => {
  it("T-12 Beer heals 1 life", () => {
    const s = scenario({ players: [{ life: 2, hand: ["beer"] }, {}, {}, {}] });
    const beer = firstInHand(s, 0, "beer");
    expect(getLegalActions(s, 0)).toContainEqual({ type: "PLAY_CARD", cardId: beer, targets: null });
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: beer });
    expect(player(state, 0).life).toBe(3);
    expect(eventsOf(events, "HEALED")).toEqual([{ t: "HEALED", seat: 0, amount: 1, cause: "beer" }]);
    expect(state.discard.at(-1)).toBe(beer);
  });

  it("T-12 Beer is not playable at max life (R-7)", () => {
    const s = scenario({ players: [{ hand: ["beer"] }, {}, {}, {}] });
    expect(player(s, 0).life).toBe(player(s, 0).maxLife);
    expect(getLegalActions(s, 0)).toEqual([{ type: "END_TURN" }]);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "beer") })).toThrow(/cannot be played now/);
  });

  it("T-12 Beer is not playable with only 2 players alive (R-6)", () => {
    const s = scenario({ players: [{ life: 1, hand: ["beer"] }, {}, { alive: false }, { alive: false }] });
    expect(getLegalActions(s, 0)).toEqual([{ type: "END_TURN" }]);
  });

  it("T-12 Beer takes no target", () => {
    const s = scenario({ players: [{ life: 1, hand: ["beer"] }, {}, {}, {}] });
    const beer = firstInHand(s, 0, "beer");
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: beer, target: { seat: 1 } })).toThrow(/no target/);
  });
});

describe("dying (docs/02 §7)", () => {
  it("T-25 a dying player may drink a Beer to survive", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { life: 1, hand: ["beer"] }, {}, {}] });
    const beer = firstInHand(s, 1, "beer");
    const { state, events } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]);
    expect(player(state, 1).life).toBe(0);
    expect(state.stack.at(-1)).toEqual({ kind: "DYING", seat: 1, killer: 0 });
    expect(currentActor(state)).toBe(1);
    expect(getLegalActions(state, 1)).toEqual([{ type: "RESPOND", cardIds: [beer], count: 1 }, { type: "PASS" }]);
    expect(eventsOf(events, "DAMAGED")).toHaveLength(1);

    const saved = applyAction(state, 1, { type: "RESPOND", cardIds: [beer] });
    expect(player(saved.state, 1)).toMatchObject({ life: 1, alive: true });
    expect(currentActor(saved.state)).toBe(0);
    expect(checkInvariants(saved.state)).toEqual([]);
  });

  it("T-25 a dying player may decline and is eliminated", () => {
    // Seat 1's Mustang puts them at distance 2, hence the Schofield.
    const s = scenario({
      players: [{ hand: ["bang"], inPlay: ["schofield"] }, { life: 1, hand: ["beer", "missed"], inPlay: ["mustang"] }, {}, {}],
    });
    const victimCards = [...player(s, 1).hand, ...player(s, 1).inPlay];
    const { state, events } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
      [1, { type: "PASS" }],
    ]);
    expect(player(state, 1)).toMatchObject({ alive: false, life: 0, hand: [], inPlay: [] });
    expect(eventsOf(events, "ELIMINATED")).toEqual([{ t: "ELIMINATED", seat: 1, role: "outlaw", killer: 0 }]);
    expect(eventsOf(events, "CARD_DISCARDED")).toEqual([
      { t: "CARD_DISCARDED", seat: 1, cardIds: victimCards, reason: "eliminated" },
    ]);
    expect(state.stats[0]?.kills).toBe(1);
    expect(state.winner).toBeNull();
    expect(currentActor(state)).toBe(0);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-25 with only 2 players alive Beer cannot save a dying player", () => {
    const s = scenario({
      players: [{ hand: ["bang"] }, { life: 1, hand: ["beer"] }, { alive: false }, { alive: false, role: "deputy" }],
    });
    const { state } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]);
    expect(getLegalActions(state, 1)).toEqual([{ type: "PASS" }]);
    expect(() => applyAction(state, 1, { type: "RESPOND", cardIds: [firstInHand(s, 1, "beer")] })).toThrow();
  });
});
