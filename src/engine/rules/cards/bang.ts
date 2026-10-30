import { emit, livingSeats, playerAt, pushPrompt } from "../context";
import { effectiveDistance, equippedWeapon, weaponRange } from "../distance";
import type { CardHandler } from "./handler";

/** Base limit (§4.3). Volcanic / Willy the Kid exceptions arrive with their phases (T-10, T-48). */
const BANGS_PER_TURN = 1;

export const bangHandler: CardHandler = {
  playTargets(s, seat) {
    if (s.turn.bangsPlayed >= BANGS_PER_TURN) return false;
    const range = weaponRange(playerAt(s, seat));
    return livingSeats(s)
      .filter((to) => to !== seat && effectiveDistance(s, seat, to) <= range)
      .map((to) => ({ seat: to }));
  },

  play(ctx, seat, _cardId, target) {
    const to = target?.seat;
    if (to === undefined) throw new Error("BANG! needs a target seat");
    ctx.s.turn.bangsPlayed += 1;
    emit(ctx, { t: "SHOT", from: seat, to, source: "bang", weapon: equippedWeapon(playerAt(ctx.s, seat)) ?? "colt45" });
    // Always prompt, even without a Missed! in hand: skipping the prompt would leak the target's hand (Golden rule 4).
    pushPrompt(ctx, { kind: "RESPOND_BANG", seat: to, attacker: seat, source: "bang", needed: 1, got: 0 });
  },
};
