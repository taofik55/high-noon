import type { CardId, CardType } from "../cards/types";
import type { CharacterId } from "../characters/data";
import type { Role, Seat, TurnPhase, Winner } from "../state/types";

export interface SeatPublic {
  seat: Seat;
  name: string;
  isNpc: boolean;
  /** null in choose_of_2 mode until CHARACTER_CHOSEN. */
  characterId: CharacterId | null;
}

export type DamageCause = "bang" | "gatling" | "indians" | "duel" | "dynamite";

export type DiscardReason =
  | "excess"
  | "eliminated"
  | "cat_balou"
  | "deputy_penalty"
  | "replaced"
  | "draw_check"
  | "sid_ketchum";

/**
 * Fine-grained, ordered events that drive the log and the 3D Director (docs/03 §2.5).
 * The engine returns them in order; the commit layer (server/adapter) assigns `seq`.
 * Some kinds are emitted only from later phases; they are declared here so consumers can be exhaustive.
 */
export type GameEvent =
  | { t: "GAME_STARTED"; seats: SeatPublic[] }
  /** Private to `seat`, except the Sheriff's (redactEvent, Phase 4). */
  | { t: "ROLE_ASSIGNED"; seat: Seat; role: Role }
  | { t: "CHARACTER_CHOSEN"; seat: Seat; characterId: CharacterId }
  | { t: "TURN_STARTED"; seat: Seat; turn: number }
  | { t: "PHASE"; seat: Seat; phase: TurnPhase }
  /** `cardIds` is private to the drawing seat. */
  | { t: "CARDS_DRAWN"; seat: Seat; count: number; cardIds: CardId[]; from: "deck" | "discard" | "player"; fromSeat?: Seat }
  | { t: "CARD_REVEALED"; seat: Seat; cardId: CardId; reason: "black_jack" }
  | {
      t: "DRAW_CHECK";
      seat: Seat;
      reason: "barrel" | "jourdonnais" | "jail" | "dynamite";
      cardIds: CardId[];
      chosen: CardId;
      success: boolean;
    }
  | { t: "CARD_PLAYED"; seat: Seat; cardId: CardId; asType?: CardType; target?: { seat?: Seat; cardId?: CardId; fromHand?: true } }
  | { t: "EQUIPPED"; seat: Seat; cardId: CardId; replaced?: CardId }
  | { t: "JAILED"; seat: Seat; by: Seat }
  | { t: "SHOT"; from: Seat; to: Seat; source: "bang" | "gatling" | "duel"; weapon: CardType | "colt45" }
  | { t: "MISSED"; seat: Seat; via: "missed" | "barrel" | "jourdonnais" | "calamity" }
  | { t: "DUEL_ROUND"; seat: Seat; discarded: CardId | null }
  | { t: "INDIANS_DEFENDED"; seat: Seat; cardId: CardId }
  | { t: "INDIANS_HIT"; seat: Seat }
  | { t: "DAMAGED"; seat: Seat; amount: number; source: Seat | null; cause: DamageCause }
  | { t: "HEALED"; seat: Seat; amount: number; cause: "beer" | "saloon" | "sid" }
  /** `cardId` is private to `from`/`to` when `fromHand`. */
  | { t: "CARD_STOLEN"; from: Seat; to: Seat; cardId?: CardId; fromHand: boolean }
  | { t: "CARD_DISCARDED"; seat: Seat; cardIds: CardId[]; reason: DiscardReason }
  | { t: "DYNAMITE_PASSED"; from: Seat; to: Seat }
  | { t: "DYNAMITE_EXPLODED"; seat: Seat }
  | { t: "JAIL_RESULT"; seat: Seat; escaped: boolean }
  | { t: "STORE_REVEALED"; cardIds: CardId[] }
  | { t: "STORE_PICKED"; seat: Seat; cardId: CardId }
  | { t: "ABILITY_USED"; seat: Seat; ability: CharacterId }
  | { t: "ELIMINATED"; seat: Seat; role: Role; killer: Seat | null }
  | { t: "REWARD"; seat: Seat; kind: "outlaw_bounty" | "deputy_penalty" }
  | { t: "DECK_RESHUFFLED"; size: number }
  | { t: "GAME_OVER"; winner: Winner; roles: Role[] };

export type GameEventType = GameEvent["t"];
