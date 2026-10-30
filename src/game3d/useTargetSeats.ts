"use client";

import type { TableInteraction } from "@/ui/table/useTableInteraction";
import { useUi3D } from "./uiStore";

/** Seats that may receive the selected card or the card being dragged (from legal actions only). */
export function useTargetSeats(ti: TableInteraction): ReadonlySet<number> {
  const draggedCard = useUi3D((s) => (s.drag?.active ? s.drag.cardId : null));
  const targets = new Set(ti.targetSeats);
  for (const option of draggedCard ? (ti.interaction.playOptions.get(draggedCard) ?? []) : []) {
    for (const tg of option.targets ?? []) if (tg.seat !== undefined) targets.add(tg.seat);
  }
  return targets;
}
