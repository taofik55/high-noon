"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import { createMemory, decideSafe } from "@/ai";
import { createRng } from "@/engine";
import { canAct, type GameStoreState } from "../store/gameStore";

/**
 * Development and e2e only: a medium bot plays this browser's seat from this browser's own view (no hidden
 * information, Golden rule 9), sending through the normal API like a click would.
 */
export function useAutoplay(store: StoreApi<GameStoreState>, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    let n = 0;
    const tick = () => {
      const s = store.getState();
      const view = s.presentedView;
      if (!view || !canAct(s)) return;
      const action = decideSafe(view, createMemory(view), "medium", createRng(`autoplay:${view.turn.number}:${n++}`));
      void s.send(action);
    };
    tick();
    const unsubscribe = store.subscribe(tick);
    return unsubscribe;
  }, [store, on]);
}
