import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, toPlayerView, type Action, type PlayerView } from "@/engine";
import type { GameAdapter, GameUpdate } from "@/net";
import { NPC_THINK_DELAY, STEP_DELAY, canAct, createGameStore } from "@/ui/store/gameStore";

function views(): PlayerView[] {
  const { state } = createGame({ players: Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, isNpc: i > 0 })), characterMode: "random" }, "store");
  return [0, 1].map(() => toPlayerView(state, 0));
}

class FakeAdapter implements GameAdapter {
  readonly mySeat = 0;
  listener: ((u: GameUpdate) => void) | null = null;
  sent: Action[] = [];
  disposed = false;
  async start(): Promise<GameUpdate> {
    throw new Error("unused");
  }
  onUpdate(cb: (u: GameUpdate) => void) {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }
  async send(action: Action) {
    this.sent.push(action);
  }
  async reportTimeout() {}
  dispose() {
    this.disposed = true;
  }
}

describe("gameStore: update queue and presented view (docs/03 §4.2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("presents updates in order, after the Director delay, never ahead of time", () => {
    const store = createGameStore();
    const adapter = new FakeAdapter();
    const [v0, v1] = views() as [PlayerView, PlayerView];
    store.getState().attach(adapter, { version: 1, events: [], view: v0, actor: null });
    expect(store.getState().presentedVersion).toBe(1);

    adapter.listener?.({ version: 2, events: [{ t: "TURN_STARTED", seat: 1, turn: 2 }], view: v1, actor: 1 });
    adapter.listener?.({ version: 3, events: [], view: v1, actor: 1 });
    expect(store.getState().presentedVersion).toBe(1);
    expect(store.getState().thinking).toBe(1);
    expect(canAct(store.getState())).toBe(false);

    vi.advanceTimersByTime(STEP_DELAY + NPC_THINK_DELAY);
    expect(store.getState().presentedVersion).toBe(2);
    expect(store.getState().log.at(-1)?.tone).toBe("turn");
    vi.advanceTimersByTime(STEP_DELAY + NPC_THINK_DELAY);
    expect(store.getState().presentedVersion).toBe(3);
    expect(store.getState().queue).toHaveLength(0);
  });

  it("fast mode presents without waiting for thinking time", () => {
    const store = createGameStore();
    const adapter = new FakeAdapter();
    const [v0, v1] = views() as [PlayerView, PlayerView];
    store.getState().attach(adapter, { version: 1, events: [], view: v0, actor: null });
    store.getState().setSpeed("fast");
    adapter.listener?.({ version: 2, events: [], view: v1, actor: 1 });
    vi.advanceTimersByTime(0);
    expect(store.getState().presentedVersion).toBe(2);
  });

  it("only sends while the human may act, and detaches cleanly", async () => {
    const store = createGameStore();
    const adapter = new FakeAdapter();
    const [v0] = views() as [PlayerView];
    store.getState().attach(adapter, { version: 1, events: [], view: v0, actor: null });
    const mayAct = v0.legalActions.length > 0;
    await store.getState().send({ type: "END_TURN" });
    expect(adapter.sent).toHaveLength(mayAct ? 1 : 0);
    store.getState().detach();
    expect(adapter.disposed).toBe(true);
    expect(store.getState().presentedView).toBeNull();
  });
});
