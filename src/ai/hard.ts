import { applyAction, currentActor, toPlayerView, type Action, type GameState, type PlayerView, type RngState, type Seat } from "@/engine";
import { determinize } from "./determinize";
import { mySeat } from "./lib/view";
import { createMemory } from "./memory";
import { decideMedium, rankPlayActions } from "./medium";
import type { AiMemory, AiOptions } from "./types";
import { utility } from "./utility";

const END_TURN: Action = { type: "END_TURN" };

export const HARD_DEFAULTS = { samples: 8, candidates: 5, horizon: 40 } as const;

/**
 * Plays `action` in a sampled world, then lets every seat follow the medium policy until this NPC's turn is over (or
 * the horizon is reached), and scores the outcome. Opponents use a fresh memory: the NPC cannot know theirs.
 */
function rollout(world: GameState, seat: Seat, action: Action, memory: AiMemory, rng: RngState, horizon: number): number {
  let s: GameState;
  try {
    s = applyAction(world, seat, action).state;
  } catch {
    return -Infinity;
  }
  for (let step = 0; step < horizon && !s.winner && s.turn.seat === seat; step++) {
    const actor = currentActor(s);
    if (actor === null) break;
    const view = toPlayerView(s, actor);
    const next = decideMedium(view, actor === seat ? memory : createMemory(view), rng);
    try {
      s = applyAction(s, actor, next).state;
    } catch {
      break;
    }
  }
  return utility(s, seat);
}

/**
 * Hard = medium + determinized lookahead at its own play phase (docs/06 §4): medium's best few actions (plus ending the
 * turn) are each tried in the same K sampled worlds and the best average wins; ties keep medium's order. Responses and
 * other prompts use medium, because the view only shows the top of the prompt stack.
 */
export function decideHard(view: PlayerView, memory: AiMemory, rng: RngState, opts: AiOptions = {}): Action {
  if (view.prompt?.kind !== "PLAY") return decideMedium(view, memory, rng);
  const seat = mySeat(view);
  const samples = opts.samples ?? HARD_DEFAULTS.samples;
  const horizon = opts.horizon ?? HARD_DEFAULTS.horizon;

  const candidates = rankPlayActions(view, memory)
    .slice(0, opts.candidates ?? HARD_DEFAULTS.candidates)
    .map((r) => r.action);
  if (!candidates.some((a) => a.type === "END_TURN")) candidates.push(END_TURN);
  if (candidates.length === 1) return candidates[0] ?? END_TURN;

  const totals = candidates.map(() => 0);
  const started = opts.now?.();
  for (let k = 0; k < samples; k++) {
    const overBudget = k > 0 && started !== undefined && opts.budgetMs !== undefined && (opts.now?.() ?? 0) - started > opts.budgetMs;
    if (overBudget) break;
    const world = determinize(view, memory, rng);
    candidates.forEach((action, i) => {
      totals[i] = (totals[i] ?? 0) + rollout(world, seat, action, memory, rng, horizon);
    });
  }

  let best = 0;
  totals.forEach((t, i) => {
    if (t > (totals[best] ?? -Infinity)) best = i;
  });
  return candidates[best] ?? END_TURN;
}
