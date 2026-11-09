"use client";

import { create } from "zustand";

/** Renderer counters for the dev overlay and the perf e2e report (docs/05 §9). Updated ~4 times a second. */
export interface PerfStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

export const EMPTY_STATS: PerfStats = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };

export const usePerf = create<{ stats: PerfStats; set(stats: PerfStats): void }>()((set) => ({
  stats: EMPTY_STATS,
  set: (stats) => set({ stats }),
}));

/** `?perf=1` shows the overlay in any build; development builds also offer a checkbox. */
export function perfOverlayRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1";
}
