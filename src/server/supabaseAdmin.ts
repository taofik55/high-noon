import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

let admin: SupabaseClient<Database> | null = null;

/**
 * Service-role client: bypasses RLS, so only server code that has already checked the caller may use it
 * (docs/04 §1: clients never write game or room tables). The secret key never leaves the server (Golden rule 12).
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase admin client: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
