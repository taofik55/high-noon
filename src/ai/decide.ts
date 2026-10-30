import { defaultActionFromLegal, matchLegal, type Action, type PlayerView, type RngState } from "@/engine";
import { decideEasy } from "./easy";
import { decideHard } from "./hard";
import { decideMedium } from "./medium";
import type { AiMemory, AiOptions, Difficulty } from "./types";

/** docs/06 §1: pure given (view, memory, rng). Only the NPC's own view — never the game state. */
export function decide(view: PlayerView, memory: AiMemory, difficulty: Difficulty, rng: RngState, opts: AiOptions = {}): Action {
  switch (difficulty) {
    case "easy":
      return decideEasy(view, rng);
    case "medium":
      return decideMedium(view, memory, rng);
    case "hard":
      return decideHard(view, memory, rng, opts);
  }
}

/** The safe action for this view: same policy as the engine's timeout default. */
export function fallbackAction(view: PlayerView): Action {
  if (!view.prompt) throw new Error("fallbackAction: nothing to do");
  return defaultActionFromLegal(view.prompt.kind, view.legalActions);
}

/**
 * The wrapper every host uses (docs/06 §1): if a brain throws or returns an action outside `view.legalActions`,
 * report it through `onProblem` (logged in dev, counted by the simulator) and play the safe fallback instead.
 */
export function decideSafe(
  view: PlayerView,
  memory: AiMemory,
  difficulty: Difficulty,
  rng: RngState,
  opts: AiOptions = {},
  onProblem?: (message: string) => void,
): Action {
  try {
    const action = decide(view, memory, difficulty, rng, opts);
    const reason = matchLegal(view.legalActions, action, view.myHand);
    if (reason === null) return action;
    onProblem?.(`${difficulty} chose an illegal action (${reason}): ${JSON.stringify(action)}`);
  } catch (e) {
    onProblem?.(`${difficulty} threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  return fallbackAction(view);
}
