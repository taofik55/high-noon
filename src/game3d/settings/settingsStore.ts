"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
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

/** docs/03 §4.3 settingsStore: graphics, cinematics and audio. */
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
    }),
    {
      name: "highnoon.settings.v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ quality: s.quality, cinematics: s.cinematics, speed: s.speed, volume: s.volume }),
      // Older saves have no volumes: keep the defaults for missing channels.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, volume: { ...DEFAULT_VOLUMES, ...p.volume } };
      },
    },
  ),
);
