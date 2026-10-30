import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions, type GameState, type Target } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, player, scenario, type PlayerSpec } from "./helpers/scenario";

function targetsOf(s: GameState, type: "panic" | "cat_balou"): Target[] {
  const cardId = firstInHand(s, 0, type);
  const option = getLegalActions(s, 0).find((l) => l.type === "PLAY_CARD" && l.cardId === cardId);
  return option?.type === "PLAY_CARD" ? (option.targets ?? []) : [];
}

function targetSeats(s: GameState, type: "panic" | "cat_balou"): number[] {
  return [...new Set(targetsOf(s, type).map((t) => t.seat ?? -1))].sort();
}

const withCard: PlayerSpec = { character: "lucky_duke", hand: ["missed"] };

describe("Panic! (docs/02 §6.5)", () => {
  it("T-9 Panic! reaches only effective distance 1, whatever the weapon", () => {
    const s = scenario({
      players: [{ character: "lucky_duke", hand: ["panic"], inPlay: ["winchester"] }, ...Array.from({ length: 6 }, () => withCard)],
    });
    expect(targetSeats(s, "panic")).toEqual([1, 6]);
  });

  it("T-7 Mustang puts a neighbour out of Panic! reach; Scope brings distance 2 in reach", () => {
    const mustang = scenario({
      players: [{ character: "lucky_duke", hand: ["panic"] }, { ...withCard, inPlay: ["mustang"] }, ...Array.from({ length: 5 }, () => withCard)],
    });
    expect(targetSeats(mustang, "panic")).toEqual([6]);

    const scope = scenario({
      players: [{ character: "lucky_duke", hand: ["panic"], inPlay: ["scope"] }, ...Array.from({ length: 6 }, () => withCard)],
    });
    expect(targetSeats(scope, "panic")).toEqual([1, 2, 5, 6]);
  });

  it("T-13 Panic! steals a random hand card", () => {
    const s = scenario({ players: [{ hand: ["panic"] }, { hand: ["missed", "beer"] }, {}, {}] });
    const victimHand = player(s, 1).hand;
    const panic = firstInHand(s, 0, "panic");
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: panic, target: { seat: 1, fromHand: true } });
    const [stolen] = eventsOf(events, "CARD_STOLEN");
    expect(stolen).toMatchObject({ from: 1, to: 0, fromHand: true });
    expect(victimHand).toContain(stolen?.cardId);
    expect(player(state, 0).hand).toEqual([stolen?.cardId]);
    expect(player(state, 1).hand).toEqual(victimHand.filter((id) => id !== stolen?.cardId));
    expect(state.discard.at(-1)).toBe(panic);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-13 Panic! takes a chosen in-play card, including Dynamite", () => {
    const s = scenario({ players: [{ hand: ["panic"] }, { hand: ["missed"], inPlay: ["barrel", "dynamite"] }, {}, {}] });
    const dynamite = player(s, 1).inPlay[1]!;
    const { state, events } = applyAction(s, 0, {
      type: "PLAY_CARD",
      cardId: firstInHand(s, 0, "panic"),
      target: { seat: 1, cardId: dynamite },
    });
    expect(player(state, 0).hand).toEqual([dynamite]);
    expect(player(state, 1).inPlay).toEqual([player(s, 1).inPlay[0]]);
    expect(eventsOf(events, "CARD_STOLEN")).toEqual([{ t: "CARD_STOLEN", from: 1, to: 0, cardId: dynamite, fromHand: false }]);
  });

  it("T-13 lists one target per hand and per in-play card", () => {
    const s = scenario({ players: [{ hand: ["panic"] }, { hand: ["missed", "beer"], inPlay: ["barrel"] }, {}, { inPlay: ["mustang"] }] });
    const barrel = player(s, 1).inPlay[0]!;
    // Seat 3's Mustang puts them at distance 2; seat 2 has no cards.
    expect(targetsOf(s, "panic")).toEqual([{ seat: 1, fromHand: true }, { seat: 1, cardId: barrel }]);
  });

  it("T-13 Panic! is illegal on a player without cards and on yourself (R-13)", () => {
    const s = scenario({ players: [{ hand: ["panic", "missed"] }, {}, {}, { hand: ["beer"] }] });
    const panic = firstInHand(s, 0, "panic");
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: panic, target: { seat: 1, fromHand: true } })).toThrow(/not valid/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: panic, target: { seat: 0, fromHand: true } })).toThrow(/not valid/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: panic, target: { seat: 3 } })).toThrow(/not valid/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: panic, target: { seat: 3, fromHand: true } })).not.toThrow();
  });

  it("T-13 Panic! is not playable when nobody in reach has a card", () => {
    const s = scenario({ players: [{ hand: ["panic"] }, {}, { hand: ["beer"] }, {}] });
    expect(getLegalActions(s, 0)).toEqual([{ type: "END_TURN" }]);
  });
});

describe("Cat Balou (docs/02 §6.5)", () => {
  it("T-13 forces a random hand discard at any distance", () => {
    const s = scenario({
      players: [{ character: "lucky_duke", hand: ["cat_balou"] }, {}, {}, { hand: ["missed", "beer"] }, {}, {}, {}],
    });
    expect(targetSeats(s, "cat_balou")).toEqual([3]);
    const { state, events } = applyAction(s, 0, {
      type: "PLAY_CARD",
      cardId: firstInHand(s, 0, "cat_balou"),
      target: { seat: 3, fromHand: true },
    });
    const [discarded] = eventsOf(events, "CARD_DISCARDED");
    expect(discarded).toMatchObject({ seat: 3, reason: "cat_balou" });
    expect(player(state, 3).hand).toHaveLength(1);
    expect(state.discard.at(-1)).toBe(discarded?.cardIds[0]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-13 can discard Jail from in front of a player", () => {
    const s = scenario({ players: [{ hand: ["cat_balou"] }, {}, { inPlay: ["jail"] }, {}] });
    const jail = player(s, 2).inPlay[0]!;
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "cat_balou"), target: { seat: 2, cardId: jail } });
    expect(player(state, 2).inPlay).toEqual([]);
    expect(state.discard.at(-1)).toBe(jail);
  });

  it("T-13 Cat Balou is illegal on yourself and on empty players", () => {
    const s = scenario({ players: [{ hand: ["cat_balou", "beer"] }, {}, {}, {}] });
    expect(getLegalActions(s, 0)).toEqual([{ type: "END_TURN" }]);
  });
});
