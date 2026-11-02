"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  status: Database["public"]["Enums"]["room_status"];
  currentGameId: string | null;
}

/**
 * The room this game belongs to (found through rooms.current_game_id, readable by members via RLS), kept live so every
 * player follows a rematch or a return to the lobby.
 */
export function useGameRoom(gameId: string | undefined, userId: string | null): GameRoom | null {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  const load = useCallback(
    async (by: { gameId: string } | { roomId: string }) => {
      const supabase = getBrowserSupabase();
      if (!supabase || !userId) return;
      const q = supabase.from("rooms").select("id, code, host_id, status, current_game_id");
      const { data } = await ("gameId" in by ? q.eq("current_game_id", by.gameId) : q.eq("id", by.roomId)).maybeSingle();
      if (!data) return;
      setRoomId(data.id);
      setRoom({ id: data.id, code: data.code, hostId: data.host_id, status: data.status, currentGameId: data.current_game_id });
    },
    [userId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of external data (async)
    if (gameId) void load({ gameId });
  }, [gameId, load]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !roomId) return;
    const channel = supabase
      .channel(`room-watch:${roomId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => void load({ roomId }))
      .subscribe();
    // Realtime is the fast path; a slow poll covers a dropped socket at the end of a game.
    const poll = window.setInterval(() => void load({ roomId }), 15_000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  return room;
}
