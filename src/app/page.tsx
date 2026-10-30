import Link from "next/link";
import { GAME_TITLE } from "@/config/game";
import { t } from "@/ui/i18n";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-amber-950 p-8 text-amber-50">
      <h1 className="text-6xl font-bold tracking-widest uppercase">{GAME_TITLE}</h1>
      <p className="text-lg text-amber-200">{t("home.tagline")}</p>
      <p className="text-sm text-amber-400/80">{t("home.comingSoon")}</p>
      <Link href="/dev/table" className="rounded bg-amber-500 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-400">
        {t("home.playDebug")}
      </Link>
    </main>
  );
}
