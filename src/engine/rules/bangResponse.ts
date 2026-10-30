import type { Seat } from "../state/types";
import { emit, hasCardType, playerAt, pushPrompt, type Ctx } from "./context";
import { drawCheck, isHearts } from "./drawCheck";

/**
 * Starts the response to one BANG!-like hit (BANG!, Calamity's Missed!-as-BANG!, each Gatling target).
 * R-9: Barrel checks run automatically first since they have no downside. If they already cancel the hit there is
 * no prompt (the Barrel is public, so this leaks nothing); otherwise the target is asked for the remaining Missed!
 * effects, which makes Barrel + Missed! against Slab (R-10) work without special cases.
 */
export function startBangResponse(ctx: Ctx, target: Seat, attacker: Seat, source: "bang" | "gatling", needed: number): void {
  let got = 0;
  // Jourdonnais' built-in Barrel is checked before the real one (R-9) from Phase 4.
  if (got < needed && hasCardType(playerAt(ctx.s, target), "barrel") && drawCheck(ctx, target, "barrel", isHearts)) {
    got += 1;
    emit(ctx, { t: "MISSED", seat: target, via: "barrel" });
  }
  if (got >= needed) return;
  pushPrompt(ctx, { kind: "RESPOND_BANG", seat: target, attacker, source, needed, got });
}
