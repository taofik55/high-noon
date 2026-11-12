"use client";

import { useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { t } from "../i18n";
import { GOOGLE_AUTH } from "@/config/game";
import { loadMe, NAME_MAX, readableAuthError, startGoogle, validName, type Me } from "./useMe";

interface NicknameFormProps {
  onSignedIn: (me: Me) => void;
  /** Where Google sign-in should come back to. */
  next?: string;
  footer?: ReactNode;
  initialError?: string | null;
}

/** First visit (docs/01 §7): a nickname creates an anonymous account; Google sign-in is the alternative. */
export function NicknameForm({ onSignedIn, next = "/", footer, initialError = null }: NicknameFormProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

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
      if (data.user) onSignedIn(await loadMe(data.user));
    });

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
      {GOOGLE_AUTH && (
        <button type="button" onClick={() => void run(() => startGoogle("signIn", next))} disabled={busy} className="w-full text-xs text-amber-300 underline">
          {t("auth.signInGoogle")}
        </button>
      )}
      {footer && <div className="border-t border-stone-700 pt-3">{footer}</div>}
    </form>
  );
}
