import { rolesFor, type PlayerView, type Role, type Seat } from "@/engine";
import { roleSuspicion } from "../memory";
import type { AiMemory } from "../types";
import { aliveCount, mySeat, playerOf } from "./view";

function knownRole(view: PlayerView, memory: AiMemory, seat: Seat): Role | null {
  return playerOf(view, seat).role ?? memory.knownRoles[seat] ?? null;
}

/**
 * docs/06 §3 "revealed roles update team counts": the roles still unaccounted for (role table minus every role I know)
 * belong to the players whose role I don't know. If that pool holds only enemies of the Sheriff (or none), the
 * suspicion of every unknown player is certain, whatever their behavior suggested (e.g. a Renegade who only shot
 * Outlaws is still the Renegade once he is the last unknown left).
 */
function certainSuspicion(view: PlayerView, memory: AiMemory): number | null {
  const pool = rolesFor(view.players.length);
  for (const p of view.players) {
    const role = knownRole(view, memory, p.seat);
    if (role === null) continue;
    const i = pool.indexOf(role);
    if (i >= 0) pool.splice(i, 1);
  }
  if (pool.length === 0) return null;
  const enemies = pool.filter((r) => r === "outlaw" || r === "renegade").length;
  if (enemies === pool.length) return pool.every((r) => r === "renegade") ? roleSuspicion("renegade") : 1;
  if (enemies === 0) return -1;
  return null;
}

/** Suspicion of `seat` from my point of view: known role > role-count certainty > behavior (memory). */
export function effectiveSuspicion(view: PlayerView, memory: AiMemory, seat: Seat): number {
  const known = knownRole(view, memory, seat);
  if (known) return roleSuspicion(known);
  return certainSuspicion(view, memory) ?? memory.suspicion[seat] ?? 0;
}

/**
 * How much I want `target` weakened, in [-1, 1]: > 0 enemy, < 0 ally (docs/06 §3 table). Uses only my own role, the
 * public roles in the view, and my memory — never hidden information (Golden rule 9).
 */
export function hostility(view: PlayerView, memory: AiMemory, target: Seat): number {
  if (target === mySeat(view)) return -1;
  const known = knownRole(view, memory, target);
  const suspicion = effectiveSuspicion(view, memory, target);

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
