import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Shared setup for tests against the local Supabase stack (`pnpm db:start`, then `pnpm test:db`).

export type Db = SupabaseClient<Database>;
export interface TestUser {
  client: Db;
  id: string;
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): Db {
  if (!URL || !PUBLISHABLE || !SECRET) throw new Error("Local Supabase env missing: run `pnpm db:start` and fill .env.local");
  return createClient<Database>(URL, SECRET, opts);
}

/** A real anonymous user acting through the publishable key, exactly like a browser. */
export async function anonymousUser(name?: string): Promise<TestUser> {
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  const { data, error } = await client.auth.signInAnonymously(name ? { options: { data: { display_name: name } } } : undefined);
  if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  return { client, id: data.user.id };
}

export async function deleteUsers(admin: Db, ids: readonly string[]): Promise<void> {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
