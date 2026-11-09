import Link from "next/link";
import { GAME_TITLE } from "@/config/game";
import { Msg } from "@/ui/i18n/Msg";
import { HomeScreen } from "@/ui/auth/HomeScreen";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-amber-950 p-8 text-amber-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-widest uppercase">{GAME_TITLE}</h1>
        <p className="mt-2 text-lg text-amber-200"><Msg k="home.tagline" /></p>
      </div>
      <HomeScreen />
      <div className="flex gap-4 text-sm">
        <Link href="/settings" data-testid="link-settings" className="text-amber-300 underline">
          <Msg k="settings.title" />
        </Link>
        <Link href="/credits" data-testid="link-credits" className="text-amber-300 underline">
          <Msg k="credits.title" />
        </Link>
      </div>
    </main>
  );
}
