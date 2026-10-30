import { describe, expect, it } from "vitest";
import { IllegalActionError, getCard, type GameEvent } from "@/engine";
import { InlineAiRunner, LocalAdapter, MemorySoloStorage, type GameUpdate, type SoloConfig } from "@/net";

const config = (overrides: Partial<SoloConfig> = {}): SoloConfig => ({
  playerName: "Tester",
  playerCount: 4,
  difficulties: ["medium", "easy", "medium", "easy"],
  characterMode: "random",
  seed: "local-adapter",
  ...overrides,
});

/** `c = null` resumes the saved game. */
function make(storage = new MemorySoloStorage(), c: SoloConfig | null = config()) {
  const adapter = new LocalAdapter({ ...(c ? { config: c } : {}), storage, ai: new InlineAiRunner() });
  const updates: GameUpdate[] = [];
  adapter.onUpdate((u) => updates.push(u));
  return { adapter, updates, storage };
}

/** CARDS_DRAWN by someone else must not reveal card ids to the human. */
function leaksDraws(events: GameEvent[]): boolean {
  return events.some((e) => e.t === "CARDS_DRAWN" && e.seat !== 0 && e.from !== "discard" && !(e.from === "player" && e.fromSeat === 0) && e.cardIds);
}

describe("LocalAdapter (solo)", () => {
  it("starts a game seen from seat 0 and lets the bots play until it is the human's turn", async () => {
    const { adapter, updates } = make();
    const initial = await adapter.start();
    expect(initial.view.viewer).toBe(0);
    expect(initial.view.myHand.length).toBeGreaterThan(0);
    expect(initial.view.players[0]?.name).toBe("Tester");
    await adapter.idle();
    const last = updates.at(-1)?.view ?? initial.view;
    expect(last.winner !== null || last.currentActor === 0).toBe(true);
    // One update per action, versions strictly increasing.
    updates.forEach((u, i) => expect(u.version).toBe(initial.version + i + 1));
    expect(updates.every((u) => u.actor !== 0)).toBe(true);
    expect(leaksDraws([...initial.events, ...updates.flatMap((u) => u.events)])).toBe(false);
  });

  it("rejects illegal actions with IllegalActionError and applies legal ones", async () => {
    const { adapter } = make();
    await adapter.start();
    await adapter.idle();
    await expect(adapter.send({ type: "PASS" })).rejects.toBeInstanceOf(IllegalActionError);
    await expect(adapter.send({ type: "END_TURN" })).resolves.toBeUndefined();
  });

  it("autoplay lets a bot finish the whole game, with redacted events only", async () => {
    const { adapter, updates } = make(new MemorySoloStorage(), config({ seed: "autoplay", playerCount: 5, difficulties: ["medium", "medium", "easy", "hard", "easy"] }));
    await adapter.start();
    adapter.setAutoplay(true);
    await adapter.idle();
    const last = updates.at(-1);
    expect(last?.view.winner).not.toBeNull();
    expect(last?.events.some((e) => e.t === "GAME_OVER")).toBe(true);
    expect(leaksDraws(updates.flatMap((u) => u.events))).toBe(false);
    // Every role is revealed at the end.
    expect(last?.view.players.every((p) => p.role !== null)).toBe(true);
  }, 60_000);

  it("saves after every action and resumes to the same view", async () => {
    const storage = new MemorySoloStorage();
    const first = make(storage);
    await first.adapter.start();
    await first.adapter.idle();
    await first.adapter.send({ type: "END_TURN" }).catch(() => undefined);
    await first.adapter.idle();
    const lastView = first.updates.at(-1)?.view;
    first.adapter.dispose();

    expect(LocalAdapter.hasSavedGame(storage)).toBe(true);
    const second = make(storage, null);
    const resumed = await second.adapter.start();
    expect(lastView?.winner).toBeNull();
    expect(resumed.view).toEqual(lastView);
    expect(resumed.version).toBe(first.updates.at(-1)?.version);
    expect(resumed.events.length).toBeGreaterThan(0);
  });

  it("clears the save once the game is over", async () => {
    const storage = new MemorySoloStorage();
    const { adapter } = make(storage, config({ seed: "finish" }));
    await adapter.start();
    adapter.setAutoplay(true);
    await adapter.idle();
    expect(LocalAdapter.hasSavedGame(storage)).toBe(false);
  }, 60_000);

  it("never shows the human another player's hand in its views", async () => {
    const { adapter, updates } = make(new MemorySoloStorage(), config({ seed: "hidden" }));
    await adapter.start();
    adapter.setAutoplay(true);
    await adapter.idle();
    for (const u of updates) {
      const othersCount = u.view.players.filter((p) => p.seat !== 0).reduce((n, p) => n + p.handCount, 0);
      expect(u.view.myHand.every((id) => getCard(id))).toBe(true);
      expect(u.view.myHand).toHaveLength(u.view.players[0]?.handCount ?? 0);
      expect(othersCount).toBeGreaterThanOrEqual(0);
      expect(u.view).not.toHaveProperty("deck");
    }
  }, 60_000);
});
