import { livingSeats } from "../context";
import { heal } from "../damage";
import { drawCards } from "../draw";
import type { CardHandler } from "./handler";

function drawHandler(count: number): CardHandler {
  return {
    playTargets: () => null,
    play: (ctx, seat) => {
      drawCards(ctx, seat, count);
    },
  };
}

export const stagecoachHandler = drawHandler(2);
export const wellsFargoHandler = drawHandler(3);

/** R-30: playable even when nobody is wounded (only Beer is restricted, R-6/R-7). */
export const saloonHandler: CardHandler = {
  playTargets: () => null,
  play(ctx) {
    for (const seat of livingSeats(ctx.s)) heal(ctx, seat, 1, "saloon");
  },
};
