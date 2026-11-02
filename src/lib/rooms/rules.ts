import { z } from "zod";

// Lobby rules shared by the rooms API (authoritative) and the lobby UI (display only). Pure: no Supabase, no DOM.

/** docs/04 rooms.code check: 6 chars, no I, O, 0, 1 (easy to read aloud and type). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** docs/01 §5.2: 7 slots, a game needs 4–7 seats. */
export const MAX_SLOTS = 7;
export const MIN_SEATS = 4;

export const NPC_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type NpcDifficultyName = (typeof NPC_DIFFICULTIES)[number];
export const npcDifficultySchema = z.enum(NPC_DIFFICULTIES);

export const TURN_TIMERS = [0, 30, 60, 90] as const;

/** docs/04 §5. Every field has a default so an empty or older settings object still parses. */
export const roomSettingsSchema = z.object({
  turnTimerSec: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90)]).default(60),
  characterMode: z.enum(["random", "choose_of_2"]).default("random"),
  afkTakeoverAfter: z.number().int().min(1).max(5).default(2),
  defaultNpcDifficulty: npcDifficultySchema.default("medium"),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;
export const DEFAULT_ROOM_SETTINGS: RoomSettings = roomSettingsSchema.parse({});

/** Stored settings are trusted only after parsing; anything broken falls back to the defaults field by field. */
export function parseRoomSettings(value: unknown): RoomSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(roomSettingsSchema.shape) as (keyof RoomSettings)[]) {
    const field = roomSettingsSchema.shape[key].safeParse(raw[key]);
    out[key] = field.success ? field.data : DEFAULT_ROOM_SETTINGS[key];
  }
  return out as RoomSettings;
}

/** Accepts what people paste: lower case, spaces, dashes, or a whole /r/CODE link. */
export function normalizeRoomCode(input: string): string | null {
  const fromLink = /\/r\/([A-Za-z0-9-]+)/.exec(input)?.[1] ?? input;
  const code = fromLink.toUpperCase().replace(/[\s-]/g, "");
  return ROOM_CODE_RE.test(code) ? code : null;
}

export function randomRoomCode(randomIndex: (n: number) => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  return code;
}

export interface LobbySlot {
  slot: number;
  userId: string | null;
  isNpc: boolean;
  npcDifficulty: NpcDifficultyName | null;
  displayName: string;
  isReady: boolean;
  joinedAt: string;
}

export function firstFreeSlot(slots: readonly LobbySlot[]): number | null {
  const taken = new Set(slots.map((s) => s.slot));
  for (let i = 0; i < MAX_SLOTS; i++) if (!taken.has(i)) return i;
  return null;
}

export type StartBlocker = "TOO_FEW_SEATS" | "PLAYERS_NOT_READY";

/** The host starts the game, so pressing Start counts as the host being ready. */
export function startBlockers(slots: readonly LobbySlot[], hostId: string): StartBlocker[] {
  const blockers: StartBlocker[] = [];
  if (slots.length < MIN_SEATS) blockers.push("TOO_FEW_SEATS");
  if (slots.some((s) => !s.isNpc && s.userId !== hostId && !s.isReady)) blockers.push("PLAYERS_NOT_READY");
  return blockers;
}

/** When the host leaves, the human who joined earliest takes over; null means nobody is left to host. */
export function nextHost(slots: readonly LobbySlot[], leavingUserId: string): string | null {
  const humans = slots
    .filter((s) => !s.isNpc && s.userId !== null && s.userId !== leavingUserId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.slot - b.slot);
  return humans[0]?.userId ?? null;
}

/** Western-flavoured bot names; the first unused one is taken. */
export const NPC_NAMES = ["Dusty", "Slim", "Hank", "Rosie", "Clem", "Mabel", "Jeb"] as const;

export function npcName(slots: readonly LobbySlot[]): string {
  const used = new Set(slots.map((s) => s.displayName));
  const free = NPC_NAMES.map((n) => `${n} (Bot)`).find((n) => !used.has(n));
  return free ?? `Bot ${slots.length + 1}`;
}

/**
 * Random seating for a new game (docs/03 §5.4: shuffle humans and NPCs together). Fisher–Yates with the caller's
 * randomness (crypto on the server, a fixed sequence in tests).
 */
export function shuffleSeats<T>(items: readonly T[], randomIndex: (n: number) => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
