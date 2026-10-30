import { describe, expect, it } from "vitest";
import { applyAction, effectiveDistance, getLegalActions, weaponRange, type CardId, type CardType, type GameState } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

function canPlay(s: GameState, type: CardType): boolean {
  const cardId = firstInHand(s, 0, type);
  return getLegalActions(s, 0).some((l) => l.type === "PLAY_CARD" && l.cardId === cardId);
}

describe("weapons & equipment (docs/02 §1.3, §4.3)", () => {
  it("T-21 equipping a weapon puts it in play and sets the range", () => {
    const s = scenario({ players: [{ hand: ["schofield"] }, {}, {}, {}] });
    const schofield = firstInHand(s, 0, "schofield");
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: schofield });
    expect(player(state, 0).inPlay).toEqual([schofield]);
    expect(player(state, 0).hand).toEqual([]);
    expect(weaponRange(player(state, 0))).toBe(2);
    expect(eventsOf(events, "EQUIPPED")).toEqual([{ t: "EQUIPPED", seat: 0, cardId: schofield }]);
    expect(state.discard).not.toContain(schofield);
  });

  it("T-21 only one weapon: a new weapon replaces and discards the old one", () => {
    const s = scenario({ players: [{ hand: ["remington"], inPlay: ["schofield", "barrel"] }, {}, {}, {}] });
    const [schofield, barrel] = player(s, 0).inPlay as [CardId, CardId];
    const remington = firstInHand(s, 0, "remington");
    const { state, events } = applyAction(s, 0, { type: "PLAY_CARD", cardId: remington });
    expect(player(state, 0).inPlay).toEqual([barrel, remington]);
    expect(state.discard.at(-1)).toBe(schofield);
    expect(eventsOf(events, "EQUIPPED")).toEqual([{ t: "EQUIPPED", seat: 0, cardId: remington, replaced: schofield }]);
    expect(weaponRange(player(state, 0))).toBe(3);
    expect(checkInvariants(state)).toEqual([]);
  });

  // The deck holds a single Dynamite and Scope, so those duplicates cannot arise; Barrel and Mustang come in pairs.
  it.each(["barrel", "mustang"] as const)("T-21 no duplicate %s in front of a player", (type) => {
    const s = scenario({ players: [{ hand: [type], inPlay: [type] }, {}, {}, {}] });
    expect(canPlay(s, type)).toBe(false);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, type) })).toThrow(/cannot be played now/);
  });

  it("T-21 the weapon you already hold cannot be played again (R-32)", () => {
    const s = scenario({ players: [{ hand: ["schofield", "winchester"], inPlay: ["schofield"] }, {}, {}, {}] });
    expect(canPlay(s, "schofield")).toBe(false);
    expect(canPlay(s, "winchester")).toBe(true);
  });

  it("T-7 equipping Mustang and Scope changes distances", () => {
    const s = scenario({
      players: [{ character: "lucky_duke", hand: ["scope"] }, { character: "lucky_duke", hand: ["mustang"] }, {}, {}, {}],
    });
    let { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "scope") });
    expect(effectiveDistance(state, 0, 2)).toBe(1);
    state = applyAction(state, 0, { type: "END_TURN" }).state;
    state = applyAction(state, 1, { type: "PLAY_CARD", cardId: firstInHand(s, 1, "mustang") }).state;
    expect(effectiveDistance(state, 2, 1)).toBe(2);
    expect(effectiveDistance(state, 0, 1)).toBe(1); // Scope −1 cancels Mustang +1.
  });
});

describe("Volcanic (T-10)", () => {
  it("T-10 Volcanic allows any number of BANG! cards", () => {
    const s = scenario({ players: [{ hand: ["bang", "bang", "bang"], inPlay: ["volcanic"] }, {}, {}, {}] });
    const [b1, b2, b3] = handOf(s, 0, "bang") as [CardId, CardId, CardId];
    const { state } = run(s, [
      [0, { type: "PLAY_CARD", cardId: b1, target: { seat: 1 } }],
      [1, { type: "PASS" }],
      [0, { type: "PLAY_CARD", cardId: b2, target: { seat: 3 } }],
      [3, { type: "PASS" }],
    ]);
    expect(state.turn.bangsPlayed).toBe(2);
    expect(getLegalActions(state, 0)).toContainEqual({ type: "PLAY_CARD", cardId: b3, targets: [{ seat: 1 }, { seat: 3 }] });
  });

  it("T-10 equipping Volcanic after a BANG! lifts the limit for the rest of the turn", () => {
    const s = scenario({ players: [{ character: "black_jack", hand: ["bang", "bang", "volcanic"] }, {}, {}, {}], turn: { bangsPlayed: 1 } });
    expect(getLegalActions(s, 0).filter((l) => l.type === "PLAY_CARD")).toHaveLength(1);
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "volcanic") });
    expect(getLegalActions(state, 0).filter((l) => l.type === "PLAY_CARD")).toHaveLength(2);
  });

  it("T-10 replacing Volcanic restores the limit", () => {
    const s = scenario({
      players: [{ character: "black_jack", hand: ["bang", "schofield"], inPlay: ["volcanic"] }, {}, {}, {}],
      turn: { bangsPlayed: 1 },
    });
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "schofield") });
    expect(getLegalActions(state, 0)).toEqual([{ type: "END_TURN" }]);
  });
});
