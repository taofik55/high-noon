import type { AiMemory, Difficulty } from "@/ai";
import type { CharacterMode, GameEvent, GameState, RngState } from "@/engine";

export interface SoloConfig {
  playerName: string;
  playerCount: number;
  /** One per seat; seat 0 (the human) is only used when autoplay is on. */
  difficulties: Difficulty[];
  characterMode: CharacterMode;
  /** Fixed seed for reproducible games (tests); random otherwise. */
  seed?: string;
}

/** Everything needed to resume a solo game after a refresh (docs/01 §5.1). */
export interface SavedSolo {
  schema: 1;
  config: SoloConfig;
  state: GameState;
  version: number;
  memories: AiMemory[];
  rngs: RngState[];
  /** Recent events, already redacted for the human seat, to rebuild the log. */
  log: GameEvent[];
}

export interface SoloStorage {
  load(): SavedSolo | null;
  save(saved: SavedSolo): void;
  clear(): void;
}

const KEY = "highnoon.solo.v1";

/** Browser storage. Every access is guarded: private mode or a full quota must never break the game. */
export const localSoloStorage: SoloStorage = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as SavedSolo;
      return saved.schema === 1 && saved.state?.schemaVersion === 1 ? saved : null;
    } catch {
      return null;
    }
  },
  save(saved) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Quota or privacy mode: the game goes on, it just cannot be resumed.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

export class MemorySoloStorage implements SoloStorage {
  private saved: string | null = null;

  load(): SavedSolo | null {
    return this.saved ? (JSON.parse(this.saved) as SavedSolo) : null;
  }

  save(saved: SavedSolo): void {
    this.saved = JSON.stringify(saved);
  }

  clear(): void {
    this.saved = null;
  }
}
