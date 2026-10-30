import type { Action, GameEvent, PlayerView, Seat } from "@/engine";

/** One committed step as one player sees it (docs/03 §4.1). */
export interface GameUpdate {
  version: number;
  /** Events already redacted for `mySeat`. */
  events: GameEvent[];
  view: PlayerView;
  /** Seat whose action produced this update; null for the initial snapshot. Lets the Director pace NPC "thinking". */
  actor: Seat | null;
}

/**
 * The only thing UI and 3D code talk to, so solo and online share all presentation code (docs/03 §4.1).
 * `send` rejects with IllegalActionError (or a network/conflict error online).
 */
export interface GameAdapter {
  readonly mySeat: Seat;
  start(): Promise<GameUpdate>;
  onUpdate(cb: (update: GameUpdate) => void): () => void;
  send(action: Action): Promise<void>;
  /** Online only; a no-op in solo games. */
  reportTimeout(): Promise<void>;
  dispose(): void;
}
