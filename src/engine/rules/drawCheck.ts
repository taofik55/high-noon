import { getCard } from "../cards/deck";
import type { Card, CardId } from "../cards/types";
import type { Seat } from "../state/types";
import { emit, hasAbility, playerAt, type Ctx } from "./context";
import { drawFromDeck } from "./draw";

export type DrawCheckReason = "barrel" | "jourdonnais" | "jail" | "dynamite";

/** Barrel, Jourdonnais and Jail succeed on Hearts (docs/02 §5). */
export const isHearts = (card: Card): boolean => card.suit === "hearts";

/** Dynamite explodes on Spades 2–9 (docs/02 §5). */
export const dynamiteExplodes = (card: Card): boolean => card.suit === "spades" && card.rank >= 2 && card.rank <= 9;

/**
 * The generic "draw!": reveal the top card(s), apply `isSuccess` to the card that counts, discard everything revealed.
 * Lucky Duke reveals 2 and keeps the one he prefers (R-23): every check has a dominant choice, so the engine picks it
 * for him (`wantSuccess` is false only for Dynamite, where "success" means it explodes).
 * R-33: if no card can be revealed (deck and discard both empty) the check fails and nothing is emitted.
 */
export function drawCheck(
  ctx: Ctx,
  seat: Seat,
  reason: DrawCheckReason,
  isSuccess: (card: Card) => boolean,
  wantSuccess = true,
): boolean {
  const count = hasAbility(playerAt(ctx.s, seat), "lucky_duke") ? 2 : 1;
  const revealed: CardId[] = [];
  for (let i = 0; i < count; i++) {
    const id = drawFromDeck(ctx);
    if (id === null) break;
    revealed.push(id);
  }
  const chosen = revealed.find((id) => isSuccess(getCard(id)) === wantSuccess) ?? revealed[0];
  if (chosen === undefined) return false;
  ctx.s.discard.push(...revealed);
  const success = isSuccess(getCard(chosen));
  emit(ctx, { t: "DRAW_CHECK", seat, reason, cardIds: revealed, chosen, success });
  return success;
}
