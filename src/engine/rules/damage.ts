import type { DamageCause } from "../events/types";
import { promptActor, type GameState, type Seat, type Winner } from "../state/types";
import { emit, playerAt, pushPrompt, type Ctx } from "./context";

export function dealDamage(ctx: Ctx, seat: Seat, amount: number, source: Seat | null, cause: DamageCause): void {
  const p = playerAt(ctx.s, seat);
  p.life -= amount;
  if (source !== null && source !== seat) {
    const stats = ctx.s.stats[source];
    if (stats) stats.damageDealt += amount;
  }
  emit(ctx, { t: "DAMAGED", seat, amount, source, cause });
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

/** §7.2: reveal role, drop every card, then check the win condition at once (§7.5). */
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

  const cards = [...p.hand, ...p.inPlay];
  p.hand = [];
  p.inPlay = [];
  if (cards.length > 0) {
    s.discard.push(...cards);
    emit(ctx, { t: "CARD_DISCARDED", seat, cardIds: cards, reason: "eliminated" });
  }

  // A dead player can no longer act; this also ends their own turn (R-16) because their PLAY prompt goes away.
  // Multi-target drivers skip dead seats when they resolve.
  s.stack = s.stack.filter((prompt) => promptActor(prompt) !== seat);

  const winner = checkWinner(s);
  if (winner) endGame(ctx, winner);
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
