import { createStore, type StoreApi } from "zustand/vanilla";
import { IllegalActionError, type Action, type PlayerView } from "@/engine";
import type { GameAdapter, GameUpdate } from "@/net";
import { t } from "../i18n";
import { formatEvent, type LogLine } from "../log/formatEvent";

export type Speed = "normal" | "fast";

export interface LogEntry extends LogLine {
  id: number;
}

export interface GameStoreState {
  adapter: GameAdapter | null;
  /** Updates received but not yet presented (docs/03 §4.2). */
  queue: GameUpdate[];
  /** What the HUD shows: never ahead of the presentation, so results are not spoiled. */
  presentedView: PlayerView | null;
  presentedVersion: number;
  /** Seat whose NPC update is being "thought about" right now. */
  thinking: number | null;
  log: LogEntry[];
  sending: boolean;
  error: string | null;
  speed: Speed;

  attach(adapter: GameAdapter, initial: GameUpdate): void;
  detach(): void;
  enqueue(update: GameUpdate): void;
  send(action: Action): Promise<void>;
  setSpeed(speed: Speed): void;
  clearError(): void;
}

/** Director stub timings (ms). Phase 8 replaces this with real cinematic sequences. */
export const STEP_DELAY = 250;
export const NPC_THINK_DELAY = 450;

/** True when the human may act: nothing left to present and the view offers legal actions (docs/03 §4.2). */
export function canAct(s: Pick<GameStoreState, "queue" | "presentedView" | "sending">): boolean {
  return s.queue.length === 0 && !s.sending && (s.presentedView?.legalActions.length ?? 0) > 0;
}

export function createGameStore(): StoreApi<GameStoreState> {
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextLogId = 0;

  const toLog = (update: GameUpdate): LogEntry[] =>
    update.events.flatMap((e) => {
      const line = formatEvent(e, update.view);
      return line ? [{ ...line, id: nextLogId++ }] : [];
    });

  return createStore<GameStoreState>()((set, get) => {
    /** Presents queued updates one at a time: the stand-in for the Director's sequence player. */
    const pump = (): void => {
      if (timer !== null) return;
      const next = get().queue[0];
      if (!next) return;
      const mySeat = get().adapter?.mySeat;
      const npc = next.actor !== null && next.actor !== mySeat;
      const delay = get().speed === "fast" ? 0 : STEP_DELAY + (npc ? NPC_THINK_DELAY : 0);
      set({ thinking: npc && delay > 0 ? next.actor : null });
      timer = setTimeout(() => {
        timer = null;
        const [head, ...rest] = get().queue;
        if (!head) return;
        set((s) => ({
          queue: rest,
          presentedView: head.view,
          presentedVersion: head.version,
          thinking: null,
          log: [...s.log, ...toLog(head)].slice(-400),
        }));
        pump();
      }, delay);
    };

    return {
      adapter: null,
      queue: [],
      presentedView: null,
      presentedVersion: 0,
      thinking: null,
      log: [],
      sending: false,
      error: null,
      speed: "normal",

      attach(adapter, initial) {
        get().detach();
        set({
          adapter,
          queue: [],
          presentedView: initial.view,
          presentedVersion: initial.version,
          log: toLog(initial),
          error: null,
          sending: false,
          thinking: null,
        });
        unsubscribe = adapter.onUpdate((u) => get().enqueue(u));
      },

      detach() {
        unsubscribe?.();
        unsubscribe = null;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        get().adapter?.dispose();
        set({ adapter: null, queue: [], presentedView: null, presentedVersion: 0, log: [], thinking: null, sending: false });
      },

      enqueue(update) {
        set((s) => ({ queue: [...s.queue, update] }));
        pump();
      },

      async send(action) {
        const { adapter } = get();
        if (!adapter || !canAct(get())) return;
        set({ sending: true, error: null });
        try {
          await adapter.send(action);
        } catch (e) {
          set({ error: e instanceof IllegalActionError ? t("error.illegal", { reason: e.reason }) : String(e) });
        } finally {
          set({ sending: false });
        }
      },

      setSpeed(speed) {
        set({ speed });
      },

      clearError() {
        set({ error: null });
      },
    };
  });
}
