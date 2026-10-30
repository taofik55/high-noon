"use client";

import { useEffect, useRef, useState } from "react";
import { LocalAdapter, createAiRunner, localSoloStorage, type SoloConfig } from "@/net";
import { createGameStore } from "../store/gameStore";

/** Solo game lifecycle shared by the 2D debug table and the 3D table: start, resume, autoplay, new game. */
export function useSoloSession() {
  const [store] = useState(createGameStore);
  const adapterRef = useRef<LocalAdapter | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [autoplay, setAutoplayState] = useState(false);

  useEffect(() => {
    // localStorage only exists in the browser, so this cannot be read during rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasSaved(LocalAdapter.hasSavedGame(localSoloStorage));
    return () => store.getState().detach();
  }, [store]);

  const begin = async (config?: SoloConfig) => {
    store.getState().detach();
    const adapter = new LocalAdapter({ ...(config ? { config } : {}), storage: localSoloStorage, ai: createAiRunner() });
    adapterRef.current = adapter;
    const initial = await adapter.start();
    store.getState().attach(adapter, initial);
    adapter.setAutoplay(autoplay);
    setPlaying(true);
  };

  const newGame = () => {
    store.getState().detach();
    adapterRef.current = null;
    localSoloStorage.clear();
    setHasSaved(false);
    setPlaying(false);
  };

  const discardSaved = () => {
    localSoloStorage.clear();
    setHasSaved(false);
  };

  const setAutoplay = (on: boolean) => {
    setAutoplayState(on);
    adapterRef.current?.setAutoplay(on);
  };

  return { store, playing, hasSaved, autoplay, begin, newGame, discardSaved, setAutoplay };
}
