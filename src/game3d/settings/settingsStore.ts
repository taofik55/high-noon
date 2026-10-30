"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { AUTO_START, stepDown, type Quality, type QualitySetting } from "./quality";

interface SettingsState {
  quality: QualitySetting;
  /** Current level chosen by "auto"; not persisted. */
  autoLevel: Quality;
  setQuality(q: QualitySetting): void;
  degradeAuto(): void;
}

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

/** docs/03 §4.3 settingsStore (graphics part; audio and cinematics join in later phases). */
export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      quality: "auto",
      autoLevel: AUTO_START,
      setQuality: (quality) => set({ quality, autoLevel: AUTO_START }),
      degradeAuto: () => {
        if (get().quality === "auto") set({ autoLevel: stepDown(get().autoLevel) });
      },
    }),
    {
      name: "highnoon.settings.v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ quality: s.quality }),
    },
  ),
);
