import { describe, expect, it } from "vitest";
import { seatOpBody, settingsPatchBody } from "@/lib/rooms/api";
import {
  DEFAULT_ROOM_SETTINGS,
  firstFreeSlot,
  nextHost,
  normalizeRoomCode,
  npcName,
  parseRoomSettings,
  randomRoomCode,
  ROOM_CODE_RE,
  shuffleSeats,
  startBlockers,
  type LobbySlot,
} from "@/lib/rooms/rules";

const human = (slot: number, userId: string, isReady = false, joinedAt = `2026-01-01T00:00:0${slot}Z`): LobbySlot => ({
  slot,
  userId,
  isNpc: false,
  npcDifficulty: null,
  displayName: userId,
  isReady,
  joinedAt,
});
const npc = (slot: number, displayName = `Bot ${slot}`): LobbySlot => ({
  slot,
  userId: null,
  isNpc: true,
  npcDifficulty: "medium",
  displayName,
  isReady: true,
  joinedAt: "2026-01-01T00:00:00Z",
});

describe("room codes", () => {
  it("only uses the unambiguous alphabet of the rooms.code check", () => {
    let i = 0;
    for (let n = 0; n < 50; n++) expect(randomRoomCode((k) => i++ % k)).toMatch(ROOM_CODE_RE);
    expect("IO01".split("").some((c) => randomRoomCode(() => 0).includes(c))).toBe(false);
  });

  it("normalizes what people type or paste", () => {
    expect(normalizeRoomCode("k7q-x2m")).toBe("K7QX2M");
    expect(normalizeRoomCode(" K7QX2M ")).toBe("K7QX2M");
    expect(normalizeRoomCode("https://high-noon.example/r/K7QX2M?x=1")).toBe("K7QX2M");
    expect(normalizeRoomCode("K7QX2")).toBeNull();
    expect(normalizeRoomCode("K7QX2O")).toBeNull(); // O is not in the alphabet
  });
});

describe("lobby rules (docs/01 §5.2)", () => {
  it("finds the lowest free slot of seven", () => {
    expect(firstFreeSlot([human(0, "a"), npc(2)])).toBe(1);
    expect(firstFreeSlot([0, 1, 2, 3, 4, 5, 6].map((s) => npc(s)))).toBeNull();
  });

  it("needs four seats and every human other than the host ready", () => {
    expect(startBlockers([human(0, "host"), npc(1), npc(2)], "host")).toEqual(["TOO_FEW_SEATS"]);
    expect(startBlockers([human(0, "host"), human(1, "b"), npc(2), npc(3)], "host")).toEqual(["PLAYERS_NOT_READY"]);
    expect(startBlockers([human(0, "host"), human(1, "b", true), npc(2), npc(3)], "host")).toEqual([]);
  });

  it("hands the host role to the earliest-joined remaining human", () => {
    const slots = [human(0, "host", false, "2026-01-01T00:00:00Z"), human(3, "late", false, "2026-01-01T00:05:00Z"), human(1, "early", false, "2026-01-01T00:01:00Z"), npc(2)];
    expect(nextHost(slots, "host")).toBe("early");
    expect(nextHost([human(0, "host"), npc(1)], "host")).toBeNull();
  });

  it("names bots without repeats", () => {
    expect(npcName([])).toBe("Dusty (Bot)");
    expect(npcName([npc(1, "Dusty (Bot)")])).toBe("Slim (Bot)");
  });

  it("shuffles seats as a permutation", () => {
    const seats = shuffleSeats(["a", "b", "c", "d", "e"], (n) => n - 1);
    expect([...seats].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(shuffleSeats(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
  });
});

describe("room settings (docs/04 §5)", () => {
  it("fills defaults and repairs broken fields one by one", () => {
    expect(parseRoomSettings({})).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(parseRoomSettings(null)).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(parseRoomSettings({ turnTimerSec: 45, characterMode: "choose_of_2" })).toEqual({ ...DEFAULT_ROOM_SETTINGS, characterMode: "choose_of_2" });
  });

  it("validates patches strictly without inventing defaults", () => {
    expect(settingsPatchBody.parse({ turnTimerSec: 0 })).toEqual({ turnTimerSec: 0 });
    expect(settingsPatchBody.safeParse({ turnTimerSec: 45 }).success).toBe(false);
    expect(settingsPatchBody.safeParse({ hostId: "me" }).success).toBe(false);
  });

  it("accepts only known seat operations", () => {
    expect(seatOpBody.safeParse({ op: "kick", slot: 3 }).success).toBe(true);
    expect(seatOpBody.safeParse({ op: "kick", slot: 7 }).success).toBe(false);
    expect(seatOpBody.safeParse({ op: "make_host", slot: 1 }).success).toBe(false);
    expect(seatOpBody.safeParse({ op: "add_npc", difficulty: "godlike" }).success).toBe(false);
  });
});
