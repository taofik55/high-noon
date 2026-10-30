import type { DamageCause } from "../events/types";
import { promptActor, type GameState, type PlayerState, type Seat, type Winner } from "../state/types";
import { emit, hasAbility, playerAt, pushPrompt, takeRandomFromHand, type Ctx } from "./context";
import { drawCards } from "./draw";

export function dealDamage(ctx: Ctx, seat: Seat, amount: number, source: Seat | null, cause: DamageCause): void {
  const p = playerAt(ctx.s, seat);
  p.life -= amount;
  if (source !== null && source !== seat) {
    const stats = ctx.s.stats[source];
    if (stats) stats.damageDealt += amount;
  }
  emit(ctx, { t: "DAMAGED", seat, amount, source, cause });

  // R-17: Bart Cassidy draws one card per life point lost, any source, before the dying check (a drawn Beer can
  // save him).
  if (hasAbility(p, "bart_cassidy")) drawCards(ctx, seat, amount);

  // R-20: El Gringo takes one random card per life point from the hand of the player whose card hurt him. Not for
  // Dynamite, and not if the hit brings him to 0 or below (he is being eliminated by it).
  if (hasAbility(p, "el_gringo") && cause !== "dynamite" && source !== null && source !== seat && p.life >= 1) {
    const attacker = playerAt(ctx.s, source);
    if (attacker.alive) {
      for (let i = 0; i < amount; i++) {
        const cardId = takeRandomFromHand(ctx, attacker);
        if (cardId === null) break;
        p.hand.push(cardId);
        emit(ctx, { t: "CARD_STOLEN", from: source, to: seat, cardId, fromHand: true });
      }
    }
  }

  // §7.1: at 0 or below the player is dying and may still save themselves; R-14 allows negative life.
  if (p.life <= 0) pushPrompt(ctx, { kind: "DYING", seat, killer: source });
}

export function heal(ctx: Ctx, seat: Seat, amount: number, cause: "beer" | "saloon" | "sid"): void {
  const p = playerAt(ctx.s, seat);
  const healed = Math.min(amount, p.maxLife - p.life);
  if (healed <= 0) return;
  p.life += healed;
  emit(ctx, { t: "HEALED", seat, amount: healed, cause });
}

/**
 * §7.2–7.5: reveal the role; Vulture Sam takes the cards, otherwise they are discarded; check the win condition at
 * once; only then rewards and penalties (R-15: pickup before rewards; a finished game cancels everything else).
 */
export function eliminate(ctx: Ctx, seat: Seat, killer: Seat | null): void {
  const { s } = ctx;
  const p = playerAt(s, seat);
  p.alive = false;
  p.life = 0;
  emit(ctx, { t: "ELIMINATED", seat, role: p.role, killer });

  if (killer !== null && killer !== seat) {
    const stats = s.stats[killer];
    if (stats) stats.kills += 1;
  }

  dropCards(ctx, p);

  // A dead player can no longer act; this also ends their own turn (R-16) because their PLAY prompt goes away.
  // Multi-target drivers skip dead seats when they resolve.
  s.stack = s.stack.filter((prompt) => promptActor(prompt) !== seat);

  const winner = checkWinner(s);
  if (winner) {
    endGame(ctx, winner);
    return;
  }
  // R-3: no killer (Dynamite) means no reward or penalty.
  if (killer !== null && killer !== seat) applyKillConsequences(ctx, p, playerAt(s, killer));
}

/** R-28: Vulture Sam (alive, not the victim) takes every card of the eliminated player into his hand. */
function dropCards(ctx: Ctx, p: PlayerState): void {
  const { s } = ctx;
  const hand = p.hand;
  const inPlay = p.inPlay;
  p.hand = [];
  p.inPlay = [];
  if (hand.length + inPlay.length === 0) return;

  const vulture = s.players.find((other) => other.seat !== p.seat && hasAbility(other, "vulture_sam"));
  if (vulture) {
    vulture.hand.push(...hand, ...inPlay);
    emit(ctx, { t: "CARDS_INHERITED", seat: vulture.seat, from: p.seat, handCount: hand.length, handCardIds: hand, inPlay });
    return;
  }
  const cards = [...hand, ...inPlay];
  s.discard.push(...cards);
  emit(ctx, { t: "CARD_DISCARDED", seat: p.seat, cardIds: cards, reason: "eliminated" });
}

/** §7.4: killing an Outlaw pays 3 cards (whoever the killer is); the Sheriff killing a Deputy loses every card. */
function applyKillConsequences(ctx: Ctx, victim: PlayerState, killer: PlayerState): void {
  if (!killer.alive) return;
  if (victim.role === "outlaw") {
    emit(ctx, { t: "REWARD", seat: killer.seat, kind: "outlaw_bounty" });
    drawCards(ctx, killer.seat, 3);
    return;
  }
  if (victim.role === "deputy" && killer.role === "sheriff") {
    emit(ctx, { t: "REWARD", seat: killer.seat, kind: "deputy_penalty" });
    const cards = [...killer.hand, ...killer.inPlay];
    killer.hand = [];
    killer.inPlay = [];
    if (cards.length > 0) {
      ctx.s.discard.push(...cards);
      emit(ctx, { t: "CARD_DISCARDED", seat: killer.seat, cardIds: cards, reason: "deputy_penalty" });
    }
  }
}

/** docs/02 §8. */
export function checkWinner(s: GameState): Winner | null {
  const alive = s.players.filter((p) => p.alive);
  const sheriffAlive = alive.some((p) => p.role === "sheriff");
  if (!sheriffAlive) {
    const onlyRenegadeLeft = alive.length === 1 && alive[0]?.role === "renegade";
    return onlyRenegadeLeft ? "renegade" : "outlaws";
  }
  const banditsAlive = alive.some((p) => p.role === "outlaw" || p.role === "renegade");
  return banditsAlive ? null : "sheriff_team";
}

function endGame(ctx: Ctx, winner: Winner): void {
  const { s } = ctx;
  s.winner = winner;
  s.stack = [];
  emit(ctx, { t: "GAME_OVER", winner, roles: s.players.map((p) => p.role) });
}
