import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  ROLE_COUNTS,
  applyAction,
  createGame,
  currentActor,
  getLegalActions,
  type GameConfig,
  type Role,
} from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf } from "./helpers/scenario";

function config(n: number, characterMode: GameConfig["characterMode"] = "random"): GameConfig {
  return { players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isNpc: i > 0 })), characterMode };
}

describe("setup (docs/02 §2)", () => {
  it.each([4, 5, 6, 7])("T-1 role distribution for %i players matches §1.1", (n) => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const { state } = createGame(config(n), seed);
      const counts: Record<Role, number> = { sheriff: 0, deputy: 0, outlaw: 0, renegade: 0 };
      for (const p of state.players) counts[p.role]++;
      expect(counts).toEqual(ROLE_COUNTS[n]);
    }
  });

  it("T-1 roles are shuffled across seats", () => {
    const sheriffSeats = new Set(
      Array.from({ length: 30 }, (_, i) => createGame(config(7), `shuffle-${i}`).state.players.findIndex((p) => p.role === "sheriff")),
    );
    expect(sheriffSeats.size).toBeGreaterThan(1);
  });

  it("T-2 Sheriff maxLife = character life + 1, starting hand = life", () => {
    for (const seed of ["x", "y", "z"]) {
      const { state } = createGame(config(5), seed);
      for (const p of state.players) {
        expect(p.characterId).not.toBeNull();
        const base = CHARACTERS[p.characterId!].life;
        expect(p.maxLife).toBe(base + (p.role === "sheriff" ? 1 : 0));
        expect(p.life).toBe(p.maxLife);
        // The Sheriff has already drawn 2 in the draw phase of turn 1.
        expect(p.hand).toHaveLength(p.life + (p.role === "sheriff" ? 2 : 0));
      }
    }
  });

  it("T-3 Sheriff takes the first turn", () => {
    const { state, events } = createGame(config(6), "first-turn");
    const sheriff = state.players.findIndex((p) => p.role === "sheriff");
    expect(state.turn).toMatchObject({ seat: sheriff, number: 1, phase: "play" });
    expect(currentActor(state)).toBe(sheriff);
    expect(eventsOf(events, "TURN_STARTED")).toEqual([{ t: "TURN_STARTED", seat: sheriff, turn: 1 }]);
  });

  it("assigns distinct characters and conserves all 80 cards", () => {
    const { state } = createGame(config(7), "distinct");
    expect(new Set(state.players.map((p) => p.characterId)).size).toBe(7);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("emits GAME_STARTED and one ROLE_ASSIGNED per seat", () => {
    const { events } = createGame(config(4), "events");
    expect(events[0]?.t).toBe("GAME_STARTED");
    expect(eventsOf(events, "ROLE_ASSIGNED")).toHaveLength(4);
  });

  it("rejects fewer than 4 or more than 7 players and empty names", () => {
    expect(() => createGame(config(3), "s")).toThrow();
    expect(() => createGame(config(8), "s")).toThrow();
    const bad = config(4);
    bad.players[2] = { name: "  ", isNpc: true };
    expect(() => createGame(bad, "s")).toThrow();
  });

  it("does not mutate the config", () => {
    const cfg = config(4);
    const copy = structuredClone(cfg);
    createGame(cfg, "cfg");
    expect(cfg).toEqual(copy);
  });

  describe("choose_of_2 variant", () => {
    it("asks each player to choose 1 of 2, Sheriff first then clockwise, before dealing", () => {
      let { state } = createGame(config(5, "choose_of_2"), "choose");
      const sheriff = state.players.findIndex((p) => p.role === "sheriff");
      expect(state.turn.phase).toBe("setup");
      expect(state.players.every((p) => p.characterId === null && p.hand.length === 0)).toBe(true);

      const offered = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const seat = (sheriff + i) % 5;
        expect(currentActor(state)).toBe(seat);
        const [legal] = getLegalActions(state, seat);
        expect(legal?.type).toBe("CHOOSE");
        if (legal?.type !== "CHOOSE") return;
        expect(legal.choices).toHaveLength(2);
        legal.choices.forEach((c) => offered.add(c.characterId));
        const choice = legal.choices[1]!;
        const r = applyAction(state, seat, { type: "CHOOSE", choice });
        state = r.state;
        expect(state.players[seat]?.characterId).toBe(choice.characterId);
        expect(eventsOf(r.events, "CHARACTER_CHOSEN")).toEqual([{ t: "CHARACTER_CHOSEN", seat, characterId: choice.characterId }]);
      }
      expect(offered.size).toBe(10);
      expect(state.turn).toMatchObject({ seat: sheriff, phase: "play", number: 1 });
      for (const p of state.players) {
        expect(p.maxLife).toBe(CHARACTERS[p.characterId!].life + (p.role === "sheriff" ? 1 : 0));
      }
      expect(checkInvariants(state)).toEqual([]);
    });

    it("rejects a character that was not offered", () => {
      const { state } = createGame(config(4, "choose_of_2"), "choose-bad");
      const seat = currentActor(state)!;
      const [legal] = getLegalActions(state, seat);
      if (legal?.type !== "CHOOSE") throw new Error("expected CHOOSE");
      const offered = legal.choices.map((c) => c.characterId);
      const other = (Object.keys(CHARACTERS) as Array<keyof typeof CHARACTERS>).find((id) => !offered.includes(id))!;
      expect(() => applyAction(state, seat, { type: "CHOOSE", choice: { kind: "character", characterId: other } })).toThrow(
        /not one of the options/,
      );
    });
  });
});
