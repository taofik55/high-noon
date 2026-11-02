"use client";

import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { t } from "../i18n";
import type { GameStoreState } from "../store/gameStore";
import { Button } from "../table/Button";
import { GameOver } from "../table/GameOver";
import { GameTable3D } from "../table3d/GameTable3D";

interface SoloTable3DProps {
  store: StoreApi<GameStoreState>;
  autoplay: boolean;
  onAutoplay: (on: boolean) => void;
  onNewGame: () => void;
}

/** /play/solo on the shared 3D table, with the solo-only controls. */
export function SoloTable3D({ store, autoplay, onAutoplay, onNewGame }: SoloTable3DProps) {
  const view = useStore(store, (s) => s.presentedView);
  return (
    <GameTable3D
      store={store}
      title={t("solo.title")}
      headerExtra={
        <>
          <label className="flex items-center gap-1">
            <input type="checkbox" data-testid="toggle-autoplay" checked={autoplay} onChange={(e) => onAutoplay(e.target.checked)} />
            {t("table.autoplay")}
          </label>
          <Button onClick={onNewGame} testId="btn-new-game">
            {t("table.newGame")}
          </Button>
        </>
      }
      gameOver={view && <GameOver view={view} onNewGame={onNewGame} />}
    />
  );
}
