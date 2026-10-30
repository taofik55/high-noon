import { cardType } from "../cards/deck";
import type { CardId, CardType } from "../cards/types";
import type { GameEvent } from "../events/types";
import type { GameState, PlayerState, Prompt, Seat } from "../state/types";

/**
 * Mutable working copy used inside one applyAction/createGame call. The public API clones the input state once
 * (structuredClone) and all rule helpers mutate that private draft, so callers always see immutable states.
 */
export interface Ctx {
  s: GameState;
  events: GameEvent[];
}

export function emit(ctx: Ctx, event: GameEvent): void {
  ctx.events.push(event);
}

export function playerAt(s: GameState, seat: Seat): PlayerState {
  const p = s.players[seat];
  if (!p) throw new Error(`No player at seat ${seat}`);
  return p;
}

export function topPrompt(s: GameState): Prompt | undefined {
  return s.stack[s.stack.length - 1];
}

export function pushPrompt(ctx: Ctx, prompt: Prompt): void {
  ctx.s.stack.push(prompt);
}

export function popPrompt(ctx: Ctx): Prompt {
  const prompt = ctx.s.stack.pop();
  if (!prompt) throw new Error("popPrompt: empty stack");
  return prompt;
}

export function livingSeats(s: GameState): Seat[] {
  return s.players.filter((p) => p.alive).map((p) => p.seat);
}

export function aliveCount(s: GameState): number {
  return s.players.reduce((n, p) => n + (p.alive ? 1 : 0), 0);
}

/** Next living seat clockwise after `from` (never `from` itself unless it is the only one alive). */
export function nextLivingSeat(s: GameState, from: Seat): Seat {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    if (playerAt(s, seat).alive) return seat;
  }
  return from;
}

/** Every other living seat, clockwise starting from the one on `from`'s left (R-11). */
export function othersClockwise(s: GameState, from: Seat): Seat[] {
  const n = s.players.length;
  const seats: Seat[] = [];
  for (let i = 1; i < n; i++) {
    const seat = (from + i) % n;
    if (playerAt(s, seat).alive) seats.push(seat);
  }
  return seats;
}

/** The in-play card of that type, if any (at most one: duplicate blue names are illegal, §4.3). */
export function inPlayOfType(p: PlayerState, type: CardType): CardId | undefined {
  return p.inPlay.find((id) => cardType(id) === type);
}

export function hasCardType(p: PlayerState, type: CardType): boolean {
  return inPlayOfType(p, type) !== undefined;
}

export function removeFromPlay(p: PlayerState, cardId: CardId): void {
  const i = p.inPlay.indexOf(cardId);
  if (i < 0) throw new Error(`Card ${cardId} not in play for seat ${p.seat}`);
  p.inPlay.splice(i, 1);
}

/** Removes `cardId` from the player's hand; throws if absent (callers validated legality already). */
export function takeFromHand(p: PlayerState, cardId: CardId): void {
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new Error(`Card ${cardId} not in hand of seat ${p.seat}`);
  p.hand.splice(i, 1);
}
