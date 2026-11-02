import { resyncBody, gameIdParam } from "@/lib/online/api";
import { ApiError } from "@/server/errors";
import { performResync } from "@/server/game/gameService";
import { supabaseGameRepo } from "@/server/game/supabaseRepo";
import { GAME_RATE_LIMIT, handleApi, parseBody } from "@/server/http";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** "I am here": optionally take the seat back from the bot; also restarts bots that should be moving. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/resync">) {
  return handleApi(GAME_RATE_LIMIT, async (user) => {
    const id = gameIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("GAME_NOT_FOUND");
    const { reclaim } = await parseBody(request, resyncBody);
    return performResync(supabaseGameRepo(getSupabaseAdmin()), id.data, user.id, reclaim ?? false, () => new Date());
  });
}
