"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "../i18n";

/** The SITE_PASSWORD form (docs/03 §6). The server sets an httpOnly cookie; nothing is stored in the page. */
export function GateForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(false);
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, next: params.get("next") ?? "/" }),
    });
    const body = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; next?: string };
    setBusy(false);
    if (res.ok && body.ok) window.location.assign(body.next ?? "/");
    else setError(true);
  };

  return (
    <form
      className="w-full max-w-sm space-y-3 rounded-xl border border-amber-700 bg-stone-900 p-6 shadow-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-xl font-bold text-amber-400">{t("gate.title")}</h1>
      <p className="text-sm text-amber-100">{t("gate.prompt")}</p>
      <label className="block text-sm">
        {t("gate.password")}
        <input
          type="password"
          data-testid="gate-password"
          autoComplete="current-password"
          className="mt-1 w-full rounded border border-stone-600 bg-stone-800 px-2 py-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-400">{t("gate.wrong")}</p>}
      <button
        type="submit"
        data-testid="gate-submit"
        disabled={busy || password.length === 0}
        className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-40"
      >
        {t("gate.enter")}
      </button>
    </form>
  );
}
