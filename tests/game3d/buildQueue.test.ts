import { describe, expect, it, vi } from "vitest";
import { drainQueue, enqueue, PRIORITY, useLoading } from "@/game3d/streaming/buildQueue";

describe("progressive build queue (Phase 13)", () => {
  it("runs essential work before visible before prefetch, once per id", async () => {
    const order: string[] = [];
    const a = enqueue("art:bang", "cards", PRIORITY.prefetch, () => order.push("prefetch"));
    enqueue("art:beer", "cards", PRIORITY.visible, () => order.push("visible"));
    enqueue("town:1", "town", PRIORITY.essential, () => order.push("town"));
    const again = enqueue("art:bang", "cards", PRIORITY.prefetch, () => order.push("twice"));
    expect(again).toBe(a);
    expect(useLoading.getState().essential).toEqual({ total: 1, done: 0 });
    expect(useLoading.getState().background).toEqual({ total: 2, done: 0 });
    drainQueue();
    expect(order).toEqual(["town", "visible", "prefetch"]);
    await expect(a).resolves.toBe(3);
    // Counters reset once everything is done.
    expect(useLoading.getState().essential.total).toBe(0);
  });

  it("a more urgent request moves a queued task forward and onto the loading screen", () => {
    const order: string[] = [];
    enqueue("art:duel", "cards", PRIORITY.prefetch, () => order.push("duel"));
    enqueue("art:jail", "cards", PRIORITY.prefetch, () => order.push("jail"));
    enqueue("art:jail", "cards", PRIORITY.essential, () => order.push("ignored"));
    expect(useLoading.getState().essential.total).toBe(1);
    drainQueue();
    expect(order).toEqual(["jail", "duel"]);
  });

  it("a failing task rejects its promise and the rest still run", async () => {
    const after = vi.fn(() => "ok");
    const failing = enqueue("character:0", "characters", PRIORITY.essential, () => {
      throw new Error("boom");
    });
    const next = enqueue("character:1", "characters", PRIORITY.essential, after);
    drainQueue();
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
    expect(after).toHaveBeenCalledOnce();
  });
});

describe("essentials gate for the Director", () => {
  it("waits for the scene to mount and its essential builds to finish", async () => {
    const { essentialsReady, setSceneMounted } = await import("@/game3d/streaming/buildQueue");
    setSceneMounted(false);
    let done = false;
    const gate = essentialsReady().then(() => (done = true));
    enqueue("town:test", "town", PRIORITY.essential, () => 1);
    setSceneMounted(true);
    await Promise.resolve();
    expect(done).toBe(false);
    drainQueue();
    await gate;
    expect(done).toBe(true);
  });

  it("gives up waiting after the timeout (no WebGL)", async () => {
    vi.useFakeTimers();
    const { essentialsReady, setSceneMounted } = await import("@/game3d/streaming/buildQueue");
    setSceneMounted(false);
    const gate = essentialsReady(1000);
    vi.advanceTimersByTime(1000);
    await expect(gate).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
