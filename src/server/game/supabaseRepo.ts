import "server-only";
import { roleWon } from "@/ai";
import { parseRoomSettings } from "@/lib/rooms/rules";
import type { Database } from "@/lib/supabase/types";
import { dbFailure } from "../errors";
import type { Db } from "../rooms/roomService";
import { asJson, type CommitArgs } from "./commitPayload";
import { VersionConflictError, type GameRepo, type LoadedGame } from "./repo";
import { readServerGame } from "./serverGame";

type RpcArgs = Database["public"]["Functions"]["commit_game_action"]["Args"];

/** commit_game_action (docs/04 §3) with the stale-version case turned into VersionConflictError. */
export async function commitViaRpc(db: Db, args: CommitArgs): Promise<number> {
  // The generated RPC types mark every SQL parameter non-null; CommitArgs keeps the real nullability.
  const { data, error } = await db.rpc("commit_game_action", args as RpcArgs);
  if (error) {
    if (error.message.includes("VERSION_CONFLICT")) throw new VersionConflictError();
    throw dbFailure("commit", error);
  }
  return data;
}

/** GameRepo over Supabase with the service-role client (server only, docs/04 §1). */
export function supabaseGameRepo(db: Db): GameRepo {
  return {
    async load(gameId) {
      const game = await db.from("games").select("id, room_id, version, status, prompt_deadline, state").eq("id", gameId).maybeSingle();
      if (game.error) throw dbFailure("load game", game.error);
      if (!game.data) return null;
      const [seats, room] = await Promise.all([
        db.from("game_seats").select("*").eq("game_id", gameId).order("seat"),
        db.from("rooms").select("settings").eq("id", game.data.room_id).maybeSingle(),
      ]);
      if (seats.error) throw dbFailure("load seats", seats.error);
      if (room.error) throw dbFailure("load room settings", room.error);
      return {
        id: game.data.id,
        roomId: game.data.room_id,
        version: game.data.version,
        status: game.data.status as LoadedGame["status"],
        deadline: game.data.prompt_deadline,
        sg: readServerGame(game.data.state),
        settings: parseRoomSettings(room.data?.settings ?? {}),
        seats: seats.data.map((s) => ({
          seat: s.seat,
          userId: s.user_id,
          isNpc: s.is_npc,
          npcDifficulty: s.npc_difficulty,
          timeouts: s.timeouts,
          afkTakeover: s.afk_takeover,
        })),
      };
    },

    commit: (args) => commitViaRpc(db, args),

    async finish(g) {
      const winner = g.sg.game.winner;
      // Only the room's current game may close it (an older game cannot clobber a rematch).
      const room = await db
        .from("rooms")
        .update({ status: "finished", updated_at: new Date().toISOString() })
        .eq("id", g.roomId)
        .eq("current_game_id", g.id);
      if (room.error) throw dbFailure("finish room", room.error);

      // docs/04 player_stats (P2). Read-modify-write is fine: one winning commit per game, one row per human.
      for (const s of g.seats) {
        if (!s.userId) continue;
        const role = g.sg.game.players[s.seat]?.role;
        if (!role) continue;
        const prev = await db.from("player_stats").select("*").eq("user_id", s.userId).maybeSingle();
        if (prev.error) throw dbFailure("load stats", prev.error);
        const won = roleWon(role, winner);
        const byRole = { ...((prev.data?.wins_by_role as Record<string, number> | null) ?? {}) };
        if (won) byRole[role] = (byRole[role] ?? 0) + 1;
        const up = await db.from("player_stats").upsert({
          user_id: s.userId,
          games_played: (prev.data?.games_played ?? 0) + 1,
          wins: (prev.data?.wins ?? 0) + (won ? 1 : 0),
          wins_by_role: asJson(byRole),
          updated_at: new Date().toISOString(),
        });
        if (up.error) throw dbFailure("save stats", up.error);
      }
    },
  };
}
