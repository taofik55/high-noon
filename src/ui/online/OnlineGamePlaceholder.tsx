"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CHARACTERS, type CharacterId, type PlayerView } from "@/engine";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { t } from "../i18n";

type Loaded = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; view: PlayerView };

/**
 * /play/online/[gameId] until Phase 11 brings the shared 3D table: proves the start produced this user's redacted
 * view (own role, Sheriff public, nobody else's) by reading only the own player_views row through RLS.
 */
export function OnlineGamePlaceholder() {
  const { gameId } = useParams<{ gameId: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !gameId) return;
    let alive = true;
    void supabase
      .from("player_views")
      .select("view")
      .eq("game_id", gameId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        // Views are written only by the server from toPlayerView (docs/04 commit_game_action).
        setLoaded(data ? { kind: "ready", view: data.view as unknown as PlayerView } : { kind: "missing" });
      });
    return () => {
      alive = false;
    };
  }, [gameId]);

  const characterName = (id: CharacterId | null) => (id ? CHARACTERS[id].name : t("online.choosing"));

  if (loaded.kind === "loading") return <p aria-busy="true">{t("online.loading")}</p>;
  if (loaded.kind === "missing") {
    return (
      <div className="space-y-2 text-center" data-testid="online-missing">
        <p>{t("online.notFound")}</p>
        <Link href="/" className="text-sm text-amber-300 underline">
          {t("lobby.backHome")}
        </Link>
      </div>
    );
  }

  const { view } = loaded;
  const me = view.players.find((p) => p.seat === view.viewer);
  return (
    <div className="w-full max-w-lg space-y-4 rounded-xl border border-amber-700 bg-stone-900/80 p-5" data-testid="online-game">
      <h1 className="text-2xl font-bold">{t("online.title")}</h1>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-stone-400">{t("online.yourRole")}</dt>
        <dd className="font-bold text-amber-300" data-testid="online-role">
          {view.myRole ? t(`role.${view.myRole}`) : t("role.hidden")}
        </dd>
        <dt className="text-stone-400">{t("online.yourCharacter")}</dt>
        <dd className="font-bold" data-testid="online-character">
          {characterName(me?.characterId ?? null)}
        </dd>
      </dl>
      <section>
        <h2 className="mb-1 text-sm font-bold text-amber-300">{t("online.seats")}</h2>
        <ol className="space-y-1">
          {view.players.map((p) => (
            <li key={p.seat} data-testid={`online-seat-${p.seat}`} className="flex justify-between rounded bg-stone-800/70 px-2 py-1 text-sm">
              <span>
                {p.seat + 1}. {p.name}
                {p.seat === view.viewer && <span className="ml-1 text-xs text-stone-400">({t("lobby.you")})</span>}
                {p.isNpc && <span className="ml-1 text-xs text-sky-400">{t("lobby.bot")}</span>}
              </span>
              <span className="text-stone-300">
                {characterName(p.characterId)} · {p.role ? t(`role.${p.role}`) : t("role.hidden")}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-xs text-stone-400">{t("online.comingPhase")}</p>
      <Link href="/" className="text-sm text-amber-300 underline">
        {t("lobby.backHome")}
      </Link>
    </div>
  );
}
