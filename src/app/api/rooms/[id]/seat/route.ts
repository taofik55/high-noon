import { roomIdParam, seatOpBody } from "@/lib/rooms/api";
import { ApiError } from "@/server/errors";
import { handleApi, parseBody, ROOMS_RATE_LIMIT } from "@/server/http";
import { seatAction } from "@/server/rooms/roomService";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.4: ready toggle and leave for anyone; NPC slots and kicks for the host. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]/seat">) {
  return handleApi(ROOMS_RATE_LIMIT, async (user) => {
    const id = roomIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("ROOM_NOT_FOUND");
    await seatAction(getSupabaseAdmin(), user.id, id.data, await parseBody(request, seatOpBody));
    return { ok: true };
  });
}
