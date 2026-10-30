import { describe, expect, it } from "vitest";
import {
  createMemory,
  decide,
  decideSafe,
  determinize,
  fallbackAction,
  hostility,
  observe,
  simulateGame,
  type Difficulty,
} from "@/ai";
import { applyAction, checkInvariants, createRng, matchLegal, toPlayerView, type GameState, type Seat } from "@/engine";
import { firstInHand, player, run, scenario } from "../engine/helpers/scenario";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function viewAndMemory(s: GameState, seat: Seat) {
  const view = toPlayerView(s, seat);
  return { view, memory: createMemory(view) };
}

describe("AI contract (docs/06 §1)", () => {
  it.each(DIFFICULTIES)("%s always answers with an action from view.legalActions", (difficulty) => {
    const s = scenario({
      players: [{ role: "sheriff", hand: ["bang", "beer", "panic", "barrel", "missed"] }, { role: "outlaw", hand: ["missed"] }, { role: "outlaw" }, { role: "renegade" }],
    });
    const { view, memory } = viewAndMemory(s, 0);
    const action = decide(view, memory, difficulty, createRng("x"));
    expect(matchLegal(view.legalActions, action)).toBeNull();
  });

  it("is deterministic for the same view, memory and rng seed", () => {
    const s = scenario({ players: [{ role: "sheriff", hand: ["bang", "beer", "panic", "duel"] }, { role: "outlaw", hand: ["missed"] }, { role: "outlaw" }, { role: "renegade" }] });
    const { view, memory } = viewAndMemory(s, 0);
    for (const difficulty of DIFFICULTIES) {
      expect(decide(view, memory, difficulty, createRng("same"))).toEqual(decide(view, memory, difficulty, createRng("same")));
    }
  });

  it("decideSafe falls back to the safe action when a brain fails", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, {}, {}, {}] });
    const { view, memory } = viewAndMemory(s, 0);
    const problems: string[] = [];
    const action = decideSafe(view, memory, "bogus" as Difficulty, createRng("x"), {}, (m) => problems.push(m));
    expect(action).toEqual(fallbackAction(view));
    expect(action).toEqual({ type: "END_TURN" });
    expect(problems).toHaveLength(1);
  });
});

describe("policies (docs/06 §4–5)", () => {
  it.each(DIFFICULTIES)("%s defends with Missed! when shot", (difficulty) => {
    const s = scenario({ players: [{ hand: ["bang"] }, { hand: ["missed", "beer"] }, {}, {}] });
    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }).state;
    const { view, memory } = viewAndMemory(shot, 1);
    expect(decide(view, memory, difficulty, createRng("x"))).toEqual({ type: "RESPOND", cardIds: [firstInHand(s, 1, "missed")] });
  });

  it.each(DIFFICULTIES)("%s drinks a Beer when dying", (difficulty) => {
    const s = scenario({ players: [{ hand: ["bang"] }, { life: 1, hand: ["beer"] }, {}, {}] });
    const dying = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]).state;
    const { view, memory } = viewAndMemory(dying, 1);
    expect(decide(view, memory, difficulty, createRng("x"))).toEqual({ type: "RESPOND", cardIds: [firstInHand(s, 1, "beer")] });
  });

  it("medium uses Sid Ketchum's ability to survive", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "sid_ketchum", life: 1, hand: ["panic", "duel"] }, {}, {}] });
    const dying = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]).state;
    const { view, memory } = viewAndMemory(dying, 1);
    expect(decide(view, memory, "medium", createRng("x"))).toMatchObject({ type: "ABILITY", ability: "sid_ketchum" });
  });

  it("medium draws cards before anything else and shoots a known enemy", () => {
    const s = scenario({
      players: [{ role: "outlaw", hand: ["bang", "stagecoach"] }, { role: "sheriff" }, { role: "outlaw" }, { role: "renegade" }],
    });
    const { view, memory } = viewAndMemory(s, 0);
    expect(decide(view, memory, "medium", createRng("x"))).toEqual({ type: "PLAY_CARD", cardId: firstInHand(s, 0, "stagecoach") });
    const afterDraw = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "stagecoach") }).state;
    const next = viewAndMemory(afterDraw, 0);
    expect(decide(next.view, next.memory, "medium", createRng("x"))).toMatchObject({ type: "PLAY_CARD", target: { seat: 1 } });
  });

  it("the easy bot never shoots the Sheriff unless it is an Outlaw", () => {
    const s = scenario({ players: [{ role: "sheriff" }, { role: "deputy", hand: ["bang", "bang", "bang"] }, { role: "outlaw" }, { role: "renegade" }], turn: { seat: 1 } });
    const { view, memory } = viewAndMemory(s, 1);
    for (let i = 0; i < 30; i++) {
      const action = decide(view, memory, "easy", createRng(`easy-${i}`));
      if (action.type === "PLAY_CARD") expect(action.target?.seat).not.toBe(0);
    }
  });
});

describe("role inference memory (docs/06 §3)", () => {
  // A legal 5-player table (docs/02 §1.1): Sheriff, Deputy, 2 Outlaws, Renegade.
  const FIVE = [{ role: "sheriff" }, { role: "outlaw" }, { role: "deputy" }, { role: "renegade" }, { role: "outlaw" }] as const;

  it("starts with the Sheriff and my own role known", () => {
    const s = scenario({ players: [...FIVE] });
    const memory = createMemory(toPlayerView(s, 2));
    expect(memory.knownRoles).toEqual(["sheriff", null, "deputy", null, null]);
    expect(memory.suspicion).toEqual([-1, 0, -1, 0, 0]);
  });

  it("raises suspicion of whoever shoots the Sheriff, and lowers it for shooting a suspect", () => {
    // Seen by the Sheriff, who cannot tell the Deputy, Outlaws and Renegade apart by role count.
    const s = scenario({ players: [...FIVE] });
    const view = toPlayerView(s, 0);
    let memory = createMemory(view);
    memory = observe(memory, { t: "CARD_PLAYED", seat: 1, cardId: "c01", target: { seat: 0 } });
    expect(memory.suspicion[1]).toBeGreaterThan(0.5);
    memory = observe(memory, { t: "CARD_PLAYED", seat: 3, cardId: "c02", target: { seat: 1 } });
    expect(memory.suspicion[3]).toBeLessThan(0);
    expect(hostility(view, memory, 1)).toBeGreaterThan(hostility(view, memory, 3));
  });

  it("the only Deputy of a 5-player table knows every unknown player is an enemy", () => {
    const s = scenario({ players: [...FIVE] });
    const view = toPlayerView(s, 2);
    const memory = createMemory(view);
    for (const seat of [1, 3, 4]) expect(hostility(view, memory, seat)).toBeGreaterThan(0.5);
    expect(hostility(view, memory, 0)).toBe(-1);
  });

  it("learns roles from eliminations and is immutable", () => {
    const s = scenario({ players: [...FIVE] });
    const before = createMemory(toPlayerView(s, 2));
    const after = observe(before, { t: "ELIMINATED", seat: 3, role: "renegade", killer: 0 });
    expect(after.knownRoles[3]).toBe("renegade");
    expect(before.knownRoles[3]).toBeNull();
  });

  it("deduces roles from the remaining role pool (docs/06 §3): the last unknown in Sheriff vs Renegade is the enemy", () => {
    // A Renegade who only ever shot Outlaws looks friendly, but once both Outlaws are dead he can only be the Renegade.
    const s = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw", alive: false }, { role: "outlaw", alive: false }, { role: "renegade", hand: ["bang"] }],
    });
    const view = toPlayerView(s, 0);
    let memory = createMemory(view);
    memory = observe(memory, { t: "CARD_PLAYED", seat: 3, cardId: "c01", target: { seat: 1 } });
    memory = { ...memory, suspicion: memory.suspicion.map((x, i) => (i === 3 ? -0.7 : x)) };
    expect(hostility(view, memory, 3)).toBeGreaterThan(0.5);
  });

  it("an easy Renegade attacks the Sheriff in the final duel, never before", () => {
    const duel = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw", alive: false }, { role: "outlaw", alive: false }, { role: "renegade", hand: ["bang"] }],
      turn: { seat: 3 },
    });
    const view = toPlayerView(duel, 3);
    const shots = Array.from({ length: 30 }, (_, i) => decide(view, createMemory(view), "easy", createRng(`r-${i}`)));
    expect(shots.some((a) => a.type === "PLAY_CARD" && a.target?.seat === 0)).toBe(true);

    const early = scenario({
      players: [{ role: "sheriff" }, { role: "outlaw" }, { role: "outlaw" }, { role: "renegade", hand: ["bang", "bang"], inPlay: ["winchester"] }],
      turn: { seat: 3 },
    });
    const earlyView = toPlayerView(early, 3);
    for (let i = 0; i < 30; i++) {
      const a = decide(earlyView, createMemory(earlyView), "easy", createRng(`e-${i}`));
      if (a.type === "PLAY_CARD") expect(a.target?.seat).not.toBe(0);
    }
  });

  it("hostility follows the role table", () => {
    const s = scenario({ players: [{ role: "sheriff" }, { role: "outlaw" }, { role: "deputy" }, { role: "renegade" }, { role: "outlaw" }] });
    const outlaw = toPlayerView(s, 1);
    expect(hostility(outlaw, createMemory(outlaw), 0)).toBe(1);
    const deputy = toPlayerView(s, 2);
    expect(hostility(deputy, createMemory(deputy), 0)).toBe(-1);
    const renegade = toPlayerView(s, 3);
    expect(hostility(renegade, createMemory(renegade), 0)).toBeLessThan(0); // keeps the Sheriff alive early
  });
});

describe("hard bot: determinization never needs hidden information", () => {
  it("builds a consistent world from the view alone", () => {
    const s = scenario({
      players: [
        { role: "sheriff", hand: ["bang", "beer"], inPlay: ["barrel"] },
        { role: "outlaw", hand: ["missed", "panic"] },
        { role: "deputy", hand: ["duel"] },
        { role: "renegade" },
        { role: "outlaw", alive: false },
      ],
      discard: ["stagecoach"],
    });
    const { view, memory } = viewAndMemory(s, 0);
    const world = determinize(view, memory, createRng("w"));
    expect(checkInvariants(world)).toEqual([]);
    expect(player(world, 0).hand).toEqual(view.myHand);
    expect(world.players.map((p) => p.hand.length)).toEqual(s.players.map((p) => p.hand.length));
    expect(world.deck).toHaveLength(view.deckCount);
    expect(world.discard).toEqual(view.discard);
    expect(player(world, 0).role).toBe("sheriff");
    expect(player(world, 4).role).toBe("outlaw"); // revealed on death
    expect([...world.players.map((p) => p.role)].sort()).toEqual(["deputy", "outlaw", "outlaw", "renegade", "sheriff"]);
  });
});

describe("simulation smoke (docs/06 §6)", () => {
  it("mixed games run without violations or illegal AI choices", () => {
    for (let i = 0; i < 12; i++) {
      const difficulties = Array.from({ length: 4 + (i % 4) }, (_, s) => DIFFICULTIES[(i + s) % 3] as Difficulty);
      const r = simulateGame({ seed: `smoke-${i}`, difficulties, hard: { samples: 2, candidates: 3 } });
      expect(r.violations).toEqual([]);
      expect(r.aiProblems).toEqual([]);
      expect(r.winner).not.toBeNull();
    }
  }, 120_000);

  it("is reproducible from its seed", () => {
    const opts = { seed: "repro", difficulties: ["hard", "medium", "easy", "medium", "hard"] as Difficulty[], hard: { samples: 2 } };
    expect(simulateGame(opts)).toEqual(simulateGame(opts));
  }, 60_000);
});
