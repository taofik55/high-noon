"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { OnlineView } from "@/lib/online/types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { OnlineActionError, OnlineAdapter, type ConnectionStatus } from "@/net/online/OnlineAdapter";
import { useMe } from "../auth/useMe";
import { t } from "../i18n";
import { roomErrorMessage, roomsApi } from "../rooms/roomsClient";
import { createGameStore, type GameStoreState } from "../store/gameStore";
import { Button } from "../table/Button";
import { GameOver } from "../table/GameOver";
import { GameScreen } from "../table/GameScreen";
import { GameTable3D } from "../table3d/GameTable3D";
import { useAutoplay } from "./useAutoplay";
import { useGameRoom } from "./useGameRoom";

type Phase = { kind: "loading" } | { kind: "missing" } | { kind: "playing" };

function TurnTimer({ store }: { store: StoreApi<GameStoreState> }) {
  const view = useStore(store, (s) => s.presentedView) as OnlineView | null;
  const deadline = view?.deadline ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!deadline || !view || view.currentActor === null) return null;
  const left = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  const name = view.players[view.currentActor]?.name ?? "";
  return (
    <span data-testid="turn-timer" className={`rounded px-2 py-0.5 font-mono ${left <= 10 ? "bg-red-800 text-red-50" : "bg-stone-800 text-amber-200"}`}>
      {t("online.timer", { name, s: left })}
    </span>
  );
}

/** /play/online/[gameId]: the shared 3D table driven by the server through OnlineAdapter (docs/03 §5.3). */
export function OnlineGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  // The plain 2D table: lighter for weak machines and for end-to-end runs (two 3D pages starve a headless CPU).
  const table2d = useSearchParams().get("table") === "2d";
  const { ready, me } = useMe();
  const [store] = useState(createGameStore);
  const [adapter, setAdapter] = useState<OnlineAdapter | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [status, setStatus] = useState<ConnectionStatus>("connected");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const room = useGameRoom(gameId, me?.id ?? null);
  const view = useStore(store, (s) => s.presentedView) as OnlineView | null;

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !me || !gameId) return;
    const a = new OnlineAdapter({ gameId, supabase });
    let alive = true;
    let offStatus = () => {};
    a.start().then(
      (initial) => {
        if (!alive) return;
        store.getState().attach(a, initial);
        offStatus = a.onStatus(setStatus);
        setAdapter(a);
        setPhase({ kind: "playing" });
      },
      (e: unknown) => {
        if (!(e instanceof OnlineActionError)) console.error("[online] start failed", e);
        if (alive) setPhase({ kind: "missing" });
        a.dispose();
      },
    );
    return () => {
      alive = false;
      offStatus();
      store.getState().detach(); // disposes the attached adapter
      a.dispose();
    };
  }, [gameId, me, store]);

  // Rematch or back-to-lobby: everyone follows the room (docs/01 §5.2).
  useEffect(() => {
    if (!room) return;
    if (room.status === "in_game" && room.currentGameId && room.currentGameId !== gameId) router.replace(`/play/online/${room.currentGameId}`);
    if (room.status === "lobby") router.replace(`/r/${room.code}`);
  }, [room, gameId, router]);

  useAutoplay(store, autoplay);

  if (!ready || (me && phase.kind === "loading")) return <p aria-busy="true">{t("online.loading")}</p>;
  if (!me || phase.kind === "missing") {
    return (
      <div className="space-y-2 text-center" data-testid="online-missing">
        <p>{t("online.notFound")}</p>
        <Link href="/" className="text-sm text-amber-300 underline">
          {t("lobby.backHome")}
        </Link>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(roomErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const amHost = room !== null && room.hostId === me.id;
  const leave = () =>
    void run(async () => {
      if (room) await roomsApi.seat(room.id, { op: "leave" });
      router.push("/");
    });

  const gameOverActions = (
    <>
      {amHost && room ? (
        <>
          <Button tone="primary" testId="btn-rematch" disabled={busy} onClick={() => void run(() => roomsApi.rematch(room.id, "rematch"))}>
            {t("online.rematch")}
          </Button>
          <Button testId="btn-lobby" disabled={busy} onClick={() => void run(() => roomsApi.rematch(room.id, "lobby"))}>
            {t("online.toLobby")}
          </Button>
        </>
      ) : (
        <span className="text-sm text-stone-300" data-testid="wait-host">
          {t("online.waitHost")}
        </span>
      )}
      <Button tone="danger" testId="btn-exit" disabled={busy} onClick={leave}>
        {t("online.exit")}
      </Button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </>
  );

  const headerExtra = (
    <>
      <TurnTimer store={store} />
      {process.env.NODE_ENV !== "production" && (
        <label className="flex items-center gap-1" title={t("online.autoplayHint")}>
          <input type="checkbox" data-testid="toggle-autoplay" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          {t("table.autoplay")}
        </label>
      )}
    </>
  );
  const overlay = (
    <>
      {status === "reconnecting" && (
        <div data-testid="reconnecting" className="absolute top-14 left-1/2 z-40 -translate-x-1/2 rounded bg-amber-700 px-4 py-1 text-sm font-semibold text-amber-50 shadow">
          {t("online.reconnecting")}
        </div>
      )}
      {view?.afk && !view.winner && (
        <div data-testid="afk-banner" className="absolute top-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500 bg-stone-950/90 px-4 py-2 shadow-xl">
          <span>{t("online.afk")}</span>
          <Button tone="primary" testId="btn-reclaim" disabled={busy || !adapter} onClick={() => void run(async () => adapter?.reclaim())}>
            {t("online.reclaim")}
          </Button>
        </div>
      )}
    </>
  );
  const gameOver = view && <GameOver view={view} actions={gameOverActions} />;

  return table2d ? (
    <GameScreen store={store} headerExtra={headerExtra} overlay={overlay} gameOver={gameOver} />
  ) : (
    <GameTable3D store={store} title={t("online.title")} headerExtra={headerExtra} overlay={overlay} gameOver={gameOver} />
  );
}
