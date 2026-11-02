"use client";

import type { ReactNode } from "react";
import type { PlayerView } from "@/engine";
import { t } from "../i18n";
import { Button } from "./Button";

interface GameOverProps {
  view: PlayerView;
  /** Solo: "play again". Online passes its own actions (rematch, lobby, leave) instead. */
  onNewGame?: () => void;
  actions?: ReactNode;
}

export function GameOver({ view, onNewGame, actions }: GameOverProps) {
  if (!view.winner) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70" data-testid="game-over">
      <div className="w-full max-w-lg rounded-xl border border-amber-500 bg-stone-900 p-6 text-amber-50 shadow-2xl">
        <h2 className="text-2xl font-bold text-amber-400">{t("gameOver.title")}</h2>
        <p className="mt-1 text-lg" data-testid="winner">
          {t(`winner.${view.winner}`)}
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {view.players.map((p) => {
            const st = view.stats[p.seat];
            return (
              <li key={p.seat} className="flex justify-between gap-2">
                <span className={p.alive ? "" : "text-stone-500 line-through"}>
                  {p.name} — {p.role ? t(`role.${p.role}`) : "?"}
                </span>
                {st && <span className="text-stone-400">{t("gameOver.stats", { kills: st.kills, damage: st.damageDealt, cards: st.cardsPlayed })}</span>}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {actions ??
            (onNewGame && (
              <Button tone="primary" onClick={onNewGame} testId="btn-play-again">
                {t("action.playAgain")}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
