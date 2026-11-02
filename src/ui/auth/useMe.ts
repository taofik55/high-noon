"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { t } from "../i18n";

export interface Me {
  id: string;
  anonymous: boolean;
  name: string;
}

export const NAME_MIN = 2;
export const NAME_MAX = 20;
export const validName = (n: string) => n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;

export async function loadMe(user: User): Promise<Me> {
  const supabase = getBrowserSupabase();
  const { data } = (await supabase?.from("profiles").select("display_name").eq("id", user.id).maybeSingle()) ?? { data: null };
  const metaName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "";
  return { id: user.id, anonymous: user.is_anonymous ?? false, name: data?.display_name ?? metaName };
}

export function readableAuthError(message: string): string {
  return /provider is not enabled|unsupported provider/i.test(message) ? t("auth.googleUnavailable") : t("auth.error", { message });
}

/** The signed-in user (with their profile name), kept in sync with Supabase auth state changes. */
export function useMe() {
  const configured = isSupabaseConfigured();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let alive = true;
    const refresh = (user: User | null) => {
      if (!user) {
        if (alive) {
          setMe(null);
          setReady(true);
        }
        return;
      }
      void loadMe(user).then((m) => {
        if (!alive) return;
        setMe(m);
        setReady(true);
      });
    };
    void supabase.auth.getUser().then(({ data }) => refresh(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => refresh(session?.user ?? null));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const update = useCallback((m: Me | null) => setMe(m), []);
  return { configured, ready, me, setMe: update };
}

/** Starts the Google OAuth round trip; it comes back through /auth/callback (docs/03 §6). */
export async function startGoogle(mode: "link" | "signIn", next = "/"): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  // Linking keeps the anonymous user's id (and everything tied to it); signing in switches to the Google account.
  const { error } =
    mode === "link"
      ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw error;
}
