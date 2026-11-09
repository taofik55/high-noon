"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CinematicMode } from "@/game3d/director/types";
import { QUALITIES, touchDevice, type QualitySetting } from "@/game3d/settings/quality";
import { SPEEDS, useSettings, type Speed, type Volumes } from "@/game3d/settings/settingsStore";
import { Credits } from "../credits/Credits";
import { LOCALES, t, type Locale } from "../i18n";
import { Button } from "../table/Button";

const CHANNELS: readonly (keyof Volumes)[] = ["master", "music", "sfx"];
const MOTION = ["system", "on", "off"] as const;

const selectClass = "rounded border border-stone-600 bg-stone-800 px-2 py-1";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold tracking-widest text-amber-400 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {children}
      </label>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

/**
 * Every local setting of docs/01 §6 in one place: graphics, cinematics, speed, sound, language and accessibility.
 * Used by /settings and the in-game settings dialog.
 */
export function SettingsPanel() {
  const s = useSettings();
  const [credits, setCredits] = useState(false);

  return (
    <div data-testid="settings-panel" className="space-y-5 text-sm text-amber-50">
      <Section title={t("settings.graphics")}>
        <Row label={t("solo.quality")} hint={touchDevice() ? t("settings.touchLow") : undefined}>
          <select data-testid="quality" className={selectClass} value={s.quality} onChange={(e) => s.setQuality(e.target.value as QualitySetting)}>
            {(["auto", ...QUALITIES] as const).map((q) => (
              <option key={q} value={q}>
                {t(`solo.quality.${q}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("solo.cinematics")}>
          <select data-testid="cinematics" className={selectClass} value={s.cinematics} onChange={(e) => s.setCinematics(e.target.value as CinematicMode)}>
            {(["full", "short", "off"] as const).map((m) => (
              <option key={m} value={m}>
                {t(`solo.cinematics.${m}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("solo.speed")}>
          <select data-testid="speed" className={selectClass} value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value) as Speed)}>
            {SPEEDS.map((x) => (
              <option key={x} value={x}>
                {x}x
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title={t("settings.audio")}>
        {CHANNELS.map((c) => (
          <Row key={c} label={t(`audio.${c}`)}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              data-testid={`audio-${c}`}
              value={Math.round(s.volume[c] * 100)}
              onChange={(e) => s.setVolume(c, Number(e.target.value) / 100)}
              className="w-36 accent-amber-500"
            />
          </Row>
        ))}
      </Section>

      <Section title={t("settings.display")}>
        <Row label={t("settings.language")} hint={t("settings.languageHint")}>
          <select data-testid="language" className={selectClass} value={s.locale} onChange={(e) => s.setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`settings.language.${l}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("settings.reduceMotion")} hint={t("settings.reduceMotionHint")}>
          <select data-testid="reduce-motion" className={selectClass} value={s.reduceMotion} onChange={(e) => s.setReduceMotion(e.target.value as (typeof MOTION)[number])}>
            {MOTION.map((m) => (
              <option key={m} value={m}>
                {t(`settings.reduceMotion.${m}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("settings.largeText")}>
          <input type="checkbox" data-testid="large-text" checked={s.largeText} onChange={(e) => s.setLargeText(e.target.checked)} className="size-4 accent-amber-500" />
        </Row>
        <Row label={t("settings.colorBlindSuits")}>
          <input type="checkbox" data-testid="color-blind-suits" checked={s.colorBlindSuits} onChange={(e) => s.setColorBlindSuits(e.target.checked)} className="size-4 accent-amber-500" />
        </Row>
        <Row label={t("settings.tutorial")}>
          <input type="checkbox" data-testid="tutorial-again" checked={!s.tutorialDone} onChange={(e) => s.setTutorialDone(!e.target.checked)} className="size-4 accent-amber-500" />
        </Row>
      </Section>

      <button type="button" data-testid="btn-credits" className="text-xs text-amber-300 underline" onClick={() => setCredits(true)}>
        {t("credits.title")}
      </button>

      {credits && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setCredits(false)}>
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

/** The settings as a dialog over the game table. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-4 pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        data-testid="settings-dialog"
        className="max-h-[calc(100vh-5rem)] w-96 max-w-full overflow-y-auto rounded-lg border border-amber-700 bg-stone-950/95 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-300">{t("settings.title")}</h2>
          <Button onClick={onClose} testId="btn-settings-close">
            {t("settings.close")}
          </Button>
        </div>
        <SettingsPanel />
      </div>
    </div>
  );
}
