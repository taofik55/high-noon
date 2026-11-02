import { describe, expect, it } from "vitest";
import { applyAction, createGame, currentActor, defaultActionOnTimeout, type GameConfig, type GameEvent } from "@/engine";
import { buildEventRows, buildViews, commitArgs, promptDeadline, type SeatOwner } from "@/server/game/commitPayload";
import { takeToken } from "@/server/rateLimit";

const config: GameConfig = {
  characterMode: "random",
  players: [
    { name: "Ann", isNpc: false },
    { name: "Ben", isNpc: false },
    { name: "Bot A", isNpc: true, npcDifficulty: "easy" },
    { name: "Bot B", isNpc: true, npcDifficulty: "hard" },
  ],
};
const seats: SeatOwner[] = [
  { seat: 0, userId: "user-ann" },
  { seat: 1, userId: "user-ben" },
  { seat: 2, userId: null },
  { seat: 3, userId: null },
];

describe("commit payload (docs/03 §5.1 step 7)", () => {
  it("builds one view per human, each for its own seat only", () => {
    const { state } = createGame(config, "seed-views");
    const views = buildViews(state, seats);
    expect(views.map((v) => [v.user_id, v.seat])).toEqual([
      ["user-ann", 0],
      ["user-ben", 1],
    ]);
    for (const v of views) {
      const view = v.view as { viewer: number; myRole: string; players: { seat: number; role: string | null }[] };
      expect(view.viewer).toBe(v.seat);
      expect(view.myRole).toBe(state.players[v.seat]?.role);
      for (const p of view.players) if (p.seat !== v.seat && p.role !== null) expect(p.role).toBe("sheriff");
    }
  });

  it("publishes public rows plus private rows only where a human sees more", () => {
    const { events } = createGame(config, "seed-events");
    const rows = buildEventRows(events, seats);
    const roles = events.filter((e): e is Extract<GameEvent, { t: "ROLE_ASSIGNED" }> => e.t === "ROLE_ASSIGNED");
    expect(roles).toHaveLength(4);
    const roleRows = rows.filter((r) => (r.payload as { t: string }).t === "ROLE_ASSIGNED");
    // Public: only the Sheriff. Private: each human's own non-Sheriff role. NPC roles appear nowhere.
    for (const r of roleRows) {
      const p = r.payload as { seat: number; role: string };
      if (r.recipient_user_id === null) expect(p.role).toBe("sheriff");
      else {
        expect(seats.find((s) => s.userId === r.recipient_user_id)?.seat).toBe(p.seat);
        expect(p.role).not.toBe("sheriff");
      }
    }
    const npcSeats = new Set([2, 3]);
    const leakedNpcRole = roleRows.some((r) => {
      const p = r.payload as { seat: number; role: string };
      return npcSeats.has(p.seat) && p.role !== "sheriff";
    });
    expect(leakedNpcRole).toBe(false);

    // Private draws: the owner gets card ids, the public row has none.
    for (const r of rows.filter((x) => (x.payload as { t: string }).t === "CARDS_DRAWN")) {
      const p = r.payload as { seat: number; cardIds?: string[] };
      if (r.recipient_user_id === null) expect(p.cardIds).toBeUndefined();
      else expect(seats.find((s) => s.userId === r.recipient_user_id)?.seat).toBe(p.seat);
    }
    // Every row keeps the engine's order index.
    expect(rows.every((r) => r.seq >= 0 && r.seq < events.length)).toBe(true);
  });

  it("sets a prompt deadline only when a human must act and the timer is on", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    let { state } = createGame(config, "seed-deadline");
    // Walk until an NPC must act, then until a human must act, to check both branches.
    const seen = new Set<string>();
    for (let i = 0; i < 400 && seen.size < 2 && state.winner === null; i++) {
      const actor = currentActor(state);
      if (actor === null) break;
      const human = seats[actor]?.userId != null;
      const deadline = promptDeadline(state, seats, 60, now);
      if (human) expect(deadline).toBe("2026-11-02T12:01:00.000Z");
      else expect(deadline).toBeNull();
      seen.add(human ? "human" : "npc");
      expect(promptDeadline(state, seats, 0, now)).toBeNull();
      state = applyAction(state, actor, defaultActionOnTimeout(state, actor)).state;
    }
    expect([...seen].sort()).toEqual(["human", "npc"]);
  });

  it("produces RPC arguments with the expected version and status", () => {
    const { state, events } = createGame(config, "seed-args");
    const args = commitArgs({ gameId: "g1", expectedVersion: 0, state, events, seats, turnTimerSec: 0, now: new Date() });
    expect(args).toMatchObject({ p_game_id: "g1", p_expected_version: 0, p_status: "active", p_winner: null, p_prompt_deadline: null });
    expect(JSON.stringify(args.p_views)).not.toContain('"rng"');
  });
});

describe("rate limit (docs/03 §6)", () => {
  it("allows a burst up to capacity, then refills over time", () => {
    const limit = { capacity: 3, refillPerSec: 1 };
    const key = `test-${Math.random()}`;
    expect([0, 0, 0, 0].map(() => takeToken(key, limit, 1000))).toEqual([true, true, true, false]);
    expect(takeToken(key, limit, 1500)).toBe(false);
    expect(takeToken(key, limit, 2100)).toBe(true);
  });
});
