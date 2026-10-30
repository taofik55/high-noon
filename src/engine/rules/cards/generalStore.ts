import type { CardId } from "../../cards/types";
import type { Seat } from "../../state/types";
import { aliveCount, emit, othersClockwise, playerAt, pushPrompt, type Ctx } from "../context";
import { drawFromDeck } from "../draw";
import type { CardHandler } from "./handler";

/** docs/02 §6.6: reveal one card per living player; pick order starts with the player, clockwise. */
export const generalStoreHandler: CardHandler = {
  playTargets: () => null,
  play(ctx, seat) {
    const revealed: CardId[] = [];
    // R-31: if deck + discard run dry, fewer cards are revealed and the last pickers get nothing.
    for (let i = 0; i < aliveCount(ctx.s); i++) {
      const id = drawFromDeck(ctx);
      if (id === null) break;
      revealed.push(id);
    }
    if (revealed.length > 0) emit(ctx, { t: "STORE_REVEALED", cardIds: [...revealed] });
    continueStore(ctx, revealed, [seat, ...othersClockwise(ctx.s, seat)]);
  },
};

export function giveStoreCard(ctx: Ctx, seat: Seat, cardId: CardId): void {
  playerAt(ctx.s, seat).hand.push(cardId);
  emit(ctx, { t: "STORE_PICKED", seat, cardId });
}

/** Asks the next picker, or hands over the last card automatically (no choice left to make). */
export function continueStore(ctx: Ctx, revealed: CardId[], pickers: Seat[]): void {
  const [next, ...rest] = pickers;
  if (revealed.length === 0 || next === undefined) {
    // Unreachable while K = living players, but never let revealed cards vanish (80-card conservation).
    if (revealed.length > 0) ctx.s.discard.push(...revealed);
    return;
  }
  if (revealed.length === 1) {
    giveStoreCard(ctx, next, revealed[0] as CardId);
    return;
  }
  pushPrompt(ctx, { kind: "STORE_PICK", seat: next, revealed, order: rest });
}
