"use client";

import { GameScreen } from "./GameScreen";
import { SetupScreen } from "./SetupScreen";
import { useSoloSession } from "./useSoloSession";

/**
 * The Phase 6 debug table: a complete solo game in plain HTML on top of the shared client pipeline
 * (LocalAdapter → gameStore → presentedView), which the 3D table reuses.
 */
export function DevTable() {
  const session = useSoloSession();
  if (!session.playing) {
    return (
      <SetupScreen
        hasSaved={session.hasSaved}
        onStart={(config) => void session.begin(config)}
        onResume={() => void session.begin()}
        onDiscardSaved={session.discardSaved}
      />
    );
  }
  return <GameScreen store={session.store} autoplay={session.autoplay} onAutoplay={session.setAutoplay} onNewGame={session.newGame} />;
}
