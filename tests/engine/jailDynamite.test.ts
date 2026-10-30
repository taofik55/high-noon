import { describe, expect, it } from "vitest";
import { applyAction, currentActor, getLegalActions, type CardId } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

const HEART = { suit: "hearts" } as const;
const SPADE_10 = { suit: "spades", rank: 10 } as const;
const SPADE_5 = { suit: "spades", rank: 5 } as const;
const END_TURN = { type: "END_TURN" } as const;

describe("Jail (docs/02 §4.1, §4.3)", () => {
  it("T-22 Jail cannot target the Sheriff, yourself or someone already jailed", () => {
    const s = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw", hand: ["jail"] }, { role: "outlaw", inPlay: ["jail"] }, { role: "renegade" }],
      turn: { seat: 1 },
    });
    const jail = firstInHand(s, 1, "jail");
    expect(getLegalActions(s, 1)).toContainEqual({ type: "PLAY_CARD", cardId: jail, targets: [{ seat: 3 }] });
    expect(() => applyAction(s, 1, { type: "PLAY_CARD", cardId: jail, target: { seat: 0 } })).toThrow(/not valid/);

    const { state, events } = applyAction(s, 1, { type: "PLAY_CARD", cardId: jail, target: { seat: 3 } });
    expect(player(state, 3).inPlay).toEqual([jail]);
    expect(eventsOf(events, "JAILED")).toEqual([{ t: "JAILED", seat: 3, by: 1 }]);
  });

  it("T-22 Hearts escapes: Jail is discarded and the turn is played normally", () => {
    const s = scenario({ players: [{}, { inPlay: ["jail"] }, {}, {}], deckTop: [HEART] });
    const jail = player(s, 1).inPlay[0]!;
    const heart = s.deck[0]!;
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "DRAW_CHECK")).toEqual([
      { t: "DRAW_CHECK", seat: 1, reason: "jail", cardIds: [heart], chosen: heart, success: true },
    ]);
    expect(eventsOf(events, "JAIL_RESULT")).toEqual([{ t: "JAIL_RESULT", seat: 1, escaped: true }]);
    expect(player(state, 1).inPlay).toEqual([]);
    expect(state.discard).toContain(jail);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
    expect(player(state, 1).hand).toHaveLength(2);
  });

  it("T-22 otherwise the turn is skipped (no draw, play or discard) and Jail is discarded", () => {
    const s = scenario({ players: [{}, { inPlay: ["jail"], life: 1, hand: ["bang", "bang", "bang"] }, {}, {}], deckTop: [SPADE_10] });
    const jail = player(s, 1).inPlay[0]!;
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "JAIL_RESULT")).toEqual([{ t: "JAIL_RESULT", seat: 1, escaped: false }]);
    expect(player(state, 1).inPlay).toEqual([]);
    expect(player(state, 1).hand).toEqual(player(s, 1).hand);
    expect(state.discard).toContain(jail);
    expect(state.turn).toMatchObject({ seat: 2, phase: "play" });
    expect(eventsOf(events, "TURN_STARTED").map((e) => e.seat)).toEqual([1, 2]);
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe("Dynamite (docs/02 §4.1)", () => {
  it("T-23 explodes on Spades 2–9: 3 damage, Dynamite discarded, the turn goes on", () => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite"] }, {}, {}], deckTop: [SPADE_5] });
    const dynamite = player(s, 1).inPlay[0]!;
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "DRAW_CHECK")[0]).toMatchObject({ seat: 1, reason: "dynamite", success: true });
    expect(eventsOf(events, "DYNAMITE_EXPLODED")).toEqual([{ t: "DYNAMITE_EXPLODED", seat: 1 }]);
    expect(eventsOf(events, "DAMAGED")).toEqual([{ t: "DAMAGED", seat: 1, amount: 3, source: null, cause: "dynamite" }]);
    expect(player(state, 1).life).toBe(player(s, 1).life - 3);
    expect(state.discard).toContain(dynamite);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
    expect(checkInvariants(state)).toEqual([]);
  });

  it.each([
    ["Hearts", HEART],
    ["Spades 10", SPADE_10],
  ] as const)("T-23 does not explode on %s: passes to the next living player on the left", (_name, card) => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite"] }, { alive: false }, {}], deckTop: [card] });
    const dynamite = player(s, 1).inPlay[0]!;
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "DYNAMITE_PASSED")).toEqual([{ t: "DYNAMITE_PASSED", from: 1, to: 3 }]);
    expect(player(state, 1).inPlay).toEqual([]);
    expect(player(state, 3).inPlay).toEqual([dynamite]);
    expect(eventsOf(events, "DAMAGED")).toEqual([]);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });

  it("T-23 Dynamite is resolved before Jail", () => {
    const s = scenario({ players: [{}, { inPlay: ["jail", "dynamite"] }, {}, {}], deckTop: [HEART, SPADE_10] });
    const { state, events } = applyAction(s, 0, END_TURN);
    // Seat 1's own checks; seat 2 then starts its turn and checks the Dynamite it just received.
    const seat1 = events.filter(
      (e) => (e.t === "DRAW_CHECK" && e.seat === 1) || (e.t === "DYNAMITE_PASSED" && e.from === 1) || e.t === "JAIL_RESULT",
    );
    expect(seat1.map((e) => (e.t === "DRAW_CHECK" ? `${e.t}:${e.reason}` : e.t))).toEqual([
      "DRAW_CHECK:dynamite",
      "DYNAMITE_PASSED",
      "DRAW_CHECK:jail",
      "JAIL_RESULT",
    ]);
    expect(state.turn.seat).toBe(2); // jailed: Spades 10 does not free them
  });

  it("T-23 after surviving an explosion the Jail is still checked", () => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite", "jail"] }, {}, {}], deckTop: [SPADE_5, HEART] });
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "DYNAMITE_EXPLODED")).toHaveLength(1);
    expect(eventsOf(events, "JAIL_RESULT")).toEqual([{ t: "JAIL_RESULT", seat: 1, escaped: true }]);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });

  it("T-24 an explosion kill gives no reward or penalty (R-3) and ends the turn (R-5, R-16)", () => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite"], life: 2, hand: ["beer"] }, {}, {}], deckTop: [SPADE_5] });
    const exploded = applyAction(s, 0, END_TURN);
    expect(exploded.state.stack.at(-1)).toEqual({ kind: "DYING", seat: 1, killer: null });
    expect(currentActor(exploded.state)).toBe(1);

    const { state, events } = applyAction(exploded.state, 1, { type: "PASS" });
    expect(eventsOf(events, "ELIMINATED")).toEqual([{ t: "ELIMINATED", seat: 1, role: "outlaw", killer: null }]);
    expect(state.stats.map((st) => st.kills)).toEqual([0, 0, 0, 0]);
    expect(eventsOf(events, "REWARD")).toEqual([]);
    expect(state.turn).toMatchObject({ seat: 2, phase: "play" });
    expect(checkInvariants(state)).toEqual([]);
  });

  it("T-24 a dying player saved by Beer goes on with their turn", () => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite"], life: 2, hand: ["beer", "beer"] }, {}, {}], deckTop: [SPADE_5] });
    const [b1, b2] = handOf(s, 1, "beer") as [CardId, CardId];
    const { state } = run(s, [
      [0, END_TURN],
      [1, { type: "RESPOND", cardIds: [b1] }],
      [1, { type: "RESPOND", cardIds: [b2] }],
    ]);
    expect(player(state, 1).life).toBe(1);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
    expect(player(state, 1).hand).toHaveLength(2); // drew 2 after surviving
  });

  it("T-24 Dynamite killing the Sheriff ends the game", () => {
    const s = scenario({ players: [{ inPlay: ["dynamite"], life: 3 }, {}, {}, {}], turn: { seat: 3 }, deckTop: [SPADE_5] });
    const { state } = run(s, [
      [3, END_TURN],
      [0, { type: "PASS" }],
    ]);
    expect(state.winner).toBe("outlaws");
  });

  it("R-33 with nothing to reveal, the draw! fails: Dynamite does not explode and moves on", () => {
    const s = scenario({ players: [{}, { inPlay: ["dynamite"] }, {}, {}], deckTop: [], leftover: "none" });
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "DRAW_CHECK")).toEqual([]);
    expect(eventsOf(events, "DYNAMITE_PASSED")).toEqual([{ t: "DYNAMITE_PASSED", from: 1, to: 2 }]);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });
});
