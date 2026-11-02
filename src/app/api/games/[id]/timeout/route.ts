import { timeoutBody, gameIdParam } from "@/lib/online/api";
import { ApiError } from "@/server/errors";
import { performTimeout } from "@/server/game/gameService";
import { supabaseGameRepo } from "@/server/game/supabaseRepo";
import { GAME_RATE_LIMIT, handleApi, parseBody } from "@/server/http";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.2: once the deadline has passed, the default action plays for the absent player. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/timeout">) {
  return handleApi(GAME_RATE_LIMIT, async (user) => {
    const id = gameIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("GAME_NOT_FOUND");
    const { version } = await parseBody(request, timeoutBody);
    return performTimeout(supabaseGameRepo(getSupabaseAdmin()), id.data, user.id, version, () => new Date());
  });
}
