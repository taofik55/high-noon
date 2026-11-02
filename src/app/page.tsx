import { GAME_TITLE } from "@/config/game";
import { t } from "@/ui/i18n";
import { HomeScreen } from "@/ui/auth/HomeScreen";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-amber-950 p-8 text-amber-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-widest uppercase">{GAME_TITLE}</h1>
        <p className="mt-2 text-lg text-amber-200">{t("home.tagline")}</p>
      </div>
      <HomeScreen />
    </main>
  );
}
