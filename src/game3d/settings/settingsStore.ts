"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Locale } from "@/ui/i18n";
import type { CinematicMode } from "../director/types";
import { AUTO_START, stepDown, type Quality, type QualitySetting } from "./quality";

export const SPEEDS = [1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

interface SettingsState {
  quality: QualitySetting;
  /** Current level chosen by "auto"; not persisted. */
  autoLevel: Quality;
  setQuality(q: QualitySetting): void;
  degradeAuto(): void;
  /** docs/01 §6: full, short, off (default full). */
  cinematics: CinematicMode;
  /** docs/01 §6: 1x, 1.5x, 2x. */
  speed: Speed;
  setCinematics(mode: CinematicMode): void;
  setSpeed(speed: Speed): void;
  /** docs/05 §10: master / music / effects volume, 0–1 (defaults 0.8 / 0.5 / 0.8). */
  volume: Volumes;
  setVolume(channel: keyof Volumes, value: number): void;
  /** docs/01 §6 language (default Bahasa Indonesia). */
  locale: Locale;
  setLocale(locale: Locale): void;
  /** Accessibility: "system" follows prefers-reduced-motion. */
  reduceMotion: "system" | "on" | "off";
  setReduceMotion(v: "system" | "on" | "off"): void;
  largeText: boolean;
  setLargeText(on: boolean): void;
  /** Four-colour suits (♥ red, ♦ blue, ♣ green, ♠ black) instead of red/black. */
  colorBlindSuits: boolean;
  setColorBlindSuits(on: boolean): void;
  /** The first-game tutorial was finished or skipped. */
  tutorialDone: boolean;
  setTutorialDone(done: boolean): void;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.5, sfx: 0.8 };

/** localStorage that never throws (private mode, blocked storage): settings then just don't persist. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

/** docs/03 §4.3 settingsStore: graphics, cinematics, audio, language and accessibility. */
export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      quality: "auto",
      autoLevel: AUTO_START,
      setQuality: (quality) => set({ quality, autoLevel: AUTO_START }),
      degradeAuto: () => {
        if (get().quality === "auto") set({ autoLevel: stepDown(get().autoLevel) });
      },
      cinematics: "full",
      speed: 1,
      setCinematics: (cinematics) => set({ cinematics }),
      setSpeed: (speed) => set({ speed }),
      volume: DEFAULT_VOLUMES,
      setVolume: (channel, value) => set({ volume: { ...get().volume, [channel]: Math.min(1, Math.max(0, value)) } }),
      locale: "id",
      setLocale: (locale) => set({ locale }),
      reduceMotion: "system",
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      largeText: false,
      setLargeText: (largeText) => set({ largeText }),
      colorBlindSuits: false,
      setColorBlindSuits: (colorBlindSuits) => set({ colorBlindSuits }),
      tutorialDone: false,
      setTutorialDone: (tutorialDone) => set({ tutorialDone }),
    }),
    {
      name: "highnoon.settings.v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        quality: s.quality,
        cinematics: s.cinematics,
        speed: s.speed,
        volume: s.volume,
        locale: s.locale,
        reduceMotion: s.reduceMotion,
        largeText: s.largeText,
        colorBlindSuits: s.colorBlindSuits,
        tutorialDone: s.tutorialDone,
      }),
      // Older saves have no volumes: keep the defaults for missing channels.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, volume: { ...DEFAULT_VOLUMES, ...p.volume } };
      },
    },
  ),
);

/** Reduced motion in effect: the player's choice, or the OS setting when it is "system". */
export function reducedMotion(): boolean {
  const pref = useSettings.getState().reduceMotion;
  if (pref !== "system") return pref === "on";
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Reduced motion caps cinematics at "short": no flying camera, no shake, no walk-outs (docs/01 §6 accessibility). */
export function effectiveCinematics(mode: CinematicMode, reduced: boolean): CinematicMode {
  return reduced && mode === "full" ? "short" : mode;
}
