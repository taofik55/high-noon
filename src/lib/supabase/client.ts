"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "./env";
import type { Database } from "./types";

export type HighNoonClient = SupabaseClient<Database>;

let client: HighNoonClient | null = null;

/** Browser client (publishable key, session in cookies shared with the server). null if Supabase is not configured. */
export function getBrowserSupabase(): HighNoonClient | null {
  const env = publicSupabaseEnv();
  if (!env) return null;
  client ??= createBrowserClient<Database>(env.url, env.publishableKey);
  return client;
}
