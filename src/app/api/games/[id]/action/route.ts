import { actionBody, gameIdParam } from "@/lib/online/api";
import { ApiError } from "@/server/errors";
import { performAction } from "@/server/game/gameService";
import { supabaseGameRepo } from "@/server/game/supabaseRepo";
import { GAME_RATE_LIMIT, handleApi, parseBody } from "@/server/http";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.1: validate with the engine, commit, then let the bots play until a human must act. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/action">) {
  return handleApi(GAME_RATE_LIMIT, async (user) => {
    const id = gameIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("GAME_NOT_FOUND");
    const { action, clientVersion } = await parseBody(request, actionBody);
    return performAction(supabaseGameRepo(getSupabaseAdmin()), id.data, user.id, action, clientVersion, () => new Date());
  });
}
