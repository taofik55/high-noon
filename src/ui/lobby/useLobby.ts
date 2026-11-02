"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseRoomSettings, type LobbySlot, type RoomSettings } from "@/lib/rooms/rules";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type SlotRow = Database["public"]["Tables"]["room_players"]["Row"];

export interface LobbyRoom {
  id: string;
  code: string;
  hostId: string;
  status: Database["public"]["Enums"]["room_status"];
  settings: RoomSettings;
  currentGameId: string | null;
}

export type LobbyState =
  | { kind: "loading" }
  /** Not a member (or no such room): RLS shows nothing, so the two look the same on purpose. */
  | { kind: "outside" }
  /** Was a member a moment ago: kicked, or the room was closed. */
  | { kind: "gone" }
  | { kind: "member"; room: LobbyRoom; slots: LobbySlot[] };

const toSlot = (r: SlotRow): LobbySlot => ({
  slot: r.slot,
  userId: r.user_id,
  isNpc: r.is_npc,
  npcDifficulty: r.npc_difficulty,
  displayName: r.display_name,
  isReady: r.is_ready,
  joinedAt: r.joined_at,
});

// Realtime is the fast path; this slow poll only covers a dropped socket.
const FALLBACK_POLL_MS = 15_000;

/**
 * Lobby data for one room code (docs/03 §5.4): reads go through RLS with the user's own session, slots and room
 * changes arrive via postgres_changes, and who is online via a presence channel `room:<code>`.
 */
export function useLobby(code: string, userId: string | null) {
  const [state, setState] = useState<LobbyState>({ kind: "loading" });
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());
  const wasMember = useRef(false);

  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !userId) return;
    const { data: room } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room) {
      setState({ kind: wasMember.current ? "gone" : "outside" });
      return;
    }
    const { data: rows } = await supabase.from("room_players").select("*").eq("room_id", room.id).order("slot");
    const slots = (rows ?? []).map(toSlot);
    if (!slots.some((s) => s.userId === userId)) {
      setState({ kind: wasMember.current ? "gone" : "outside" });
      return;
    }
    wasMember.current = true;
    setState({
      kind: "member",
      room: {
        id: room.id,
        code: room.code,
        hostId: room.host_id,
        status: room.status,
        settings: parseRoomSettings(room.settings),
        currentGameId: room.current_game_id,
      },
      slots,
    });
  }, [code, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const roomId = state.kind === "member" ? state.room.id : null;
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !roomId || !userId) return;
    const onChange = () => void refresh();
    // DELETE events cannot be filtered server-side and carry only the primary key, so match the room here.
    const channel = supabase
      .channel(`room:${code}`, { config: { presence: { key: userId } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_players" }, (p) => {
        if ((p.old as Partial<SlotRow>).room_id === roomId) onChange();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "rooms" }, (p) => {
        if ((p.old as { id?: string }).id === roomId) onChange();
      })
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ at: new Date().toISOString() });
          onChange(); // anything that changed while subscribing
        }
      });
    const poll = window.setInterval(onChange, FALLBACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") onChange();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [code, roomId, userId, refresh]);

  return { state, online, refresh };
}
