import { createMemory, observe, type AiMemory } from "@/ai";
import {
  IllegalActionError,
  applyAction,
  createGame,
  createRng,
  currentActor,
  defaultActionOnTimeout,
  redactEvent,
  toPlayerView,
  whyIllegal,
  type Action,
  type GameEvent,
  type GameState,
  type RngState,
  type Seat,
} from "@/engine";
import type { GameAdapter, GameUpdate } from "../types";
import { InlineAiRunner, type AiRunner } from "./aiRunner";
import type { SavedSolo, SoloConfig, SoloStorage } from "./storage";

const HUMAN: Seat = 0;
const LOG_LIMIT = 300;

export interface LocalAdapterOptions {
  /** New game settings; omit to resume the saved game. */
  config?: SoloConfig;
  storage: SoloStorage;
  ai: AiRunner;
}

/**
 * Solo games, entirely in the browser (docs/01 §5.1, docs/03 §4.1). Holds the full GameState — acceptable here
 * because there is nobody to hide it from — but hands the UI only the human's PlayerView and redacted events,
 * exactly like the online adapter will. NPCs decide from their own views (Golden rule 9), one update per action so the
 * Director can stage each of them.
 */
export class LocalAdapter implements GameAdapter {
  readonly mySeat = HUMAN;
  private state!: GameState;
  private config!: SoloConfig;
  private version = 0;
  private memories: AiMemory[] = [];
  private rngs: RngState[] = [];
  private log: GameEvent[] = [];
  private readonly listeners = new Set<(u: GameUpdate) => void>();
  private loop: Promise<void> | null = null;
  private autoplay = false;
  private disposed = false;
  private readonly inline = new InlineAiRunner();

  constructor(private readonly opts: LocalAdapterOptions) {}

  static hasSavedGame(storage: SoloStorage): boolean {
    return storage.load() !== null;
  }

  async start(): Promise<GameUpdate> {
    const saved = this.opts.config ? null : this.opts.storage.load();
    if (saved) this.restore(saved);
    else if (this.opts.config) this.create(this.opts.config);
    else throw new Error("LocalAdapter: no saved game to resume");

    const initial: GameUpdate = { version: this.version, events: [...this.log], view: toPlayerView(this.state, HUMAN), actor: null };
    // NPCs may already be on the move (another Sheriff, a character choice): let them play after the snapshot.
    queueMicrotask(() => this.kick());
    return initial;
  }

  onUpdate(cb: (update: GameUpdate) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async send(action: Action): Promise<void> {
    if (this.disposed) throw new Error("LocalAdapter disposed");
    if (this.isBot(HUMAN) && currentActor(this.state) === HUMAN) throw new IllegalActionError("autoplay is on");
    const reason = whyIllegal(this.state, HUMAN, action);
    if (reason) throw new IllegalActionError(reason);
    this.commit(HUMAN, action);
    await this.kick();
  }

  async reportTimeout(): Promise<void> {}

  /** Lets a medium bot play the human seat (debugging and end-to-end tests). */
  setAutoplay(on: boolean): void {
    this.autoplay = on;
    if (on) void this.kick();
  }

  /** Resolves once no bot has anything left to do (tests). */
  async idle(): Promise<void> {
    while (this.loop) await this.loop;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.opts.ai.dispose();
  }

  private create(config: SoloConfig): void {
    this.config = config;
    const n = config.playerCount;
    const seed = config.seed ?? crypto.randomUUID();
    const players = Array.from({ length: n }, (_, seat) =>
      seat === HUMAN
        ? { name: config.playerName.trim() || "Kamu", isNpc: false }
        : { name: `Bot ${seat}`, isNpc: true, npcDifficulty: config.difficulties[seat] ?? "medium" },
    );
    const { state, events } = createGame({ players, characterMode: config.characterMode }, seed);
    this.state = state;
    this.version = 1;
    this.rngs = players.map((_, seat) => createRng(`${seed}:npc:${seat}`));
    this.memories = players.map((_, seat) => createMemory(toPlayerView(state, seat)));
    this.observeAll(events);
    this.log = this.redactForHuman(events);
    this.save();
  }

  private restore(saved: SavedSolo): void {
    this.config = saved.config;
    this.state = saved.state;
    this.version = saved.version;
    this.memories = saved.memories;
    this.rngs = saved.rngs;
    this.log = saved.log;
  }

  private isBot(seat: Seat): boolean {
    return seat !== HUMAN || this.autoplay;
  }

  /** Starts the bot loop unless it is already running; returns the running loop. */
  private kick(): Promise<void> {
    this.loop ??= this.runBots().finally(() => {
      this.loop = null;
    });
    return this.loop;
  }

  private async runBots(): Promise<void> {
    while (!this.disposed && !this.state.winner) {
      const seat = currentActor(this.state);
      if (seat === null || !this.isBot(seat)) return;
      const action = await this.decideFor(seat);
      if (this.disposed) return;
      // The state cannot change while we wait (only bots act now), but stay defensive.
      if (currentActor(this.state) !== seat) continue;
      this.commit(seat, whyIllegal(this.state, seat, action) === null ? action : defaultActionOnTimeout(this.state, seat));
    }
  }

  private async decideFor(seat: Seat): Promise<Action> {
    const memory = this.memories[seat];
    const rng = this.rngs[seat];
    if (!memory || !rng) throw new Error(`LocalAdapter: no bot state for seat ${seat}`);
    const difficulty = seat === HUMAN ? "medium" : (this.config.difficulties[seat] ?? "medium");
    const request = { view: toPlayerView(this.state, seat), memory, difficulty, rng };
    let response;
    try {
      response = await this.opts.ai.decide(request);
    } catch {
      response = await this.inline.decide(request);
    }
    this.rngs[seat] = response.rng;
    if (response.problems.length > 0 && process.env.NODE_ENV !== "production") console.warn("[ai]", ...response.problems);
    return response.action;
  }

  private commit(seat: Seat, action: Action): void {
    const result = applyAction(this.state, seat, action);
    this.state = result.state;
    this.version += 1;
    this.observeAll(result.events);
    const events = this.redactForHuman(result.events);
    this.log = [...this.log, ...events].slice(-LOG_LIMIT);
    this.save();
    const update: GameUpdate = { version: this.version, events, view: toPlayerView(this.state, HUMAN), actor: seat };
    for (const cb of this.listeners) cb(update);
  }

  private observeAll(events: readonly GameEvent[]): void {
    this.memories = this.memories.map((memory) => {
      let m = memory;
      for (const e of events) {
        const visible = redactEvent(e, m.seat);
        if (visible) m = observe(m, visible);
      }
      return m;
    });
  }

  private redactForHuman(events: readonly GameEvent[]): GameEvent[] {
    return events.flatMap((e) => {
      const visible = redactEvent(e, HUMAN);
      return visible ? [visible] : [];
    });
  }

  private save(): void {
    if (this.state.winner) {
      // A finished game is not resumable; keep the final screen only in memory.
      this.opts.storage.clear();
      return;
    }
    this.opts.storage.save({
      schema: 1,
      config: this.config,
      state: this.state,
      version: this.version,
      memories: this.memories,
      rngs: this.rngs,
      log: this.log,
    });
  }
}
