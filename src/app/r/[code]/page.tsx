import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/ui/i18n";
import { LobbyScreen } from "@/ui/lobby/LobbyScreen";

export const metadata: Metadata = { title: t("lobby.title", { code: "" }).trim() };

export default function LobbyPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-amber-950 p-6 text-amber-50">
      {/* The room code is read on the client (useParams); with Cache Components it needs a Suspense boundary. */}
      <Suspense>
        <LobbyScreen />
      </Suspense>
    </main>
  );
}
