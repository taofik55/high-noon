"use client";

import type { ApiErrorCode } from "@/lib/apiErrors";
import type { SeatOp, SettingsPatch } from "@/lib/rooms/api";
import type { RoomSettings } from "@/lib/rooms/rules";
import { t, type MessageKey } from "../i18n";

// Thin fetch wrappers for the rooms API (docs/03 §5.4). The server decides everything; errors come back as codes.

export class RoomApiError extends Error {
  constructor(readonly code: ApiErrorCode | "NETWORK") {
    super(code);
    this.name = "RoomApiError";
  }
}

async function call<T>(path: string, method: "POST" | "PATCH", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RoomApiError("NETWORK");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: ApiErrorCode } & T;
  if (!res.ok) throw new RoomApiError(json.error ?? "INTERNAL");
  return json;
}

export interface RoomRef {
  roomId: string;
  code: string;
}

export const roomsApi = {
  create: () => call<RoomRef>("/api/rooms", "POST"),
  join: (code: string) => call<RoomRef>("/api/rooms/join", "POST", { code }),
  seat: (roomId: string, op: SeatOp) => call<{ ok: true }>(`/api/rooms/${roomId}/seat`, "POST", op),
  settings: (roomId: string, patch: SettingsPatch) => call<{ settings: RoomSettings }>(`/api/rooms/${roomId}/settings`, "PATCH", patch),
  start: (roomId: string) => call<{ gameId: string }>(`/api/rooms/${roomId}/start`, "POST"),
  rematch: (roomId: string, mode: "rematch" | "lobby") => call<{ gameId: string | null }>(`/api/rooms/${roomId}/rematch`, "POST", { mode }),
};

export function roomErrorMessage(e: unknown): string {
  const code = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "INTERNAL";
  return t(`rooms.error.${code}` as MessageKey);
}
