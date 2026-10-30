import { getCard } from "../cards/deck";
import type { CardId } from "../cards/types";
import type { GameState, Seat } from "../state/types";
import type { Choice } from "./actions";
import { emit, hasAbility, livingSeats, playerAt, popPrompt, pushPrompt, setPhase, takeRandomFromHand, type Ctx } from "./context";
import { drawCards, drawFromDeck } from "./draw";

/**
 * Draw-phase alternatives for Jesse Jones (R-21: a random card from another player's hand) and Pedro Ramirez (R-24:
 * the top of the discard pile). Both are optional, so "deck" is always included; an empty list means "no choice".
 */
export function drawChoices(s: GameState, seat: Seat): Choice[] {
  const p = playerAt(s, seat);
  const choices: Choice[] = [];
  if (hasAbility(p, "jesse_jones")) {
    for (const other of livingSeats(s)) {
      if (other !== seat && playerAt(s, other).hand.length > 0) choices.push({ kind: "draw", from: "player", seat: other });
    }
  }
  if (hasAbility(p, "pedro_ramirez") && s.discard.length > 0) choices.push({ kind: "draw", from: "discard" });
  return choices.length > 0 ? [{ kind: "draw", from: "deck" }, ...choices] : [];
}

/** Phase 1 of a turn (§4.2), including the character variants. Ends by opening the play phase or asking a prompt. */
export function startDrawPhase(ctx: Ctx, seat: Seat): void {
  const p = playerAt(ctx.s, seat);

  if (drawChoices(ctx.s, seat).length > 0) {
    pushPrompt(ctx, { kind: "DRAW_CHOICE", seat });
    return;
  }

  if (hasAbility(p, "kit_carlson")) {
    // R-22: look at the top 3 (fewer if deck + discard run short), keep 2, put 1 back on top.
    const cards: CardId[] = [];
    for (let i = 0; i < 3; i++) {
      const id = drawFromDeck(ctx);
      if (id === null) break;
      cards.push(id);
    }
    if (cards.length === 3) {
      pushPrompt(ctx, { kind: "KIT_PICK", seat, cards });
      return;
    }
    keep(ctx, seat, cards);
    beginPlayPhase(ctx, seat);
    return;
  }

  if (hasAbility(p, "black_jack")) {
    // R-18: the second card is shown; Hearts/Diamonds earn one more (not shown).
    const drawn = drawCards(ctx, seat, 2);
    const second = drawn[1];
    if (second !== undefined) {
      emit(ctx, { t: "CARD_REVEALED", seat, cardId: second, reason: "black_jack" });
      const suit = getCard(second).suit;
      if (suit === "hearts" || suit === "diamonds") drawCards(ctx, seat, 1);
    }
    beginPlayPhase(ctx, seat);
    return;
  }

  drawCards(ctx, seat, 2);
  beginPlayPhase(ctx, seat);
}

export function beginPlayPhase(ctx: Ctx, seat: Seat): void {
  setPhase(ctx, "play");
  pushPrompt(ctx, { kind: "PLAY", seat });
}

function keep(ctx: Ctx, seat: Seat, cards: CardId[]): void {
  if (cards.length === 0) return;
  playerAt(ctx.s, seat).hand.push(...cards);
  emit(ctx, { t: "CARDS_DRAWN", seat, count: cards.length, cardIds: cards, from: "deck" });
}

/** Resolves DRAW_CHOICE: the first card from the chosen source, the second from the deck. */
export function resolveDrawChoice(ctx: Ctx, seat: Seat, choice: Extract<Choice, { kind: "draw" }>): void {
  popPrompt(ctx);
  const p = playerAt(ctx.s, seat);
  if (choice.from === "deck") {
    drawCards(ctx, seat, 2);
  } else if (choice.from === "discard") {
    const top = ctx.s.discard.pop();
    if (top === undefined) throw new Error("Pedro Ramirez: discard pile is empty");
    p.hand.push(top);
    emit(ctx, { t: "CARDS_DRAWN", seat, count: 1, cardIds: [top], from: "discard" });
    drawCards(ctx, seat, 1);
  } else {
    if (choice.seat === undefined) throw new Error("Jesse Jones: no player chosen");
    const cardId = takeRandomFromHand(ctx, playerAt(ctx.s, choice.seat));
    if (cardId === null) throw new Error("Jesse Jones: chosen hand is empty");
    p.hand.push(cardId);
    emit(ctx, { t: "CARDS_DRAWN", seat, count: 1, cardIds: [cardId], from: "player", fromSeat: choice.seat });
    drawCards(ctx, seat, 1);
  }
  beginPlayPhase(ctx, seat);
}

/** Resolves KIT_PICK: `returned` goes back on top of the deck, the other two go to Kit's hand. */
export function resolveKitPick(ctx: Ctx, seat: Seat, cards: CardId[], returned: CardId): void {
  popPrompt(ctx);
  keep(
    ctx,
    seat,
    cards.filter((id) => id !== returned),
  );
  ctx.s.deck.unshift(returned);
  beginPlayPhase(ctx, seat);
}
