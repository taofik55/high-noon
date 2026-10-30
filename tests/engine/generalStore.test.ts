import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions, type CardId } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, player, scenario } from "./helpers/scenario";

const pick = (cardId: CardId) => ({ type: "CHOOSE" as const, choice: { kind: "store_card" as const, cardId } });

describe("General Store (docs/02 §6.6)", () => {
  it("T-18 reveals K = living players; picks start with the player and go clockwise; the last card is automatic", () => {
    const s = scenario({
      players: [{}, { alive: false }, { hand: ["general_store"] }, {}, {}],
      turn: { seat: 2 },
    });
    const revealed = s.deck.slice(0, 4);
    let r = applyAction(s, 2, { type: "PLAY_CARD", cardId: firstInHand(s, 2, "general_store") });
    expect(eventsOf(r.events, "STORE_REVEALED")).toEqual([{ t: "STORE_REVEALED", cardIds: revealed }]);
    expect(r.state.stack.at(-1)).toEqual({ kind: "STORE_PICK", seat: 2, revealed, order: [3, 4, 0] });
    expect(getLegalActions(r.state, 2)).toEqual([
      { type: "CHOOSE", choices: revealed.map((cardId) => ({ kind: "store_card", cardId })) },
    ]);
    expect(checkInvariants(r.state)).toEqual([]);

    const [c0, c1, c2, c3] = revealed as [CardId, CardId, CardId, CardId];
    r = applyAction(r.state, 2, pick(c2));
    expect(currentActor(r.state)).toBe(3);
    expect(() => applyAction(r.state, 3, pick(c2))).toThrow(/not one of the options/);
    r = applyAction(r.state, 3, pick(c0));
    expect(currentActor(r.state)).toBe(4);
    r = applyAction(r.state, 4, pick(c3));

    // Seat 0 gets the last card without being asked.
    expect(eventsOf(r.events, "STORE_PICKED")).toEqual([
      { t: "STORE_PICKED", seat: 4, cardId: c3 },
      { t: "STORE_PICKED", seat: 0, cardId: c1 },
    ]);
    expect(player(r.state, 2).hand).toEqual([c2]);
    expect(player(r.state, 3).hand).toEqual([c0]);
    expect(player(r.state, 4).hand).toEqual([c3]);
    expect(player(r.state, 0).hand).toEqual([c1]);
    expect(currentActor(r.state)).toBe(2);
    expect(checkInvariants(r.state)).toEqual([]);
  });

  it("T-18 with fewer cards available than players, the last pickers get nothing (R-31)", () => {
    // Deck: 1 card. The played General Store is already in the discard pile, so R-8 reshuffles it back in:
    // 2 cards for 4 players.
    const s = scenario({ players: [{ hand: ["general_store"] }, {}, {}, {}], deckTop: ["beer"], leftover: "none" });
    const [beer] = s.deck as [CardId];
    const store = firstInHand(s, 0, "general_store");
    let r = applyAction(s, 0, { type: "PLAY_CARD", cardId: store });
    expect(eventsOf(r.events, "DECK_RESHUFFLED")).toEqual([{ t: "DECK_RESHUFFLED", size: 1 }]);
    expect(r.state.stack.at(-1)).toEqual({ kind: "STORE_PICK", seat: 0, revealed: [beer, store], order: [1, 2, 3] });
    r = applyAction(r.state, 0, pick(store));
    expect(player(r.state, 0).hand).toEqual([store]);
    expect(player(r.state, 1).hand).toEqual([beer]);
    expect(player(r.state, 2).hand).toEqual([]);
    expect(player(r.state, 3).hand).toEqual([]);
    expect(currentActor(r.state)).toBe(0);
  });
});
