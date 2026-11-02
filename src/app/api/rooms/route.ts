import { handleApi, ROOMS_RATE_LIMIT } from "@/server/http";
import { createRoom } from "@/server/rooms/roomService";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.4: create a room with the caller in slot 0 as host; returns its code. */
export async function POST() {
  return handleApi(ROOMS_RATE_LIMIT, (user) => createRoom(getSupabaseAdmin(), user.id));
}
