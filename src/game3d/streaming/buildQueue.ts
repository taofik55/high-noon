import { create } from "zustand";

/**
 * Progressive building (docs/05 §9, Phase 13): procedural assets are built a few at a time between frames instead of
 * all at once on mount, so the table appears immediately with placeholders (Golden rule 6) and fills in. Essential
 * work (town, characters) is shown on the loading screen; the rest (card illustrations) streams in behind the game.
 */
export type LoadKind = "town" | "characters" | "cards";

export const PRIORITY = { essential: 0, visible: 1, prefetch: 2 } as const;

interface Task {
  id: string;
  kind: LoadKind;
  priority: number;
  run: () => unknown;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

export interface LoadingState {
  /** Tasks queued or done since the queue was last empty, split by essential / background. */
  essential: { total: number; done: number };
  background: { total: number; done: number };
  /** What is being built right now. */
  current: LoadKind | null;
  /** The 3D scene is mounted (its essential builds are queued by then). */
  sceneMounted: boolean;
}

const COUNTERS = { essential: { total: 0, done: 0 }, background: { total: 0, done: 0 }, current: null } as const;

export const useLoading = create<LoadingState>()(() => ({ ...COUNTERS, sceneMounted: false }));

export function setSceneMounted(on: boolean): void {
  useLoading.setState({ sceneMounted: on });
}

const ready = (s: LoadingState) => s.sceneMounted && s.essential.done >= s.essential.total;

/**
 * Resolves once the scene is mounted and its essential builds are done, so the Director never stages a scene behind
 * the loading screen.
 */
export function essentialsReady(timeoutMs = 90_000): Promise<void> {
  if (ready(useLoading.getState())) return Promise.resolve();
  return new Promise((resolve) => {
    // Never hold the game hostage: if the scene cannot mount (no WebGL) the game goes on without it.
    const timer = setTimeout(done, timeoutMs);
    const off = useLoading.subscribe((s) => {
      if (ready(s)) done();
    });
    function done() {
      clearTimeout(timer);
      off();
      resolve();
    }
  });
}

const queue: Task[] = [];
const pending = new Map<string, Promise<unknown>>();
let scheduled = false;
/** Milliseconds of building per frame before yielding (one long task can exceed it, but then it yields). */
const BUDGET_MS = 10;

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  const next = () => {
    scheduled = false;
    pump();
  };
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(next);
  else setTimeout(next, 0);
}

function pump(): void {
  const start = now();
  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const task = queue.shift() as Task;
    const essential = task.priority === PRIORITY.essential;
    useLoading.setState({ current: task.kind });
    try {
      task.resolve(task.run());
    } catch (e) {
      task.reject(e);
    }
    pending.delete(task.id);
    const s = useLoading.getState();
    useLoading.setState(
      essential ? { essential: { ...s.essential, done: s.essential.done + 1 } } : { background: { ...s.background, done: s.background.done + 1 } },
    );
    if (now() - start > BUDGET_MS) break;
  }
  if (queue.length > 0) schedule();
  // Counters start over with the next batch of work.
  else useLoading.setState(COUNTERS);
}

/** Queues `run` once per `id` (later calls get the same promise) and resolves with its result. */
export function enqueue<T>(id: string, kind: LoadKind, priority: number, run: () => T): Promise<T> {
  const existing = pending.get(id);
  if (existing) {
    // A more urgent request moves the task forward.
    const task = queue.find((t) => t.id === id);
    if (task && priority < task.priority) {
      const s = useLoading.getState();
      if (task.priority !== PRIORITY.essential && priority === PRIORITY.essential) {
        useLoading.setState({
          essential: { ...s.essential, total: s.essential.total + 1 },
          background: { ...s.background, total: s.background.total - 1 },
        });
      }
      task.priority = priority;
    }
    return existing as Promise<T>;
  }
  const promise = new Promise<T>((resolve, reject) => {
    queue.push({ id, kind, priority, run, resolve: resolve as (v: unknown) => void, reject });
  });
  pending.set(id, promise);
  const s = useLoading.getState();
  useLoading.setState(
    priority === PRIORITY.essential ? { essential: { ...s.essential, total: s.essential.total + 1 } } : { background: { ...s.background, total: s.background.total + 1 } },
  );
  schedule();
  return promise;
}

/** Test helper: run everything queued now. */
export function drainQueue(): void {
  while (queue.length > 0) pump();
}
