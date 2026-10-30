import { describe, expect, it } from "vitest";
import { applyAction, checkWinner, currentActor, getLegalActions, type Action, type GameState, type Seat } from "@/engine";
import { eventsOf, firstInHand, run, scenario, type PlayerSpec } from "./helpers/scenario";

/** Attacker shoots the victim, who takes the hit and declines to save themselves. */
function kill(s: GameState, attacker: Seat, victim: Seat) {
  const steps: Array<[Seat, Action]> = [
    [attacker, { type: "PLAY_CARD", cardId: firstInHand(s, attacker, "bang"), target: { seat: victim } }],
    [victim, { type: "PASS" }],
    [victim, { type: "PASS" }],
  ];
  return run(s, steps);
}

const dead: PlayerSpec = { alive: false };

describe("win conditions (docs/02 §8)", () => {
  it("T-29 the Sheriff team wins when all Outlaws and the Renegade are dead", () => {
    const s = scenario({
      players: [{ role: "sheriff", hand: ["bang"] }, { role: "outlaw", life: 1 }, { ...dead, role: "outlaw" }, { ...dead, role: "renegade" }, { role: "deputy" }],
    });
    const { state, events } = kill(s, 0, 1);
    expect(state.winner).toBe("sheriff_team");
    expect(eventsOf(events, "GAME_OVER")).toEqual([
      { t: "GAME_OVER", winner: "sheriff_team", roles: ["sheriff", "outlaw", "outlaw", "renegade", "deputy"] },
    ]);
    expect(state.stack).toEqual([]);
    expect(currentActor(state)).toBeNull();
    expect(getLegalActions(state, 0)).toEqual([]);
    expect(() => applyAction(state, 0, { type: "END_TURN" })).toThrow(/game is over/);
  });

  it("T-29 the game continues while the Renegade lives", () => {
    const s = scenario({
      players: [{ role: "sheriff", hand: ["bang"] }, { role: "outlaw", life: 1 }, { ...dead, role: "outlaw" }, { role: "renegade" }],
    });
    expect(kill(s, 0, 1).state.winner).toBeNull();
  });

  it("T-30 Outlaws win when the Sheriff dies with other players alive", () => {
    const s = scenario({
      players: [{ role: "sheriff", life: 1 }, { role: "outlaw", hand: ["bang"] }, { role: "outlaw" }, { role: "renegade" }],
      turn: { seat: 1 },
    });
    const { state, events } = kill(s, 1, 0);
    expect(state.winner).toBe("outlaws");
    expect(eventsOf(events, "GAME_OVER")[0]?.winner).toBe("outlaws");
  });

  it("T-30 Outlaws win even if every Outlaw is already dead (Renegade kills Sheriff, Deputy alive)", () => {
    const s = scenario({
      players: [
        { role: "sheriff", life: 1 },
        { ...dead, role: "outlaw" },
        { ...dead, role: "outlaw" },
        { role: "renegade", hand: ["bang"] },
        { role: "deputy" },
      ],
      turn: { seat: 3 },
    });
    expect(kill(s, 3, 0).state.winner).toBe("outlaws");
  });

  it("T-31 the Renegade wins only as the sole survivor", () => {
    const s = scenario({
      players: [{ role: "sheriff", life: 1 }, { ...dead, role: "outlaw" }, { ...dead, role: "outlaw" }, { role: "renegade", hand: ["bang"] }],
      turn: { seat: 3 },
    });
    const { state } = kill(s, 3, 0);
    expect(state.winner).toBe("renegade");
  });

  it("T-31 checkWinner covers the table of outcomes", () => {
    const base = (specs: PlayerSpec[]) => checkWinner(scenario({ players: specs }));
    expect(base([{ role: "sheriff" }, { role: "outlaw" }, { role: "outlaw" }, { role: "renegade" }])).toBeNull();
    expect(base([{ role: "sheriff" }, { ...dead, role: "outlaw" }, { ...dead, role: "outlaw" }, { ...dead, role: "renegade" }, { role: "deputy" }])).toBe(
      "sheriff_team",
    );
    expect(base([{ ...dead, role: "sheriff" }, { ...dead, role: "outlaw" }, { ...dead, role: "outlaw" }, { role: "renegade" }])).toBe("renegade");
    expect(base([{ ...dead, role: "sheriff" }, { role: "outlaw" }, { ...dead, role: "outlaw" }, { role: "renegade" }])).toBe("outlaws");
    expect(base([{ ...dead, role: "sheriff" }, { ...dead, role: "outlaw" }, { ...dead, role: "outlaw" }, { role: "renegade" }, { role: "deputy" }])).toBe(
      "outlaws",
    );
  });
});
