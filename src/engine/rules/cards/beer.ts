import type { GameState, Seat } from "../../state/types";
import { aliveCount, playerAt } from "../context";
import { heal } from "../damage";
import type { CardHandler } from "./handler";

/** R-6: Beer has no effect and is not playable with only 2 players alive. */
export function beerAllowed(s: GameState): boolean {
  return aliveCount(s) > 2;
}

export const beerHandler: CardHandler = {
  playTargets(s, seat: Seat) {
    const p = playerAt(s, seat);
    // R-7: not playable at max life (pointless play).
    return beerAllowed(s) && p.life < p.maxLife ? null : false;
  },

  play(ctx, seat) {
    heal(ctx, seat, 1, "beer");
  },
};
