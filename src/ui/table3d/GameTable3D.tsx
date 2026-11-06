"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { Director } from "@/game3d/director/Director";
import type { CinematicMode } from "@/game3d/director/types";
import { QUALITIES, type QualitySetting } from "@/game3d/settings/quality";
import { SPEEDS, useSettings, type Speed } from "@/game3d/settings/settingsStore";
import { SeatBadges } from "@/game3d/hud/SeatBadges";
import { useUi3D } from "@/game3d/uiStore";
import { useTargetSeats } from "@/game3d/useTargetSeats";
import { cardLabel, cardRules } from "../cards";
import { t } from "../i18n";
import type { GameStoreState } from "../store/gameStore";
import { Button } from "../table/Button";
import { GameLog } from "../table/GameLog";
import { PromptPanel } from "../table/PromptPanel";
import { useTableInteraction } from "../table/useTableInteraction";
import { SoundMenu } from "./SoundMenu";

// three.js must never render on the server.
const GameCanvas = dynamic(() => import("@/game3d/scene/GameCanvas").then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-amber-200">{t("solo.loading")}</div>,
});

interface GameTable3DProps {
  store: StoreApi<GameStoreState>;
  title: string;
  /** Mode-specific controls in the top bar (solo: autoplay, new game; online: timer, connection). */
  headerExtra?: ReactNode;
  /** Mode-specific banners over the table (online: AFK takeover, reconnecting). */
  overlay?: ReactNode;
  /** Shown once the presented view has a winner. */
  gameOver: ReactNode;
}

/**
 * The 3D table with its HTML overlays: top bar, prompt panel, log, card tooltip, game over (docs/01 §9). Solo and
 * online share it entirely; only the adapter behind the store differs (docs/03 §4.1).
 */
export function GameTable3D({ store, title, headerExtra, overlay, gameOver }: GameTable3DProps) {
  const ti = useTableInteraction(store, { confirmUntargeted: true });
  const thinking = useStore(store, (s) => s.thinking);
  const log = useStore(store, (s) => s.log);
  const error = useStore(store, (s) => s.error);
  const presenting = useStore(store, (s) => s.presenting);
  const cinematics = useSettings((s) => s.cinematics);
  const setCinematics = useSettings((s) => s.setCinematics);
  const speed = useSettings((s) => s.speed);
  const setSpeed = useSettings((s) => s.setSpeed);
  const banner = useUi3D((s) => s.banner);
  const quality = useSettings((s) => s.quality);
  const setQuality = useSettings((s) => s.setQuality);
  const hoveredCard = useUi3D((s) => s.hoveredCard);
  const freeCamera = useUi3D((s) => s.freeCamera);
  const setFreeCamera = useUi3D((s) => s.setFreeCamera);
  const [showLog, setShowLog] = useState(true);

  // The Director stages every update on this table (docs/05 §6); without it the store falls back to short delays.
  useEffect(() => {
    const director = new Director(
      () => ({ mode: useSettings.getState().cinematics, speed: useSettings.getState().speed }),
      (on) => useUi3D.getState().setCinematic(on),
    );
    store.getState().setPresenter(director);
    return () => {
      store.getState().setPresenter(null);
      director.skip();
      useUi3D.getState().setBanner(null);
      useUi3D.getState().setCinematic(false);
    };
  }, [store]);

  // Space = skip (docs/05 §6), unless the player is typing in a form field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      e.preventDefault();
      store.getState().skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
  const targets = useTargetSeats(ti);

  const view = ti.view;
  if (!view) return null;

  return (
    <div data-testid="game-table" className="fixed inset-0 overflow-hidden bg-stone-950 text-amber-50">
      <div className="absolute inset-0">
        <GameCanvas ti={ti} />
      </div>
      <SeatBadges view={view} targets={targets} thinking={thinking} />

      <header className="absolute top-0 right-0 left-0 z-30 flex flex-wrap items-center gap-3 bg-stone-950/70 px-4 py-2 text-sm">
        <span className="font-bold tracking-widest text-amber-400 uppercase">{title}</span>
        <span>{t("table.turn", { n: view.turn.number })}</span>
        <span className="text-amber-300">{t(`phase.${view.turn.phase}`)}</span>
        <span className="text-stone-400">{t("table.deck", { n: view.deckCount })}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1">
            {t("solo.quality")}
            <select
              data-testid="quality"
              className="rounded border border-stone-600 bg-stone-800 px-1 py-0.5"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualitySetting)}
            >
              {(["auto", ...QUALITIES] as const).map((q) => (
                <option key={q} value={q}>
                  {t(`solo.quality.${q}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            {t("solo.cinematics")}
            <select
              data-testid="cinematics"
              className="rounded border border-stone-600 bg-stone-800 px-1 py-0.5"
              value={cinematics}
              onChange={(e) => setCinematics(e.target.value as CinematicMode)}
            >
              {(["full", "short", "off"] as const).map((m) => (
                <option key={m} value={m}>
                  {t(`solo.cinematics.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            {t("solo.speed")}
            <select
              data-testid="speed"
              className="rounded border border-stone-600 bg-stone-800 px-1 py-0.5"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
            >
              {SPEEDS.map((x) => (
                <option key={x} value={x}>
                  {x}x
                </option>
              ))}
            </select>
          </label>
          <SoundMenu />
          <Button onClick={() => store.getState().skip()} disabled={!presenting} testId="btn-skip">
            {t("solo.skip")}
          </Button>
          {headerExtra}
          {process.env.NODE_ENV !== "production" && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={freeCamera} onChange={(e) => setFreeCamera(e.target.checked)} />
              {t("solo.freeCamera")}
            </label>
          )}
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={showLog} onChange={(e) => setShowLog(e.target.checked)} />
            {t("solo.showLog")}
          </label>
        </div>
      </header>

      {/* The bottom band (HAND_BAND) belongs to the 3D hand: no HTML panel may cover a card there. */}
      <div className="absolute bottom-60 left-4 z-30 w-96 max-w-[calc(100vw-2rem)]">
        <PromptPanel ti={ti} thinking={thinking !== null} error={error} />
        <p className="mt-1 text-xs text-stone-400">{t("solo.hint")}</p>
      </div>

      {/* top-24 clears a header that wraps to two rows on narrower screens. */}
      {showLog && <GameLog log={log} className="absolute top-24 right-4 bottom-60 z-30 w-80" />}

      {banner && (
        <div
          data-testid="director-banner"
          className={`pointer-events-none absolute top-24 left-1/2 z-20 -translate-x-1/2 rounded-lg border px-6 py-3 text-center text-xl font-bold tracking-wide shadow-2xl ${
            banner.tone === "danger"
              ? "border-red-500 bg-red-950/85 text-red-100"
              : banner.tone === "gold"
                ? "border-amber-400 bg-stone-950/85 text-amber-300"
                : "border-stone-500 bg-stone-950/80 text-amber-50"
          }`}
        >
          {banner.text}
        </div>
      )}

      {hoveredCard && (
        <div
          className="pointer-events-none absolute bottom-64 left-1/2 z-30 w-72 -translate-x-1/2 rounded border border-amber-600 bg-stone-900/95 p-3 text-sm shadow-xl"
          data-testid="card-tooltip"
        >
          <div className="font-bold text-amber-300">{cardLabel(hoveredCard)}</div>
          <div className="text-stone-200">{cardRules(hoveredCard)}</div>
        </div>
      )}

      {overlay}

      {view.winner && gameOver}
    </div>
  );
}
