import type { Seat } from "../state/types";
import { emit, hasAbility, hasCardType, playerAt, pushPrompt, type Ctx } from "./context";
import { drawCheck, isHearts } from "./drawCheck";

/**
 * Starts the response to one BANG!-like hit (BANG!, Calamity's Missed!-as-BANG!, each Gatling target).
 * R-9: Barrel checks run automatically first since they have no downside — Jourdonnais' built-in Barrel, then a real
 * one — stopping once enough Missed! effects are reached. If they already cancel the hit there is no prompt (Barrels
 * are public, so this leaks nothing); otherwise the target is asked for the remaining Missed! effects, which makes
 * Barrel + Missed! against Slab (R-10) work without special cases.
 */
export function startBangResponse(ctx: Ctx, target: Seat, attacker: Seat, source: "bang" | "gatling", needed: number): void {
  const p = playerAt(ctx.s, target);
  let got = 0;
  if (got < needed && hasAbility(p, "jourdonnais") && drawCheck(ctx, target, "jourdonnais", isHearts)) {
    got += 1;
    emit(ctx, { t: "MISSED", seat: target, via: "jourdonnais" });
  }
  if (got < needed && hasCardType(p, "barrel") && drawCheck(ctx, target, "barrel", isHearts)) {
    got += 1;
    emit(ctx, { t: "MISSED", seat: target, via: "barrel" });
  }
  if (got >= needed) return;
  pushPrompt(ctx, { kind: "RESPOND_BANG", seat: target, attacker, source, needed, got });
}
