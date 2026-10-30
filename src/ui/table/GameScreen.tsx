"use client";

import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { effectiveDistance, weaponRange, type CardId } from "@/engine";
import { t } from "../i18n";
import type { GameStoreState } from "../store/gameStore";
import { Button } from "./Button";
import { CardChip } from "./CardChip";
import { GameLog } from "./GameLog";
import { GameOver } from "./GameOver";
import { PromptPanel } from "./PromptPanel";
import { SeatPanel } from "./SeatPanel";
import { useTableInteraction } from "./useTableInteraction";

interface GameScreenProps {
  store: StoreApi<GameStoreState>;
  autoplay: boolean;
  onAutoplay: (on: boolean) => void;
  onNewGame: () => void;
}

/** The 2D debug table (Phase 6): plain HTML on top of the shared interaction state machine. */
export function GameScreen({ store, autoplay, onAutoplay, onNewGame }: GameScreenProps) {
  const ti = useTableInteraction(store);
  const thinking = useStore(store, (s) => s.thinking);
  const log = useStore(store, (s) => s.log);
  const error = useStore(store, (s) => s.error);
  const speed = useStore(store, (s) => s.speed);
  const setSpeed = useStore(store, (s) => s.setSpeed);

  const { view, actNow } = ti;
  if (!view) return null;
  const me = view.viewer === "spectator" ? 0 : view.viewer;
  const myPlayer = view.players[me];
  const range = myPlayer ? weaponRange(myPlayer) : 1;
  const n = view.players.length;

  return (
    <div data-testid="game-table" className="flex min-h-screen flex-col gap-4 bg-stone-950 p-4 text-amber-50 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-3 text-sm">
          <h1 className="text-lg font-bold tracking-widest text-amber-400 uppercase">{t("table.title")}</h1>
          <span>{t("table.turn", { n: view.turn.number })}</span>
          <span className="text-amber-300">{t(`phase.${view.turn.phase}`)}</span>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1">
              <input type="checkbox" data-testid="toggle-fast" checked={speed === "fast"} onChange={(e) => setSpeed(e.target.checked ? "fast" : "normal")} />
              {t("table.fast")}
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" data-testid="toggle-autoplay" checked={autoplay} onChange={(e) => onAutoplay(e.target.checked)} />
              {t("table.autoplay")}
            </label>
            <Button onClick={onNewGame} testId="btn-new-game">
              {t("table.newGame")}
            </Button>
          </div>
        </header>

        <div className="relative h-136 rounded-2xl border border-amber-900/50 bg-linear-to-b from-amber-950 to-stone-900">
          {view.players.map((p) => {
            const r = (p.seat - me + n) % n;
            const angle = ((90 + (r * 360) / n) * Math.PI) / 180;
            const distance = p.seat === me ? null : effectiveDistance(view, me, p.seat);
            return (
              <div
                key={p.seat}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` }}
              >
                <SeatPanel
                  player={p}
                  isMe={p.seat === me}
                  isTurn={view.turn.seat === p.seat}
                  isActing={view.currentActor === p.seat}
                  thinking={thinking === p.seat}
                  distance={distance}
                  inRange={distance !== null && distance <= range}
                  targetable={ti.targetSeats.has(p.seat)}
                  onTarget={() => ti.onSeat(p.seat)}
                />
              </div>
            );
          })}
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-xs text-stone-300">
            <span>{t("table.deck", { n: view.deckCount })}</span>
            <span>{t("table.discard", { n: view.discard.length })}</span>
            {view.discard.at(-1) && <CardChip cardId={view.discard.at(-1) as CardId} size="md" />}
          </div>
        </div>

        <PromptPanel ti={ti} thinking={thinking !== null} error={error} />

        <section>
          <h2 className="mb-1 text-sm text-amber-300">{t("table.yourHand")}</h2>
          <div className="flex flex-wrap gap-2" data-testid="hand">
            {view.myHand.length === 0 && <span className="text-stone-500">{t("table.empty")}</span>}
            {view.myHand.map((id) => (
              <CardChip key={id} cardId={id} size="md" state={ti.handState(id)} onClick={actNow ? () => ti.onHandCard(id) : undefined} testId="hand-card" />
            ))}
          </div>
        </section>
      </div>

      <aside className="flex max-h-screen w-full flex-col lg:w-96">
        <h2 className="mb-1 text-sm text-amber-300">{t("table.log")}</h2>
        <GameLog log={log} className="flex-1" />
      </aside>

      {view.winner && <GameOver view={view} onNewGame={onNewGame} />}
    </div>
  );
}
