import type { CardId } from "../cards/types";
import { shuffle } from "../rng";
import type { Seat } from "../state/types";
import { emit, playerAt, type Ctx } from "./context";

/** R-8: an empty deck is rebuilt from the whole shuffled discard pile. Both empty → null (draw skipped, §4.5). */
export function drawFromDeck(ctx: Ctx): CardId | null {
  const { s } = ctx;
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.rng, s.discard);
    s.discard = [];
    emit(ctx, { t: "DECK_RESHUFFLED", size: s.deck.length });
  }
  return s.deck.shift() ?? null;
}

/** Draws up to `count` cards from the deck into the seat's hand. Returns the ids actually drawn. */
export function drawCards(ctx: Ctx, seat: Seat, count: number): CardId[] {
  const p = playerAt(ctx.s, seat);
  const drawn: CardId[] = [];
  for (let i = 0; i < count; i++) {
    const id = drawFromDeck(ctx);
    if (id === null) break;
    p.hand.push(id);
    drawn.push(id);
  }
  if (drawn.length > 0) emit(ctx, { t: "CARDS_DRAWN", seat, count: drawn.length, cardIds: drawn, from: "deck" });
  return drawn;
}
