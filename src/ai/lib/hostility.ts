import type { PlayerView, Seat } from "@/engine";
import { roleSuspicion } from "../memory";
import type { AiMemory } from "../types";
import { aliveCount, mySeat, playerOf } from "./view";

/**
 * How much I want `target` weakened, in [-1, 1]: > 0 enemy, < 0 ally (docs/06 §3 table). Uses only my own role, the
 * public roles in the view, and my memory's suspicion — never hidden information (Golden rule 9).
 */
export function hostility(view: PlayerView, memory: AiMemory, target: Seat): number {
  if (target === mySeat(view)) return -1;
  const known = playerOf(view, target).role ?? memory.knownRoles[target] ?? null;
  const suspicion = known ? roleSuspicion(known) : (memory.suspicion[target] ?? 0);

  switch (view.myRole) {
    case "sheriff":
      return suspicion;
    case "deputy":
      return known === "sheriff" ? -1 : suspicion;
    case "outlaw":
      if (known === "sheriff") return 1;
      if (known === "renegade") return 0.3;
      return -suspicion;
    case "renegade": {
      // Keep the Sheriff alive while anyone else stands, then finish him in the duel at the end.
      if (known === "sheriff") return aliveCount(view) > 2 ? -0.6 : 1;
      return 0.4 + 0.4 * Math.max(suspicion, 0);
    }
    case null:
      return 0;
  }
}

export function isEnemy(view: PlayerView, memory: AiMemory, target: Seat, threshold = 0.15): boolean {
  return hostility(view, memory, target) > threshold;
}
