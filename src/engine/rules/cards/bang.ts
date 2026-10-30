import type { GameState, PlayerState, Seat } from "../../state/types";
import type { Target } from "../actions";
import { startBangResponse } from "../bangResponse";
import { emit, hasAbility, livingSeats, playerAt } from "../context";
import { effectiveDistance, equippedWeapon, weaponRange } from "../distance";
import type { CardHandler } from "./handler";

/** Base limit (§4.3). */
const BANGS_PER_TURN = 1;

/** Volcanic (T-10) and Willy the Kid (R-29) lift the limit. */
function unlimitedBang(p: PlayerState): boolean {
  return equippedWeapon(p) === "volcanic" || hasAbility(p, "willy_the_kid");
}

/**
 * Targets for a BANG! — also used for Calamity Janet's Missed! played as BANG!, which counts toward the limit and
 * obeys range like a real one (R-19).
 */
export function bangTargets(s: GameState, seat: Seat): Target[] | false {
  const p = playerAt(s, seat);
  if (s.turn.bangsPlayed >= BANGS_PER_TURN && !unlimitedBang(p)) return false;
  const range = weaponRange(p);
  return livingSeats(s)
    .filter((to) => to !== seat && effectiveDistance(s, seat, to) <= range)
    .map((to) => ({ seat: to }));
}

export const bangHandler: CardHandler = {
  playTargets: (s, seat) => bangTargets(s, seat),

  play(ctx, seat, _cardId, target) {
    const to = target?.seat;
    if (to === undefined) throw new Error("BANG! needs a target seat");
    ctx.s.turn.bangsPlayed += 1;
    const attacker = playerAt(ctx.s, seat);
    emit(ctx, { t: "SHOT", from: seat, to, source: "bang", weapon: equippedWeapon(attacker) ?? "colt45" });
    // R-26: Slab the Killer's BANG! cards need 2 Missed! effects.
    const needed = hasAbility(attacker, "slab_the_killer") ? 2 : 1;
    // The target is always prompted unless a Barrel already cancelled the hit: skipping the prompt otherwise would
    // leak that their hand holds no Missed! (Golden rule 4).
    startBangResponse(ctx, to, seat, "bang", needed);
  },
};
