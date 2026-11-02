"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { SeatOp, SettingsPatch } from "@/lib/rooms/api";
import { normalizeRoomCode, startBlockers } from "@/lib/rooms/rules";
import { NicknameForm } from "../auth/NicknameForm";
import { useMe } from "../auth/useMe";
import { t } from "../i18n";
import { roomErrorMessage, roomsApi } from "../rooms/roomsClient";
import { Button } from "../table/Button";
import { LobbySettings } from "./LobbySettings";
import { SlotList } from "./SlotList";
import { useLobby } from "./useLobby";

const shell = "w-full max-w-lg space-y-4 rounded-xl border border-amber-700 bg-stone-900/80 p-5";

function CopyButton({ text, label, testId }: { text: string; label: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      testId={testId}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t("lobby.copied") : label}
    </Button>
  );
}

/** /r/[code]: sign in if needed, take a seat from a shared link, then the live lobby (docs/01 §7.3). */
export function LobbyScreen() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? "") ?? (params.code ?? "").toUpperCase();
  const router = useRouter();
  const { configured, ready, me, setMe } = useMe();
  const { state, online, refresh } = useLobby(code, me?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameId = state.kind === "member" && state.room.status === "in_game" ? state.room.currentGameId : null;
  useEffect(() => {
    if (gameId) router.replace(`/play/online/${gameId}`);
  }, [gameId, router]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(roomErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) return <p className="text-sm text-amber-300">{t("auth.offline")}</p>;
  if (!ready || (me && state.kind === "loading")) return <p aria-busy="true">{t("lobby.loading")}</p>;
  if (!me) return <NicknameForm onSignedIn={setMe} next={`/r/${code}`} />;

  const errorLine = error && (
    <p className="text-sm text-red-400" data-testid="lobby-error">
      {error}
    </p>
  );

  if (state.kind === "outside") {
    return (
      <div className={shell} data-testid="lobby-invite">
        <h1 className="font-mono text-2xl font-bold tracking-widest">{t("lobby.title", { code })}</h1>
        <p className="text-sm text-stone-300">{t("lobby.invited")}</p>
        {errorLine}
        <div className="flex gap-2">
          <Button tone="primary" testId="join-room" disabled={busy} onClick={() => void run(() => roomsApi.join(code))}>
            {t("lobby.join")}
          </Button>
          <Link href="/" className="self-center text-sm text-amber-300 underline">
            {t("lobby.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind !== "member") {
    return (
      <div className={shell} data-testid="lobby-gone">
        <p>{t("lobby.gone")}</p>
        <Link href="/" className="text-sm text-amber-300 underline">
          {t("lobby.backHome")}
        </Link>
      </div>
    );
  }

  const { room, slots } = state;
  const amHost = room.hostId === me.id;
  const mine = slots.find((s) => s.userId === me.id);
  const blockers = startBlockers(slots, room.hostId);
  const seat = (op: SeatOp) => void run(() => roomsApi.seat(room.id, op));
  const settings = (patch: SettingsPatch) => void run(() => roomsApi.settings(room.id, patch));
  // Rendered only after the session loaded on the client, so window is available here.
  const link = `${window.location.origin}/r/${room.code}`;

  return (
    <div className={shell} data-testid="lobby">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-2xl font-bold tracking-widest" data-testid="lobby-code">
          {room.code}
        </h1>
        <div className="flex gap-2">
          <CopyButton text={room.code} label={t("lobby.copyCode")} testId="copy-code" />
          <CopyButton text={link} label={t("lobby.copyLink")} testId="copy-link" />
        </div>
        <p className="w-full text-xs text-stone-400">{t("lobby.shareHint")}</p>
      </header>

      {room.status !== "lobby" && room.currentGameId ? (
        <p className="text-sm text-amber-300" data-testid="lobby-in-game">
          {t("lobby.inGame")}{" "}
          <Link href={`/play/online/${room.currentGameId}`} className="underline">
            {t("lobby.toGame")}
          </Link>
        </p>
      ) : null}

      <SlotList slots={slots} hostId={room.hostId} meId={me.id} online={online} busy={busy} onSeat={seat} />
      <LobbySettings settings={room.settings} editable={amHost} busy={busy} onChange={settings} />
      {errorLine}

      <footer className="flex flex-wrap items-center gap-2">
        {amHost ? (
          <Button
            tone="primary"
            testId="start-game"
            disabled={busy || blockers.length > 0 || room.status !== "lobby"}
            onClick={() =>
              void run(async () => {
                const { gameId: id } = await roomsApi.start(room.id);
                router.push(`/play/online/${id}`);
              })
            }
          >
            {t("lobby.start")}
          </Button>
        ) : (
          <Button testId="ready-toggle" tone={mine?.isReady ? "secondary" : "primary"} disabled={busy} onClick={() => seat({ op: "ready", ready: !mine?.isReady })}>
            {mine?.isReady ? t("lobby.readyOff") : t("lobby.readyOn")}
          </Button>
        )}
        <Button
          testId="leave-room"
          tone="danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await roomsApi.seat(room.id, { op: "leave" });
              router.push("/");
            })
          }
        >
          {t("lobby.leave")}
        </Button>
        <p className="w-full text-xs text-stone-400" data-testid="start-hint">
          {!amHost
            ? t("lobby.waitHost")
            : blockers.includes("TOO_FEW_SEATS")
              ? t("lobby.needSeats", { n: slots.length })
              : blockers.includes("PLAYERS_NOT_READY")
                ? t("lobby.needReady")
                : null}
        </p>
      </footer>
    </div>
  );
}
