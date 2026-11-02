// Error codes of the online API, shared by the server (which throws them) and the UI (which translates them).
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_NOT_IN_LOBBY"
  | "NOT_A_MEMBER"
  | "NOT_HOST"
  | "SLOT_TAKEN"
  | "SLOT_EMPTY"
  | "CANNOT_TARGET_SELF"
  | "TOO_FEW_SEATS"
  | "PLAYERS_NOT_READY"
  | "INTERNAL";
