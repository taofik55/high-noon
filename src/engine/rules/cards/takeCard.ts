import type { CardId } from "../../cards/types";
import type { GameState, Seat } from "../../state/types";
import type { Target } from "../actions";
import { emit, livingSeats, playerAt, takeRandomFromHand, type Ctx } from "../context";
import { effectiveDistance } from "../distance";
import type { CardHandler } from "./handler";

/**
 * Panic! / Cat Balou targets (docs/02 §6.5): another living player (R-13) with at least one card, either a random
 * hand card or one specific in-play card (Jail and Dynamite included). `maxDistance` null = any distance.
 */
function cardTargets(s: GameState, seat: Seat, maxDistance: number | null): Target[] {
  const targets: Target[] = [];
  for (const to of livingSeats(s)) {
    if (to === seat) continue;
    if (maxDistance !== null && effectiveDistance(s, seat, to) > maxDistance) continue;
    const victim = playerAt(s, to);
    if (victim.hand.length > 0) targets.push({ seat: to, fromHand: true });
    for (const cardId of victim.inPlay) targets.push({ seat: to, cardId });
  }
  return targets;
}

/** Removes the targeted card from the victim and reports whether it came from the hand. */
function removeTargetedCard(ctx: Ctx, target: Target | undefined): { victim: Seat; cardId: CardId; fromHand: boolean } {
  if (target?.seat === undefined) throw new Error("card-taking effect needs a target seat");
  const victim = playerAt(ctx.s, target.seat);
  if (target.fromHand) {
    // Random hand card: drawn with the game RNG so the attacker cannot choose it.
    const cardId = takeRandomFromHand(ctx, victim);
    if (cardId === null) throw new Error("targeted hand is empty");
    return { victim: victim.seat, cardId, fromHand: true };
  }
  const cardId = target.cardId;
  if (cardId === undefined || !victim.inPlay.includes(cardId)) throw new Error("targeted in-play card is missing");
  victim.inPlay.splice(victim.inPlay.indexOf(cardId), 1);
  return { victim: victim.seat, cardId, fromHand: false };
}

/** Panic!: steal from a player at effective distance 1, whatever the weapon (T-9). */
export const panicHandler: CardHandler = {
  playTargets: (s, seat) => cardTargets(s, seat, 1),
  play(ctx, seat, _cardId, target) {
    const { victim, cardId, fromHand } = removeTargetedCard(ctx, target);
    playerAt(ctx.s, seat).hand.push(cardId);
    emit(ctx, { t: "CARD_STOLEN", from: victim, to: seat, cardId, fromHand });
  },
};

/** Cat Balou: force a discard, any distance. The discarded card is public. */
export const catBalouHandler: CardHandler = {
  playTargets: (s, seat) => cardTargets(s, seat, null),
  play(ctx, _seat, _cardId, target) {
    const { victim, cardId } = removeTargetedCard(ctx, target);
    ctx.s.discard.push(cardId);
    emit(ctx, { t: "CARD_DISCARDED", seat: victim, cardIds: [cardId], reason: "cat_balou" });
  },
};
