import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions, toPlayerView, type Action, type CardId, type GameState, type Seat } from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

const PASS = { type: "PASS" } as const;

function kill(s: GameState, attacker: Seat, victim: Seat) {
  const steps: Array<[Seat, Action]> = [
    [attacker, { type: "PLAY_CARD", cardId: firstInHand(s, attacker, "bang"), target: { seat: victim } }],
    [victim, PASS],
    [victim, PASS],
  ];
  return run(s, steps);
}

describe("T-26 multi-point damage (R-14)", () => {
  it("life can go negative; the player needs enough heals to get back to 1", () => {
    const s = scenario({
      players: [{}, { inPlay: ["dynamite"], life: 1, hand: ["beer", "beer", "beer"] }, {}, {}],
      deckTop: [{ suit: "spades", rank: 5 }],
    });
    let { state } = applyAction(s, 0, { type: "END_TURN" });
    expect(player(state, 1).life).toBe(-2);
    expect(toPlayerView(state, 0).players[1]?.life).toBe(0); // display clamps at 0
    const beers = handOf(s, 1, "beer") as [CardId, CardId, CardId];
    for (const [i, beer] of beers.entries()) {
      expect(state.stack.at(-1)).toMatchObject({ kind: "DYING", seat: 1 });
      state = applyAction(state, 1, { type: "RESPOND", cardIds: [beer] }).state;
      expect(player(state, 1).life).toBe(-1 + i);
    }
    expect(player(state, 1)).toMatchObject({ alive: true, life: 1 });
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });

  it("two Beers are not enough at -2", () => {
    const s = scenario({
      players: [{}, { inPlay: ["dynamite"], life: 1, hand: ["beer", "beer"] }, {}, {}],
      deckTop: [{ suit: "spades", rank: 5 }],
    });
    const [b1, b2] = handOf(s, 1, "beer") as [CardId, CardId];
    const { state } = run(s, [
      [0, { type: "END_TURN" }],
      [1, { type: "RESPOND", cardIds: [b1] }],
      [1, { type: "RESPOND", cardIds: [b2] }],
    ]);
    expect(getLegalActions(state, 1)).toEqual([PASS]);
    expect(applyAction(state, 1, PASS).state.players[1]?.alive).toBe(false);
  });
});

describe("T-27 rewards and penalties (docs/02 §7.4)", () => {
  it("killing an Outlaw draws 3 cards for the killer, whatever the killer's role", () => {
    const s = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw", hand: ["bang"] }, { role: "outlaw", life: 1 }, { role: "renegade" }],
      turn: { seat: 1 },
    });
    const next3 = s.deck.slice(0, 3);
    const { state, events } = kill(s, 1, 2);
    expect(eventsOf(events, "REWARD")).toEqual([{ t: "REWARD", seat: 1, kind: "outlaw_bounty" }]);
    expect(player(state, 1).hand).toEqual(next3);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("the Sheriff killing a Deputy discards every card in hand and in play", () => {
    const s = scenario({
      players: [
        { role: "sheriff", hand: ["bang", "beer"], inPlay: ["barrel", "schofield"] },
        { role: "deputy", life: 1 },
        { role: "outlaw" },
        { role: "renegade" },
      ],
      deckTop: [{ suit: "clubs" }],
    });
    const lost = [firstInHand(s, 0, "beer"), ...player(s, 0).inPlay];
    const { state, events } = kill(s, 0, 1);
    expect(eventsOf(events, "REWARD")).toEqual([{ t: "REWARD", seat: 0, kind: "deputy_penalty" }]);
    expect(player(state, 0)).toMatchObject({ hand: [], inPlay: [] });
    expect(eventsOf(events, "CARD_DISCARDED").find((e) => e.reason === "deputy_penalty")?.cardIds).toEqual(lost);
  });

  it("no reward for killing the Renegade or a Deputy killed by someone else", () => {
    const renegade = scenario({ players: [{ role: "sheriff", hand: ["bang"] }, { role: "renegade", life: 1 }, { role: "outlaw" }, { role: "outlaw" }] });
    expect(eventsOf(kill(renegade, 0, 1).events, "REWARD")).toEqual([]);

    const deputy = scenario({
      players: [{ role: "sheriff" }, { role: "deputy", life: 1 }, { role: "outlaw", hand: ["bang"] }, { role: "renegade" }, { role: "outlaw" }],
      turn: { seat: 2 },
    });
    expect(eventsOf(kill(deputy, 2, 1).events, "REWARD")).toEqual([]);
  });

  it("no reward when the kill ends the game", () => {
    const s = scenario({
      players: [{ role: "sheriff", hand: ["bang"] }, { role: "outlaw", life: 1 }, { role: "outlaw", alive: false }, { role: "renegade", alive: false }],
    });
    const { state, events } = kill(s, 0, 1);
    expect(state.winner).toBe("sheriff_team");
    expect(eventsOf(events, "REWARD")).toEqual([]);
  });
});
