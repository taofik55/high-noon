import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";

// Proves the row-level security of docs/04 against the local Supabase stack (`pnpm db:start`, then `pnpm test:db`).
// Real anonymous users act through the publishable key exactly like browsers do; fixtures are written with the
// secret key exactly like the server will.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";

type Db = SupabaseClient<Database>;
// Generated types cannot see that these SQL parameters accept null; the function body handles it (docs/04 §3).
type CommitArgs = Omit<Database["public"]["Functions"]["commit_game_action"]["Args"], "p_winner" | "p_prompt_deadline"> & {
  p_winner: string | null;
  p_prompt_deadline: string | null;
};
const commitGameAction = (db: Db, args: CommitArgs) =>
  db.rpc("commit_game_action", args as Database["public"]["Functions"]["commit_game_action"]["Args"]);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

async function anonymousUser(name?: string): Promise<{ client: Db; id: string }> {
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  const { data, error } = await client.auth.signInAnonymously(name ? { options: { data: { display_name: name } } } : undefined);
  if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  return { client, id: data.user.id };
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

describe("RLS (docs/04 §3)", () => {
  let admin: Db;
  let alice: { client: Db; id: string };
  let bob: { client: Db; id: string };
  let carol: { client: Db; id: string }; // not in the room or the game
  let roomId = "";
  let gameId = "";
  const created: string[] = [];

  beforeAll(async () => {
    if (!URL || !PUBLISHABLE || !SECRET) throw new Error("Local Supabase env missing: run `pnpm db:start` and fill .env.local");
    admin = createClient<Database>(URL, SECRET, opts);
    alice = await anonymousUser("Alice");
    bob = await anonymousUser("Bob");
    carol = await anonymousUser("Carol");
    created.push(alice.id, bob.id, carol.id);

    const room = await admin.from("rooms").insert({ code: roomCode(), host_id: alice.id }).select("id").single();
    if (room.error) throw room.error;
    roomId = room.data.id;
    const players = await admin.from("room_players").insert([
      { room_id: roomId, slot: 0, user_id: alice.id, display_name: "Alice" },
      { room_id: roomId, slot: 1, user_id: bob.id, display_name: "Bob" },
      { room_id: roomId, slot: 2, is_npc: true, npc_difficulty: "medium", display_name: "Bot" },
    ], { defaultToNull: false }); // rows that omit is_npc get the column default, not null
    if (players.error) throw players.error;

    const game = await admin.from("games").insert({ room_id: roomId, state: { secret: "deck order and every hand" } }).select("id").single();
    if (game.error) throw game.error;
    gameId = game.data.id;
    const seats = await admin.from("game_seats").insert([
      { game_id: gameId, seat: 0, user_id: alice.id, display_name: "Alice" },
      { game_id: gameId, seat: 1, user_id: bob.id, display_name: "Bob" },
      { game_id: gameId, seat: 2, is_npc: true, npc_difficulty: "medium", display_name: "Bot" },
    ], { defaultToNull: false });
    if (seats.error) throw seats.error;

    // Through the real RPC: views and events land atomically with version 1.
    const commit = await commitGameAction(admin, {
      p_game_id: gameId,
      p_expected_version: 0,
      p_state: { secret: "still secret" },
      p_status: "active",
      p_winner: null,
      p_prompt_deadline: null,
      p_views: [
        { user_id: alice.id, seat: 0, view: { myHand: ["alice-card"] } },
        { user_id: bob.id, seat: 1, view: { myHand: ["bob-card"] } },
      ],
      p_events: [
        { seq: 0, recipient_user_id: null, payload: { t: "TURN_STARTED" } },
        { seq: 1, recipient_user_id: alice.id, payload: { t: "CARDS_DRAWN", cardIds: ["alice-card"] } },
        { seq: 1, recipient_user_id: bob.id, payload: { t: "CARDS_DRAWN", cardIds: ["bob-card"] } },
      ],
      p_seat_updates: [],
    });
    if (commit.error) throw commit.error;
    expect(commit.data).toBe(1);
  });

  afterAll(async () => {
    if (roomId) await admin.from("rooms").delete().eq("id", roomId);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("creates a profile for every new user, with the chosen nickname or a default", async () => {
    const { data } = await alice.client.from("profiles").select("display_name").eq("id", alice.id).single();
    expect(data?.display_name).toBe("Alice");
    const nameless = await anonymousUser();
    created.push(nameless.id);
    const { data: d2 } = await nameless.client.from("profiles").select("display_name").eq("id", nameless.id).single();
    expect(d2?.display_name).toMatch(/^Koboi-[0-9a-f]{4}$/);
  });

  it("never lets a client read games (the full secret state)", async () => {
    for (const user of [alice, bob, carol]) {
      const { data, error } = await user.client.from("games").select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("shows a player only their own player_views row", async () => {
    const { data } = await alice.client.from("player_views").select("user_id, view");
    expect(data).toEqual([{ user_id: alice.id, view: { myHand: ["alice-card"] } }]);
    const { data: bobs } = await alice.client.from("player_views").select("*").eq("user_id", bob.id);
    expect(bobs).toEqual([]);
  });

  it("shows public events and the player's own private events, never someone else's", async () => {
    const { data } = await alice.client.from("game_events").select("recipient_user_id, payload").order("seq");
    expect(data).toEqual([
      { recipient_user_id: null, payload: { t: "TURN_STARTED" } },
      { recipient_user_id: alice.id, payload: { t: "CARDS_DRAWN", cardIds: ["alice-card"] } },
    ]);
    const { data: leaked } = await alice.client.from("game_events").select("*").eq("recipient_user_id", bob.id);
    expect(leaked).toEqual([]);
  });

  it("lets members see their room, players and seats", async () => {
    const rooms = await alice.client.from("rooms").select("id");
    expect(rooms.data?.map((r) => r.id)).toEqual([roomId]);
    const players = await bob.client.from("room_players").select("slot").eq("room_id", roomId).order("slot");
    expect(players.data?.map((p) => p.slot)).toEqual([0, 1, 2]);
    const seats = await bob.client.from("game_seats").select("seat").eq("game_id", gameId);
    expect(seats.data).toHaveLength(3);
  });

  it("shows outsiders nothing of a room or game they are not in", async () => {
    for (const table of ["rooms", "room_players", "game_seats", "player_views", "game_events"] as const) {
      const { data, error } = await carol.client.from(table).select("*");
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("rejects every client write to game and room tables", async () => {
    const insertGame = await alice.client.from("games").insert({ room_id: roomId, state: {} });
    expect(insertGame.error).not.toBeNull();
    const insertEvent = await alice.client.from("game_events").insert({ game_id: gameId, version: 9, seq: 0, payload: {} });
    expect(insertEvent.error).not.toBeNull();
    const insertSeat = await carol.client.from("room_players").insert({ room_id: roomId, slot: 3, user_id: carol.id, display_name: "Carol" });
    expect(insertSeat.error).not.toBeNull();

    // Updates without a policy affect no rows; check the data did not change.
    await alice.client.from("player_views").update({ view: { myHand: ["forged"] } }).eq("user_id", alice.id);
    await alice.client.from("rooms").update({ status: "closed" }).eq("id", roomId);
    const view = await admin.from("player_views").select("view").eq("user_id", alice.id).single();
    expect(view.data?.view).toEqual({ myHand: ["alice-card"] });
    const room = await admin.from("rooms").select("status").eq("id", roomId).single();
    expect(room.data?.status).toBe("lobby");
  });

  it("does not let clients call the commit RPC", async () => {
    const { error } = await commitGameAction(alice.client, {
      p_game_id: gameId,
      p_expected_version: 1,
      p_state: {},
      p_status: "finished",
      p_winner: "outlaws",
      p_prompt_deadline: null,
      p_views: [],
      p_events: [],
      p_seat_updates: [],
    });
    expect(error).not.toBeNull();
    const game = await admin.from("games").select("version, status").eq("id", gameId).single();
    expect(game.data).toEqual({ version: 1, status: "active" });
  });

  it("commits atomically with optimistic versioning (VERSION_CONFLICT on a stale version)", async () => {
    const { error } = await commitGameAction(admin, {
      p_game_id: gameId,
      p_expected_version: 0,
      p_state: {},
      p_status: "active",
      p_winner: null,
      p_prompt_deadline: null,
      p_views: [],
      p_events: [],
      p_seat_updates: [],
    });
    expect(error?.message).toContain("VERSION_CONFLICT");
  });

  it("lets users rename only themselves", async () => {
    const own = await alice.client.from("profiles").update({ display_name: "Alicia" }).eq("id", alice.id).select("display_name");
    expect(own.data).toEqual([{ display_name: "Alicia" }]);
    await alice.client.from("profiles").update({ display_name: "Hacked" }).eq("id", bob.id);
    const bobs = await admin.from("profiles").select("display_name").eq("id", bob.id).single();
    expect(bobs.data?.display_name).toBe("Bob");
    const tooShort = await alice.client.from("profiles").update({ display_name: "A" }).eq("id", alice.id);
    expect(tooShort.error).not.toBeNull();
  });
});
