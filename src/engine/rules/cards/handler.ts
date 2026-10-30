import type { CardId } from "../../cards/types";
import type { GameState, Seat } from "../../state/types";
import type { Target } from "../actions";
import type { Ctx } from "../context";

export interface CardHandler {
  /**
   * Whether the card can be played from hand in the play phase, and how it is targeted.
   * `null` = playable without target; a non-empty array = pick one target; `false` or `[]` = not playable now.
   */
  playTargets(s: GameState, seat: Seat, cardId: CardId): Target[] | null | false;
  /** Resolves the effect. The card has already left the hand and CARD_PLAYED was emitted. */
  play(ctx: Ctx, seat: Seat, cardId: CardId, target: Target | undefined): void;
}
