// Pure, deterministic Bang! rules engine: the single source of truth for game rules (Golden rules 1–2).
// Public API: docs/03 §2.1.

export { createGame, type CreateGameResult } from "./state/createGame";
export { toPlayerView, type PlayerView, type PublicPlayer, type ViewPrompt, type Viewer } from "./view/playerView";
export { redactEvent } from "./view/redact";
export { defaultActionFromLegal, defaultActionOnTimeout } from "./view/timeout";
export { applyAction, type ApplyResult } from "./rules/apply";
export { currentActor, expandLegalActions, getLegalActions, isActionLegal, matchLegal, whyIllegal } from "./rules/legal";
export {
  effectiveDistance,
  equippedWeapon,
  seatDistance,
  weaponRange,
  type DistancePlayer,
  type DistanceTable,
} from "./rules/distance";
export { checkInvariants } from "./debug/invariants";
export { checkWinner } from "./rules/damage";
export { IllegalActionError } from "./errors";

export { ALL_CARDS, ALL_CARD_IDS, getCard, cardType, isCardId } from "./cards/deck";
export { COLT_45_RANGE, WEAPON_RANGE, isBlueCard, isWeapon } from "./cards/cardData";
export { CHARACTERS, CHARACTER_IDS } from "./characters/data";
export { ROLE_COUNTS, rolesFor, MIN_PLAYERS, MAX_PLAYERS } from "./state/roles";
export { promptActor } from "./state/types";
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
export type { Action, ActionType, Choice, DrawSource, LegalAction, PlayAs, Target } from "./rules/actions";
