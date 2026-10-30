// Pure, deterministic Bang! rules engine: the single source of truth for game rules (Golden rules 1–2).
// Public API: docs/03 §2.1. toPlayerView, redactEvent and defaultActionOnTimeout arrive in Phase 4.

export { createGame, type CreateGameResult } from "./state/createGame";
export { applyAction, type ApplyResult } from "./rules/apply";
export { currentActor, expandLegalActions, getLegalActions, isActionLegal, whyIllegal } from "./rules/legal";
export { effectiveDistance, seatDistance, weaponRange } from "./rules/distance";
export { checkWinner } from "./rules/damage";
export { IllegalActionError } from "./errors";

export { ALL_CARDS, ALL_CARD_IDS, getCard, cardType, isCardId } from "./cards/deck";
export { COLT_45_RANGE, WEAPON_RANGE, isBlueCard, isWeapon } from "./cards/cardData";
export { CHARACTERS, CHARACTER_IDS } from "./characters/data";
export { ROLE_COUNTS, rolesFor, MIN_PLAYERS, MAX_PLAYERS } from "./state/roles";
export { createRng, nextUint32, pick, randomInt, shuffle, type RngState } from "./rng";

export type { Card, CardId, CardType, Rank, Suit } from "./cards/types";
export type { CharacterId, CharacterInfo } from "./characters/data";
export type {
  CharacterMode,
  GameConfig,
  GameState,
  NpcDifficulty,
  PlayerConfig,
  PlayerState,
  Prompt,
  PromptKind,
  Role,
  Seat,
  SeatStats,
  TurnPhase,
  TurnState,
  Winner,
} from "./state/types";
export type { DamageCause, DiscardReason, GameEvent, GameEventType, SeatPublic } from "./events/types";
export type { Action, ActionType, Choice, LegalAction, Target } from "./rules/actions";
