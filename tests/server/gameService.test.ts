import { describe, expect, it } from "vitest";
import { createMemory, decideSafe } from "@/ai";
import { createRng, currentActor, type Action, type GameConfig, type PlayerView } from "@/engine";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/lib/rooms/rules";
import type { OnlineView } from "@/lib/online/types";
import { ApiError, type ApiErrorCode } from "@/server/errors";
import { commitArgs, type CommitArgs, type EventRow, type SeatOwner, type ViewRow } from "@/server/game/commitPayload";
import { performAction, performResync, performTimeout } from "@/server/game/gameService";
import { VersionConflictError, type GameRepo, type GameSeat, type LoadedGame } from "@/server/game/repo";
import { newServerGame, type ServerGame } from "@/server/game/serverGame";

// docs/03 §5.1–5.2 against an in-memory GameRepo: the same flow the routes run, minus the database.

const ANN = "user-ann";
const BEN = "user-ben";

interface Committed {
  version: number;
  views: ViewRow[];
  events: EventRow[];
  sg: ServerGame;
}

class MemoryRepo implements GameRepo {
  game: LoadedGame;
  log: Committed[] = [];
  finished = 0;
  /** Simulates another request committing first, `n` times. */
  conflicts = 0;

  constructor(game: LoadedGame) {
    this.game = game;
  }

  async load(): Promise<LoadedGame | null> {
    return structuredClone(this.game);
  }

  async commit(args: CommitArgs): Promise<number> {
    if (this.conflicts > 0) {
      this.conflicts--;
      throw new VersionConflictError();
    }
    if (args.p_expected_version !== this.game.version) throw new VersionConflictError();
    const sg = structuredClone(args.p_state) as unknown as ServerGame;
    const updates = args.p_seat_updates as unknown as { seat: number; timeouts: number; afk_takeover: boolean }[];
    this.game = {
      ...this.game,
      version: this.game.version + 1,
      sg,
      status: args.p_status,
      deadline: args.p_prompt_deadline,
      seats: this.game.seats.map((s) => {
        const u = updates.find((x) => x.seat === s.seat);
        return u ? { ...s, timeouts: u.timeouts, afkTakeover: u.afk_takeover } : s;
      }),
    };
    this.log.push({ version: this.game.version, views: args.p_views as unknown as ViewRow[], events: args.p_events as unknown as EventRow[], sg });
    return this.game.version;
  }

  async finish(): Promise<void> {
    this.finished++;
  }
}

function setup(seed: string, settings: Partial<RoomSettings> = {}): MemoryRepo {
  const config: GameConfig = {
    characterMode: "random",
    players: [
      { name: "Ann", isNpc: false },
      { name: "Bot A", isNpc: true, npcDifficulty: "easy" },
      { name: "Ben", isNpc: false },
      { name: "Bot B", isNpc: true, npcDifficulty: "medium" },
    ],
  };
  const { sg, events } = newServerGame(config, seed, `${seed}:ai`);
  const seats: GameSeat[] = [
    { seat: 0, userId: ANN, isNpc: false, npcDifficulty: null, timeouts: 0, afkTakeover: false },
    { seat: 1, userId: null, isNpc: true, npcDifficulty: "easy", timeouts: 0, afkTakeover: false },
    { seat: 2, userId: BEN, isNpc: false, npcDifficulty: null, timeouts: 0, afkTakeover: false },
    { seat: 3, userId: null, isNpc: true, npcDifficulty: "medium", timeouts: 0, afkTakeover: false },
  ];
  const repo = new MemoryRepo({
    id: "g1",
    roomId: "r1",
    version: 0,
    status: "active",
    deadline: null,
    sg,
    seats,
    settings: { ...DEFAULT_ROOM_SETTINGS, turnTimerSec: 0, ...settings },
  });
  const owners: SeatOwner[] = seats.map((s) => ({ seat: s.seat, userId: s.userId }));
  void repo.commit(
    commitArgs({ gameId: "g1", expectedVersion: 0, stored: sg, state: sg.game, events, seats: owners, turnTimerSec: repo.game.settings.turnTimerSec, now: new Date(1_000_000), actor: null }),
  );
  return repo;
}

async function failsWith(p: Promise<unknown>, code: ApiErrorCode): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  expect((e as ApiError).code).toBe(code);
  return e as ApiError;
}

/** What a human's own client would play: a medium bot deciding from that human's view only. */
function clientPick(view: PlayerView, seed: number): Action {
  return decideSafe(view, createMemory(view), "medium", createRng(`client:${seed}`));
}

const userOf = (repo: MemoryRepo, seat: number) => repo.game.seats.find((s) => s.seat === seat)?.userId ?? null;
const clock = () => new Date(1_000_000);

describe("gameService (docs/03 §5.1)", () => {
  it("rejects outsiders, stale versions and illegal actions without changing anything", async () => {
    const repo = setup("svc-reject");
    await performResync(repo, "g1", ANN, false, clock); // bots move until a human must act
    const v = repo.game.version;
    await failsWith(performAction(repo, "g1", "stranger", { type: "PASS" }, v, clock), "GAME_NOT_FOUND");
    const stale = await failsWith(performAction(repo, "g1", ANN, { type: "PASS" }, v - 1, clock), "VERSION_CONFLICT");
    expect(stale.details).toEqual({ version: v });
    const actor = currentActor(repo.game.sg.game);
    const idle = actor === 0 ? BEN : ANN; // whoever is not asked to act now
    await failsWith(performAction(repo, "g1", idle, { type: "END_TURN" }, v, clock), "ILLEGAL_ACTION");
    expect(repo.game.version).toBe(v);
  });

  it.each(["svc-full-1", "svc-full-2", "svc-full-3", "svc-full-4"])("plays a whole game through the server path: one version per action, no hidden information (%s)", async (seed) => {
    const repo = setup(seed);
    await performResync(repo, "g1", ANN, false, clock);
    for (let i = 0; i < 2000 && repo.game.status === "active"; i++) {
      const actor = currentActor(repo.game.sg.game);
      expect(actor, "only humans are left waiting").not.toBeNull();
      const user = userOf(repo, actor as number);
      expect(user, "bots never wait for a request").not.toBeNull();
      const view = repo.log.at(-1)?.views.find((r) => r.user_id === user)?.view as unknown as OnlineView;
      await performAction(repo, "g1", user as string, clientPick(view, i), repo.game.version, clock);
    }
    expect(repo.game.status).toBe("finished");
    expect(repo.game.sg.game.winner).not.toBeNull();
    expect(repo.finished).toBe(1);
    expect(repo.log.map((c) => c.version)).toEqual(repo.log.map((_, i) => i + 1));

    for (const c of repo.log) {
      const hands = c.sg.game.players.map((p) => p.hand);
      for (const row of c.views) {
        const json = JSON.stringify(row.view);
        expect(json).not.toMatch(/"(rng|deck|hand|ai|memories)":/);
        hands.forEach((hand, seat) => {
          if (seat === row.seat || c.sg.game.winner) return;
          for (const card of hand) {
            expect(json, `seat ${row.seat} sees seat ${seat}'s ${card} in v${c.version}`).not.toContain(`"${card}"`);
          }
        });
      }
      // Events (cards may legitimately become public, e.g. General Store): check who receives the private parts.
      const seatOf = (user: string | null) => c.views.find((r) => r.user_id === user)?.seat;
      for (const row of c.events) {
        const e = row.payload as { t: string; seat?: number; from?: number | string; to?: number; fromSeat?: number; cardIds?: unknown; cardId?: unknown; fromHand?: boolean; handCardIds?: unknown; role?: string };
        const me = seatOf(row.recipient_user_id);
        if (e.t === "CARDS_DRAWN" && e.from !== "discard") {
          if (row.recipient_user_id === null) expect(e.cardIds).toBeUndefined();
          else expect([e.seat, e.fromSeat]).toContain(me);
        }
        if (e.t === "CARD_STOLEN" && e.fromHand) {
          if (row.recipient_user_id === null) expect(e.cardId).toBeUndefined();
          else expect([e.from, e.to]).toContain(me);
        }
        if (e.t === "CARDS_INHERITED" && row.recipient_user_id === null) expect(e.handCardIds).toBeUndefined();
        if (e.t === "ROLE_ASSIGNED" && e.role !== "sheriff" && !c.sg.game.winner) expect(me).toBe(e.seat);
      }
    }
  });

  it("retries once after a conflict, re-validating against the newer state", async () => {
    const repo = setup("svc-conflict");
    await performResync(repo, "g1", ANN, false, clock);
    const actor = currentActor(repo.game.sg.game) as number;
    const user = userOf(repo, actor) as string;
    const view = repo.log.at(-1)?.views.find((r) => r.user_id === user)?.view as unknown as OnlineView;
    const before = repo.game.version;
    repo.conflicts = 1;
    await performAction(repo, "g1", user, clientPick(view, 1), before, clock);
    expect(repo.game.version).toBeGreaterThan(before);
    repo.conflicts = 2;
    const next = currentActor(repo.game.sg.game) as number;
    const nextUser = userOf(repo, next) as string;
    const nextView = repo.log.at(-1)?.views.find((r) => r.user_id === nextUser)?.view as unknown as OnlineView;
    await failsWith(performAction(repo, "g1", nextUser, clientPick(nextView, 2), repo.game.version, clock), "VERSION_CONFLICT");
  });
});

describe("timeouts and AFK takeover (docs/03 §5.2, docs/01 §5.2)", () => {
  it("plays the default action after the deadline, then lets a bot take over, until the player reclaims the seat", async () => {
    const repo = setup("svc-timeout", { turnTimerSec: 30, afkTakeoverAfter: 2 });
    let now = 1_000_000;
    const at = () => new Date(now);
    await performResync(repo, "g1", ANN, false, at);
    const waitingSeat = currentActor(repo.game.sg.game) as number;
    const waiting = userOf(repo, waitingSeat) as string;
    expect(repo.game.deadline).not.toBeNull();
    expect((repo.log.at(-1)?.views.find((r) => r.user_id === waiting)?.view as unknown as OnlineView).deadline).toBe(repo.game.deadline);

    await failsWith(performTimeout(repo, "g1", ANN, repo.game.version, at), "NOT_EXPIRED");
    // A stale report is a harmless no-op.
    expect(await performTimeout(repo, "g1", ANN, repo.game.version - 1, at)).toEqual({ version: repo.game.version });

    // Time out the same player until the bot takes over (any member may report it).
    for (let n = 1; repo.game.seats[waitingSeat]?.afkTakeover !== true; n++) {
      expect(n).toBeLessThan(50);
      const actor = currentActor(repo.game.sg.game) as number;
      if (actor !== waitingSeat) {
        // the other human answers normally so the game reaches our player again
        const u = userOf(repo, actor) as string;
        const v = repo.log.at(-1)?.views.find((r) => r.user_id === u)?.view as unknown as OnlineView;
        await performAction(repo, "g1", u, clientPick(v, n), repo.game.version, at);
        continue;
      }
      now = new Date(repo.game.deadline as string).getTime() + 1;
      await performTimeout(repo, "g1", BEN, repo.game.version, at);
      if (repo.game.status !== "active") return; // the timeouts ended the game: nothing more to check
    }
    expect(repo.game.seats[waitingSeat]?.timeouts).toBe(2);
    const latest = repo.log.at(-1)?.views.find((r) => r.user_id === waiting)?.view as unknown as OnlineView;
    expect(latest.afk).toBe(true);
    // While AFK, the game never waits for that seat.
    if (repo.game.status === "active") expect(currentActor(repo.game.sg.game)).not.toBe(waitingSeat);

    await performResync(repo, "g1", waiting, true, at);
    expect(repo.game.seats[waitingSeat]).toMatchObject({ timeouts: 0, afkTakeover: false });
    const back = repo.log.at(-1)?.views.find((r) => r.user_id === waiting)?.view as unknown as OnlineView;
    expect(back.afk).toBe(false);
  });
});
