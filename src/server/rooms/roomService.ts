import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettingsPatch, SeatOp } from "@/lib/rooms/api";
import {
  DEFAULT_ROOM_SETTINGS,
  firstFreeSlot,
  nextHost,
  normalizeRoomCode,
  npcName,
  parseRoomSettings,
  randomRoomCode,
  type LobbySlot,
  type RoomSettings,
} from "@/lib/rooms/rules";
import type { Database } from "@/lib/supabase/types";
import { ApiError, dbFailure } from "../errors";

// Room lifecycle (docs/03 §5.4). Callers pass the service-role client and an authenticated user id; every
// permission check lives here because RLS gives clients no write access at all (docs/04 §1).

export type Db = SupabaseClient<Database>;
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type SlotRow = Database["public"]["Tables"]["room_players"]["Row"];

const UNIQUE_VIOLATION = "23505";

/** Uniform index in [0, n) from the platform CSPRNG (rejection sampling avoids modulo bias). */
export function cryptoIndex(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] as number;
    if (v < limit) return v % n;
  }
}

export function toLobbySlot(row: SlotRow): LobbySlot {
  return {
    slot: row.slot,
    userId: row.user_id,
    isNpc: row.is_npc,
    npcDifficulty: row.npc_difficulty,
    displayName: row.display_name,
    isReady: row.is_ready,
    joinedAt: row.joined_at,
  };
}

export async function loadRoom(db: Db, roomId: string): Promise<RoomRow> {
  const { data, error } = await db.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error) throw dbFailure("load room", error);
  if (!data) throw new ApiError("ROOM_NOT_FOUND");
  return data;
}

export async function loadSlots(db: Db, roomId: string): Promise<LobbySlot[]> {
  const { data, error } = await db.from("room_players").select("*").eq("room_id", roomId).order("slot");
  if (error) throw dbFailure("load slots", error);
  return data.map(toLobbySlot);
}

async function profileName(db: Db, userId: string): Promise<string> {
  const { data, error } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (error) throw dbFailure("load profile", error);
  return data?.display_name ?? "Koboi";
}

async function touch(db: Db, roomId: string): Promise<void> {
  // updated_at drives lobby housekeeping (docs/04 §4)
  const { error } = await db.from("rooms").update({ updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) throw dbFailure("touch room", error);
}

export interface RoomRef {
  roomId: string;
  code: string;
}

export async function createRoom(db: Db, userId: string): Promise<RoomRef> {
  const name = await profileName(db, userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode(cryptoIndex);
    const { data, error } = await db
      .from("rooms")
      .insert({ code, host_id: userId, settings: DEFAULT_ROOM_SETTINGS })
      .select("id")
      .single();
    if (error?.code === UNIQUE_VIOLATION) continue; // code already taken: draw another
    if (error) throw dbFailure("create room", error);
    const host = await db.from("room_players").insert({ room_id: data.id, slot: 0, user_id: userId, display_name: name });
    if (host.error) {
      await db.from("rooms").delete().eq("id", data.id);
      throw dbFailure("seat host", host.error);
    }
    return { roomId: data.id, code };
  }
  throw new ApiError("INTERNAL", "could not find a free room code");
}

/** Joining is idempotent: a member (also during a game) just gets the room back. */
export async function joinRoom(db: Db, userId: string, rawCode: string): Promise<RoomRef> {
  const code = normalizeRoomCode(rawCode);
  if (!code) throw new ApiError("ROOM_NOT_FOUND");
  const { data: room, error } = await db.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw dbFailure("find room", error);
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  const ref = { roomId: room.id, code: room.code };

  const name = await profileName(db, userId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slots = await loadSlots(db, room.id);
    if (slots.some((s) => s.userId === userId)) return ref;
    if (room.status !== "lobby") throw new ApiError("ROOM_NOT_IN_LOBBY");
    const slot = firstFreeSlot(slots);
    if (slot === null) throw new ApiError("ROOM_FULL");
    const ins = await db.from("room_players").insert({ room_id: room.id, slot, user_id: userId, display_name: name });
    if (ins.error?.code === UNIQUE_VIOLATION) continue; // someone took that slot at the same moment: look again
    if (ins.error) throw dbFailure("join room", ins.error);
    await touch(db, room.id);
    return ref;
  }
  throw new ApiError("ROOM_FULL");
}

function requireSlot(slots: readonly LobbySlot[], slot: number, kind: "npc" | "human"): LobbySlot {
  const target = slots.find((s) => s.slot === slot);
  if (!target || target.isNpc !== (kind === "npc")) throw new ApiError("SLOT_EMPTY");
  return target;
}

export async function seatAction(db: Db, userId: string, roomId: string, op: SeatOp): Promise<void> {
  const room = await loadRoom(db, roomId);
  const slots = await loadSlots(db, roomId);
  const me = slots.find((s) => s.userId === userId);
  // Outsiders learn nothing about a room they are not in.
  if (!me) throw new ApiError("ROOM_NOT_FOUND");
  if (room.status !== "lobby") throw new ApiError("ROOM_NOT_IN_LOBBY");
  const isHost = room.host_id === userId;
  const hostOnly = () => {
    if (!isHost) throw new ApiError("NOT_HOST");
  };
  const del = async (slot: number, context: string) => {
    const { error } = await db.from("room_players").delete().eq("room_id", roomId).eq("slot", slot);
    if (error) throw dbFailure(context, error);
  };

  switch (op.op) {
    case "ready": {
      const { error } = await db.from("room_players").update({ is_ready: op.ready }).eq("room_id", roomId).eq("user_id", userId);
      if (error) throw dbFailure("ready", error);
      break;
    }
    case "leave": {
      await del(me.slot, "leave");
      if (isHost) {
        const heir = nextHost(slots, userId);
        if (heir === null) {
          // No human is left to host: the room goes (and its NPC slots with it, by cascade).
          const { error } = await db.from("rooms").delete().eq("id", roomId);
          if (error) throw dbFailure("close room", error);
          return;
        }
        const { error } = await db.from("rooms").update({ host_id: heir }).eq("id", roomId);
        if (error) throw dbFailure("hand over host", error);
      }
      break;
    }
    case "add_npc": {
      hostOnly();
      const slot = op.slot ?? firstFreeSlot(slots);
      if (slot === null) throw new ApiError("ROOM_FULL");
      if (slots.some((s) => s.slot === slot)) throw new ApiError("SLOT_TAKEN");
      const difficulty = op.difficulty ?? parseRoomSettings(room.settings).defaultNpcDifficulty;
      const { error } = await db
        .from("room_players")
        .insert({ room_id: roomId, slot, is_npc: true, npc_difficulty: difficulty, display_name: npcName(slots), is_ready: true });
      if (error?.code === UNIQUE_VIOLATION) throw new ApiError("SLOT_TAKEN");
      if (error) throw dbFailure("add npc", error);
      break;
    }
    case "remove_npc":
      hostOnly();
      requireSlot(slots, op.slot, "npc");
      await del(op.slot, "remove npc");
      break;
    case "npc_difficulty": {
      hostOnly();
      requireSlot(slots, op.slot, "npc");
      const { error } = await db.from("room_players").update({ npc_difficulty: op.difficulty }).eq("room_id", roomId).eq("slot", op.slot);
      if (error) throw dbFailure("npc difficulty", error);
      break;
    }
    case "kick": {
      hostOnly();
      const target = requireSlot(slots, op.slot, "human");
      if (target.userId === userId) throw new ApiError("CANNOT_TARGET_SELF");
      await del(op.slot, "kick");
      break;
    }
  }
  await touch(db, roomId);
}

export async function updateSettings(db: Db, userId: string, roomId: string, patch: SettingsPatch): Promise<RoomSettings> {
  const room = await loadRoom(db, roomId);
  if (room.host_id !== userId) {
    const slots = await loadSlots(db, roomId);
    throw new ApiError(slots.some((s) => s.userId === userId) ? "NOT_HOST" : "ROOM_NOT_FOUND");
  }
  if (room.status !== "lobby") throw new ApiError("ROOM_NOT_IN_LOBBY");
  const settings = parseRoomSettings({ ...parseRoomSettings(room.settings), ...patch });
  const { error } = await db.from("rooms").update({ settings, updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) throw dbFailure("update settings", error);
  return settings;
}
