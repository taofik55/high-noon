// Public Supabase settings (safe in the browser). The secret key is read only in src/server (Golden rule 12).

export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

/** null when Supabase is not configured: solo play still works, online features are hidden. */
export function publicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export function isSupabaseConfigured(): boolean {
  return publicSupabaseEnv() !== null;
}
