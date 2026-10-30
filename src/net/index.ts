// GameAdapter implementations (docs/03 §4.1): LocalAdapter for solo (Phase 6), OnlineAdapter for Supabase (Phase 11).
// UI and 3D depend only on the GameAdapter interface, so solo and online share all presentation code.
export type { GameAdapter, GameUpdate } from "./types";
export { LocalAdapter, type LocalAdapterOptions } from "./local/LocalAdapter";
export { InlineAiRunner, WorkerAiRunner, createAiRunner, computeAi, type AiRunner, type AiRequest, type AiResponse } from "./local/aiRunner";
export { MemorySoloStorage, localSoloStorage, type SavedSolo, type SoloConfig, type SoloStorage } from "./local/storage";
