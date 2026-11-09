"use client";

import { useState } from "react";
import { useSettings } from "@/game3d/settings/settingsStore";
import { t, type MessageKey } from "../i18n";
import { Button } from "../table/Button";

/** Screen regions the steps point at (pointer-events none: the game stays playable during the tutorial). */
type Region = "hand" | "seats" | "prompt" | "log" | "header" | null;

export const TUTORIAL_STEPS: readonly { key: string; region: Region }[] = [
  { key: "welcome", region: null },
  { key: "role", region: "seats" },
  { key: "hand", region: "hand" },
  { key: "range", region: "seats" },
  { key: "respond", region: "prompt" },
  { key: "turn", region: "prompt" },
  { key: "draw", region: "log" },
  { key: "settings", region: "header" },
];

const REGION_CLASS: Record<Exclude<Region, null>, string> = {
  hand: "bottom-0 left-1/2 h-56 w-[44rem] max-w-full -translate-x-1/2",
  seats: "top-24 left-1/2 h-[45%] w-[70%] -translate-x-1/2",
  prompt: "bottom-56 left-2 h-40 w-[25rem] max-w-[calc(100vw-1rem)]",
  log: "top-20 right-2 bottom-56 w-[21rem]",
  header: "top-0 right-0 left-0 h-12",
};

/**
 * First-game tutorial (Phase 13): a few coach marks over the live table, never blocking it. Finishing or skipping it
 * sets `tutorialDone`; the settings can turn it back on.
 */
export function Tutorial() {
  const done = useSettings((s) => s.tutorialDone);
  const setDone = useSettings((s) => s.setTutorialDone);
  const [step, setStep] = useState(0);
  if (done) return null;
  const current = TUTORIAL_STEPS[step] ?? (TUTORIAL_STEPS[0] as (typeof TUTORIAL_STEPS)[number]);
  const last = step === TUTORIAL_STEPS.length - 1;
  const finish = () => {
    setDone(true);
    setStep(0);
  };
  return (
    <>
      {current.region && (
        <div
          data-testid="tutorial-highlight"
          className={`pointer-events-none absolute z-20 rounded-xl border-2 border-amber-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] ${REGION_CLASS[current.region]}`}
        />
      )}
      <div
        data-testid="tutorial"
        role="dialog"
        aria-label={t("tutorial.title")}
        className="absolute top-14 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-amber-500 bg-stone-950/95 p-4 text-sm text-amber-50 shadow-2xl"
      >
        <div className="mb-1 flex justify-between text-xs text-amber-400">
          <span className="font-bold tracking-widest uppercase">{t("tutorial.title")}</span>
          <span>
            {step + 1}/{TUTORIAL_STEPS.length}
          </span>
        </div>
        <h3 className="mb-1 font-bold text-amber-300">{t(`tutorial.${current.key}.title` as MessageKey)}</h3>
        <p className="text-stone-200">{t(`tutorial.${current.key}.body` as MessageKey)}</p>
        <div className="mt-3 flex justify-between gap-2">
          <button type="button" data-testid="tutorial-skip" className="text-xs text-stone-400 underline" onClick={finish}>
            {t("tutorial.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button onClick={() => setStep(step - 1)} testId="tutorial-back">
                {t("tutorial.back")}
              </Button>
            )}
            <Button tone="primary" onClick={last ? finish : () => setStep(step + 1)} testId="tutorial-next">
              {last ? t("tutorial.done") : t("tutorial.next")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
