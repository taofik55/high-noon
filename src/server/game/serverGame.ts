import "server-only";
import { createMemory, decideSafe, observe, type AiMemory, type Difficulty } from "@/ai";
import {
  applyAction,
  createGame,
  createRng,
  defaultActionOnTimeout,
  redactEvent,
  toPlayerView,
  whyIllegal,
  type Action,
  type GameConfig,
  type GameEvent,
  type GameState,
  type RngState,
  type Seat,
} from "@/engine";

/**
 * What `games.state` holds online (docs/04: the full secret state, never readable by clients): the engine state plus
 * the bots' memories and RNG streams, which must survive between requests. Memories and RNGs exist for every seat so
 * a bot can take over an AFK human (docs/01 §5.2) with what that seat has legitimately seen.
 */
export interface ServerGame {
  schema: 1;
  game: GameState;
  ai: { memories: AiMemory[]; rngs: RngState[] };
}

/** Wall-clock guard for hard bots on the server (docs/06: 50 ms per decision). */
export const NPC_BUDGET_MS = 50;

export function newServerGame(config: GameConfig, seed: string, aiSeed: string): { sg: ServerGame; events: GameEvent[] } {
  const { state, events } = createGame(config, seed);
  const sg: ServerGame = {
    schema: 1,
    game: state,
    ai: {
      memories: state.players.map((_, seat) => createMemory(toPlayerView(state, seat))),
      rngs: state.players.map((_, seat) => createRng(`${aiSeed}:${seat}`)),
    },
  };
  return { sg: observeAll(sg, events), events };
}

/** Every seat's memory learns what that seat may see of these events, nothing more (Golden rule 9). */
function observeAll(sg: ServerGame, events: readonly GameEvent[]): ServerGame {
  const memories = sg.ai.memories.map((memory) => {
    let m = memory;
    for (const e of events) {
      const visible = redactEvent(e, m.seat);
      if (visible) m = observe(m, visible);
    }
    return m;
  });
  return { ...sg, ai: { ...sg.ai, memories } };
}

/** Applies an already validated action. Throws IllegalActionError otherwise (the caller validates first). */
export function advance(sg: ServerGame, seat: Seat, action: Action): { sg: ServerGame; events: GameEvent[] } {
  const result = applyAction(sg.game, seat, action);
  return { sg: observeAll({ ...sg, game: result.state }, result.events), events: result.events };
}

/**
 * A bot's choice for `seat`, from that seat's own view only (Golden rule 9). An illegal pick (a bug) falls back to
 * the timeout default so the game never stalls.
 */
export function decideFor(sg: ServerGame, seat: Seat, difficulty: Difficulty, now: () => number): { action: Action; sg: ServerGame } {
  const memory = sg.ai.memories[seat];
  const stored = sg.ai.rngs[seat];
  if (!memory || !stored) throw new Error(`no bot state for seat ${seat}`);
  const rng: RngState = [...stored];
  const picked = decideSafe(toPlayerView(sg.game, seat), memory, difficulty, rng, { now, budgetMs: NPC_BUDGET_MS }, (m) =>
    console.warn(`[ai] seat ${seat}: ${m}`),
  );
  const action = whyIllegal(sg.game, seat, picked) === null ? picked : defaultActionOnTimeout(sg.game, seat);
  const rngs = sg.ai.rngs.map((r, i) => (i === seat ? rng : r));
  return { action, sg: { ...sg, ai: { ...sg.ai, rngs } } };
}

/** Older rows (Phase 10 starts) stored the bare GameState; give them fresh bot state rather than failing. */
export function readServerGame(stored: unknown): ServerGame {
  const value = stored as Partial<ServerGame> & Partial<GameState>;
  if (value.schema === 1 && value.game && value.ai) return value as ServerGame;
  const game = stored as GameState;
  return {
    schema: 1,
    game,
    ai: {
      memories: game.players.map((_, seat) => createMemory(toPlayerView(game, seat))),
      rngs: game.players.map((_, seat) => createRng(`legacy:${seat}:${game.turn.number}`)),
    },
  };
}
