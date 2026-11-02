import { z } from "zod";
import { CHARACTER_IDS, isCardId, type Action, type CardId } from "@/engine";

// Request bodies of the game API (docs/03 §5.1–5.2). Shapes are checked here; legality is the engine's job.

const cardId = z.custom<CardId>(isCardId, "unknown card");
const seat = z.number().int().min(0).max(6);
const cardIds = z.array(cardId).max(80);

const target = z.object({ seat: seat.optional(), cardId: cardId.optional(), fromHand: z.literal(true).optional() }).strict();

const choice = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("character"), characterId: z.enum(CHARACTER_IDS) }).strict(),
  z.object({ kind: z.literal("store_card"), cardId }).strict(),
  z.object({ kind: z.literal("draw"), from: z.enum(["deck", "discard", "player"]), seat: seat.optional() }).strict(),
  z.object({ kind: z.literal("kit_return"), cardId }).strict(),
]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLAY_CARD"), cardId, asType: z.literal("bang").optional(), target: target.optional() }).strict(),
  z.object({ type: z.literal("RESPOND"), cardIds }).strict(),
  z.object({ type: z.literal("PASS") }).strict(),
  z.object({ type: z.literal("CHOOSE"), choice }).strict(),
  z.object({ type: z.literal("ABILITY"), ability: z.literal("sid_ketchum"), cardIds }).strict(),
  z.object({ type: z.literal("END_TURN") }).strict(),
  z.object({ type: z.literal("DISCARD"), cardIds }).strict(),
]);

// Compile-time check that the schema produces engine Actions (the cast in the route relies on it).
type Parsed = z.infer<typeof actionSchema>;
export type ActionSchemaMatches = Parsed extends Action ? true : never;
export const actionSchemaMatches: ActionSchemaMatches = true;

const version = z.number().int().min(0);
export const actionBody = z.object({ action: actionSchema, clientVersion: version });
export const timeoutBody = z.object({ version });
export const resyncBody = z.object({ reclaim: z.boolean().optional() });
export const gameIdParam = z.uuid();
