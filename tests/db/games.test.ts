import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMemory, decideSafe } from "@/ai";
import { createRng, currentActor, type PlayerView } from "@/engine";
import type { OnlineView } from "@/lib/online/types";
import { ApiError } from "@/server/errors";
import { performAction, performResync, performTimeout } from "@/server/game/gameService";
import { supabaseGameRepo } from "@/server/game/supabaseRepo";
import { createRoom, joinRoom, seatAction, updateSettings } from "@/server/rooms/roomService";
import { rematchRoom, startRoom } from "@/server/rooms/startGame";
import { adminClient, anonymousUser, deleteUsers, type Db, type TestUser } from "./helpers";

// Online play end to end at the service level (docs/03 §5): real schema, RPC, RLS reads and stats.

const clock = () => new Date();

async function myView(user: TestUser, gameId: string): Promise<{ version: number; view: OnlineView }> {
  const { data, error } = await user.client.from("player_views").select("version, view").eq("game_id", gameId).single();
  if (error) throw error;
  return { version: data.version, view: data.view as unknown as OnlineView };
}

describe("online games (docs/03 §5)", () => {
  let admin: Db;
  let ana: TestUser;
  let budi: TestUser;
  const users: string[] = [];
  let roomId = "";
  let gameId = "";

  beforeAll(async () => {
    admin = adminClient();
    ana = await anonymousUser("Ana");
    budi = await anonymousUser("Budi");
    users.push(ana.id, budi.id);
    const ref = await createRoom(admin, ana.id);
    roomId = ref.roomId;
    await joinRoom(admin, budi.id, ref.code);
    await seatAction(admin, ana.id, roomId, { op: "add_npc", difficulty: "easy" });
    await seatAction(admin, ana.id, roomId, { op: "add_npc", difficulty: "medium" });
    await updateSettings(admin, ana.id, roomId, { turnTimerSec: 0 });
    await seatAction(admin, budi.id, roomId, { op: "ready", ready: true });
    gameId = (await startRoom(admin, ana.id, roomId)).gameId;
  });

  afterAll(async () => {
    await admin.from("rooms").delete().eq("id", roomId);
    await deleteUsers(admin, users);
  });

  it("stores the bots' memories with the secret state, out of every client's reach", async () => {
    const { data } = await admin.from("games").select("state").eq("id", gameId).single();
    const state = data?.state as { schema?: number; ai?: { memories: unknown[] } };
    expect(state.schema).toBe(1);
    expect(state.ai?.memories).toHaveLength(4);
    expect((await ana.client.from("games").select("state").eq("id", gameId)).data).toEqual([]);
  });

  it("rejects stale versions and illegal moves with the current version", async () => {
    const repo = supabaseGameRepo(admin);
    await performResync(repo, gameId, ana.id, false, clock);
    const { version } = await myView(ana, gameId);
    const stale = await performAction(repo, gameId, ana.id, { type: "PASS" }, version - 1, clock).catch((e: unknown) => e);
    expect((stale as ApiError).code).toBe("VERSION_CONFLICT");
    const outsider = await performAction(repo, gameId, "00000000-0000-0000-0000-000000000000", { type: "PASS" }, version, clock).catch((e: unknown) => e);
    expect((outsider as ApiError).code).toBe("GAME_NOT_FOUND");
    expect((await performTimeout(repo, gameId, ana.id, version, clock).catch((e: unknown) => e)) as ApiError).toMatchObject({ code: "NOT_EXPIRED" });
  });

  it("plays to the end through the database, then finishes the room and records stats", async () => {
    const repo = supabaseGameRepo(admin);
    const started = Date.now();
    let actions = 0;
    for (let i = 0; i < 1500; i++) {
      const [a, b] = await Promise.all([myView(ana, gameId), myView(budi, gameId)]);
      if (a.view.winner) break;
      const mover = a.view.legalActions.length > 0 ? { user: ana, ...a } : b.view.legalActions.length > 0 ? { user: budi, ...b } : null;
      expect(mover, `v${a.version}: a human must be asked (bots never wait)`).not.toBeNull();
      if (!mover) break;
      const view: PlayerView = mover.view;
      const action = decideSafe(view, createMemory(view), "medium", createRng(`db:${i}`));
      await performAction(repo, gameId, mover.user.id, action, mover.version, clock);
      actions++;
    }
    const game = await admin.from("games").select("version, status, winner").eq("id", gameId).single();
    const ms = Date.now() - started;
    console.log(`[perf] ${game.data?.version} versions, ${actions} human actions in ${ms} ms (${(ms / (game.data?.version ?? 1)).toFixed(1)} ms/version)`);
    expect(game.data?.status).toBe("finished");
    expect(game.data?.winner).not.toBeNull();

    const room = await ana.client.from("rooms").select("status").eq("id", roomId).single();
    expect(room.data?.status).toBe("finished");
    const stats = await ana.client.from("player_stats").select("user_id, games_played").in("user_id", [ana.id, budi.id]);
    expect(stats.data?.map((s) => s.games_played)).toEqual([1, 1]);
    const final = await myView(ana, gameId);
    expect(final.view.players.every((p) => p.role !== null)).toBe(true); // everything revealed at game over
    expect(currentActor).toBeTypeOf("function");
  });

  it("rematches with the same seats, and only the host may", async () => {
    await expect(rematchRoom(admin, budi.id, roomId, "rematch")).rejects.toMatchObject({ code: "NOT_HOST" });
    const { gameId: next } = await rematchRoom(admin, ana.id, roomId, "rematch");
    expect(next).not.toBe(gameId);
    const room = await budi.client.from("rooms").select("status, current_game_id").eq("id", roomId).single();
    expect(room.data).toEqual({ status: "in_game", current_game_id: next });
    const seats = await budi.client.from("game_seats").select("user_id").eq("game_id", next ?? "");
    expect(seats.data).toHaveLength(4);
    await expect(rematchRoom(admin, ana.id, roomId, "lobby")).rejects.toMatchObject({ code: "GAME_NOT_FINISHED" });
  });
});
