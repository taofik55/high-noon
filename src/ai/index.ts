// NPC brains: pure functions of a PlayerView plus a seeded RNG, so NPCs can never cheat (Golden rule 9).
// Contract and policies: docs/06.

export { decide, decideSafe, fallbackAction } from "./decide";
export { createMemory, observe, roleSuspicion } from "./memory";
export { decideEasy } from "./easy";
export { decideMedium, rankPlayActions, scorePlay, type ScoredAction } from "./medium";
export { decideHard, HARD_DEFAULTS } from "./hard";
export { determinize } from "./determinize";
export { utility } from "./utility";
export { hostility } from "./lib/hostility";
export { cardValue } from "./lib/cardValue";
export { simulateGame, roleWon, type SimGameOptions, type SimGameResult } from "./simulate";
export type { AiMemory, AiOptions, Difficulty } from "./types";
