import { cardType, type CardType, type GameEvent, type PlayerView, type Role, type Seat } from "@/engine";
import type { AiMemory } from "./types";

/** How much a role is "an enemy of the Sheriff". The Renegade is, but less openly. */
export function roleSuspicion(role: Role): number {
  switch (role) {
    case "outlaw":
      return 1;
    case "renegade":
      return 0.8;
    case "deputy":
    case "sheriff":
      return -1;
  }
}

/** Cards whose target reveals intent (docs/06 §3). Gatling / Indians! hit everyone and say nothing. */
const HOSTILE: ReadonlySet<CardType> = new Set<CardType>(["bang", "duel", "panic", "cat_balou", "jail"]);

const clamp = (x: number): number => Math.max(-1, Math.min(1, x));

export function createMemory(view: PlayerView): AiMemory {
  if (view.viewer === "spectator") throw new Error("createMemory: spectators have no memory");
  return {
    seat: view.viewer,
    suspicion: view.players.map((p) => (p.role ? roleSuspicion(p.role) : 0)),
    knownRoles: view.players.map((p) => p.role),
  };
}

function learnRole(memory: AiMemory, seat: Seat, role: Role): AiMemory {
  const knownRoles = [...memory.knownRoles];
  const suspicion = [...memory.suspicion];
  knownRoles[seat] = role;
  suspicion[seat] = roleSuspicion(role);
  return { ...memory, knownRoles, suspicion };
}

/**
 * `attacker` acted against `victim` (helping = false) or removed Jail/Dynamite from them (helping = true).
 * Hitting the Sheriff is strong evidence; hitting a suspected Outlaw makes you look like a lawman, and vice versa.
 */
function noteIntent(memory: AiMemory, attacker: Seat, victim: Seat, helping: boolean): AiMemory {
  if (memory.knownRoles[attacker]) return memory;
  const victimSuspicion = memory.suspicion[victim] ?? 0;
  const victimIsSheriff = memory.knownRoles[victim] === "sheriff";
  let delta = victimIsSheriff ? 0.6 : -0.35 * victimSuspicion;
  if (helping) delta = -delta;
  const suspicion = [...memory.suspicion];
  suspicion[attacker] = clamp((suspicion[attacker] ?? 0) + delta);
  return { ...memory, suspicion };
}

/** Folds one event (already redacted for this NPC) into its memory. */
export function observe(memory: AiMemory, event: GameEvent): AiMemory {
  switch (event.t) {
    case "ROLE_ASSIGNED":
    case "ELIMINATED":
      return learnRole(memory, event.seat, event.role);
    case "CARD_PLAYED": {
      const victim = event.target?.seat;
      if (victim === undefined || victim === event.seat) return memory;
      const type = event.asType ?? cardType(event.cardId);
      if (!HOSTILE.has(type)) return memory;
      const taken = event.target?.cardId;
      const helping = taken !== undefined && ["jail", "dynamite"].includes(cardType(taken));
      return noteIntent(memory, event.seat, victim, helping);
    }
    default:
      return memory;
  }
}
