import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions, type CardId } from "@/engine";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

describe("BANG! and Missed! (docs/02 §6.1)", () => {
  it("BANG! makes the target respond, PASS takes 1 damage", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, {}, {}, {}] });
    const bang = firstInHand(s, 0, "bang");
    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 1 } });
    expect(currentActor(shot.state)).toBe(1);
    expect(shot.state.stack.at(-1)).toEqual({ kind: "RESPOND_BANG", seat: 1, attacker: 0, source: "bang", needed: 1, got: 0 });
    expect(eventsOf(shot.events, "SHOT")).toEqual([{ t: "SHOT", from: 0, to: 1, source: "bang", weapon: "colt45" }]);
    expect(shot.state.discard.at(-1)).toBe(bang);

    // No Missed! in hand: the prompt still appears (no information leak), with PASS as the only option.
    expect(getLegalActions(shot.state, 1)).toEqual([{ type: "PASS" }]);

    const hit = applyAction(shot.state, 1, { type: "PASS" });
    expect(player(hit.state, 1).life).toBe(player(s, 1).life - 1);
    expect(eventsOf(hit.events, "DAMAGED")).toEqual([{ t: "DAMAGED", seat: 1, amount: 1, source: 0, cause: "bang" }]);
    expect(hit.state.stats[0]).toEqual({ damageDealt: 1, kills: 0, cardsPlayed: 1 });
    expect(currentActor(hit.state)).toBe(0);
  });

  it("T-10 only one BANG! per turn (BANG! part)", () => {
    const s = scenario({ players: [{ hand: ["bang", "bang"] }, {}, {}, {}] });
    const [b1, b2] = handOf(s, 0, "bang") as [CardId, CardId];
    const { state } = run(s, [
      [0, { type: "PLAY_CARD", cardId: b1, target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]);
    expect(state.turn.bangsPlayed).toBe(1);
    expect(getLegalActions(state, 0).some((l) => l.type === "PLAY_CARD")).toBe(false);
    expect(() => applyAction(state, 0, { type: "PLAY_CARD", cardId: b2, target: { seat: 1 } })).toThrow(
      /cannot be played now/,
    );
  });

  it("T-10 the BANG! counter resets on the next turn", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { hand: ["bang"] }, {}, {}], turn: { bangsPlayed: 1 } });
    expect(getLegalActions(s, 0).some((l) => l.type === "PLAY_CARD")).toBe(false);
    const { state } = applyAction(s, 0, { type: "END_TURN" });
    expect(state.turn).toMatchObject({ seat: 1, bangsPlayed: 0 });
    expect(getLegalActions(state, 1).some((l) => l.type === "PLAY_CARD")).toBe(true);
  });

  it("T-11 Missed! cancels a BANG!", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { hand: ["missed", "beer"] }, {}, {}] });
    const bang = firstInHand(s, 0, "bang");
    const missed = firstInHand(s, 1, "missed");
    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 1 } });
    expect(getLegalActions(shot.state, 1)).toEqual([{ type: "RESPOND", cardIds: [missed], count: 1 }, { type: "PASS" }]);

    const saved = applyAction(shot.state, 1, { type: "RESPOND", cardIds: [missed] });
    expect(player(saved.state, 1).life).toBe(player(s, 1).life);
    expect(player(saved.state, 1).hand).not.toContain(missed);
    expect(saved.state.discard.at(-1)).toBe(missed);
    expect(eventsOf(saved.events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "missed" }]);
    expect(eventsOf(saved.events, "DAMAGED")).toEqual([]);
    expect(currentActor(saved.state)).toBe(0);
  });

  it("T-11 a non-Missed! card cannot be used to respond", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { hand: ["missed", "beer"] }, {}, {}] });
    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } });
    const beer = firstInHand(s, 1, "beer");
    expect(() => applyAction(shot.state, 1, { type: "RESPOND", cardIds: [beer] })).toThrow(/cannot be used here/);
  });

  it("T-11 Missed! cannot be played outside a response", () => {
    const s = scenario({ players: [{ hand: ["missed"] }, {}, {}, {}] });
    expect(getLegalActions(s, 0)).toEqual([{ type: "END_TURN" }]);
    const missed = firstInHand(s, 0, "missed");
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: missed })).toThrow(/cannot be played now/);
  });

  it("BANG! cannot target yourself or a dead player", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { alive: false }, {}, {}] });
    const bang = firstInHand(s, 0, "bang");
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 0 } })).toThrow(/not valid/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: bang, target: { seat: 1 } })).toThrow(/not valid/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: bang })).toThrow(/target is required/);
  });
});
