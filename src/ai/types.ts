import type { Role, Seat } from "@/engine";

export type Difficulty = "easy" | "medium" | "hard";

/**
 * What an NPC remembers from public (already redacted) events (docs/06 §3). Immutable: observe() returns a new one.
 */
export interface AiMemory {
  seat: Seat;
  /** Per seat, in [-1, 1]: estimated "is an enemy of the Sheriff". Known roles are pinned to ±1. */
  suspicion: number[];
  /** Roles learned so far: own, the Sheriff's, and eliminated players'. */
  knownRoles: (Role | null)[];
}

export interface AiOptions {
  /** Hard: determinized worlds sampled per play-phase decision. */
  samples?: number;
  /** Hard: how many of medium's best play actions are compared by lookahead. */
  candidates?: number;
  /** Hard: max engine steps per rollout. */
  horizon?: number;
  /**
   * Optional wall-clock guard for the online server (docs/06: 50 ms). The AI never reads a clock itself (Golden rule 2);
   * the host injects one. Leave unset for reproducible runs (the simulator): the work is then bounded by the counts above.
   */
  now?: () => number;
  budgetMs?: number;
}
