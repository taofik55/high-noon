import { cardType, type CardId, type CardType, type PlayerView, type PublicPlayer, type Seat } from "@/engine";

/** The NPC's own seat; the AI never runs for spectators. */
export function mySeat(view: PlayerView): Seat {
  if (view.viewer === "spectator") throw new Error("AI cannot play as a spectator");
  return view.viewer;
}

export function me(view: PlayerView): PublicPlayer {
  const p = view.players[mySeat(view)];
  if (!p) throw new Error("viewer seat missing from view");
  return p;
}

export function playerOf(view: PlayerView, seat: Seat): PublicPlayer {
  const p = view.players[seat];
  if (!p) throw new Error(`no seat ${seat} in view`);
  return p;
}

export function countInHand(view: PlayerView, type: CardType): number {
  return view.myHand.filter((id) => cardType(id) === type).length;
}

export function aliveCount(view: PlayerView): number {
  return view.players.filter((p) => p.alive).length;
}

export function hasInPlay(p: PublicPlayer, type: CardType): boolean {
  return p.inPlay.some((id) => cardType(id) === type);
}

/** Cards sorted from least to most valuable according to `value`. */
export function byValue(cards: readonly CardId[], value: (id: CardId) => number): CardId[] {
  return [...cards].sort((a, b) => value(a) - value(b));
}
