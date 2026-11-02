import "server-only";
import type { Difficulty } from "@/ai";
import type { RoomSettings } from "@/lib/rooms/rules";
import type { CommitArgs } from "./commitPayload";
import type { ServerGame } from "./serverGame";

// Storage seen by gameService. The Supabase implementation is supabaseRepo.ts; tests use an in-memory one, so the
// game flow (NPC loop, timeouts, AFK, conflicts) is tested without a database.

export interface GameSeat {
  seat: number;
  userId: string | null;
  isNpc: boolean;
  npcDifficulty: Difficulty | null;
  timeouts: number;
  afkTakeover: boolean;
}

export interface LoadedGame {
  id: string;
  roomId: string;
  version: number;
  status: "active" | "finished" | "aborted";
  deadline: string | null;
  sg: ServerGame;
  seats: GameSeat[];
  settings: RoomSettings;
}

/** The commit RPC refused: someone else committed first (docs/04 commit_game_action). */
export class VersionConflictError extends Error {
  constructor() {
    super("VERSION_CONFLICT");
    this.name = "VersionConflictError";
  }
}

export interface GameRepo {
  load(gameId: string): Promise<LoadedGame | null>;
  /** Returns the new version; throws VersionConflictError on a stale expected version. */
  commit(args: CommitArgs): Promise<number>;
  /** After the winning commit: room status and player stats (docs/03 §5.1 step 9). */
  finish(game: LoadedGame): Promise<void>;
}
