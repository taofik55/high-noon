"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { t } from "../i18n";
import { Button } from "../table/Button";

interface Me {
  id: string;
  anonymous: boolean;
  name: string;
}

const NAME_MIN = 2;
const NAME_MAX = 20;
const validName = (n: string) => n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX;

async function loadMe(user: User): Promise<Me> {
  const supabase = getBrowserSupabase();
  const { data } = (await supabase?.from("profiles").select("display_name").eq("id", user.id).maybeSingle()) ?? { data: null };
  const metaName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "";
  return { id: user.id, anonymous: user.is_anonymous ?? false, name: data?.display_name ?? metaName };
}

function readableAuthError(message: string): string {
  return /provider is not enabled|unsupported provider/i.test(message) ? t("auth.googleUnavailable") : t("auth.error", { message });
}

/**
 * First visit and home menu (docs/01 §7): nickname → anonymous sign-in → menu; optional Google linking that keeps the
 * same user id (docs/04 §1). Solo play never needs an account.
 */
export function HomeScreen() {
  const configured = isSupabaseConfigured();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(!configured);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const authError = new URLSearchParams(window.location.search).get("auth_error");
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
    void supabase.auth.getUser().then(({ data }) => {
      refresh(data.user);
      if (authError && alive) setError(readableAuthError(authError));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => refresh(session?.user ?? null));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(readableAuthError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const signUp = () =>
    run(async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const display_name = name.trim();
      const { data, error: err } = await supabase.auth.signInAnonymously({ options: { data: { display_name } } });
      if (err) throw err;
      if (data.user) setMe(await loadMe(data.user));
    });

  const saveName = () =>
    run(async () => {
      const supabase = getBrowserSupabase();
      if (!supabase || !me) return;
      const display_name = name.trim();
      // RLS lets a user update only their own profile row (docs/04 profiles_update).
      const { error: err } = await supabase.from("profiles").update({ display_name, updated_at: new Date().toISOString() }).eq("id", me.id);
      if (err) throw err;
      await supabase.auth.updateUser({ data: { display_name } });
      setMe({ ...me, name: display_name });
      setEditing(false);
    });

  const google = (mode: "link" | "signIn") =>
    run(async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const redirectTo = `${window.location.origin}/auth/callback`;
      // Linking keeps the anonymous user's id (and everything tied to it); signing in switches to the Google account.
      const { error: err } =
        mode === "link"
          ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
          : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (err) throw err;
    });

  const signOut = () =>
    run(async () => {
      await getBrowserSupabase()?.auth.signOut();
      setMe(null);
    });

  const soloLinks = (
    <div className="flex flex-col gap-2">
      <Link href="/play/solo" data-testid="menu-solo" className="rounded bg-amber-500 px-4 py-2 text-center font-semibold text-stone-950 hover:bg-amber-400">
        {t("home.playSolo")}
      </Link>
      <Link href="/dev/table" className="text-center text-xs text-amber-300 underline">
        {t("home.playDebug")}
      </Link>
    </div>
  );

  if (!configured) {
    return (
      <div className="w-full max-w-sm space-y-4" data-testid="home-offline">
        <p className="text-sm text-amber-300">{t("auth.offline")}</p>
        {soloLinks}
      </div>
    );
  }
  if (!ready) return <div className="h-40" aria-busy="true" />;

  if (!me) {
    return (
      <form
        data-testid="nickname-form"
        className="w-full max-w-sm space-y-3 rounded-xl border border-amber-700 bg-stone-900/80 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (validName(name)) void signUp();
        }}
      >
        <label className="block text-sm">
          {t("auth.welcome")}
          <input
            data-testid="nickname-input"
            className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="text-xs text-stone-400">{t("auth.nicknameHint")}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          data-testid="nickname-submit"
          disabled={busy || !validName(name)}
          className="w-full rounded bg-amber-500 px-3 py-2 font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {t("auth.start")}
        </button>
        <button type="button" onClick={() => void google("signIn")} disabled={busy} className="w-full text-xs text-amber-300 underline">
          {t("auth.signInGoogle")}
        </button>
        <div className="border-t border-stone-700 pt-3">{soloLinks}</div>
      </form>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-amber-700 bg-stone-900/80 p-5" data-testid="home-menu">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (validName(name)) void saveName();
          }}
        >
          <input
            data-testid="rename-input"
            className="flex-1 rounded border border-stone-600 bg-stone-800 px-2 py-1"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" data-testid="rename-save" disabled={busy || !validName(name)} className="rounded bg-amber-500 px-3 font-semibold text-stone-950 disabled:opacity-40">
            {t("auth.save")}
          </button>
          <Button onClick={() => setEditing(false)}>{t("auth.cancel")}</Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-lg font-bold" data-testid="hello">
              {t("auth.hello", { name: me.name })}
            </p>
            <p className="text-xs text-stone-400">{me.anonymous ? t("auth.anonymous") : t("auth.linked")}</p>
          </div>
          <Button
            testId="rename"
            onClick={() => {
              setName(me.name);
              setEditing(true);
            }}
          >
            {t("auth.editName")}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {soloLinks}

      <div className="grid grid-cols-2 gap-2">
        <Button disabled title={t("home.comingPhase", { n: 10 })}>
          {t("home.createRoom")}
        </Button>
        <Button disabled title={t("home.comingPhase", { n: 10 })}>
          {t("home.joinRoom")}
        </Button>
      </div>

      {me.anonymous ? (
        <div className="space-y-1">
          <Button onClick={() => void google("link")} disabled={busy} testId="link-google">
            {t("auth.linkGoogle")}
          </Button>
          <p className="text-xs text-stone-400">{t("auth.linkGoogleHint")}</p>
        </div>
      ) : (
        <Button onClick={() => void signOut()} disabled={busy}>
          {t("auth.signOut")}
        </Button>
      )}
    </div>
  );
}
