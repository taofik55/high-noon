import "server-only";
import type { GameConfig } from "@/engine";
import { parseRoomSettings, shuffleSeats, startBlockers, type LobbySlot } from "@/lib/rooms/rules";
import type { Database } from "@/lib/supabase/types";
import { ApiError, dbFailure } from "../errors";
import { asJson, commitArgs, type SeatOwner } from "../game/commitPayload";
import { newServerGame } from "../game/serverGame";
import { commitViaRpc } from "../game/supabaseRepo";
import { cryptoIndex, loadRoom, loadSlots, type Db } from "./roomService";

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];

/**
 * Creates and publishes a new game for the room's current slots. Claims the room first (fromStatus → in_game in one
 * conditional update) so a double click or two tabs cannot create two games, seats everyone at random, seeds the
 * engine and the bots server-side (docs/03 §2.7) and publishes the first views and events through the commit RPC. Any
 * failure after the claim deletes the half-made game and puts the room back as it was.
 *
 * Bots do not move here: the players' clients call resync on arrival, which runs them (gameService.performResync).
 */
async function launchGame(db: Db, room: RoomRow, slots: readonly LobbySlot[], fromStatus: "lobby" | "finished", now: Date): Promise<{ gameId: string }> {
  const claim = await db
    .from("rooms")
    .update({ status: "in_game", updated_at: now.toISOString() })
    .eq("id", room.id)
    .eq("status", fromStatus)
    .select("id");
  if (claim.error) throw dbFailure("claim room", claim.error);
  if (claim.data.length === 0) throw new ApiError(fromStatus === "lobby" ? "ROOM_NOT_IN_LOBBY" : "GAME_NOT_FINISHED");

  let gameId: string | null = null;
  try {
    const settings = parseRoomSettings(room.settings);
    const seated = shuffleSeats(slots, cryptoIndex);
    const config: GameConfig = {
      characterMode: settings.characterMode,
      players: seated.map((s) =>
        s.isNpc ? { name: s.displayName, isNpc: true, npcDifficulty: s.npcDifficulty ?? "medium" } : { name: s.displayName, isNpc: false },
      ),
    };
    const { sg, events } = newServerGame(config, crypto.randomUUID(), crypto.randomUUID());

    const game = await db.from("games").insert({ room_id: room.id, state: asJson(sg) }).select("id").single();
    if (game.error) throw dbFailure("insert game", game.error);
    gameId = game.data.id;

    const seatRows = seated.map((s, seat) => ({
      game_id: game.data.id,
      seat,
      user_id: s.userId,
      is_npc: s.isNpc,
      npc_difficulty: s.npcDifficulty,
      display_name: s.displayName,
    }));
    const seats = await db.from("game_seats").insert(seatRows, { defaultToNull: false });
    if (seats.error) throw dbFailure("insert seats", seats.error);

    const owners: SeatOwner[] = seated.map((s, seat) => ({ seat, userId: s.userId }));
    await commitViaRpc(
      db,
      commitArgs({ gameId, expectedVersion: 0, stored: sg, state: sg.game, events, seats: owners, turnTimerSec: settings.turnTimerSec, now, actor: null }),
    );

    const link = await db.from("rooms").update({ current_game_id: gameId }).eq("id", room.id);
    if (link.error) throw dbFailure("link game", link.error);
    return { gameId };
  } catch (e) {
    if (gameId) await db.from("games").delete().eq("id", gameId);
    await db.from("rooms").update({ status: fromStatus, current_game_id: room.current_game_id }).eq("id", room.id);
    throw e;
  }
}

async function loadAsHost(db: Db, userId: string, roomId: string) {
  const room = await loadRoom(db, roomId);
  const slots = await loadSlots(db, roomId);
  if (!slots.some((s) => s.userId === userId)) throw new ApiError("ROOM_NOT_FOUND");
  if (room.host_id !== userId) throw new ApiError("NOT_HOST");
  return { room, slots };
}

/** docs/03 §5.4 start: host only; needs 4–7 seats and every other human ready. */
export async function startRoom(db: Db, userId: string, roomId: string, now: Date = new Date()): Promise<{ gameId: string }> {
  const { room, slots } = await loadAsHost(db, userId, roomId);
  if (room.status !== "lobby") throw new ApiError("ROOM_NOT_IN_LOBBY");
  const [blocker] = startBlockers(slots, userId);
  if (blocker) throw new ApiError(blocker);
  return launchGame(db, room, slots, "lobby", now);
}

/**
 * docs/03 §5.4 rematch (docs/01 §5.2): after a game, the host deals again with the same seats (new seating, roles
 * and characters), or takes everyone back to the lobby to change bots or settings.
 */
export async function rematchRoom(
  db: Db,
  userId: string,
  roomId: string,
  mode: "rematch" | "lobby",
  now: Date = new Date(),
): Promise<{ gameId: string | null }> {
  const { room, slots } = await loadAsHost(db, userId, roomId);
  if (room.status !== "finished") throw new ApiError("GAME_NOT_FINISHED");
  if (mode === "rematch") {
    if (startBlockers(slots, userId).includes("TOO_FEW_SEATS")) throw new ApiError("TOO_FEW_SEATS");
    return launchGame(db, room, slots, "finished", now);
  }
  // A fresh lobby: everyone confirms again. Reset first, so nobody arrives to stale ready flags.
  const unready = await db.from("room_players").update({ is_ready: false }).eq("room_id", roomId).eq("is_npc", false);
  if (unready.error) throw dbFailure("reset ready", unready.error);
  const back = await db
    .from("rooms")
    .update({ status: "lobby", current_game_id: null, updated_at: now.toISOString() })
    .eq("id", roomId)
    .eq("status", "finished")
    .select("id");
  if (back.error) throw dbFailure("back to lobby", back.error);
  if (back.data.length === 0) throw new ApiError("GAME_NOT_FINISHED");
  return { gameId: null };
}
