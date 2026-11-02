import { createStore, type StoreApi } from "zustand/vanilla";
import { IllegalActionError, type Action, type PlayerView, type Seat } from "@/engine";
import type { GameAdapter, GameUpdate } from "@/net";
import { t, type MessageKey } from "../i18n";
import { formatEvent, type LogLine } from "../log/formatEvent";

export type Speed = "normal" | "fast";

export interface LogEntry extends LogLine {
  id: number;
}

export interface PresentInfo {
  /** The view the HUD shows while this update is staged (the result is not revealed before the scene ends). */
  prev: PlayerView;
  mySeat: Seat;
  /** Skip / fast-forward: present without any animation. */
  instant: boolean;
  /** Shows "X is thinking…" on the HUD while the presenter holds an NPC's thinking pause. */
  setThinking(seat: Seat | null): void;
}

/**
 * Stages one update before the HUD shows its result (docs/03 §4.2, docs/05 §6). The 3D table installs the Director;
 * without a presenter the store uses a short delay (2D debug table, tests). Must never be required for correctness.
 */
export interface Presenter {
  present(update: GameUpdate, info: PresentInfo): Promise<void>;
  /** Finish the current scene at once. */
  skip(): void;
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
  /** True while an update is being presented. */
  presenting: boolean;
  log: LogEntry[];
  sending: boolean;
  error: string | null;
  speed: Speed;

  attach(adapter: GameAdapter, initial: GameUpdate): void;
  detach(): void;
  enqueue(update: GameUpdate): void;
  send(action: Action): Promise<void>;
  setSpeed(speed: Speed): void;
  setPresenter(presenter: Presenter | null): void;
  /** Skip button / Space: finish the current scene and fast-forward everything queued (docs/05 §6). */
  skip(): void;
  clearError(): void;
}

/** Stub presenter timings (ms), used when no Director is installed. */
export const STEP_DELAY = 250;
export const NPC_THINK_DELAY = 450;

/** True when the human may act: nothing left to present and the view offers legal actions (docs/03 §4.2). */
export function canAct(s: Pick<GameStoreState, "queue" | "presentedView" | "sending">): boolean {
  return s.queue.length === 0 && !s.sending && (s.presentedView?.legalActions.length ?? 0) > 0;
}

export function createGameStore(): StoreApi<GameStoreState> {
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let presenter: Presenter | null = null;
  let running = false;
  let skipping = false;
  /** Bumped on attach/detach so a scene finishing after a reset is ignored. */
  let generation = 0;
  let nextLogId = 0;

  const toLog = (update: GameUpdate): LogEntry[] =>
    update.events.flatMap((e) => {
      const line = formatEvent(e, update.view);
      return line ? [{ ...line, id: nextLogId++ }] : [];
    });

  return createStore<GameStoreState>()((set, get) => {
    const apply = (update: GameUpdate): void => {
      set((s) => ({
        queue: s.queue.slice(1),
        presentedView: update.view,
        presentedVersion: update.version,
        thinking: null,
        log: [...s.log, ...toLog(update)].slice(-400),
      }));
    };

    /** The stand-in presenter: a short delay, longer for NPC actions, none in fast mode. */
    const stubPresent = (update: GameUpdate, done: () => void): void => {
      const npc = update.actor !== null && update.actor !== get().adapter?.mySeat;
      const delay = get().speed === "fast" || skipping ? 0 : STEP_DELAY + (npc ? NPC_THINK_DELAY : 0);
      set({ thinking: npc && delay > 0 ? update.actor : null });
      timer = setTimeout(() => {
        timer = null;
        done();
      }, delay);
    };

    /** Presents queued updates strictly one at a time, in order. */
    const pump = (): void => {
      if (running) return;
      const next = get().queue[0];
      const prev = get().presentedView;
      const adapter = get().adapter;
      if (!next || !prev || !adapter) {
        skipping = false;
        if (get().presenting) set({ presenting: false });
        return;
      }
      running = true;
      set({ presenting: true });
      const gen = generation;
      const finish = () => {
        if (gen !== generation) return;
        running = false;
        apply(next);
        if (get().queue.length === 0) {
          skipping = false;
          set({ presenting: false });
        }
        pump();
      };
      if (!presenter) {
        stubPresent(next, finish);
        return;
      }
      presenter
        .present(next, { prev, mySeat: adapter.mySeat, instant: skipping, setThinking: (seat) => set({ thinking: seat }) })
        .catch((e: unknown) => {
          // A broken scene must never block the game (docs/05 §6): log it and show the result.
          if (process.env.NODE_ENV !== "production") console.error("[director]", e);
        })
        .finally(finish);
    };

    return {
      adapter: null,
      queue: [],
      presentedView: null,
      presentedVersion: 0,
      thinking: null,
      presenting: false,
      log: [],
      sending: false,
      error: null,
      speed: "normal",

      attach(adapter, initial) {
        get().detach();
        generation++;
        set({
          adapter,
          queue: [],
          presentedView: initial.view,
          presentedVersion: initial.version,
          log: toLog(initial),
          error: null,
          sending: false,
          thinking: null,
          presenting: false,
        });
        unsubscribe = adapter.onUpdate((u) => get().enqueue(u));
      },

      detach() {
        generation++;
        unsubscribe?.();
        unsubscribe = null;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        presenter?.skip();
        running = false;
        skipping = false;
        get().adapter?.dispose();
        set({ adapter: null, queue: [], presentedView: null, presentedVersion: 0, log: [], thinking: null, sending: false, presenting: false });
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
          // Online refusals carry an API error code (OnlineActionError); show the translated message, not the code.
          const code = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : null;
          set({
            error:
              e instanceof IllegalActionError
                ? t("error.illegal", { reason: e.reason })
                : code
                  ? t(`rooms.error.${code}` as MessageKey)
                  : String(e),
          });
        } finally {
          set({ sending: false });
        }
      },

      setSpeed(speed) {
        set({ speed });
      },

      setPresenter(p) {
        presenter = p;
      },

      skip() {
        if (!running && get().queue.length === 0) return;
        skipping = true;
        presenter?.skip();
        if (timer !== null) {
          // Stub presenter: fire the pending step now.
          clearTimeout(timer);
          timer = null;
          running = false;
          const next = get().queue[0];
          if (next) apply(next);
          pump();
        }
      },

      clearError() {
        set({ error: null });
      },
    };
  });
}
