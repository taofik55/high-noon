"use client";

import { useStore } from "zustand";
import { t } from "../i18n";
import { Button } from "./Button";
import { GameOver } from "./GameOver";
import { GameScreen } from "./GameScreen";
import { SetupScreen } from "./SetupScreen";
import { useSoloSession } from "./useSoloSession";

/**
 * The Phase 6 debug table: a complete solo game in plain HTML on top of the shared client pipeline
 * (LocalAdapter → gameStore → presentedView), which the 3D table reuses.
 */
export function DevTable() {
  const session = useSoloSession();
  const view = useStore(session.store, (s) => s.presentedView);
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
  return (
    <GameScreen
      store={session.store}
      headerExtra={
        <>
          <label className="flex items-center gap-1">
            <input type="checkbox" data-testid="toggle-autoplay" checked={session.autoplay} onChange={(e) => session.setAutoplay(e.target.checked)} />
            {t("table.autoplay")}
          </label>
          <Button onClick={session.newGame} testId="btn-new-game">
            {t("table.newGame")}
          </Button>
        </>
      }
      gameOver={view && <GameOver view={view} onNewGame={session.newGame} />}
    />
  );
}
