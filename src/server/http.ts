import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { ApiError } from "./errors";
import { takeToken, type RateLimit } from "./rateLimit";

export interface AuthedUser {
  id: string;
}

/** The caller, from the session cookie (verified by the Auth server, not just decoded). */
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await getServerSupabase();
  if (!supabase) throw new ApiError("INTERNAL", "Supabase is not configured");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError("UNAUTHENTICATED");
  return { id: data.user.id };
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError("BAD_REQUEST", z.prettifyError(parsed.error));
  return parsed.data;
}

export const ROOMS_RATE_LIMIT: RateLimit = { name: "rooms", capacity: 20, refillPerSec: 2 };
/** Game calls: a burst for quick responses, then a few per second (docs/03 §6). */
export const GAME_RATE_LIMIT: RateLimit = { name: "game", capacity: 30, refillPerSec: 5 };

/**
 * Wraps a route handler body: authenticates, rate-limits per user, and turns ApiError into `{ error: code }` JSON
 * with its status. Unexpected errors become a bare 500 so internals never reach the client.
 */
export async function handleApi(limit: RateLimit, run: (user: AuthedUser) => Promise<unknown>): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (!takeToken(`${limit.name}:${user.id}`, limit)) throw new ApiError("RATE_LIMITED");
    return NextResponse.json(await run(user));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ ...e.details, error: e.code, message: e.message }, { status: e.status });
    console.error("[api] unexpected error", e);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
