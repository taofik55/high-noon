"use client";

import { useState } from "react";
import { useSettings, type Volumes } from "@/game3d/settings/settingsStore";
import { Credits } from "../credits/Credits";
import { t } from "../i18n";
import { Button } from "../table/Button";

const CHANNELS: readonly (keyof Volumes)[] = ["master", "music", "sfx"];

/** Volume sliders (docs/05 §10) and the credits, behind one header button. */
export function SoundMenu() {
  const volume = useSettings((s) => s.volume);
  const setVolume = useSettings((s) => s.setVolume);
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(false);

  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} testId="btn-sound">
        {t("audio.title")}
      </Button>
      {open && (
        <div data-testid="sound-menu" className="absolute top-full right-0 mt-2 w-56 space-y-2 rounded border border-stone-600 bg-stone-900/95 p-3 shadow-xl">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center justify-between gap-2">
              <span>{t(`audio.${c}`)}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                data-testid={`audio-${c}`}
                value={Math.round(volume[c] * 100)}
                onChange={(e) => setVolume(c, Number(e.target.value) / 100)}
                className="w-28 accent-amber-500"
              />
            </label>
          ))}
          <button type="button" data-testid="btn-credits" className="text-xs text-amber-300 underline" onClick={() => setCredits(true)}>
            {t("credits.title")}
          </button>
        </div>
      )}
      {credits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setCredits(false)}>
          <div className="max-w-xl rounded-lg border border-amber-700 bg-stone-950 p-6" onClick={(e) => e.stopPropagation()}>
            <Credits />
            <div className="mt-4 text-right">
              <Button onClick={() => setCredits(false)} testId="btn-credits-close">
                {t("credits.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
