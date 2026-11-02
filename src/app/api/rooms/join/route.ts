import { joinRoomBody } from "@/lib/rooms/api";
import { handleApi, parseBody, ROOMS_RATE_LIMIT } from "@/server/http";
import { joinRoom } from "@/server/rooms/roomService";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.4: join by code while the room is in its lobby and has a free slot. */
export async function POST(request: Request) {
  return handleApi(ROOMS_RATE_LIMIT, async (user) => {
    const { code } = await parseBody(request, joinRoomBody);
    return joinRoom(getSupabaseAdmin(), user.id, code);
  });
}
