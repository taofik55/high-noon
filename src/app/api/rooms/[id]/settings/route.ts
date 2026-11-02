import { roomIdParam, settingsPatchBody } from "@/lib/rooms/api";
import { ApiError } from "@/server/errors";
import { handleApi, parseBody, ROOMS_RATE_LIMIT } from "@/server/http";
import { updateSettings } from "@/server/rooms/roomService";
import { getSupabaseAdmin } from "@/server/supabaseAdmin";

/** docs/03 §5.4: host only, lobby only. Returns the full settings after the change. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rooms/[id]/settings">) {
  return handleApi(ROOMS_RATE_LIMIT, async (user) => {
    const id = roomIdParam.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiError("ROOM_NOT_FOUND");
    const settings = await updateSettings(getSupabaseAdmin(), user.id, id.data, await parseBody(request, settingsPatchBody));
    return { settings };
  });
}
