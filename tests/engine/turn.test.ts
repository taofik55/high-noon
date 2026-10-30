import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, player, run, scenario } from "./helpers/scenario";

describe("turn flow (docs/02 §4)", () => {
  it("T-3 turns go clockwise and skip dead players", () => {
    const s = scenario({
      players: [{}, { alive: false }, {}, { alive: false }, {}],
    });
    const r1 = applyAction(s, 0, { type: "END_TURN" });
    expect(r1.state.turn).toMatchObject({ seat: 2, number: 2, phase: "play" });
    const r2 = applyAction(r1.state, 2, { type: "END_TURN" });
    expect(r2.state.turn.seat).toBe(4);
    const r3 = applyAction(r2.state, 4, { type: "END_TURN" });
    expect(r3.state.turn.seat).toBe(0);
  });

  it("T-4 the draw phase draws 2 cards from the top of the deck", () => {
    const s = scenario({
      players: [{ character: "lucky_duke" }, { character: "sid_ketchum", hand: ["missed"] }, {}, {}],
      deckTop: ["beer", "panic", "stagecoach"],
    });
    const top2 = s.deck.slice(0, 2);
    const { state, events } = applyAction(s, 0, { type: "END_TURN" });
    expect(player(state, 1).hand).toHaveLength(3);
    expect(player(state, 1).hand.slice(1)).toEqual(top2);
    expect(eventsOf(events, "CARDS_DRAWN")).toEqual([{ t: "CARDS_DRAWN", seat: 1, count: 2, cardIds: top2, from: "deck" }]);
    expect(eventsOf(events, "PHASE").map((e) => e.phase)).toEqual(["discard", "draw", "play"]);
  });

  it("T-4 the discard phase forces hand size down to current life", () => {
    const s = scenario({
      players: [{ life: 2, hand: ["bang", "bang", "missed", "beer", "panic"] }, {}, {}, {}],
    });
    const { state } = applyAction(s, 0, { type: "END_TURN" });
    expect(state.turn.phase).toBe("discard");
    expect(state.stack).toEqual([{ kind: "DISCARD_EXCESS", seat: 0, count: 3 }]);
    expect(getLegalActions(state, 0)).toEqual([{ type: "DISCARD", cardIds: player(s, 0).hand, count: 3 }]);

    const hand = player(state, 0).hand;
    expect(() => applyAction(state, 0, { type: "DISCARD", cardIds: hand.slice(0, 2) })).toThrow(/exactly 3/);
    expect(() => applyAction(state, 0, { type: "END_TURN" })).toThrow();

    const done = applyAction(state, 0, { type: "DISCARD", cardIds: hand.slice(0, 3) });
    expect(player(done.state, 0).hand).toEqual(hand.slice(3));
    expect(done.state.discard.slice(-3)).toEqual(hand.slice(0, 3));
    expect(eventsOf(done.events, "CARD_DISCARDED")).toEqual([
      { t: "CARD_DISCARDED", seat: 0, cardIds: hand.slice(0, 3), reason: "excess" },
    ]);
    expect(done.state.turn.seat).toBe(1);
  });

  it("T-4 no discard prompt when hand size <= life", () => {
    const s = scenario({ players: [{ life: 3, hand: ["bang", "bang", "missed"] }, {}, {}, {}] });
    const { state } = applyAction(s, 0, { type: "END_TURN" });
    expect(state.turn.seat).toBe(1);
    expect(player(state, 0).hand).toHaveLength(3);
  });

  it("T-5 an empty deck is rebuilt from the shuffled discard pile (R-8)", () => {
    const s = scenario({
      players: 4,
      deckTop: [],
      leftover: "discard",
    });
    expect(s.deck).toHaveLength(0);
    const discardBefore = s.discard.length;
    const { state, events } = applyAction(s, 0, { type: "END_TURN" });
    expect(eventsOf(events, "DECK_RESHUFFLED")).toEqual([{ t: "DECK_RESHUFFLED", size: discardBefore }]);
    expect(player(state, 1).hand).toHaveLength(2);
    expect(state.discard).toHaveLength(0);
    expect(state.deck).toHaveLength(discardBefore - 2);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-5 reshuffles in the middle of a draw when the deck runs out", () => {
    const s = scenario({ players: 4, deckTop: ["beer"], discard: ["bang", "missed", "panic"], leftover: "none" });
    const { state, events } = applyAction(s, 0, { type: "END_TURN" });
    expect(player(state, 1).hand).toHaveLength(2);
    expect(player(state, 1).hand[0]).toBe(s.deck[0]);
    expect(eventsOf(events, "DECK_RESHUFFLED")).toHaveLength(1);
    expect(state.deck).toHaveLength(2);
  });

  it("T-5 empty deck and empty discard does not crash: the draw is skipped", () => {
    const s = scenario({ players: 4, deckTop: [], leftover: "none" });
    const { state, events } = applyAction(s, 0, { type: "END_TURN" });
    expect(player(state, 1).hand).toHaveLength(0);
    expect(eventsOf(events, "CARDS_DRAWN")).toHaveLength(0);
    expect(currentActor(state)).toBe(1);
  });

  it("END_TURN is only legal for the active player in the play phase", () => {
    const s = scenario({ players: 4 });
    expect(() => applyAction(s, 1, { type: "END_TURN" })).toThrow(/not the one to act/);
    expect(getLegalActions(s, 1)).toEqual([]);
    const { state } = run(s, [[0, { type: "END_TURN" }]]);
    expect(currentActor(state)).toBe(1);
  });
});
