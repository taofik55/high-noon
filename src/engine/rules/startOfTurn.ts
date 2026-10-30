import type { CardId } from "../cards/types";
import type { Seat } from "../state/types";
import { emit, hasCardType, inPlayOfType, playerAt, removeFromPlay, type Ctx } from "./context";
import { dealDamage } from "./damage";
import { drawCheck, dynamiteExplodes, isHearts } from "./drawCheck";

export type StartOfTurnOutcome = "continue" | "checked" | "skip_turn";

/**
 * One step of the start-of-turn checks (§4.1): Dynamite first, then Jail. Each check consumes its card (Dynamite
 * explodes or moves on, Jail is always discarded), so the caller can simply call this again after a DYING prompt
 * interrupted the turn: nothing is ever checked twice.
 *  - "checked": a check ran; call again (the player may now be dying or dead, R-5).
 *  - "skip_turn": Jail held: no draw, play or discard phase.
 *  - "continue": no checks left; go on to the draw phase.
 */
export function startOfTurnStep(ctx: Ctx, seat: Seat): StartOfTurnOutcome {
  const p = playerAt(ctx.s, seat);
  const dynamite = inPlayOfType(p, "dynamite");
  if (dynamite) {
    resolveDynamite(ctx, seat, dynamite);
    return "checked";
  }
  const jail = inPlayOfType(p, "jail");
  if (jail) return resolveJail(ctx, seat, jail) ? "checked" : "skip_turn";
  return "continue";
}

function resolveDynamite(ctx: Ctx, seat: Seat, dynamite: CardId): void {
  const p = playerAt(ctx.s, seat);
  removeFromPlay(p, dynamite);
  if (drawCheck(ctx, seat, "dynamite", dynamiteExplodes)) {
    ctx.s.discard.push(dynamite);
    emit(ctx, { t: "DYNAMITE_EXPLODED", seat });
    // R-3: Dynamite has no killer, so no reward or penalty can follow.
    dealDamage(ctx, seat, 3, null, "dynamite");
    return;
  }
  const to = nextDynamiteHolder(ctx, seat);
  if (to === null) {
    // Unreachable with one Dynamite in the deck; discarding keeps the start-of-turn loop finite.
    ctx.s.discard.push(dynamite);
    return;
  }
  playerAt(ctx.s, to).inPlay.push(dynamite);
  emit(ctx, { t: "DYNAMITE_PASSED", from: seat, to });
}

/** Next living player on the left (clockwise) who has no Dynamite yet (R-4). */
function nextDynamiteHolder(ctx: Ctx, from: Seat): Seat | null {
  const n = ctx.s.players.length;
  for (let i = 1; i < n; i++) {
    const p = playerAt(ctx.s, (from + i) % n);
    if (p.alive && !hasCardType(p, "dynamite")) return p.seat;
  }
  return null;
}

/** Returns true if the player escapes (Hearts). Jail is discarded either way. */
function resolveJail(ctx: Ctx, seat: Seat, jail: CardId): boolean {
  // Check first, discard after: the Jail must not be reshuffled into its own draw! (R-8).
  const escaped = drawCheck(ctx, seat, "jail", isHearts);
  removeFromPlay(playerAt(ctx.s, seat), jail);
  ctx.s.discard.push(jail);
  emit(ctx, { t: "JAIL_RESULT", seat, escaped });
  return escaped;
}
