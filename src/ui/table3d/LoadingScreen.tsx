"use client";

import { useEffect, useState } from "react";
import { GAME_TITLE } from "@/config/game";
import { useLoading, type LoadKind } from "@/game3d/streaming/buildQueue";
import { t } from "../i18n";

const LABEL: Record<LoadKind, "loading.town" | "loading.characters" | "loading.cards"> = {
  town: "loading.town",
  characters: "loading.characters",
  cards: "loading.cards",
};

/** Full-screen card while the essentials are built; `indeterminate` before the 3D scene has even loaded. */
export function LoadingCurtain({ indeterminate = false }: { indeterminate?: boolean }) {
  const { essential, current } = useLoading();
  const busy = indeterminate || essential.done < essential.total;
  // Stays mounted (fading out) for 400 ms after the work is done.
  const [gone, setGone] = useState(!busy);
  if (busy && gone) setGone(false);
  useEffect(() => {
    if (busy) return;
    const id = setTimeout(() => setGone(true), 400);
    return () => clearTimeout(id);
  }, [busy]);
  if (gone) return null;
  const pct = indeterminate || essential.total === 0 ? null : Math.round((essential.done / essential.total) * 100);
  return (
    <div
      data-testid="loading-screen"
      aria-busy={busy}
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-stone-950 text-amber-50 transition-opacity duration-400 ${busy ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className="text-4xl font-bold tracking-widest text-amber-400 uppercase">{GAME_TITLE}</div>
      <div className="text-sm text-amber-200">{t(current && !indeterminate ? LABEL[current] : "solo.loading")}</div>
      <div className="h-2 w-72 overflow-hidden rounded bg-stone-800" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full bg-amber-500 transition-all ${pct === null ? "w-1/3 animate-pulse" : ""}`} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Small corner note while card illustrations stream in behind the game. */
export function StreamingNote() {
  const { background, essential } = useLoading();
  if (background.total === 0 || essential.done < essential.total) return null;
  return (
    <div data-testid="streaming-note" className="pointer-events-none absolute right-4 bottom-4 z-30 rounded bg-stone-900/80 px-3 py-1 text-xs text-amber-200">
      {t("loading.background", { done: background.done, total: background.total })}
    </div>
  );
}
