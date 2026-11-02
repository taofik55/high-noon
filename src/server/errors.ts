// Typed failures of the online API; route handlers map them to HTTP responses (src/server/http.ts).
import type { ApiErrorCode } from "@/lib/apiErrors";

export type { ApiErrorCode };

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_NOT_IN_LOBBY: 409,
  NOT_A_MEMBER: 403,
  NOT_HOST: 403,
  SLOT_TAKEN: 409,
  SLOT_EMPTY: 409,
  CANNOT_TARGET_SELF: 400,
  TOO_FEW_SEATS: 409,
  PLAYERS_NOT_READY: 409,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = STATUS[code];
  }
}

/** Supabase query errors are server faults from the client's point of view; keep the detail in the server log. */
export function dbFailure(context: string, error: { message: string }): ApiError {
  console.error(`[db] ${context}: ${error.message}`);
  return new ApiError("INTERNAL", context);
}
