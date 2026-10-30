/** Card width on screen in pixels (the HUD camera maps 1 unit to 1 pixel). */
export const HAND_CARD_PX = 118;

export interface FanSlot {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Fan layout of the hand in HUD pixels (origin = screen center, y up): cards spread over at most ~55% of the width,
 * a gentle arc and tilt, the middle card highest. Pure, so it is shared with the test hook and unit-tested.
 */
export function fanLayout(count: number, width: number, height: number): FanSlot[] {
  const spacing = Math.min(HAND_CARD_PX * 0.82, (width * 0.55) / Math.max(1, count));
  return Array.from({ length: count }, (_, i) => {
    const offset = i - (count - 1) / 2;
    return {
      x: offset * spacing,
      y: -height / 2 + HAND_CARD_PX * 0.78 - offset * offset * 2.2,
      rotation: -offset * 0.05,
    };
  });
}
