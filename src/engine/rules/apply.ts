import { isBlueCard } from "../cards/cardData";
import { cardType } from "../cards/deck";
import type { CardId } from "../cards/types";
import { IllegalActionError } from "../errors";
import type { GameEvent } from "../events/types";
import type { GameState, Seat } from "../state/types";
import type { Action } from "./actions";
import { CARD_HANDLERS } from "./cards";
import { continueStore, giveStoreCard } from "./cards/generalStore";
import { duelShot } from "./cards/multi";
import { emit, playerAt, popPrompt, pushPrompt, takeFromHand, topPrompt, type Ctx } from "./context";
import { dealDamage, eliminate, heal } from "./damage";
import { resolveDrawChoice, resolveKitPick } from "./drawPhase";
import { whyIllegal } from "./legal";
import { advance } from "./turn";

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

/** Validates, applies and advances. Never mutates `state`; throws IllegalActionError with a reason. */
export function applyAction(state: GameState, seat: Seat, action: Action): ApplyResult {
  const reason = whyIllegal(state, seat, action);
  if (reason) throw new IllegalActionError(reason);
  const ctx: Ctx = { s: structuredClone(state), events: [] };
  resolveAction(ctx, seat, action);
  advance(ctx);
  return { state: ctx.s, events: ctx.events };
}

/**
 * R-25: Sid Ketchum discards 2 cards to regain 1 life. The current prompt stays open, except that a dying Sid back
 * at 1+ life is saved, and a pending discard-to-life count is recomputed (fewer cards, more life).
 */
function applySidKetchum(ctx: Ctx, seat: Seat, cardIds: CardId[]): void {
  const p = playerAt(ctx.s, seat);
  for (const cardId of cardIds) takeFromHand(p, cardId);
  ctx.s.discard.push(...cardIds);
  emit(ctx, { t: "ABILITY_USED", seat, ability: "sid_ketchum" });
  emit(ctx, { t: "CARD_DISCARDED", seat, cardIds, reason: "sid_ketchum" });
  heal(ctx, seat, 1, "sid");

  const prompt = topPrompt(ctx.s);
  if (prompt?.kind === "DYING" && p.life >= 1) popPrompt(ctx);
  if (prompt?.kind === "DISCARD_EXCESS") {
    const excess = p.hand.length - p.life;
    if (excess > 0) prompt.count = excess;
    else popPrompt(ctx);
  }
}

/** Moves a played/responded card from hand to the discard pile and announces it. */
function playFromHand(ctx: Ctx, seat: Seat, cardId: CardId): void {
  discardFromHand(ctx, seat, cardId);
  emit(ctx, { t: "CARD_PLAYED", seat, cardId });
}

/** Silent move to the discard pile; the caller emits the event that explains it (INDIANS_DEFENDED, DUEL_ROUNDâ€¦). */
function discardFromHand(ctx: Ctx, seat: Seat, cardId: CardId): void {
  takeFromHand(playerAt(ctx.s, seat), cardId);
  ctx.s.discard.push(cardId);
}

function resolveAction(ctx: Ctx, seat: Seat, action: Action): void {
  const { s } = ctx;
  const prompt = topPrompt(s);
  if (!prompt) throw new Error("resolveAction: empty stack");

  switch (action.type) {
    case "CHOOSE": {
      const choice = action.choice;
      if (prompt.kind === "CHOOSE_CHARACTER" && choice.kind === "character") {
        playerAt(s, seat).characterId = choice.characterId;
        emit(ctx, { t: "CHARACTER_CHOSEN", seat, characterId: choice.characterId });
        popPrompt(ctx);
        return;
      }
      if (prompt.kind === "STORE_PICK" && choice.kind === "store_card") {
        popPrompt(ctx);
        giveStoreCard(ctx, seat, choice.cardId);
        continueStore(ctx, prompt.revealed.filter((id) => id !== choice.cardId), prompt.order);
        return;
      }
      if (prompt.kind === "DRAW_CHOICE" && choice.kind === "draw") {
        resolveDrawChoice(ctx, seat, choice);
        return;
      }
      if (prompt.kind === "KIT_PICK" && choice.kind === "kit_return") {
        resolveKitPick(ctx, seat, prompt.cards, choice.cardId);
        return;
      }
      break;
    }

    case "PLAY_CARD": {
      const type = cardType(action.cardId);
      // Calamity Janet's Missed! played as BANG! resolves as a BANG! (R-19).
      const handler = CARD_HANDLERS[action.asType ?? type];
      if (!handler) break;
      takeFromHand(playerAt(s, seat), action.cardId);
      // Brown cards are discarded as they are played; blue cards are placed by their handler.
      if (!isBlueCard(type)) s.discard.push(action.cardId);
      const stats = s.stats[seat];
      if (stats) stats.cardsPlayed += 1;
      emit(ctx, {
        t: "CARD_PLAYED",
        seat,
        cardId: action.cardId,
        ...(action.asType ? { asType: action.asType } : {}),
        ...(action.target ? { target: action.target } : {}),
      });
      handler.play(ctx, seat, action.cardId, action.target);
      return;
    }

    case "ABILITY":
      applySidKetchum(ctx, seat, action.cardIds);
      return;

    case "END_TURN":
      popPrompt(ctx);
      return;

    case "RESPOND": {
      if (prompt.kind === "RESPOND_BANG") {
        for (const cardId of action.cardIds) {
          // A BANG! here can only be Calamity Janet's (R-19).
          const via = cardType(cardId) === "bang" ? "calamity" : "missed";
          playFromHand(ctx, seat, cardId);
          emit(ctx, { t: "MISSED", seat, via });
        }
        prompt.got += action.cardIds.length;
        if (prompt.got >= prompt.needed) popPrompt(ctx);
        return;
      }
      if (prompt.kind === "DYING") {
        for (const cardId of action.cardIds) {
          playFromHand(ctx, seat, cardId);
          heal(ctx, seat, 1, "beer");
        }
        if (playerAt(s, seat).life >= 1) popPrompt(ctx);
        return;
      }
      if (prompt.kind === "RESPOND_INDIANS") {
        const [cardId] = action.cardIds as [CardId];
        discardFromHand(ctx, seat, cardId);
        emit(ctx, { t: "INDIANS_DEFENDED", seat, cardId });
        popPrompt(ctx);
        return;
      }
      if (prompt.kind === "DUEL") {
        const [cardId] = action.cardIds as [CardId];
        discardFromHand(ctx, seat, cardId);
        emit(ctx, { t: "DUEL_ROUND", seat, discarded: cardId });
        popPrompt(ctx);
        // The ball is in the other duellist's court.
        pushPrompt(ctx, { kind: "DUEL", seat: prompt.opponent, opponent: seat, initiator: prompt.initiator });
        return;
      }
      break;
    }

    case "PASS": {
      if (prompt.kind === "RESPOND_BANG") {
        popPrompt(ctx);
        dealDamage(ctx, seat, 1, prompt.attacker, prompt.source);
        return;
      }
      if (prompt.kind === "RESPOND_INDIANS") {
        popPrompt(ctx);
        emit(ctx, { t: "INDIANS_HIT", seat });
        dealDamage(ctx, seat, 1, prompt.attacker, "indians");
        return;
      }
      if (prompt.kind === "DUEL") {
        popPrompt(ctx);
        emit(ctx, { t: "DUEL_ROUND", seat, discarded: null });
        duelShot(ctx, seat, prompt.opponent);
        // Â§6.4: the opponent is the damage source (kill credit, El Gringo).
        dealDamage(ctx, seat, 1, prompt.opponent, "duel");
        return;
      }
      if (prompt.kind === "DYING") {
        popPrompt(ctx);
        eliminate(ctx, seat, prompt.killer);
        return;
      }
      break;
    }

    case "DISCARD": {
      if (prompt.kind !== "DISCARD_EXCESS") break;
      const p = playerAt(s, seat);
      for (const cardId of action.cardIds) takeFromHand(p, cardId);
      s.discard.push(...action.cardIds);
      emit(ctx, { t: "CARD_DISCARDED", seat, cardIds: action.cardIds, reason: "excess" });
      popPrompt(ctx);
      return;
    }
  }
  // Unreachable when whyIllegal agrees with this dispatcher; fail loudly if they ever drift apart.
  throw new Error(`resolveAction: ${action.type} not handled for prompt ${prompt.kind}`);
}
