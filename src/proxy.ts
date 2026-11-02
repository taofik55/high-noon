import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, isGateExempt, sameToken } from "@/lib/siteGate";
import { publicSupabaseEnv } from "@/lib/supabase/env";

/**
 * Runs before every page and route (Next.js 16 "proxy", formerly middleware):
 * 1. optional SITE_PASSWORD gate (docs/03 §6);
 * 2. Supabase session refresh, writing renewed auth cookies back to the response (@supabase/ssr pattern).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const password = process.env.SITE_PASSWORD;
  const { pathname, search } = request.nextUrl;

  if (password && !isGateExempt(pathname)) {
    const cookie = request.cookies.get(GATE_COOKIE)?.value ?? "";
    if (!sameToken(cookie, await gateToken(password))) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "site password required" }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });
  const env = publicSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  // Validates the session and refreshes the tokens when needed; renewed cookies go out through setAll above.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|ktx2|mp3|ogg)$).*)"],
};
