import {
  applyAction,
  checkInvariants,
  createGame,
  createRng,
  currentActor,
  redactEvent,
  toPlayerView,
  type CharacterMode,
  type GameEvent,
  type Role,
  type Winner,
} from "@/engine";
import { decideSafe } from "./decide";
import { createMemory, observe } from "./memory";
import type { AiMemory, AiOptions, Difficulty } from "./types";

export interface SimGameOptions {
  seed: string;
  /** One difficulty per seat; the length is the player count. */
  difficulties: Difficulty[];
  characterMode?: CharacterMode;
  /** Options for hard bots (sample counts). Keep `now` unset for reproducible results. */
  hard?: AiOptions;
  /** docs/06 §6: every game must end within this many turns. */
  maxTurns?: number;
}

export interface SimGameResult {
  seed: string;
  difficulties: Difficulty[];
  roles: Role[];
  winner: Winner | null;
  turns: number;
  steps: number;
  /** Engine-side failures: broken invariants, rejected actions, games that never end. Must stay empty. */
  violations: string[];
  /** AI-side failures: a brain threw or picked an action outside its legal actions (fallback used). Must stay empty. */
  aiProblems: string[];
}

function feed(memory: AiMemory, events: readonly GameEvent[]): AiMemory {
  let m = memory;
  for (const event of events) {
    const visible = redactEvent(event, m.seat);
    if (visible) m = observe(m, visible);
  }
  return m;
}

/**
 * Plays one all-NPC game exactly as a host would (docs/06 §6): each NPC decides from its own view and the redacted
 * events it was shown, through decideSafe; the engine re-validates every action; invariants are checked after each
 * step. Deterministic for a given seed and options.
 */
export function simulateGame(opts: SimGameOptions): SimGameResult {
  const maxTurns = opts.maxTurns ?? 1000;
  const config = {
    players: opts.difficulties.map((d, i) => ({ name: `Bot ${i + 1}`, isNpc: true, npcDifficulty: d })),
    characterMode: opts.characterMode ?? "random",
  };
  const created = createGame(config, opts.seed);
  let state = created.state;
  const seats = state.players.map((p) => p.seat);
  const rngs = seats.map((seat) => createRng(`${opts.seed}:npc:${seat}`));
  let memories = seats.map((seat) => feed(createMemory(toPlayerView(state, seat)), created.events));

  const violations: string[] = [];
  const aiProblems: string[] = [];
  let steps = 0;

  while (!state.winner) {
    if (state.turn.number > maxTurns) {
      violations.push(`no winner after ${maxTurns} turns`);
      break;
    }
    const seat = currentActor(state);
    if (seat === null) {
      violations.push("no actor while the game is running");
      break;
    }
    const memory = memories[seat];
    const rng = rngs[seat];
    const difficulty = opts.difficulties[seat];
    if (!memory || !rng || !difficulty) throw new Error(`simulateGame: no bot for seat ${seat}`);

    const view = toPlayerView(state, seat);
    const action = decideSafe(view, memory, difficulty, rng, opts.hard, (m) => aiProblems.push(`step ${steps}, seat ${seat}: ${m}`));
    let result;
    try {
      result = applyAction(state, seat, action);
    } catch (e) {
      violations.push(`step ${steps}: engine rejected ${JSON.stringify(action)}: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
    state = result.state;
    steps++;
    const events = result.events;
    memories = memories.map((m) => feed(m, events));

    const broken = checkInvariants(state);
    if (broken.length > 0) {
      violations.push(`step ${steps}: ${broken.join("; ")}`);
      break;
    }
  }

  return {
    seed: opts.seed,
    difficulties: opts.difficulties,
    roles: state.players.map((p) => p.role),
    winner: state.winner,
    turns: state.turn.number,
    steps,
    violations,
    aiProblems,
  };
}

/** Did `role` win this game? Dead teammates win too (docs/02 §8). */
export function roleWon(role: Role, winner: Winner | null): boolean {
  if (winner === "sheriff_team") return role === "sheriff" || role === "deputy";
  if (winner === "outlaws") return role === "outlaw";
  if (winner === "renegade") return role === "renegade";
  return false;
}
