import { COLT_45_RANGE, WEAPON_RANGE } from "../cards/cardData";
import { cardType } from "../cards/deck";
import type { CardType } from "../cards/types";
import type { GameState, PlayerState, Seat } from "../state/types";
import { hasCardType, playerAt } from "./context";

/** Minimum steps either way around the table, counting only living players (docs/02 §3). */
export function seatDistance(s: GameState, from: Seat, to: Seat): number {
  if (from === to) return 0;
  const ring = s.players.filter((p) => p.alive || p.seat === from || p.seat === to).map((p) => p.seat);
  const a = ring.indexOf(from);
  const b = ring.indexOf(to);
  const d = Math.abs(a - b);
  return Math.min(d, ring.length - d);
}

/**
 * Seat distance + target's Mustang/Paul Regret − viewer's Scope/Rose Doolan, minimum 1.
 * Character built-ins stack with the real cards (R-2).
 */
export function effectiveDistance(s: GameState, from: Seat, to: Seat): number {
  const viewer = playerAt(s, from);
  const target = playerAt(s, to);
  let d = seatDistance(s, from, to);
  if (hasCardType(target, "mustang")) d += 1;
  if (target.characterId === "paul_regret") d += 1;
  if (hasCardType(viewer, "scope")) d -= 1;
  if (viewer.characterId === "rose_doolan") d -= 1;
  return Math.max(1, d);
}

export function equippedWeapon(p: PlayerState): CardType | null {
  for (const id of p.inPlay) {
    const type = cardType(id);
    if (WEAPON_RANGE[type] !== undefined) return type;
  }
  return null;
}

export function weaponRange(p: PlayerState): number {
  const weapon = equippedWeapon(p);
  return weapon ? (WEAPON_RANGE[weapon] ?? COLT_45_RANGE) : COLT_45_RANGE;
}
