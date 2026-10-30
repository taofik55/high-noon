"use client";

import { useEffect, useRef, useState } from "react";
import { LocalAdapter, createAiRunner, localSoloStorage, type SoloConfig } from "@/net";
import { createGameStore } from "../store/gameStore";
import { GameScreen } from "./GameScreen";
import { SetupScreen } from "./SetupScreen";

/**
 * The Phase 6 debug table: a complete solo game in plain HTML on top of the shared client pipeline
 * (LocalAdapter → gameStore → presentedView), which the 3D table reuses in Phase 7.
 */
export function DevTable() {
  const [store] = useState(createGameStore);
  const adapterRef = useRef<LocalAdapter | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

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

  if (!playing) {
    return (
      <SetupScreen
        hasSaved={hasSaved}
        onStart={(config) => void begin(config)}
        onResume={() => void begin()}
        onDiscardSaved={() => {
          localSoloStorage.clear();
          setHasSaved(false);
        }}
      />
    );
  }

  return (
    <GameScreen
      store={store}
      autoplay={autoplay}
      onAutoplay={(on) => {
        setAutoplay(on);
        adapterRef.current?.setAutoplay(on);
      }}
      onNewGame={newGame}
    />
  );
}
