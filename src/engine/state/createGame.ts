import { ALL_CARD_IDS } from "../cards/deck";
import { CHARACTER_IDS, type CharacterId } from "../characters/data";
import type { GameEvent } from "../events/types";
import { createRng, shuffle } from "../rng";
import { emit, pushPrompt, type Ctx } from "../rules/context";
import { advance } from "../rules/turn";
import { MAX_PLAYERS, MIN_PLAYERS, rolesFor } from "./roles";
import type { GameConfig, GameState, PlayerState, Role, Seat } from "./types";

export interface CreateGameResult {
  state: GameState;
  events: GameEvent[];
}

function validateConfig(config: GameConfig): void {
  const n = config.players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`createGame: need ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${n}`);
  config.players.forEach((p, seat) => {
    if (p.name.trim() === "") throw new Error(`createGame: seat ${seat} has an empty name`);
  });
}

/**
 * docs/02 §2. Roles and the deck are shuffled with the seeded RNG; seats keep the config order.
 * In "choose_of_2" mode each player gets a CHOOSE_CHARACTER prompt (Sheriff first, then clockwise) and life and
 * hands are dealt only after everyone has chosen.
 */
export function createGame(config: GameConfig, seed: string): CreateGameResult {
  validateConfig(config);
  const rng = createRng(seed);
  const n = config.players.length;
  const roles = shuffle(rng, rolesFor(n));
  const characters = shuffle(rng, [...CHARACTER_IDS]);
  const deck = shuffle(rng, [...ALL_CARD_IDS]);
  const choose = config.characterMode === "choose_of_2";

  const players: PlayerState[] = config.players.map((pc, seat) => ({
    seat,
    name: pc.name.trim(),
    characterId: choose ? null : (characters[seat] as CharacterId),
    role: roles[seat] as Role, // rolesFor(n) has exactly n entries
    life: 0,
    maxLife: 0,
    hand: [],
    inPlay: [],
    alive: true,
    isNpc: pc.isNpc,
    ...(pc.npcDifficulty ? { npcDifficulty: pc.npcDifficulty } : {}),
  }));
  const sheriffSeat = players.findIndex((p) => p.role === "sheriff");

  const state: GameState = {
    schemaVersion: 1,
    config: structuredClone(config),
    rng,
    deck,
    discard: [],
    players,
    turn: { seat: sheriffSeat, number: 0, phase: "setup", bangsPlayed: 0 },
    stack: [],
    winner: null,
    stats: players.map(() => ({ damageDealt: 0, kills: 0, cardsPlayed: 0 })),
  };
  const ctx: Ctx = { s: state, events: [] };

  emit(ctx, {
    t: "GAME_STARTED",
    seats: players.map((p) => ({ seat: p.seat, name: p.name, isNpc: p.isNpc, characterId: p.characterId })),
  });
  for (const p of players) emit(ctx, { t: "ROLE_ASSIGNED", seat: p.seat, role: p.role });

  if (choose) {
    const order: Seat[] = Array.from({ length: n }, (_, i) => (sheriffSeat + i) % n);
    // Pushed in reverse so the Sheriff's prompt is on top and choices go clockwise.
    for (let i = n - 1; i >= 0; i--) {
      const seat = order[i] as Seat;
      const options: [CharacterId, CharacterId] = [characters[2 * i] as CharacterId, characters[2 * i + 1] as CharacterId];
      pushPrompt(ctx, { kind: "CHOOSE_CHARACTER", seat, options });
    }
  }

  advance(ctx);
  return { state: ctx.s, events: ctx.events };
}
