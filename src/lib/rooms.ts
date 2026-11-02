import { z } from "zod";
import { MAX_PLAYERS, MIN_PLAYERS, shuffle, type GameConfig, type NpcDifficulty, type PlayerConfig, type RngState } from "@/engine";

// Pure room/lobby rules shared by the route handlers and the lobby UI (docs/01 §5.2, docs/03 §5.4, docs/04 §5).

/** Codes avoid I, O, 0 and 1 so they can be read out loud (docs/04 §3 `rooms.code` check). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** 7 lobby slots; a game needs 4–7 of them filled (docs/02 §1.1). */
export const MAX_SLOTS = 7;

export function isRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(code);
}

/** Accepts what people actually type: lower case, spaces, dashes, and the confusable 0/O, 1/I, 5/S. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/0/g, "O")
    .replace(/[1I]/g, "J")
    .slice(0, ROOM_CODE_LENGTH);
}

export function generateRoomCode(random: () => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  return code;
}

export const NPC_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const TURN_TIMERS = [0, 30, 60, 90] as const;

/** `rooms.settings` (docs/04 §5). Unknown or broken values fall back to the defaults. */
export const RoomSettingsSchema = z.object({
  turnTimerSec: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90)]).default(60),
  characterMode: z.enum(["random", "choose_of_2"]).default("random"),
  afkTakeoverAfter: z.number().int().min(1).max(5).default(2),
  defaultNpcDifficulty: z.enum(NPC_DIFFICULTIES).default("medium"),
});

export type RoomSettings = z.output<typeof RoomSettingsSchema>;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = RoomSettingsSchema.parse({});

export function parseRoomSettings(value: unknown): RoomSettings {
  const parsed = RoomSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_ROOM_SETTINGS;
}

export type RoomStatus = "lobby" | "in_game" | "finished" | "closed";

/** One lobby slot as every member may see it (`room_players`, readable through RLS). */
export interface RoomSlot {
  slot: number;
  userId: string | null;
  isNpc: boolean;
  npcDifficulty: NpcDifficulty | null;
  displayName: string;
  isReady: boolean;
}

export interface RoomLobby {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  currentGameId: string | null;
  slots: RoomSlot[];
}

export type StartBlocker = "not_host" | "not_lobby" | "too_few" | "too_many" | "not_ready";

/**
 * Why Start is disabled, or null when the host may start: 4–7 filled slots and every human but the host ready
 * (pressing Start is the host's own ready, docs/01 §5.2).
 */
export function startBlocker(lobby: Pick<RoomLobby, "hostId" | "status" | "slots">, userId: string): StartBlocker | null {
  if (lobby.hostId !== userId) return "not_host";
  if (lobby.status !== "lobby") return "not_lobby";
  if (lobby.slots.length < MIN_PLAYERS) return "too_few";
  if (lobby.slots.length > MAX_PLAYERS) return "too_many";
  if (lobby.slots.some((s) => !s.isNpc && s.userId !== lobby.hostId && !s.isReady)) return "not_ready";
  return null;
}

/** Lowest free slot index, or null when the lobby is full. */
export function firstFreeSlot(slots: readonly RoomSlot[]): number | null {
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    if (!slots.some((s) => s.slot === slot)) return slot;
  }
  return null;
}

/**
 * Seating for a starting game: slot order is shuffled with the game's own seeded RNG so the host cannot pick who sits
 * next to whom (docs/03 §5.4). Returns the engine config plus the seat → slot mapping for `game_seats`.
 */
export function assignSeats(
  slots: readonly RoomSlot[],
  settings: RoomSettings,
  rng: RngState,
): { config: GameConfig; seats: RoomSlot[] } {
  const seats = shuffle(rng, [...slots]);
  const players: PlayerConfig[] = seats.map((s) => ({
    name: s.displayName,
    isNpc: s.isNpc,
    ...(s.isNpc ? { npcDifficulty: s.npcDifficulty ?? settings.defaultNpcDifficulty } : {}),
  }));
  return { config: { players, characterMode: settings.characterMode }, seats };
}
