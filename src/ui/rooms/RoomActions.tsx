"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeRoomCode } from "@/lib/rooms/rules";
import { t } from "../i18n";
import { Button } from "../table/Button";
import { roomErrorMessage, roomsApi } from "./roomsClient";

/** Home menu: "Buat room" and "Gabung room" by code (docs/01 §7). */
export function RoomActions() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (fn: () => Promise<{ code: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const ref = await fn();
      router.push(`/r/${ref.code}`);
    } catch (e) {
      setError(roomErrorMessage(e));
      setBusy(false);
    }
  };

  const normalized = normalizeRoomCode(code);
  return (
    <div className="space-y-2">
      <Button tone="primary" testId="create-room" disabled={busy} onClick={() => void go(roomsApi.create)}>
        {t("home.createRoom")}
      </Button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (normalized) void go(() => roomsApi.join(normalized));
        }}
      >
        <input
          data-testid="join-code"
          aria-label={t("rooms.codeLabel")}
          placeholder={t("rooms.codePlaceholder")}
          className="w-32 rounded border border-stone-600 bg-stone-800 px-2 py-1 font-mono uppercase tracking-widest"
          value={code}
          maxLength={60}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="submit"
          data-testid="join-submit"
          disabled={busy || !normalized}
          className="flex-1 rounded bg-stone-700 px-3 py-1.5 text-sm font-semibold text-amber-50 hover:bg-stone-600 disabled:opacity-40"
        >
          {t("home.joinRoom")}
        </button>
      </form>
      {error && (
        <p className="text-sm text-red-400" data-testid="room-error">
          {error}
        </p>
      )}
    </div>
  );
}
