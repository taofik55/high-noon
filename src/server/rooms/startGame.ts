import "server-only";
import { createGame, type GameConfig } from "@/engine";
import { parseRoomSettings, shuffleSeats, startBlockers } from "@/lib/rooms/rules";
import type { Database } from "@/lib/supabase/types";
import { ApiError, dbFailure } from "../errors";
import { asJson, commitArgs, type SeatOwner } from "../game/commitPayload";
import { cryptoIndex, loadRoom, loadSlots, type Db } from "./roomService";

type RpcArgs = Database["public"]["Functions"]["commit_game_action"]["Args"];

/**
 * docs/03 §5.4 start: host only. Claims the room first (lobby → in_game in one conditional update) so a double click
 * or two tabs cannot create two games, then seats everyone at random, creates the game with a server-only seed
 * (docs/03 §2.7) and publishes the first views and events through the commit RPC. Any failure after the claim
 * deletes the half-made game and reopens the lobby.
 *
 * NPCs do not move yet: the server NPC loop arrives with gameService in Phase 11.
 */
export async function startRoom(db: Db, userId: string, roomId: string, now: Date = new Date()): Promise<{ gameId: string }> {
  const room = await loadRoom(db, roomId);
  const slots = await loadSlots(db, roomId);
  if (!slots.some((s) => s.userId === userId)) throw new ApiError("ROOM_NOT_FOUND");
  if (room.host_id !== userId) throw new ApiError("NOT_HOST");
  if (room.status !== "lobby") throw new ApiError("ROOM_NOT_IN_LOBBY");
  const [blocker] = startBlockers(slots, userId);
  if (blocker) throw new ApiError(blocker);

  const claim = await db
    .from("rooms")
    .update({ status: "in_game", updated_at: now.toISOString() })
    .eq("id", roomId)
    .eq("status", "lobby")
    .select("id");
  if (claim.error) throw dbFailure("claim room", claim.error);
  if (claim.data.length === 0) throw new ApiError("ROOM_NOT_IN_LOBBY");

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
    const { state, events } = createGame(config, crypto.randomUUID());

    const game = await db.from("games").insert({ room_id: roomId, state: asJson(state) }).select("id").single();
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
    const args = commitArgs({ gameId, expectedVersion: 0, state, events, seats: owners, turnTimerSec: settings.turnTimerSec, now });
    // The generated RPC types mark every SQL parameter non-null; CommitArgs keeps the real nullability.
    const commit = await db.rpc("commit_game_action", args as RpcArgs);
    if (commit.error) throw dbFailure("commit first state", commit.error);

    const link = await db.from("rooms").update({ current_game_id: gameId }).eq("id", roomId);
    if (link.error) throw dbFailure("link game", link.error);
    return { gameId };
  } catch (e) {
    if (gameId) await db.from("games").delete().eq("id", gameId);
    await db.from("rooms").update({ status: "lobby", current_game_id: null }).eq("id", roomId);
    throw e;
  }
}
