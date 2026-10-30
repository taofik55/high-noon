import type { CardId } from "../cards/types";
import type { CharacterId } from "../characters/data";
import type { RngState } from "../rng";

/** Seat index 0..n-1, clockwise. */
export type Seat = number;

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";

export type NpcDifficulty = "easy" | "medium" | "hard";

export type CharacterMode = "random" | "choose_of_2";

export interface PlayerConfig {
  name: string;
  isNpc: boolean;
  npcDifficulty?: NpcDifficulty;
}

export interface GameConfig {
  /** In seat order (clockwise). Seating is shuffled by the caller (room start), not by the engine. */
  players: PlayerConfig[];
  characterMode: CharacterMode;
}

export interface PlayerState {
  seat: Seat;
  name: string;
  /** null only during the choose_of_2 setup, before this player has picked. */
  characterId: CharacterId | null;
  role: Role;
  /** May go below 0 internally on multi-point damage (R-14); views clamp at 0. */
  life: number;
  maxLife: number;
  hand: CardId[];
  inPlay: CardId[];
  alive: boolean;
  isNpc: boolean;
  npcDifficulty?: NpcDifficulty;
}

export type TurnPhase = "setup" | "start" | "draw" | "play" | "discard";

export interface TurnState {
  seat: Seat;
  /** 0 during setup, 1 for the Sheriff's first turn. */
  number: number;
  phase: TurnPhase;
  bangsPlayed: number;
}

export type Winner = "sheriff_team" | "outlaws" | "renegade";

export interface SeatStats {
  damageDealt: number;
  kills: number;
  cardsPlayed: number;
}

/**
 * Pending interactions; the top of the stack is the last element (docs/03 §2.3).
 * Prompts with a `seat` wait for that player; driver prompts (no `seat`) are resolved by advance().
 */
export type Prompt =
  | { kind: "CHOOSE_CHARACTER"; seat: Seat; options: [CharacterId, CharacterId] }
  | { kind: "PLAY"; seat: Seat }
  | { kind: "RESPOND_BANG"; seat: Seat; attacker: Seat; source: "bang" | "gatling"; needed: number; got: number }
  | { kind: "RESPOND_INDIANS"; seat: Seat; attacker: Seat }
  /** `seat` must discard a BANG! or lose 1 life to `opponent`. */
  | { kind: "DUEL"; seat: Seat; opponent: Seat; initiator: Seat }
  /** `revealed` cards are off every zone until picked; `order` = pickers after `seat`. */
  | { kind: "STORE_PICK"; seat: Seat; revealed: CardId[]; order: Seat[] }
  | { kind: "DYING"; seat: Seat; killer: Seat | null }
  | { kind: "DISCARD_EXCESS"; seat: Seat; count: number }
  /** Driver for Gatling / Indians!: hits `remaining` one at a time, clockwise from the attacker's left (R-11). */
  | { kind: "MULTI_TARGET"; attacker: Seat; source: "gatling" | "indians"; remaining: Seat[] };

export type PromptKind = Prompt["kind"];

/** The seat a prompt waits for, or null for driver prompts. */
export function promptActor(prompt: Prompt): Seat | null {
  return "seat" in prompt ? prompt.seat : null;
}

export interface GameState {
  schemaVersion: 1;
  config: GameConfig;
  rng: RngState;
  /** deck[0] is the top card. Card data is static (cards/deck.ts); state only holds ids. */
  deck: CardId[];
  /** The last element is the top (visible) card. */
  discard: CardId[];
  players: PlayerState[];
  turn: TurnState;
  stack: Prompt[];
  winner: Winner | null;
  /** Indexed by seat. */
  stats: SeatStats[];
}
