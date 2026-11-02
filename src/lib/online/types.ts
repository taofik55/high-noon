import type { PlayerView, Seat } from "@/engine";

/**
 * What the server stores in `player_views.view` (docs/04): the engine's PlayerView plus two online-only fields, so no
 * extra columns are needed. `deadline` drives the turn timer ring (docs/03 §5.3); `actor` is the seat whose action
 * produced this version (null for the first snapshot), used to pace NPC "thinking" like solo does.
 */
export type OnlineView = PlayerView & {
  deadline: string | null;
  actor: Seat | null;
  /** True when a bot is playing this viewer's seat after repeated timeouts (docs/01 §5.2). */
  afk: boolean;
};
