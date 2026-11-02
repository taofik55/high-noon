import { describe, expect, it } from "vitest";
import { actionBody, actionSchema } from "@/lib/online/api";
import { mergeEvents } from "@/net/online/OnlineAdapter";

describe("OnlineAdapter event merge (docs/03 §5.3)", () => {
  it("orders by (version, seq) and lets a private row replace the public one", () => {
    const events = mergeEvents([
      { version: 2, seq: 0, recipient_user_id: null, payload: { t: "TURN_STARTED", seat: 1, turn: 2 } },
      { version: 1, seq: 1, recipient_user_id: null, payload: { t: "CARDS_DRAWN", seat: 0, count: 2, from: "deck" } },
      { version: 1, seq: 1, recipient_user_id: "me", payload: { t: "CARDS_DRAWN", seat: 0, count: 2, cardIds: ["c01", "c02"], from: "deck" } },
      { version: 1, seq: 0, recipient_user_id: null, payload: { t: "PHASE", seat: 0, phase: "draw" } },
    ]);
    expect(events.map((e) => e.t)).toEqual(["PHASE", "CARDS_DRAWN", "TURN_STARTED"]);
    expect(events[1]).toMatchObject({ cardIds: ["c01", "c02"] });
  });

  it("keeps the private row whichever order the rows come in", () => {
    const events = mergeEvents([
      { version: 3, seq: 0, recipient_user_id: "me", payload: { t: "ROLE_ASSIGNED", seat: 2, role: "outlaw" } },
      { version: 3, seq: 0, recipient_user_id: null, payload: { t: "PHASE", seat: 0, phase: "draw" } },
    ]);
    expect(events).toEqual([{ t: "ROLE_ASSIGNED", seat: 2, role: "outlaw" }]);
  });
});

describe("game API bodies (docs/03 §5.1)", () => {
  it("accepts engine actions and nothing else", () => {
    expect(actionSchema.safeParse({ type: "PLAY_CARD", cardId: "c01", target: { seat: 2 } }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "CHOOSE", choice: { kind: "draw", from: "player", seat: 1 } }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "PLAY_CARD", cardId: "c99" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "PLAY_CARD", cardId: "c01", hack: true }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "SET_LIFE", life: 9 }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "DISCARD", cardIds: Array(81).fill("c01") }).success).toBe(false);
    expect(actionBody.safeParse({ action: { type: "PASS" }, clientVersion: -1 }).success).toBe(false);
  });
});
