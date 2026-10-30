import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

describe("Duel (docs/02 §6.4)", () => {
  it("T-17 any distance; alternates starting with the target; the one who gives up is hit by the opponent", () => {
    const s = scenario({
      players: [{ hand: ["duel", "bang"] }, {}, {}, { hand: ["bang", "bang"] }, {}, {}, {}],
    });
    const duel = firstInHand(s, 0, "duel");
    expect(getLegalActions(s, 0)).toContainEqual({
      type: "PLAY_CARD",
      cardId: duel,
      targets: [1, 2, 3, 4, 5, 6].map((seat) => ({ seat })),
    });

    const [t1, t2] = handOf(s, 3, "bang");
    const a1 = firstInHand(s, 0, "bang");
    let r = applyAction(s, 0, { type: "PLAY_CARD", cardId: duel, target: { seat: 3 } });
    expect(r.state.stack.at(-1)).toEqual({ kind: "DUEL", seat: 3, opponent: 0, initiator: 0 });

    r = applyAction(r.state, 3, { type: "RESPOND", cardIds: [t1!] });
    expect(currentActor(r.state)).toBe(0);
    expect(eventsOf(r.events, "DUEL_ROUND")).toEqual([{ t: "DUEL_ROUND", seat: 3, discarded: t1 }]);

    const { state, events } = run(r.state, [
      [0, { type: "RESPOND", cardIds: [a1] }],
      [3, { type: "RESPOND", cardIds: [t2!] }],
      [0, { type: "PASS" }],
    ]);
    expect(player(state, 0).life).toBe(player(s, 0).life - 1);
    expect(player(state, 3).life).toBe(player(s, 3).life);
    expect(eventsOf(events, "DUEL_ROUND").map((e) => [e.seat, e.discarded])).toEqual([
      [0, a1],
      [3, t2],
      [0, null],
    ]);
    // §6.4: the initiator can lose, and the damage source is the opponent.
    expect(eventsOf(events, "DAMAGED")).toEqual([{ t: "DAMAGED", seat: 0, amount: 1, source: 3, cause: "duel" }]);
    expect(eventsOf(events, "SHOT")).toEqual([{ t: "SHOT", from: 3, to: 0, source: "duel", weapon: "colt45" }]);
    expect(state.stats[3]?.damageDealt).toBe(1);
    expect(currentActor(state)).toBe(0);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-17 the target can lose straight away; Missed! is no use in a Duel", () => {
    const s = scenario({ players: [{ hand: ["duel"] }, { hand: ["missed"] }, {}, {}] });
    const r = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "duel"), target: { seat: 1 } });
    expect(getLegalActions(r.state, 1)).toEqual([{ type: "PASS" }]);
    const hit = applyAction(r.state, 1, { type: "PASS" });
    expect(eventsOf(hit.events, "DAMAGED")).toEqual([{ t: "DAMAGED", seat: 1, amount: 1, source: 0, cause: "duel" }]);
  });

  it("T-17 Duel does not count toward the BANG! limit", () => {
    const s = scenario({ players: [{ hand: ["duel"] }, {}, {}, {}], turn: { bangsPlayed: 1 } });
    expect(getLegalActions(s, 0).some((l) => l.type === "PLAY_CARD")).toBe(true);
    const { state } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "duel"), target: { seat: 2 } }],
      [2, { type: "PASS" }],
    ]);
    expect(state.turn.bangsPlayed).toBe(1);
  });

  it("T-17 an initiator killed in their own Duel loses the rest of the turn (R-16); the target gets the kill", () => {
    const s = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw", life: 1, hand: ["duel", "stagecoach"] }, { role: "outlaw" }, { role: "renegade", hand: ["bang"] }],
      turn: { seat: 1 },
    });
    const { state, events } = run(s, [
      [1, { type: "PLAY_CARD", cardId: firstInHand(s, 1, "duel"), target: { seat: 3 } }],
      [3, { type: "RESPOND", cardIds: [firstInHand(s, 3, "bang")] }],
      [1, { type: "PASS" }],
      [1, { type: "PASS" }],
    ]);
    expect(eventsOf(events, "ELIMINATED")).toEqual([{ t: "ELIMINATED", seat: 1, role: "outlaw", killer: 3 }]);
    expect(state.stats[3]?.kills).toBe(1);
    expect(state.winner).toBeNull();
    expect(state.turn).toMatchObject({ seat: 2, phase: "play" });
    expect(eventsOf(events, "TURN_STARTED")).toEqual([{ t: "TURN_STARTED", seat: 2, turn: 2 }]);
    expect(checkInvariants(state)).toEqual([]);
  });
});
