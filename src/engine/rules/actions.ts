import type { CardId } from "../cards/types";
import type { CharacterId } from "../characters/data";
import type { Seat } from "../state/types";

/**
 * `{ seat }` targets a player. Panic! / Cat Balou name the card too: `{ seat, fromHand: true }` = a random hand card,
 * `{ seat, cardId }` = that in-play card. This keeps them one atomic action (no follow-up prompt, docs/03 §2.4).
 */
export interface Target {
  seat?: Seat;
  cardId?: CardId;
  fromHand?: true;
}

/** Where Jesse Jones / Pedro Ramirez take their first card from. */
export type DrawSource = "deck" | "discard" | "player";

export type Choice =
  | { kind: "character"; characterId: CharacterId }
  | { kind: "store_card"; cardId: CardId }
  /** `seat` only with `from: "player"` (Jesse Jones). */
  | { kind: "draw"; from: DrawSource; seat?: Seat }
  /** Kit Carlson: the card that goes back on top of the deck. */
  | { kind: "kit_return"; cardId: CardId };

/** Calamity Janet plays Missed! as BANG! (R-19). */
export type PlayAs = "bang";

/** What a client (human or NPC) sends. Validated against getLegalActions before anything changes. */
export type Action =
  | { type: "PLAY_CARD"; cardId: CardId; asType?: PlayAs; target?: Target }
  | { type: "RESPOND"; cardIds: CardId[] }
  | { type: "PASS" }
  | { type: "CHOOSE"; choice: Choice }
  | { type: "ABILITY"; ability: "sid_ketchum"; cardIds: CardId[] }
  | { type: "END_TURN" }
  | { type: "DISCARD"; cardIds: CardId[] };

export type ActionType = Action["type"];

/**
 * Legal actions are descriptors rather than every concrete action: "discard any 2 of these 6 cards" would
 * otherwise explode combinatorially. Use `isActionLegal` to validate and `expandLegalActions` to enumerate.
 */
export type LegalAction =
  /** `targets: null` = played without a target; otherwise the action must name exactly one of `targets`. */
  | { type: "PLAY_CARD"; cardId: CardId; asType?: PlayAs; targets: Target[] | null }
  /** Respond with exactly `count` distinct cards from `cardIds`. */
  | { type: "RESPOND"; cardIds: CardId[]; count: number }
  | { type: "PASS" }
  | { type: "CHOOSE"; choices: Choice[] }
  /** Sid Ketchum: discard exactly `count` (2) distinct cards from `cardIds` to regain 1 life (R-25). */
  | { type: "ABILITY"; ability: "sid_ketchum"; cardIds: CardId[]; count: number }
  | { type: "END_TURN" }
  /** Discard exactly `count` distinct cards from `cardIds`. */
  | { type: "DISCARD"; cardIds: CardId[]; count: number };
