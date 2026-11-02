import { z } from "zod";
import { MAX_SLOTS, npcDifficultySchema, roomSettingsSchema } from "./rules";

// Request bodies of the rooms API (docs/03 §5.4). Shared so the lobby UI sends exactly what the server validates.

const slot = z.number().int().min(0).max(MAX_SLOTS - 1);

export const joinRoomBody = z.object({ code: z.string().min(1).max(200) });

export const seatOpBody = z.discriminatedUnion("op", [
  z.object({ op: z.literal("ready"), ready: z.boolean() }),
  z.object({ op: z.literal("leave") }),
  z.object({ op: z.literal("add_npc"), slot: slot.optional(), difficulty: npcDifficultySchema.optional() }),
  z.object({ op: z.literal("remove_npc"), slot }),
  z.object({ op: z.literal("npc_difficulty"), slot, difficulty: npcDifficultySchema }),
  z.object({ op: z.literal("kick"), slot }),
]);
export type SeatOp = z.infer<typeof seatOpBody>;

// Defaults must not fill in fields the host did not send, so the patch is built from the bare field types.
export const settingsPatchBody = z
  .object({
    turnTimerSec: roomSettingsSchema.shape.turnTimerSec.unwrap(),
    characterMode: roomSettingsSchema.shape.characterMode.unwrap(),
    afkTakeoverAfter: roomSettingsSchema.shape.afkTakeoverAfter.unwrap(),
    defaultNpcDifficulty: roomSettingsSchema.shape.defaultNpcDifficulty.unwrap(),
  })
  .partial()
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatchBody>;

export const roomIdParam = z.uuid();
