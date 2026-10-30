import type { CardId } from "../cards/types";
import type { CharacterId } from "../characters/data";
import type { Seat } from "../state/types";

export interface Target {
  seat?: Seat;
  cardId?: CardId;
  fromHand?: true;
}

export type Choice = { kind: "character"; characterId: CharacterId };

/** What a client (human or NPC) sends. Validated against getLegalActions before anything changes. */
export type Action =
  | { type: "PLAY_CARD"; cardId: CardId; target?: Target }
  | { type: "RESPOND"; cardIds: CardId[] }
  | { type: "PASS" }
  | { type: "CHOOSE"; choice: Choice }
  | { type: "END_TURN" }
  | { type: "DISCARD"; cardIds: CardId[] };

export type ActionType = Action["type"];

/**
 * Legal actions are descriptors rather than every concrete action: "discard any 2 of these 6 cards" would
 * otherwise explode combinatorially. Use `isActionLegal` to validate and `expandLegalActions` to enumerate.
 */
export type LegalAction =
  /** `targets: null` = played without a target; otherwise the action must name exactly one of `targets`. */
  | { type: "PLAY_CARD"; cardId: CardId; targets: Target[] | null }
  /** Respond with exactly `count` distinct cards from `cardIds`. */
  | { type: "RESPOND"; cardIds: CardId[]; count: number }
  | { type: "PASS" }
  | { type: "CHOOSE"; choices: Choice[] }
  | { type: "END_TURN" }
  /** Discard exactly `count` distinct cards from `cardIds`. */
  | { type: "DISCARD"; cardIds: CardId[]; count: number };
