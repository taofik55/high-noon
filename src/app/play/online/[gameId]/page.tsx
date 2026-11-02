import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/ui/i18n";
import { OnlineGamePlaceholder } from "@/ui/online/OnlineGamePlaceholder";

export const metadata: Metadata = { title: t("online.title") };

export default function OnlineGamePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-amber-950 p-6 text-amber-50">
      <Suspense>
        <OnlineGamePlaceholder />
      </Suspense>
    </main>
  );
}
