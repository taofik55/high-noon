import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { IllegalActionError, type Action, type GameEvent, type Seat } from "@/engine";
import type { ApiErrorCode } from "@/lib/apiErrors";
import type { OnlineView } from "@/lib/online/types";
import type { Database } from "@/lib/supabase/types";
import type { GameAdapter, GameUpdate } from "../types";

export type ConnectionStatus = "connected" | "reconnecting";

/** A refused game request (network, conflict, game over…), with the server's error code. */
export class OnlineActionError extends Error {
  constructor(readonly code: ApiErrorCode | "NETWORK") {
    super(code);
    this.name = "OnlineActionError";
  }
}

export interface OnlineAdapterOptions {
  gameId: string;
  supabase: SupabaseClient<Database>;
  fetchImpl?: typeof fetch;
  /** For the timeout jitter; injectable for tests. */
  random?: () => number;
  /** Without any new version for this long while someone else must act, ask the server to resync (watchdog). */
  stallMs?: number;
}

interface EventRowLite {
  version: number;
  seq: number;
  recipient_user_id: string | null;
  payload: unknown;
}

/** Log length fetched on start (docs/03 §5.3). */
const LOG_EVENTS = 200;
const TIMEOUT_JITTER_MS = 1500;

/**
 * Private rows carry the whole event for their recipient (server/game/commitPayload.ts), so per (version, seq) the
 * private row replaces the public one.
 */
export function mergeEvents(rows: readonly EventRowLite[]): GameEvent[] {
  const byKey = new Map<string, EventRowLite>();
  for (const r of rows) {
    const key = `${r.version}:${r.seq}`;
    const prev = byKey.get(key);
    if (!prev || (prev.recipient_user_id === null && r.recipient_user_id !== null)) byKey.set(key, r);
  }
  return [...byKey.values()].sort((a, b) => a.version - b.version || a.seq - b.seq).map((r) => r.payload as GameEvent);
}

/**
 * Online games (docs/03 §5.3). The client never holds the full state: it reads its own player_views row (RLS) and
 * the events visible to it, sends intents to the API and lets the server decide (Golden rules 3–4). Every committed
 * version arrives as one realtime change carrying that version's view, so each action becomes one GameUpdate.
 */
export class OnlineAdapter implements GameAdapter {
  mySeat: Seat = 0;
  private version = 0;
  private view: OnlineView | null = null;
  /** Views received but not yet emitted, by version. */
  private readonly pending = new Map<number, OnlineView>();
  private draining = false;
  private readonly waiters: { version: number; resolve: () => void }[] = [];
  private channel: RealtimeChannel | null = null;
  private readonly listeners = new Set<(u: GameUpdate) => void>();
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private status: ConnectionStatus = "connected";
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly fetchImpl: typeof fetch;
  private readonly random: () => number;
  private readonly onVisible = () => {
    if (document.visibilityState === "visible") void this.catchUp();
  };

  constructor(private readonly opts: OnlineAdapterOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
    this.random = opts.random ?? Math.random;
  }

  async start(): Promise<GameUpdate> {
    const { supabase, gameId } = this.opts;
    const row = await supabase.from("player_views").select("seat, version, view").eq("game_id", gameId).maybeSingle();
    if (row.error || !row.data) throw new OnlineActionError("GAME_NOT_FOUND");
    this.mySeat = row.data.seat;
    this.version = row.data.version;
    this.view = row.data.view as unknown as OnlineView;

    // Newest first so the limit keeps the end of the log; public + private rows, merged below.
    const ev = await supabase
      .from("game_events")
      .select("version, seq, recipient_user_id, payload")
      .eq("game_id", gameId)
      .lte("version", this.version)
      .order("version", { ascending: false })
      .order("seq", { ascending: false })
      .limit(LOG_EVENTS * 2);
    const events = mergeEvents(ev.data ?? []).slice(-LOG_EVENTS);
    // Unmounted while loading (React may mount twice in development): never subscribe a dead adapter.
    if (this.disposed) throw new OnlineActionError("GAME_NOT_FOUND");

    this.subscribe();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    this.armTimers();
    // Arrival doubles as a watchdog: bots that should be moving (a fresh game, a dropped request) continue now.
    void this.post("resync", {}).catch(() => undefined);
    return { version: this.version, events, view: this.view, actor: null };
  }

  onUpdate(cb: (update: GameUpdate) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onStatus(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  async send(action: Action): Promise<void> {
    try {
      const res = (await this.post("action", { action, clientVersion: this.version })) as { version?: number };
      // Resolve only once the result is here, so the UI never acts again on the view it just acted on.
      if (typeof res.version === "number") await this.waitFor(res.version);
    } catch (e) {
      if (e instanceof OnlineActionError && e.code === "VERSION_CONFLICT") void this.catchUp();
      throw e;
    }
  }

  /** docs/03 §5.3 step 5: any client may report an expired deadline; the server ignores duplicates by version. */
  async reportTimeout(): Promise<void> {
    await this.post("timeout", { version: this.version }).catch(() => undefined);
  }

  /** "Saya kembali": take the seat back from the bot (docs/01 §5.2). */
  async reclaim(): Promise<void> {
    await this.post("resync", { reclaim: true });
  }

  dispose(): void {
    this.disposed = true;
    for (const w of this.waiters.splice(0)) w.resolve();
    this.listeners.clear();
    this.statusListeners.clear();
    this.clearTimers();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
    if (this.channel) void this.opts.supabase.removeChannel(this.channel);
    this.channel = null;
  }

  private subscribe(): void {
    const { supabase, gameId } = this.opts;
    let wasDown = false;
    const onRow = (row: { version?: number; view?: unknown }) => {
      if (typeof row.version === "number" && row.view) this.enqueue(row.version, row.view as OnlineView);
    };
    // supabase.channel() returns an existing channel with the same topic; a unique topic keeps a remounted table from
    // inheriting the previous (already subscribed) one.
    this.channel = supabase
      .channel(`game:${gameId}:${crypto.randomUUID()}`)
      // RLS limits these to the caller's own row (docs/04 player_views_read).
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "player_views", filter: `game_id=eq.${gameId}` }, (p) => onRow(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "player_views", filter: `game_id=eq.${gameId}` }, (p) => onRow(p.new))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("connected");
          // Anything committed while (re)connecting.
          if (wasDown) void this.catchUp();
          wasDown = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (this.disposed) return;
          wasDown = true;
          this.setStatus("reconnecting");
        }
      });
  }

  /** Versions are emitted strictly in order; whatever piled up meanwhile is fetched in one go. */
  private enqueue(version: number, view: OnlineView): void {
    if (version <= this.version) return;
    this.pending.set(version, view);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (!this.disposed) {
        const batch = [...this.pending.entries()].filter(([v]) => v > this.version).sort(([a], [b]) => a - b);
        this.pending.clear();
        if (batch.length === 0) break;
        await this.emitBatch(batch);
      }
    } catch (e) {
      console.error("[online]", e);
    } finally {
      this.draining = false;
    }
  }

  private async emitBatch(batch: readonly (readonly [number, OnlineView])[]): Promise<void> {
    const last = batch[batch.length - 1]?.[0] ?? this.version;
    const ev = await this.opts.supabase
      .from("game_events")
      .select("version, seq, recipient_user_id, payload")
      .eq("game_id", this.opts.gameId)
      .gt("version", this.version)
      .lte("version", last)
      .order("version")
      .order("seq");
    if (ev.error) throw ev.error;
    for (const [version, view] of batch) {
      if (this.disposed) return;
      // Versions without a view of their own (missed while offline) fold into the next one we have.
      const events = mergeEvents(ev.data.filter((r) => r.version > this.version && r.version <= version));
      this.version = version;
      this.view = view;
      const update: GameUpdate = { version, events, view, actor: view.actor };
      for (const cb of this.listeners) cb(update);
    }
    this.armTimers();
    this.settleWaiters();
  }

  /** Resolves once `version` has been emitted; after `ms` it fetches the current row instead of waiting forever. */
  private waitFor(version: number, ms = 5000): Promise<void> {
    if (this.version >= version || this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        void this.catchUp();
        resolve();
      }, ms);
      this.waiters.push({
        version,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
    });
  }

  private settleWaiters(): void {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      if (w && w.version <= this.version) {
        this.waiters.splice(i, 1);
        w.resolve();
      }
    }
  }

  /** Reconnect / tab focus / conflict: fetch the current row and present whatever was missed (docs/03 §5.3 step 4). */
  private async catchUp(): Promise<void> {
    const row = await this.opts.supabase.from("player_views").select("version, view").eq("game_id", this.opts.gameId).maybeSingle();
    if (row.data) this.enqueue(row.data.version, row.data.view as unknown as OnlineView);
  }

  private armTimers(): void {
    this.clearTimers();
    const view = this.view;
    if (!view || view.winner !== null || this.disposed) return;
    if (view.deadline) {
      const ms = new Date(view.deadline).getTime() - Date.now() + this.random() * TIMEOUT_JITTER_MS;
      this.timeoutTimer = setTimeout(() => void this.reportTimeout(), Math.max(0, ms));
    }
    if (view.currentActor !== null && view.currentActor !== this.mySeat) {
      this.stallTimer = setTimeout(() => void this.post("resync", {}).catch(() => undefined), this.opts.stallMs ?? 10_000);
    }
  }

  private clearTimers(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.stallTimer = null;
    this.timeoutTimer = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status) return;
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private async post(path: "action" | "timeout" | "resync", body: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(`/api/games/${this.opts.gameId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new OnlineActionError("NETWORK");
    }
    const json = (await res.json().catch(() => ({}))) as { error?: ApiErrorCode; message?: string };
    if (res.ok) return json;
    if (json.error === "ILLEGAL_ACTION") throw new IllegalActionError(json.message ?? "illegal");
    throw new OnlineActionError(json.error ?? "INTERNAL");
  }
}
