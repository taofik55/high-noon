import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Server client acting as the signed-in user (publishable key + the user's session cookie): RLS applies.
 * For route handlers and server components; privileged writes use src/server/supabaseAdmin.ts instead.
 */
export async function getServerSupabase(): Promise<SupabaseClient<Database> | null> {
  const env = publicSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only: the proxy refreshes the session instead.
        }
      },
    },
  });
}
