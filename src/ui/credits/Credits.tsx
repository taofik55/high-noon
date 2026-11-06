import { GAME_TITLE } from "@/config/game";
import { t } from "../i18n";

/** Credits (see CREDITS.md): shown on /credits and from the in-game sound menu. */
export function Credits() {
  return (
    <div data-testid="credits" className="space-y-3 text-sm leading-relaxed text-amber-50">
      <h2 className="text-2xl font-bold tracking-widest text-amber-400 uppercase">{GAME_TITLE}</h2>
      <p>{t("credits.body")}</p>
      <p className="text-stone-300">{t("credits.rules")}</p>
      <p className="text-stone-400">{t("credits.tech")}</p>
    </div>
  );
}
