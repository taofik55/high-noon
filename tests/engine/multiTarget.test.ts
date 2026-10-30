import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions, type GameState } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, player, run, scenario } from "./helpers/scenario";

/** PASSes for whoever is asked until `seat` is back in control; returns the order of responders. */
function passUntil(state: GameState, seat: number): { state: GameState; order: number[] } {
  const order: number[] = [];
  let s = state;
  while (currentActor(s) !== seat && !s.winner) {
    const actor = currentActor(s)!;
    order.push(actor);
    s = applyAction(s, actor, { type: "PASS" }).state;
  }
  return { state: s, order };
}

describe("Gatling (docs/02 §6.2)", () => {
  it("T-15 hits every other living player one at a time, clockwise from the attacker's left (R-11)", () => {
    const s = scenario({
      players: [{}, {}, { hand: ["gatling"] }, { alive: false }, {}],
      turn: { seat: 2 },
    });
    const played = applyAction(s, 2, { type: "PLAY_CARD", cardId: firstInHand(s, 2, "gatling") });
    expect(eventsOf(played.events, "SHOT")).toEqual([{ t: "SHOT", from: 2, to: 4, source: "gatling", weapon: "gatling" }]);
    expect(played.state.stack.at(-1)).toEqual({ kind: "RESPOND_BANG", seat: 4, attacker: 2, source: "gatling", needed: 1, got: 0 });

    const { state, order } = passUntil(played.state, 2);
    expect(order).toEqual([4, 0, 1]);
    for (const seat of [4, 0, 1]) expect(player(state, seat).life).toBe(player(s, seat).life - 1);
    expect(state.stats[2]?.damageDealt).toBe(3);
    expect(state.stack).toEqual([{ kind: "PLAY", seat: 2 }]);
  });

  it("T-15 Missed! works against Gatling", () => {
    const s = scenario({ players: [{ hand: ["gatling"] }, { hand: ["missed"] }, {}, {}] });
    const played = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "gatling") });
    const saved = applyAction(played.state, 1, { type: "RESPOND", cardIds: [firstInHand(s, 1, "missed")] });
    expect(player(saved.state, 1).life).toBe(player(s, 1).life);
    expect(currentActor(saved.state)).toBe(2);
  });

  it("T-15 Gatling does not count toward the BANG! limit, in either order", () => {
    const s = scenario({ players: [{ hand: ["gatling", "bang"] }, {}, {}, {}] });
    const afterGatling = passUntil(applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "gatling") }).state, 0).state;
    expect(afterGatling.turn.bangsPlayed).toBe(0);
    expect(getLegalActions(afterGatling, 0).some((l) => l.type === "PLAY_CARD")).toBe(true);

    const t = scenario({ players: [{ hand: ["gatling"] }, {}, {}, {}], turn: { bangsPlayed: 1 } });
    expect(getLegalActions(t, 0)).toContainEqual({ type: "PLAY_CARD", cardId: firstInHand(t, 0, "gatling"), targets: null });
  });

  it("T-15 Slab the Killer's Gatling needs only 1 Missed! per target (R-12)", () => {
    const s = scenario({ players: [{ character: "slab_the_killer", hand: ["gatling"] }, {}, {}, {}] });
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "gatling") });
    expect(state.stack.at(-1)).toMatchObject({ kind: "RESPOND_BANG", needed: 1 });
  });

  it("continues with the remaining targets after one is eliminated, crediting the attacker", () => {
    const s = scenario({ players: [{ hand: ["gatling"] }, { life: 1 }, {}, {}, { role: "deputy" }] });
    let { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "gatling") });
    state = run(state, [
      [1, { type: "PASS" }], // take the hit
      [1, { type: "PASS" }], // decline to save yourself
    ]).state;
    expect(player(state, 1).alive).toBe(false);
    expect(state.stats[0]?.kills).toBe(1);
    expect(currentActor(state)).toBe(2);
    expect(passUntil(state, 0).order).toEqual([2, 3, 4]);
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe("Indians! (docs/02 §6.3)", () => {
  it("T-16 each other player discards a BANG! or loses 1 life", () => {
    const s = scenario({ players: [{ hand: ["indians"] }, { hand: ["bang"] }, { hand: ["missed"], inPlay: ["barrel"] }, {}] });
    const played = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "indians") });
    expect(played.state.stack.at(-1)).toEqual({ kind: "RESPOND_INDIANS", seat: 1, attacker: 0 });
    const bang = firstInHand(s, 1, "bang");
    expect(getLegalActions(played.state, 1)).toEqual([{ type: "RESPOND", cardIds: [bang], count: 1 }, { type: "PASS" }]);

    const defended = applyAction(played.state, 1, { type: "RESPOND", cardIds: [bang] });
    expect(eventsOf(defended.events, "INDIANS_DEFENDED")).toEqual([{ t: "INDIANS_DEFENDED", seat: 1, cardId: bang }]);
    expect(player(defended.state, 1).life).toBe(player(s, 1).life);
    expect(defended.state.discard.at(-1)).toBe(bang);

    // Missed! and Barrel are useless against Indians!.
    expect(getLegalActions(defended.state, 2)).toEqual([{ type: "PASS" }]);
    expect(() => applyAction(defended.state, 2, { type: "RESPOND", cardIds: [firstInHand(s, 2, "missed")] })).toThrow();
    const hit = applyAction(defended.state, 2, { type: "PASS" });
    expect(eventsOf(hit.events, "INDIANS_HIT")).toEqual([{ t: "INDIANS_HIT", seat: 2 }]);
    expect(eventsOf(hit.events, "DAMAGED")).toEqual([{ t: "DAMAGED", seat: 2, amount: 1, source: 0, cause: "indians" }]);
    expect(eventsOf(hit.events, "DRAW_CHECK")).toEqual([]);

    const done = applyAction(hit.state, 3, { type: "PASS" });
    expect(currentActor(done.state)).toBe(0);
    expect(done.state.turn.bangsPlayed).toBe(0);
  });
});

describe("T-32 the game ends immediately mid-effect", () => {
  it.each(["gatling", "indians"] as const)("%s: remaining targets are not asked once a side has won", (card) => {
    const s = scenario({
      players: [{ role: "outlaw", hand: [card] }, { role: "sheriff", life: 1 }, { role: "outlaw" }, { role: "renegade" }],
    });
    const { state, events } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, card) }],
      [1, { type: "PASS" }],
      [1, { type: "PASS" }],
    ]);
    expect(state.winner).toBe("outlaws");
    expect(state.stack).toEqual([]);
    expect(currentActor(state)).toBeNull();
    expect(eventsOf(events, "DAMAGED").map((e) => e.seat)).toEqual([1]);
    expect(events.at(-1)?.t).toBe("GAME_OVER");
  });
});
