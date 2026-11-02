"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { t } from "../i18n";
import { RoomActions } from "../rooms/RoomActions";
import { Button } from "../table/Button";
import { NicknameForm } from "./NicknameForm";
import { NAME_MAX, readableAuthError, startGoogle, useMe, validName } from "./useMe";

/**
 * First visit and home menu (docs/01 §7): nickname → anonymous sign-in → menu; optional Google linking that keeps the
 * same user id (docs/04 §1). Solo play never needs an account.
 */
export function HomeScreen() {
  const { configured, ready, me, setMe } = useMe();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the OAuth return URL
    if (authError) setError(readableAuthError(authError));
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

  const google = (mode: "link" | "signIn") => run(() => startGoogle(mode));

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

  if (!me) return <NicknameForm onSignedIn={setMe} footer={soloLinks} initialError={error} />;

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

      <RoomActions />

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
