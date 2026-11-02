import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOM_CODE_RE } from "@/lib/rooms/rules";
import { ApiError, type ApiErrorCode } from "@/server/errors";
import { createRoom, joinRoom, loadSlots, seatAction, updateSettings } from "@/server/rooms/roomService";
import { startRoom } from "@/server/rooms/startGame";
import { adminClient, anonymousUser, deleteUsers, type Db, type TestUser } from "./helpers";

// The rooms API service (docs/03 §5.4) against the real schema, with RLS checked through the users' own clients.

async function failsWith(promise: Promise<unknown>, code: ApiErrorCode): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
}

describe("rooms service (docs/03 §5.4)", () => {
  let admin: Db;
  let alice: TestUser; // host
  let bob: TestUser;
  let carol: TestUser; // outsider
  const users: string[] = [];
  const rooms: string[] = [];
  let roomId = "";
  let code = "";

  beforeAll(async () => {
    admin = adminClient();
    alice = await anonymousUser("Alice");
    bob = await anonymousUser("Bob");
    carol = await anonymousUser("Carol");
    users.push(alice.id, bob.id, carol.id);
  });

  afterAll(async () => {
    if (rooms.length) await admin.from("rooms").delete().in("id", rooms);
    await deleteUsers(admin, users);
  });

  it("creates a room with a readable code and the host in slot 0", async () => {
    const ref = await createRoom(admin, alice.id);
    roomId = ref.roomId;
    code = ref.code;
    rooms.push(roomId);
    expect(code).toMatch(ROOM_CODE_RE);
    const mine = await alice.client.from("rooms").select("host_id, status, settings").eq("id", roomId).single();
    expect(mine.data).toMatchObject({ host_id: alice.id, status: "lobby", settings: { turnTimerSec: 60, characterMode: "random" } });
    const slots = await alice.client.from("room_players").select("slot, user_id, display_name");
    expect(slots.data).toEqual([{ slot: 0, user_id: alice.id, display_name: "Alice" }]);
  });

  it("joins by code (forgiving about case and dashes), idempotently", async () => {
    const pretty = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
    expect(await joinRoom(admin, bob.id, pretty)).toEqual({ roomId, code });
    expect(await joinRoom(admin, bob.id, `https://example.test/r/${code}`)).toEqual({ roomId, code });
    const slots = await loadSlots(admin, roomId);
    expect(slots.map((s) => [s.slot, s.displayName])).toEqual([
      [0, "Alice"],
      [1, "Bob"],
    ]);
    await failsWith(joinRoom(admin, carol.id, "ZZZZZZ"), "ROOM_NOT_FOUND");
    await failsWith(joinRoom(admin, carol.id, "not a code"), "ROOM_NOT_FOUND");
  });

  it("keeps outsiders out and host controls for the host", async () => {
    await failsWith(seatAction(admin, carol.id, roomId, { op: "ready", ready: true }), "ROOM_NOT_FOUND");
    await failsWith(updateSettings(admin, carol.id, roomId, { turnTimerSec: 30 }), "ROOM_NOT_FOUND");
    await failsWith(startRoom(admin, carol.id, roomId), "ROOM_NOT_FOUND");
    await failsWith(seatAction(admin, bob.id, roomId, { op: "add_npc" }), "NOT_HOST");
    await failsWith(seatAction(admin, bob.id, roomId, { op: "kick", slot: 0 }), "NOT_HOST");
    await failsWith(updateSettings(admin, bob.id, roomId, { turnTimerSec: 30 }), "NOT_HOST");
    await failsWith(startRoom(admin, bob.id, roomId), "NOT_HOST");
    await failsWith(seatAction(admin, alice.id, roomId, { op: "kick", slot: 0 }), "CANNOT_TARGET_SELF");
    const outside = await carol.client.from("room_players").select("slot").eq("room_id", roomId);
    expect(outside.data).toEqual([]);
  });

  it("manages NPC slots with the room's default difficulty", async () => {
    await updateSettings(admin, alice.id, roomId, { defaultNpcDifficulty: "hard" });
    await seatAction(admin, alice.id, roomId, { op: "add_npc" });
    await seatAction(admin, alice.id, roomId, { op: "add_npc", slot: 5, difficulty: "easy" });
    await failsWith(seatAction(admin, alice.id, roomId, { op: "add_npc", slot: 5 }), "SLOT_TAKEN");
    await failsWith(seatAction(admin, alice.id, roomId, { op: "remove_npc", slot: 1 }), "SLOT_EMPTY");
    await failsWith(seatAction(admin, alice.id, roomId, { op: "kick", slot: 2 }), "SLOT_EMPTY");
    await seatAction(admin, alice.id, roomId, { op: "npc_difficulty", slot: 2, difficulty: "medium" });
    let slots = await loadSlots(admin, roomId);
    expect(slots.filter((s) => s.isNpc).map((s) => [s.slot, s.npcDifficulty, s.displayName])).toEqual([
      [2, "medium", "Dusty (Bot)"],
      [5, "easy", "Slim (Bot)"],
    ]);
    await seatAction(admin, alice.id, roomId, { op: "remove_npc", slot: 5 });
    slots = await loadSlots(admin, roomId);
    expect(slots.map((s) => s.slot)).toEqual([0, 1, 2]);
  });

  it("merges settings patches", async () => {
    const settings = await updateSettings(admin, alice.id, roomId, { turnTimerSec: 30, characterMode: "choose_of_2" });
    expect(settings).toEqual({ turnTimerSec: 30, characterMode: "choose_of_2", afkTakeoverAfter: 2, defaultNpcDifficulty: "hard" });
    await updateSettings(admin, alice.id, roomId, { characterMode: "random" });
  });

  it("starts only with 4+ seats and every other human ready", async () => {
    await failsWith(startRoom(admin, alice.id, roomId), "TOO_FEW_SEATS");
    await seatAction(admin, alice.id, roomId, { op: "add_npc" });
    await failsWith(startRoom(admin, alice.id, roomId), "PLAYERS_NOT_READY");
    await seatAction(admin, bob.id, roomId, { op: "ready", ready: true });
  });

  it("start is claimed once: two simultaneous starts make exactly one game", async () => {
    const results = await Promise.allSettled([startRoom(admin, alice.id, roomId), startRoom(admin, alice.id, roomId)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    expect((failed?.reason as ApiError).code).toBe("ROOM_NOT_IN_LOBBY");

    const games = await admin.from("games").select("id, version, status").eq("room_id", roomId);
    expect(games.data).toHaveLength(1);
    const game = games.data?.[0];
    expect(game).toMatchObject({ version: 1, status: "active" });
    const room = await alice.client.from("rooms").select("status, current_game_id").eq("id", roomId).single();
    expect(room.data).toEqual({ status: "in_game", current_game_id: game?.id });
  });

  it("seats everyone, gives each human only their own view, and keeps roles private", async () => {
    const { data: room } = await admin.from("rooms").select("current_game_id").eq("id", roomId).single();
    const gameId = room?.current_game_id ?? "";
    const seats = await bob.client.from("game_seats").select("seat, user_id, is_npc, display_name").eq("game_id", gameId).order("seat");
    expect(seats.data?.map((s) => s.seat)).toEqual([0, 1, 2, 3]);
    expect(seats.data?.filter((s) => !s.is_npc).map((s) => s.user_id).sort()).toEqual([alice.id, bob.id].sort());

    for (const me of [alice, bob]) {
      const views = await me.client.from("player_views").select("user_id, seat, version, view").eq("game_id", gameId);
      expect(views.data).toHaveLength(1);
      const row = views.data?.[0];
      expect(row?.user_id).toBe(me.id);
      expect(row?.version).toBe(1);
      const view = row?.view as { viewer: number; myRole: string | null; players: { seat: number; role: string | null }[] };
      expect(view.viewer).toBe(row?.seat);
      expect(view.myRole).not.toBeNull();
      // Only the viewer's own role and the Sheriff's are visible (docs/03 §2.6).
      for (const p of view.players) if (p.seat !== view.viewer && p.role !== null) expect(p.role).toBe("sheriff");
    }

    // Role events: the public rows only reveal the Sheriff; each human gets their own role privately.
    const aliceEvents = await alice.client.from("game_events").select("recipient_user_id, payload").eq("game_id", gameId);
    const bobEvents = await bob.client.from("game_events").select("recipient_user_id, payload").eq("game_id", gameId);
    expect(aliceEvents.data?.every((e) => e.recipient_user_id === null || e.recipient_user_id === alice.id)).toBe(true);
    expect(bobEvents.data?.every((e) => e.recipient_user_id === null || e.recipient_user_id === bob.id)).toBe(true);
    const roles = (rows: { payload: unknown }[] | null | undefined) =>
      (rows ?? []).map((e) => e.payload as { t: string; role?: string }).filter((p) => p.t === "ROLE_ASSIGNED");
    expect(roles(aliceEvents.data?.filter((e) => e.recipient_user_id === null)).every((p) => p.role === "sheriff")).toBe(true);
    expect(roles(aliceEvents.data).length).toBeGreaterThanOrEqual(1);
    const outsider = await carol.client.from("game_events").select("id").eq("game_id", gameId);
    expect(outsider.data).toEqual([]);
    const secret = await alice.client.from("games").select("state").eq("id", gameId);
    expect(secret.data).toEqual([]);
  });

  it("locks the lobby once the game runs (members can still find their room)", async () => {
    const dave = await anonymousUser("Dave");
    users.push(dave.id);
    await failsWith(joinRoom(admin, dave.id, code), "ROOM_NOT_IN_LOBBY");
    expect(await joinRoom(admin, bob.id, code)).toEqual({ roomId, code });
    await failsWith(seatAction(admin, bob.id, roomId, { op: "leave" }), "ROOM_NOT_IN_LOBBY");
    await failsWith(startRoom(admin, alice.id, roomId), "ROOM_NOT_IN_LOBBY");
  });

  it("refuses a full room, hands over host on leave, and closes the room when the last human leaves", async () => {
    const ref = await createRoom(admin, alice.id);
    rooms.push(ref.roomId);
    await joinRoom(admin, bob.id, ref.code);
    for (let i = 0; i < 5; i++) await seatAction(admin, alice.id, ref.roomId, { op: "add_npc" });
    await failsWith(joinRoom(admin, carol.id, ref.code), "ROOM_FULL");
    await failsWith(seatAction(admin, alice.id, ref.roomId, { op: "add_npc" }), "ROOM_FULL");

    await seatAction(admin, alice.id, ref.roomId, { op: "leave" });
    const after = await admin.from("rooms").select("host_id").eq("id", ref.roomId).single();
    expect(after.data?.host_id).toBe(bob.id);
    const aliceSees = await alice.client.from("rooms").select("id").eq("id", ref.roomId);
    expect(aliceSees.data).toEqual([]);

    await joinRoom(admin, carol.id, ref.code); // alice's slot is free again
    await seatAction(admin, bob.id, ref.roomId, { op: "kick", slot: 0 });
    expect((await loadSlots(admin, ref.roomId)).some((s) => s.userId === carol.id)).toBe(false);

    await seatAction(admin, bob.id, ref.roomId, { op: "leave" });
    const gone = await admin.from("rooms").select("id").eq("id", ref.roomId);
    expect(gone.data).toEqual([]);
  });
});
