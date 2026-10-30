import { COLT_45_RANGE, WEAPON_RANGE } from "../cards/cardData";
import { cardType } from "../cards/deck";
import type { CardId, CardType } from "../cards/types";
import type { CharacterId } from "../characters/data";
import type { Seat } from "../state/types";

/**
 * The public facts distance depends on. Both GameState and PlayerView satisfy this, so the AI and the UI reuse the
 * engine's formula on a view instead of re-implementing it.
 */
export interface DistancePlayer {
  seat: Seat;
  alive: boolean;
  characterId: CharacterId | null;
  inPlay: readonly CardId[];
}

export interface DistanceTable {
  players: readonly DistancePlayer[];
}

function at(t: DistanceTable, seat: Seat): DistancePlayer {
  const p = t.players[seat];
  if (!p) throw new Error(`No player at seat ${seat}`);
  return p;
}

function hasType(p: DistancePlayer, type: CardType): boolean {
  return p.inPlay.some((id) => cardType(id) === type);
}

/** Minimum steps either way around the table, counting only living players (docs/02 §3). */
export function seatDistance(t: DistanceTable, from: Seat, to: Seat): number {
  if (from === to) return 0;
  const ring = t.players.filter((p) => p.alive || p.seat === from || p.seat === to).map((p) => p.seat);
  const a = ring.indexOf(from);
  const b = ring.indexOf(to);
  const d = Math.abs(a - b);
  return Math.min(d, ring.length - d);
}

/**
 * Seat distance + target's Mustang/Paul Regret − viewer's Scope/Rose Doolan, minimum 1.
 * Character built-ins stack with the real cards (R-2).
 */
export function effectiveDistance(t: DistanceTable, from: Seat, to: Seat): number {
  const viewer = at(t, from);
  const target = at(t, to);
  let d = seatDistance(t, from, to);
  if (hasType(target, "mustang")) d += 1;
  if (target.characterId === "paul_regret") d += 1;
  if (hasType(viewer, "scope")) d -= 1;
  if (viewer.characterId === "rose_doolan") d -= 1;
  return Math.max(1, d);
}

export function equippedWeapon(p: Pick<DistancePlayer, "inPlay">): CardType | null {
  for (const id of p.inPlay) {
    const type = cardType(id);
    if (WEAPON_RANGE[type] !== undefined) return type;
  }
  return null;
}

export function weaponRange(p: Pick<DistancePlayer, "inPlay">): number {
  const weapon = equippedWeapon(p);
  return weapon ? (WEAPON_RANGE[weapon] ?? COLT_45_RANGE) : COLT_45_RANGE;
}
