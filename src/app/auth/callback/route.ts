import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/siteGate";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth return point (PKCE): Google sign-in and anonymous → Google linking both land here with a `code`, which is
 * exchanged for a session cookie. Errors go back home with ?auth_error so the UI can explain.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(providerError ?? "missing code")}`);
  }
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
