import "server-only";
import { currentActor, defaultActionOnTimeout, whyIllegal, type Action, type GameEvent, type Seat } from "@/engine";
import { ApiError } from "../errors";
import { commitArgs, type SeatOwner, type SeatUpdate } from "./commitPayload";
import { VersionConflictError, type GameRepo, type GameSeat, type LoadedGame } from "./repo";
import { advance, decideFor, type ServerGame } from "./serverGame";

// Authoritative online play (docs/03 §5.1–5.2): load → validate → apply → bots → commit, all through the engine.
// Every action is committed as its own version so each step reaches clients with its own view (realtime delivers
// each player_views change), and the Director can stage it exactly like solo.

export type Clock = () => Date;

/** docs/03 §5.1 step 5: hard cap on bot steps per request. */
export const NPC_STEP_LIMIT = 500;

const owners = (seats: readonly GameSeat[]): SeatOwner[] => seats.map((s) => ({ seat: s.seat, userId: s.userId, afk: s.afkTakeover }));

function patchSeats(seats: readonly GameSeat[], updates: readonly SeatUpdate[]): GameSeat[] {
  return seats.map((s) => {
    const u = updates.find((x) => x.seat === s.seat);
    return u ? { ...s, timeouts: u.timeouts, afkTakeover: u.afk_takeover } : s;
  });
}

async function commitStep(
  repo: GameRepo,
  g: LoadedGame,
  actor: Seat | null,
  next: { sg: ServerGame; events: GameEvent[] },
  clock: Clock,
  seatUpdates: readonly SeatUpdate[] = [],
): Promise<LoadedGame> {
  const seats = patchSeats(g.seats, seatUpdates);
  const args = commitArgs({
    gameId: g.id,
    expectedVersion: g.version,
    stored: next.sg,
    state: next.sg.game,
    events: next.events,
    seats: owners(seats),
    turnTimerSec: g.settings.turnTimerSec,
    now: clock(),
    actor,
    seatUpdates,
  });
  const version = await repo.commit(args);
  const done: LoadedGame = { ...g, version, sg: next.sg, seats, deadline: args.p_prompt_deadline, status: args.p_status };
  if (next.sg.game.winner !== null) await repo.finish(done);
  return done;
}

/** True when a bot must move now: an NPC seat, or a human seat a bot took over. */
function botToMove(g: LoadedGame): Seat | null {
  if (g.status !== "active" || g.sg.game.winner !== null) return null;
  const actor = currentActor(g.sg.game);
  if (actor === null) return null;
  const seat = g.seats.find((s) => s.seat === actor);
  return seat && (seat.isNpc || seat.afkTakeover) ? actor : null;
}

/**
 * docs/03 §5.1 step 5. Plays bots until a present human must act or the game ends. A version conflict means another
 * request moved the game on (it runs its own loop), so this one simply stops.
 */
export async function runBots(repo: GameRepo, start: LoadedGame, clock: Clock): Promise<LoadedGame> {
  let g = start;
  for (let i = 0; i < NPC_STEP_LIMIT; i++) {
    const actor = botToMove(g);
    if (actor === null) return g;
    const seat = g.seats.find((s) => s.seat === actor);
    const difficulty = seat?.isNpc ? (seat.npcDifficulty ?? "medium") : "medium"; // AFK takeover plays medium (docs/01 §5.2)
    const decided = decideFor(g.sg, actor, difficulty, () => clock().getTime());
    try {
      g = await commitStep(repo, g, actor, advance(decided.sg, actor, decided.action), clock);
    } catch (e) {
      if (e instanceof VersionConflictError) return g;
      throw e;
    }
  }
  console.error(`[game ${g.id}] bot step limit reached`);
  return g;
}

async function loadFor(repo: GameRepo, gameId: string, userId: string): Promise<{ g: LoadedGame; seat: GameSeat }> {
  const g = await repo.load(gameId);
  const seat = g?.seats.find((s) => s.userId === userId);
  // Outsiders cannot tell a missing game from someone else's.
  if (!g || !seat) throw new ApiError("GAME_NOT_FOUND");
  return { g, seat };
}

/** POST /api/games/[id]/action (docs/03 §5.1). */
export async function performAction(
  repo: GameRepo,
  gameId: string,
  userId: string,
  action: Action,
  clientVersion: number,
  clock: Clock,
): Promise<{ version: number }> {
  for (let attempt = 0; ; attempt++) {
    const { g, seat } = await loadFor(repo, gameId, userId);
    if (g.status !== "active") throw new ApiError("GAME_OVER", "GAME_OVER", { version: g.version });
    // The client acted on what it saw; after our own retry the action is simply re-validated against the new state.
    if (attempt === 0 && clientVersion !== g.version) throw new ApiError("VERSION_CONFLICT", "VERSION_CONFLICT", { version: g.version });
    let reason: string | null;
    try {
      reason = whyIllegal(g.sg.game, seat.seat, action);
    } catch {
      reason = "malformed action";
    }
    if (reason !== null) throw new ApiError("ILLEGAL_ACTION", reason, { version: g.version });

    // Any action of their own brings a player back from AFK (docs/03 §5.2).
    const back: SeatUpdate[] = seat.timeouts > 0 || seat.afkTakeover ? [{ seat: seat.seat, timeouts: 0, afk_takeover: false }] : [];
    try {
      const after = await commitStep(repo, g, seat.seat, advance(g.sg, seat.seat, action), clock, back);
      const final = await runBots(repo, after, clock);
      return { version: final.version };
    } catch (e) {
      if (!(e instanceof VersionConflictError)) throw e;
      if (attempt >= 1) throw new ApiError("VERSION_CONFLICT", "VERSION_CONFLICT", { version: g.version + 1 });
    }
  }
}

/**
 * POST /api/games/[id]/timeout (docs/03 §5.2). Any member may report it (the AFK player's own client may be gone); the
 * version check makes duplicate reports harmless.
 */
export async function performTimeout(repo: GameRepo, gameId: string, userId: string, version: number, clock: Clock): Promise<{ version: number }> {
  const { g } = await loadFor(repo, gameId, userId);
  if (g.status !== "active" || g.version !== version) return { version: g.version };
  if (!g.deadline || new Date(g.deadline).getTime() > clock().getTime()) throw new ApiError("NOT_EXPIRED", "NOT_EXPIRED", { version: g.version });
  const actor = currentActor(g.sg.game);
  const seat = actor === null ? undefined : g.seats.find((s) => s.seat === actor);
  if (actor === null || !seat) return { version: g.version };

  const timeouts = seat.timeouts + 1;
  const update: SeatUpdate = { seat: actor, timeouts, afk_takeover: timeouts >= g.settings.afkTakeoverAfter };
  try {
    const after = await commitStep(repo, g, actor, advance(g.sg, actor, defaultActionOnTimeout(g.sg.game, actor)), clock, [update]);
    return { version: (await runBots(repo, after, clock)).version };
  } catch (e) {
    if (e instanceof VersionConflictError) return { version: g.version };
    throw e;
  }
}

/**
 * POST /api/games/[id]/resync: "I am here". Optionally takes the caller's seat back from the bot, and doubles as a
 * watchdog: if a bot should be moving but nothing is (a request died mid-loop), the bots continue from here.
 */
export async function performResync(repo: GameRepo, gameId: string, userId: string, reclaim: boolean, clock: Clock): Promise<{ version: number }> {
  const loaded = await loadFor(repo, gameId, userId);
  const { seat } = loaded;
  let g = loaded.g;
  if (reclaim && g.status === "active" && (seat.afkTakeover || seat.timeouts > 0)) {
    // An event-less commit, so every view (this player's `afk` flag included) refreshes right away.
    try {
      g = await commitStep(repo, g, null, { sg: g.sg, events: [] }, clock, [{ seat: seat.seat, timeouts: 0, afk_takeover: false }]);
    } catch (e) {
      if (!(e instanceof VersionConflictError)) throw e;
      g = (await loadFor(repo, gameId, userId)).g;
    }
  }
  return { version: (await runBots(repo, g, clock)).version };
}
