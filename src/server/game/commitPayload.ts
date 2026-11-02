import "server-only";
import { currentActor, redactEvent, toPlayerView, type GameEvent, type GameState, type Seat } from "@/engine";
import type { OnlineView } from "@/lib/online/types";
import type { Json } from "@/lib/supabase/types";

// Builds what one engine step publishes (docs/03 §5.1 step 7): a view per human seat and the redacted event rows.
// Nothing here reads the database, so the same code serves start, actions and timeouts.

export interface SeatOwner {
  seat: number;
  /** null for NPC seats (and for humans whose account was deleted). */
  userId: string | null;
  /** A bot is playing this human seat (docs/01 §5.2). */
  afk?: boolean;
}

export interface ViewRow {
  user_id: string;
  seat: number;
  view: Json;
}

export interface EventRow {
  seq: number;
  recipient_user_id: string | null;
  payload: Json;
}

export interface SeatUpdate {
  seat: number;
  timeouts: number;
  afk_takeover: boolean;
}

// Engine values are plain JSON data (Golden rule 1); the generated Json type just cannot see that through interfaces.
export const asJson = (value: object): NonNullable<Json> => value as NonNullable<Json>;

export function buildViews(state: GameState, seats: readonly SeatOwner[], extra: { deadline: string | null; actor: Seat | null }): ViewRow[] {
  return seats.flatMap((s) => {
    if (!s.userId) return [];
    const view: OnlineView = { ...toPlayerView(state, s.seat), deadline: extra.deadline, actor: extra.actor, afk: s.afk ?? false };
    return [{ user_id: s.userId, seat: s.seat, view: asJson(view) }];
  });
}

/**
 * One public row per event (what a spectator may see) plus a private row for each human whose redaction differs, e.g.
 * the drawer's own CARDS_DRAWN or their own ROLE_ASSIGNED. Clients merge private over public by (version, seq)
 * (docs/03 §5.3), so a private row must carry the whole event, not a diff.
 */
export function buildEventRows(events: readonly GameEvent[], seats: readonly SeatOwner[]): EventRow[] {
  const rows: EventRow[] = [];
  events.forEach((event, seq) => {
    const pub = redactEvent(event, "spectator");
    const pubJson = pub ? JSON.stringify(pub) : null;
    if (pub) rows.push({ seq, recipient_user_id: null, payload: asJson(pub) });
    for (const s of seats) {
      if (!s.userId) continue;
      const mine = redactEvent(event, s.seat);
      if (mine && JSON.stringify(mine) !== pubJson) rows.push({ seq, recipient_user_id: s.userId, payload: asJson(mine) });
    }
  });
  return rows;
}

/** docs/03 §5.1 step 6: a deadline only when a present human must act and the room uses a timer. */
export function promptDeadline(state: GameState, seats: readonly SeatOwner[], turnTimerSec: number, now: Date): string | null {
  if (turnTimerSec <= 0 || state.winner !== null) return null;
  const actor = currentActor(state);
  const owner = actor === null ? undefined : seats.find((s) => s.seat === actor);
  if (!owner?.userId || owner.afk) return null;
  return new Date(now.getTime() + turnTimerSec * 1000).toISOString();
}

/** Arguments of the commit_game_action RPC (docs/04 §3), with the nullability the SQL really has. */
export interface CommitArgs {
  p_game_id: string;
  p_expected_version: number;
  p_state: Json;
  p_status: "active" | "finished" | "aborted";
  p_winner: string | null;
  p_prompt_deadline: string | null;
  p_views: Json;
  p_events: Json;
  p_seat_updates: Json;
}

export function commitArgs(input: {
  gameId: string;
  expectedVersion: number;
  /** What games.state stores (the ServerGame wrapper); `state` below is its engine part. */
  stored: object;
  state: GameState;
  events: readonly GameEvent[];
  seats: readonly SeatOwner[];
  turnTimerSec: number;
  now: Date;
  actor: Seat | null;
  seatUpdates?: readonly SeatUpdate[];
}): CommitArgs {
  const { state, seats } = input;
  const deadline = promptDeadline(state, seats, input.turnTimerSec, input.now);
  return {
    p_game_id: input.gameId,
    p_expected_version: input.expectedVersion,
    p_state: asJson(input.stored),
    p_status: state.winner === null ? "active" : "finished",
    p_winner: state.winner, // engine Winner values match the games.winner check constraint
    p_prompt_deadline: deadline,
    p_views: asJson(buildViews(state, seats, { deadline, actor: input.actor })),
    p_events: asJson(buildEventRows(input.events, seats)),
    p_seat_updates: asJson([...(input.seatUpdates ?? [])]),
  };
}
