import { z } from "zod";
import { roomIdParam } from "@/lib/rooms/api";
import { ApiError } from "@/server/errors";
import { handleApi, parseBody, ROOMS_RATE_LIMIT } from "@/server/http";
import { rematchRoom } from "@/server/rooms/startGame";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

const Body = z.object({ mode: z.enum(["rematch", "lobby"]) });

/** docs/03 §5.4: host only, after a game: deal again with the same seats, or go back to the lobby. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]/rematch">) {
  return handleApi(ROOMS_RATE_LIMIT, async (user) => {
    const id = roomIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("ROOM_NOT_FOUND");
    const { mode } = await parseBody(request, Body);
    return rematchRoom(getSupabaseAdmin(), user.id, id.data, mode);
  });
}
