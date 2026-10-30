import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "@/engine";
import { eventsOf, firstInHand, player, scenario } from "./helpers/scenario";

describe("Stagecoach & Wells Fargo (docs/02 §6.8)", () => {
  it("T-14 Stagecoach draws 2", () => {
    const s = scenario({ players: [{ hand: ["stagecoach"] }, {}, {}, {}] });
    const top = s.deck.slice(0, 2);
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "stagecoach") });
    expect(player(state, 0).hand).toEqual(top);
    expect(eventsOf(events, "CARDS_DRAWN")).toEqual([{ t: "CARDS_DRAWN", seat: 0, count: 2, cardIds: top, from: "deck" }]);
  });

  it("T-14 Wells Fargo draws 3", () => {
    const s = scenario({ players: [{ hand: ["wells_fargo"] }, {}, {}, {}] });
    const top = s.deck.slice(0, 3);
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "wells_fargo") });
    expect(player(state, 0).hand).toEqual(top);
  });
});

describe("Saloon (docs/02 §6.7)", () => {
  it("T-19 Saloon heals every living player by 1, capped at max life", () => {
    const s = scenario({
      players: [{ life: 2, hand: ["saloon"] }, { life: 1 }, {}, { alive: false }],
    });
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "saloon") });
    expect(player(state, 0).life).toBe(3);
    expect(player(state, 1).life).toBe(2);
    expect(player(state, 2).life).toBe(player(s, 2).maxLife);
    expect(player(state, 3)).toMatchObject({ alive: false, life: 0 });
    expect(eventsOf(events, "HEALED")).toEqual([
      { t: "HEALED", seat: 0, amount: 1, cause: "saloon" },
      { t: "HEALED", seat: 1, amount: 1, cause: "saloon" },
    ]);
  });

  it("T-19 Saloon is playable even when nobody is wounded (R-30)", () => {
    const s = scenario({ players: [{ hand: ["saloon"] }, {}, {}, {}] });
    const saloon = firstInHand(s, 0, "saloon");
    expect(getLegalActions(s, 0)).toContainEqual({ type: "PLAY_CARD", cardId: saloon, targets: null });
    const { events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: saloon });
    expect(eventsOf(events, "HEALED")).toEqual([]);
    expect(eventsOf(events, "CARD_PLAYED")).toHaveLength(1);
  });

  it("T-19 Saloon still works with only 2 players alive (only Beer is restricted, R-6)", () => {
    const s = scenario({ players: [{ life: 1, hand: ["saloon"] }, { life: 1 }, { alive: false }, { alive: false, role: "deputy" }] });
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "saloon") });
    expect(player(state, 0).life).toBe(2);
    expect(player(state, 1).life).toBe(2);
  });
});
