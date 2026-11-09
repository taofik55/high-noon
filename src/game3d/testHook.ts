"use client";

import type { CardId } from "@/engine";
import type { PerfStats } from "./perf/perfStats";
import { useUi3D } from "./uiStore";

/**
 * Screen positions of 3D objects for the Playwright tests, which cannot see inside a WebGL canvas. Only installed
 * outside production builds; the game never reads it.
 */
export interface HighNoonTestHook {
  handCards(): { cardId: CardId; x: number; y: number; state: string }[];
  seats(): { seat: number; x: number; y: number; targetable: boolean }[];
  ui(): { hoveredSeat: number | null; dragging: CardId | null; active: boolean };
  perf(): PerfStats | null;
}

type Provider<K extends keyof HighNoonTestHook> = HighNoonTestHook[K];

const providers: { handCards?: Provider<"handCards">; seats?: Provider<"seats">; perf?: Provider<"perf"> } = {};

declare global {
  interface Window {
    __highnoonTest?: HighNoonTestHook;
  }
}

export function registerTestProvider<K extends keyof HighNoonTestHook>(key: K, fn: Provider<K>): () => void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return () => {};
  (providers as Record<K, Provider<K> | undefined>)[key] = fn;
  window.__highnoonTest = {
    handCards: () => providers.handCards?.() ?? [],
    seats: () => providers.seats?.() ?? [],
    perf: () => providers.perf?.() ?? null,
    ui: () => {
      const s = useUi3D.getState();
      return { hoveredSeat: s.hoveredSeat, dragging: s.drag?.cardId ?? null, active: s.drag?.active ?? false };
    },
  };
  return () => {
    if ((providers as Record<K, Provider<K> | undefined>)[key] === fn) (providers as Record<K, Provider<K> | undefined>)[key] = undefined;
  };
}
