"use client";

import { useState, useSyncExternalStore } from "react";
import type { Difficulty } from "@/ai";
import type { CharacterMode } from "@/engine";
import type { SoloConfig } from "@/net";
import { t } from "../i18n";
import { Button } from "./Button";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const noSubscribe = () => () => {};

/**
 * False during server rendering and hydration, true once React owns the form. Anything typed before that would be
 * wiped by hydration, so Start stays disabled until then (and e2e tests wait for it).
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

interface SetupScreenProps {
  hasSaved: boolean;
  onStart: (config: SoloConfig) => void;
  onResume: () => void;
  onDiscardSaved: () => void;
}

export function SetupScreen({ hasSaved, onStart, onResume, onDiscardSaved }: SetupScreenProps) {
  const hydrated = useHydrated();
  const [name, setName] = useState("");
  const [count, setCount] = useState(5);
  const [global, setGlobal] = useState<Difficulty>("medium");
  const [perSeat, setPerSeat] = useState<Difficulty[] | null>(null);
  const [characterMode, setCharacterMode] = useState<CharacterMode>("random");

  const difficulties = Array.from({ length: count }, (_, seat) => perSeat?.[seat] ?? global);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 p-6 text-amber-50">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-amber-800 bg-stone-900 p-6 shadow-2xl">
        <h1 className="text-2xl font-bold tracking-widest text-amber-400 uppercase">{t("setup.title")}</h1>

        {hasSaved && (
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={onResume} testId="setup-resume">
              {t("setup.resume")}
            </Button>
            <Button onClick={onDiscardSaved}>{t("setup.discard")}</Button>
          </div>
        )}

        <label className="block text-sm">
          {t("setup.nickname")}
          <input
            data-testid="setup-name"
            className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          {t("setup.players")}
          <select
            data-testid="setup-count"
            className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <div className="flex items-center justify-between">
            <span>{t("setup.difficulty")}</span>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={perSeat !== null} onChange={(e) => setPerSeat(e.target.checked ? difficulties : null)} />
              {t("setup.perSeat")}
            </label>
          </div>
          {perSeat === null ? (
            <select
              data-testid="setup-difficulty"
              className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
              value={global}
              onChange={(e) => setGlobal(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {t(`difficulty.${d}`)}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 space-y-1">
              {difficulties.slice(1).map((d, i) => (
                <label key={i} className="flex items-center justify-between gap-2 text-xs">
                  {t("setup.seat", { n: i + 2 })}
                  <select
                    className="rounded border border-stone-600 bg-stone-800 px-2 py-0.5"
                    value={d}
                    onChange={(e) => {
                      const next = [...difficulties];
                      next[i + 1] = e.target.value as Difficulty;
                      setPerSeat(next);
                    }}
                  >
                    {DIFFICULTIES.map((x) => (
                      <option key={x} value={x}>
                        {t(`difficulty.${x}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="block text-sm">
          {t("setup.characterMode")}
          <select
            className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
            value={characterMode}
            onChange={(e) => setCharacterMode(e.target.value as CharacterMode)}
          >
            <option value="random">{t("setup.characterMode.random")}</option>
            <option value="choose_of_2">{t("setup.characterMode.choose_of_2")}</option>
          </select>
        </label>

        <Button tone="primary" testId="setup-start" disabled={!hydrated} onClick={() => onStart({ playerName: name, playerCount: count, difficulties, characterMode })}>
          {t("setup.start")}
        </Button>
      </div>
    </div>
  );
}
