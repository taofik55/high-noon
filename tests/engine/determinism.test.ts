import { describe, expect, it } from "vitest";
import { applyAction, createGame, type GameConfig } from "@/engine";
import { playRandom } from "./helpers/invariants";
import { deepFreeze } from "./helpers/scenario";

function config(n: number, characterMode: GameConfig["characterMode"] = "random"): GameConfig {
  return { players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isNpc: true, npcDifficulty: "easy" })), characterMode };
}

describe("determinism & invariants", () => {
  it("T-51 same seed + same actions ⇒ identical states and events", () => {
    const a = createGame(config(6), "game-seed");
    const b = createGame(config(6), "game-seed");
    expect(b).toEqual(a);

    const runA = playRandom(a.state, "player-seed", 400);
    // Replay the recorded actions on a fresh game from the same seed.
    let state = b.state;
    const events = [];
    for (const [seat, action] of runA.actions) {
      const r = applyAction(state, seat, action);
      state = r.state;
      events.push(...r.events);
    }
    expect(state).toEqual(runA.state);
    expect(events).toEqual(runA.events);
    expect(JSON.stringify(state)).toBe(JSON.stringify(runA.state));
  });

  it("T-51 a different seed gives a different game", () => {
    const a = createGame(config(6), "seed-A").state;
    const b = createGame(config(6), "seed-B").state;
    expect(a.deck).not.toEqual(b.deck);
  });

  it("T-51 the state survives a JSON round trip mid-game (stored as jsonb online)", () => {
    const start = createGame(config(5), "json").state;
    const half = playRandom(start, "json-actions", 100);
    const revived = JSON.parse(JSON.stringify(half.state)) as typeof half.state;
    const direct = playRandom(half.state, "continue", 200);
    const fromJson = playRandom(revived, "continue", 200);
    expect(fromJson.state).toEqual(direct.state);
    expect(fromJson.events).toEqual(direct.events);
  });

  it("applyAction never mutates its input state", () => {
    let state = deepFreeze(createGame(config(5), "frozen").state);
    const r = playRandom(state, "frozen-actions", 150);
    for (const [seat, action] of r.actions) state = deepFreeze(applyAction(state, seat, action).state);
    expect(state).toEqual(r.state);
  });

  it.each([4, 5, 6, 7])("random legal play keeps invariants with %i players", (n) => {
    let finished = 0;
    for (let i = 0; i < 25; i++) {
      const mode = i % 2 === 0 ? "random" : "choose_of_2";
      const { state } = createGame(config(n, mode), `inv-${n}-${i}`);
      const r = playRandom(state, `inv-actions-${n}-${i}`, 3000);
      if (r.state.winner) finished++;
    }
    expect(finished).toBeGreaterThan(0);
  });
});
