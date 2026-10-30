"use client";

import { SetupScreen } from "../table/SetupScreen";
import { useSoloSession } from "../table/useSoloSession";
import { SoloTable3D } from "./SoloTable3D";

/** /play/solo: the same solo session as the debug table, presented in 3D. */
export function SoloGame() {
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
  return <SoloTable3D store={session.store} autoplay={session.autoplay} onAutoplay={session.setAutoplay} onNewGame={session.newGame} />;
}
