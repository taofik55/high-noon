import type { PlayerState } from "../../state/types";
import { startBangResponse } from "../bangResponse";
import { emit, livingSeats, playerAt } from "../context";
import { effectiveDistance, equippedWeapon, weaponRange } from "../distance";
import type { CardHandler } from "./handler";

/** Base limit (§4.3). */
const BANGS_PER_TURN = 1;

/** Volcanic lifts the limit (T-10); Willy the Kid joins in Phase 4 (R-29). */
function unlimitedBang(p: PlayerState): boolean {
  return equippedWeapon(p) === "volcanic";
}

export const bangHandler: CardHandler = {
  playTargets(s, seat) {
    const p = playerAt(s, seat);
    if (s.turn.bangsPlayed >= BANGS_PER_TURN && !unlimitedBang(p)) return false;
    const range = weaponRange(p);
    return livingSeats(s)
      .filter((to) => to !== seat && effectiveDistance(s, seat, to) <= range)
      .map((to) => ({ seat: to }));
  },

  play(ctx, seat, _cardId, target) {
    const to = target?.seat;
    if (to === undefined) throw new Error("BANG! needs a target seat");
    ctx.s.turn.bangsPlayed += 1;
    emit(ctx, { t: "SHOT", from: seat, to, source: "bang", weapon: equippedWeapon(playerAt(ctx.s, seat)) ?? "colt45" });
    // The target is always prompted unless a Barrel already cancelled the hit: skipping the prompt otherwise would
    // leak that their hand holds no Missed! (Golden rule 4).
    startBangResponse(ctx, to, seat, "bang", 1);
  },
};
