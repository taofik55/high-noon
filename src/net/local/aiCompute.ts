import { decideSafe, type AiMemory, type Difficulty } from "@/ai";
import type { Action, PlayerView, RngState } from "@/engine";

// Kept apart from aiRunner.ts on purpose: the worker entry imports this module, and it must not reach the
// `new Worker(new URL("./ai.worker.ts"))` in aiRunner.ts, or the bundler tries to bundle the worker into itself.

export interface AiRequest {
  view: PlayerView;
  memory: AiMemory;
  difficulty: Difficulty;
  rng: RngState;
}

export interface AiResponse {
  action: Action;
  /** The NPC's RNG after deciding: the caller stores it so the next decision continues the same sequence. */
  rng: RngState;
  problems: string[];
}

export function computeAi(request: AiRequest): AiResponse {
  const rng: RngState = [...request.rng];
  const problems: string[] = [];
  const action = decideSafe(request.view, request.memory, request.difficulty, rng, {}, (m) => problems.push(m));
  return { action, rng, problems };
}
