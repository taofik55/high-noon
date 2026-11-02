import { roomIdParam } from "@/lib/rooms/api";
import { ApiError } from "@/server/errors";
import { handleApi, ROOMS_RATE_LIMIT } from "@/server/http";
import { startRoom } from "@/server/rooms/startGame";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.4: host only; needs 4–7 seats and every other human ready. Returns the new game id. */
export async function POST(_request: Request, ctx: RouteContext<"/api/rooms/[id]/start">) {
  return handleApi(ROOMS_RATE_LIMIT, async (user) => {
    const id = roomIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("ROOM_NOT_FOUND");
    return startRoom(getSupabaseAdmin(), user.id, id.data);
  });
}
