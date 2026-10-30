import { startBangResponse } from "../bangResponse";
import { emit, livingSeats, othersClockwise, playerAt, popPrompt, pushPrompt, type Ctx } from "../context";
import { equippedWeapon } from "../distance";
import type { Prompt } from "../../state/types";
import type { CardHandler } from "./handler";

function multiTargetHandler(source: "gatling" | "indians"): CardHandler {
  return {
    playTargets: (s, seat) => (livingSeats(s).some((to) => to !== seat) ? null : false),
    play(ctx, seat) {
      pushPrompt(ctx, { kind: "MULTI_TARGET", attacker: seat, source, remaining: othersClockwise(ctx.s, seat) });
    },
  };
}

/** Gatling is not a BANG! card: ignores range, skips the BANG! limit and Slab's double Missed! (R-12). */
export const gatlingHandler = multiTargetHandler("gatling");
export const indiansHandler = multiTargetHandler("indians");

/**
 * Advances a MULTI_TARGET driver: asks the next living target, or finishes. Targets eliminated meanwhile are
 * skipped (§7.7); if the game ended, endGame already cleared the stack (T-32).
 */
export function resolveMultiTarget(ctx: Ctx, driver: Extract<Prompt, { kind: "MULTI_TARGET" }>): void {
  while (driver.remaining.length > 0) {
    const to = driver.remaining.shift() as number;
    if (!playerAt(ctx.s, to).alive) continue;
    if (driver.source === "gatling") {
      emit(ctx, { t: "SHOT", from: driver.attacker, to, source: "gatling", weapon: "gatling" });
      // R-12: one Missed! effect per target, even from Slab the Killer. A Barrel may settle it without a prompt,
      // in which case the driver simply stays on top and advance() moves to the next target.
      startBangResponse(ctx, to, driver.attacker, "gatling", 1);
    } else {
      pushPrompt(ctx, { kind: "RESPOND_INDIANS", seat: to, attacker: driver.attacker });
    }
    return;
  }
  popPrompt(ctx);
}

/** Duel: any other player; the target answers first (docs/02 §6.4). Does not count as a BANG!. */
export const duelHandler: CardHandler = {
  playTargets: (s, seat) => livingSeats(s).filter((to) => to !== seat).map((to) => ({ seat: to })),
  play(ctx, seat, _cardId, target) {
    const to = target?.seat;
    if (to === undefined) throw new Error("Duel needs a target seat");
    pushPrompt(ctx, { kind: "DUEL", seat: to, opponent: seat, initiator: seat });
  },
};

/** The duellist who gives up is shot by their opponent, who gets the damage/kill credit. */
export function duelShot(ctx: Ctx, loser: number, opponent: number): void {
  emit(ctx, { t: "SHOT", from: opponent, to: loser, source: "duel", weapon: equippedWeapon(playerAt(ctx.s, opponent)) ?? "colt45" });
}
